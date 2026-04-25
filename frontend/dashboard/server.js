import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

// ─── Environment & Paths ─────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGO_URI = 'mongodb://janindumuthunayaka:janindumuthunayaka@ac-hlhiljp-shard-00-00.oj7twy4.mongodb.net:27017,ac-hlhiljp-shard-00-01.oj7twy4.mongodb.net:27017,ac-hlhiljp-shard-00-02.oj7twy4.mongodb.net:27017/coldchain_logistics?ssl=true&replicaSet=atlas-ingym5-shard-0&authSource=admin&appName=ClusterIOTBDA';
const CHATBOT_BASE = path.join(__dirname, 'src', 'components');

// ─── Mongoose Models ─────────────────────────────────────────────────────────
const tripSchema = new mongoose.Schema({}, { strict: false, collection: 'trips' });
const sensorReadingSchema = new mongoose.Schema({}, { strict: false, collection: 'sensordatas' });

const Trip = mongoose.model('Trip', tripSchema);
const SensorData = mongoose.model('SensorData', sensorReadingSchema);

// ─── Express & Socket.IO Setup ───────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getChatbotConfig = (role) => {
    switch (role) {
        case 'retailer': 
            return { dir: path.join(CHATBOT_BASE, 'retailer', 'Retail_Chatbot'), prefix: 'Retail_' };
        case 'owner': 
            return { dir: path.join(CHATBOT_BASE, 'owner', 'Owner_Chatbot'), prefix: 'Owner_' };
        case 'driver': 
            return { dir: path.join(CHATBOT_BASE, 'driver', 'Driver_Chatbot'), prefix: 'Driver_' };
        case 'qa': 
        default: 
            return { dir: path.join(CHATBOT_BASE, 'qa-inspector', 'Chatbot'), prefix: '' };
    }
};

async function buildFullPayload() {
    try {
        const trips = await Trip.find().sort({ timestamp: -1 }).lean();
        const allSensors = await SensorData.find({
            trip_id: { $in: trips.map(t => t.trip_id) }
        }).lean();

        const sensorMap = {};
        allSensors.forEach(s => { sensorMap[s.trip_id] = s; });

        // Build payload for batch prediction
        const mlPayload = trips.map(trip => {
            const sensorData = sensorMap[trip.trip_id] || {};
            let durationMinutes = 165;
            if (trip.timestamp && sensorData.last_updated) {
                const start = new Date(trip.timestamp);
                const end = new Date(sensorData.last_updated);
                if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                    durationMinutes = (end - start) / 60000;
                }
            }
            return { trip, sensorData, duration_minutes: durationMinutes };
        });

        // Execute ML script asynchronously
        const pythonScriptPath = path.join(__dirname, 'QualityScore', 'predict_quality.py');
        const pythonProcess = spawn('python', [pythonScriptPath]);
        
        let dataString = '';
        pythonProcess.stdout.on('data', (data) => dataString += data.toString());
        
        const mlScores = await new Promise((resolve) => {
            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    resolve({});
                } else {
                    try {
                        const lines = dataString.trim().split('\n');
                        const result = JSON.parse(lines[lines.length - 1]);
                        if (result.success && result.scores) {
                            resolve(result.scores);
                        } else {
                            resolve({});
                        }
                    } catch (e) {
                        resolve({});
                    }
                }
            });
            pythonProcess.stdin.write(JSON.stringify(mlPayload));
            pythonProcess.stdin.end();
        });

        // Inject ML scores into sensorMap for frontend consumption
        Object.keys(mlScores).forEach(tripId => {
            if (sensorMap[tripId]) {
                sensorMap[tripId].ml_quality = mlScores[tripId];
            } else {
                sensorMap[tripId] = { ml_quality: mlScores[tripId] };
            }
        });

        return { trips, sensorMap };
    } catch (err) {
        console.error('[Server] Error building payload:', err.message);
        return null;
    }
}

// ─── Socket.IO Logic ─────────────────────────────────────────────────────────

io.on('connection', async (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    const payload = await buildFullPayload();
    if (payload) {
        socket.emit('data:full', payload);
        console.log(`[Socket.io] Sent initial payload to ${socket.id} (${payload.trips.length} trips)`);
    }

    socket.on('disconnect', () => {
        console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
});

// ─── MongoDB Change Streams ──────────────────────────────────────────────────

async function startChangeStreams() {
    try {
        // Watch trips collection
        const tripStream = Trip.watch([], { fullDocument: 'updateLookup' });
        tripStream.on('change', async (change) => {
            const type = change.operationType;
            if (['insert', 'update', 'replace'].includes(type)) {
                console.log(`[ChangeStream] Trip ${type} detected → pushing update`);
                const payload = await buildFullPayload();
                if (payload) io.emit('data:full', payload);
            }
        });
        tripStream.on('error', (err) => console.error('[ChangeStream] Trip stream error:', err.message));

        // Watch sensordatas collection
        const sensorStream = SensorData.watch([], { fullDocument: 'updateLookup' });
        sensorStream.on('change', async (change) => {
            const type = change.operationType;
            if (['insert', 'update', 'replace'].includes(type)) {
                const tripId = change.fullDocument?.trip_id || 'unknown';
                console.log(`[ChangeStream] Sensor ${type} for trip ${tripId} → pushing update`);
                const payload = await buildFullPayload();
                if (payload) io.emit('data:full', payload);
            }
        });
        sensorStream.on('error', (err) => console.error('[ChangeStream] Sensor stream error:', err.message));

        console.log('[ChangeStream] ✅ Watching MongoDB collections for changes');
    } catch (err) {
        console.error('[ChangeStream] Failed to start change streams:', err.message);
    }
}

// ─── REST API Endpoints ───────────────────────────────────────────────────────

// 1. Trip Data
app.get('/api/trips', async (req, res) => {
    try {
        const trips = await Trip.find().sort({ timestamp: -1 });
        res.json(trips);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/trips/:trip_id/sensors', async (req, res) => {
    try {
        const trip = await Trip.findOne({ trip_id: req.params.trip_id });
        const sensorData = await SensorData.findOne({ trip_id: req.params.trip_id });
        res.json({ trip, sensorData });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/dashboard/full', async (req, res) => {
    try {
        const payload = await buildFullPayload();
        if (!payload) return res.status(500).json({ error: 'Failed to build payload' });
        res.json(payload);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. ML Quality Score Pipeline
app.get('/api/quality-score/:trip_id', async (req, res) => {
    try {
        const trip = await Trip.findOne({ trip_id: req.params.trip_id });
        const sensorData = await SensorData.findOne({ trip_id: req.params.trip_id });
        
        if (!trip || !sensorData) {
            return res.status(404).json({ error: 'Trip or SensorData not found' });
        }

        let durationMinutes = 165; // fallback
        if (trip.timestamp && sensorData.last_updated) {
            const start = new Date(trip.timestamp);
            const end = new Date(sensorData.last_updated);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                durationMinutes = (end - start) / 60000;
            }
        }

        const payload = JSON.stringify({
            trip: trip,
            sensorData: sensorData,
            duration_minutes: durationMinutes
        });

        const pythonScriptPath = path.join(__dirname, 'QualityScore', 'predict_quality.py');
        const pythonProcess = spawn('python', [pythonScriptPath]);

        let dataString = '';
        let errorString = '';

        pythonProcess.stdout.on('data', (data) => dataString += data.toString());
        pythonProcess.stderr.on('data', (data) => errorString += data.toString());

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.error(`Python script error (code ${code}): ${errorString}`);
                return res.status(500).json({ error: 'Failed to calculate quality score' });
            }
            try {
                const lines = dataString.trim().split('\n');
                const result = JSON.parse(lines[lines.length - 1]);
                res.json(result);
            } catch (err) {
                res.status(500).json({ error: 'Invalid ML model output' });
            }
        });

        pythonProcess.stdin.write(payload);
        pythonProcess.stdin.end();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Chatbot Storage API
app.get('/api/chatbot/:role/persona', (req, res) => {
    const config = getChatbotConfig(req.params.role);
    const filePath = path.join(config.dir, `${config.prefix}Persona.txt`);
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        res.json({ content });
    } catch (err) {
        res.status(500).json({ error: `Failed to read persona: ${err.message}` });
    }
});

app.get('/api/chatbot/:role/pretext', (req, res) => {
    const config = getChatbotConfig(req.params.role);
    const filePath = path.join(config.dir, `${config.prefix}Pretext.txt`);
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        res.json({ content });
    } catch (err) {
        res.status(500).json({ error: `Failed to read pretext: ${err.message}` });
    }
});

app.post('/api/chatbot/:role/pretext', (req, res) => {
    const config = getChatbotConfig(req.params.role);
    const filePath = path.join(config.dir, `${config.prefix}Pretext.txt`);
    try {
        const { content } = req.body;
        if (!fs.existsSync(config.dir)) fs.mkdirSync(config.dir, { recursive: true });
        fs.writeFileSync(filePath, content, 'utf-8');
        res.json({ success: true, message: 'Pretext updated successfully' });
    } catch (err) {
        res.status(500).json({ error: `Failed to write pretext: ${err.message}` });
    }
});

// Legacy chatbot routes for compatibility
app.get('/api/chatbot/persona', (req, res) => res.redirect('/api/chatbot/qa/persona'));
app.get('/api/chatbot/pretext', (req, res) => res.redirect('/api/chatbot/qa/pretext'));
app.post('/api/chatbot/pretext', (req, res) => {
    req.url = '/api/chatbot/qa/pretext';
    app.handle(req, res);
});

// ─── Server Startup ───────────────────────────────────────────────────────────

mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log('[Dashboard API] ✅ Connected to MongoDB Atlas');
        await startChangeStreams();  // Start real-time watchers AFTER connection
    })
    .catch(err => console.error('[Dashboard API] ❌ MongoDB Connection Error:', err));

httpServer.listen(3001, () => {
    console.log('🌐 Dashboard API + Socket.io server running on http://localhost:3001');
    console.log('📡 Real-time WebSocket endpoint: ws://localhost:3001');
});
