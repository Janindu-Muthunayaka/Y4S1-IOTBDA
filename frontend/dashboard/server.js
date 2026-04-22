import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── MongoDB Connection ───────────────────────────────────────────────────────
const MONGO_URI = 'mongodb://janindumuthunayaka:janindumuthunayaka@ac-hlhiljp-shard-00-00.oj7twy4.mongodb.net:27017,ac-hlhiljp-shard-00-01.oj7twy4.mongodb.net:27017,ac-hlhiljp-shard-00-02.oj7twy4.mongodb.net:27017/coldchain_logistics?ssl=true&replicaSet=atlas-ingym5-shard-0&authSource=admin&appName=ClusterIOTBDA';

// ─── Mongoose Schemas ─────────────────────────────────────────────────────────
const tripSchema = new mongoose.Schema({}, { strict: false, collection: 'trips' });
const sensorReadingSchema = new mongoose.Schema({}, { strict: false, collection: 'sensordatas' });

const Trip = mongoose.model('Trip', tripSchema);
const SensorData = mongoose.model('SensorData', sensorReadingSchema);

// ─── Express + HTTP Server + Socket.IO Setup ──────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
    cors: {
        origin: '*',  // Allow all origins (Vite dev server)
        methods: ['GET', 'POST']
    }
});

// ─── Chatbot Config Helper ───────────────────────────────────────────────────
const CHATBOT_BASE = path.join(__dirname, 'src', 'components');

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

// ─── Helper: Build Full Payload for All Connected Clients ─────────────────────
async function buildFullPayload() {
    try {
        const trips = await Trip.find().sort({ timestamp: -1 }).lean();

        // Build sensor map: { trip_id: sensorData }
        const allSensors = await SensorData.find({
            trip_id: { $in: trips.map(t => t.trip_id) }
        }).lean();

        const sensorMap = {};
        allSensors.forEach(s => { sensorMap[s.trip_id] = s; });

        return { trips, sensorMap };
    } catch (err) {
        console.error('[Server] Error building payload:', err.message);
        return null;
    }
}

// ─── Socket.io: Client Connection Handler ────────────────────────────────────
io.on('connection', async (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    // Send full data immediately on connect
    const payload = await buildFullPayload();
    if (payload) {
        socket.emit('data:full', payload);
        console.log(`[Socket.io] Sent initial payload to ${socket.id} (${payload.trips.length} trips)`);
    }

    socket.on('disconnect', () => {
        console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
});

// ─── MongoDB Change Streams: Watch for Real-Time DB Changes ──────────────────
async function startChangeStreams() {
    try {
        // Watch trips collection
        const tripStream = Trip.watch([], { fullDocument: 'updateLookup' });
        tripStream.on('change', async (change) => {
            const type = change.operationType;
            if (['insert', 'update', 'replace'].includes(type)) {
                console.log(`[ChangeStream] Trip ${type} detected → pushing to ${io.engine.clientsCount} client(s)`);
                const payload = await buildFullPayload();
                if (payload) io.emit('data:full', payload);
            }
        });
        tripStream.on('error', (err) => {
            console.error('[ChangeStream] Trip stream error:', err.message);
        });
        console.log('[ChangeStream] ✅ Watching trips collection');

        // Watch sensordatas collection
        const sensorStream = SensorData.watch([], { fullDocument: 'updateLookup' });
        sensorStream.on('change', async (change) => {
            const type = change.operationType;
            if (['insert', 'update', 'replace'].includes(type)) {
                const tripId = change.fullDocument?.trip_id || 'unknown';
                console.log(`[ChangeStream] Sensor ${type} for trip ${tripId} → pushing to ${io.engine.clientsCount} client(s)`);
                const payload = await buildFullPayload();
                if (payload) io.emit('data:full', payload);
            }
        });
        sensorStream.on('error', (err) => {
            console.error('[ChangeStream] Sensor stream error:', err.message);
        });
        console.log('[ChangeStream] ✅ Watching sensordatas collection');

    } catch (err) {
        console.error('[ChangeStream] Failed to start change streams:', err.message);
        console.warn('[ChangeStream] ⚠️  Change streams not available — dashboard will use polling fallback.');
    }
}

// ─── REST API Endpoints ───────────────────────────────────────────────────────

// All trips
app.get('/api/trips', async (req, res) => {
    try {
        const trips = await Trip.find().sort({ timestamp: -1 });
        res.json(trips);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// One trip + its sensor data
app.get('/api/trips/:trip_id/sensors', async (req, res) => {
    try {
        const trip = await Trip.findOne({ trip_id: req.params.trip_id });
        const sensorData = await SensorData.findOne({ trip_id: req.params.trip_id });
        res.json({ trip, sensorData });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

<<<<<<< HEAD
// --- ML Pipeline Endpoint ---
app.get('/api/quality-score/:trip_id', async (req, res) => {
    try {
        const trip = await Trip.findOne({ trip_id: req.params.trip_id });
        const sensorData = await SensorData.findOne({ trip_id: req.params.trip_id });
        
        if (!trip || !sensorData) {
            return res.status(404).json({ error: 'Trip or SensorData not found' });
        }

        // Calculate duration in minutes if timestamps are available
        let durationMinutes = 165; // default fallback
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
        
        // Spawn Python process
        const pythonProcess = spawn('python', [pythonScriptPath]);

        let dataString = '';
        let errorString = '';

        pythonProcess.stdout.on('data', (data) => {
            dataString += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorString += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.error(`Python script exited with code ${code}. Error: ${errorString}`);
                return res.status(500).json({ error: 'Failed to calculate quality score' });
            }
            
            try {
                // Find the JSON block from stdout (in case python prints other warnings before JSON)
                const lines = dataString.trim().split('\n');
                const jsonOutput = lines[lines.length - 1];
                const result = JSON.parse(jsonOutput);
                res.json(result);
            } catch (err) {
                console.error('Failed to parse Python output:', dataString);
                res.status(500).json({ error: 'Invalid output from ML model pipeline' });
            }
        });

        // Write the payload to python stdin and close it
        pythonProcess.stdin.write(payload);
        pythonProcess.stdin.end();

=======
// Full payload endpoint (for polling fallback)
app.get('/api/dashboard/full', async (req, res) => {
    try {
        const payload = await buildFullPayload();
        if (!payload) return res.status(500).json({ error: 'Failed to build payload' });
        res.json(payload);
>>>>>>> 55e8d4764464e3e3143cddd38dc2d66d5e0ea631
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
<<<<<<< HEAD

// --- Chatbot Storage API ---
=======
>>>>>>> 55e8d4764464e3e3143cddd38dc2d66d5e0ea631

// ─── Chatbot Storage API ──────────────────────────────────────────────────────

// Legacy endpoints (backward compatibility)
app.get('/api/chatbot/persona', (req, res) => {
    const config = getChatbotConfig('qa');
    const filePath = path.join(config.dir, 'Persona.txt');
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        res.json({ content });
    } catch (err) {
        res.status(500).json({ error: 'Failed to read Persona.txt: ' + err.message });
    }
});

app.get('/api/chatbot/pretext', (req, res) => {
    const config = getChatbotConfig('qa');
    const filePath = path.join(config.dir, 'Pretext.txt');
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        res.json({ content });
    } catch (err) {
        res.status(500).json({ error: 'Failed to read Pretext.txt: ' + err.message });
    }
});

app.post('/api/chatbot/pretext', (req, res) => {
    const config = getChatbotConfig('qa');
    const filePath = path.join(config.dir, 'Pretext.txt');
    try {
        const { content } = req.body;
        fs.writeFileSync(filePath, content, 'utf-8');
        res.json({ success: true, message: 'Pretext updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to write Pretext.txt: ' + err.message });
    }
});

// Multi-role endpoints
app.get('/api/chatbot/:role/persona', (req, res) => {
    const config = getChatbotConfig(req.params.role);
    const filePath = path.join(config.dir, `${config.prefix}Persona.txt`);
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        res.json({ content });
    } catch (err) {
        res.status(500).json({ error: `Failed to read ${config.prefix}Persona.txt: ` + err.message });
    }
});

app.get('/api/chatbot/:role/pretext', (req, res) => {
    const config = getChatbotConfig(req.params.role);
    const filePath = path.join(config.dir, `${config.prefix}Pretext.txt`);
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        res.json({ content });
    } catch (err) {
        res.status(500).json({ error: `Failed to read ${config.prefix}Pretext.txt: ` + err.message });
    }
});

app.post('/api/chatbot/:role/pretext', (req, res) => {
    const config = getChatbotConfig(req.params.role);
    const filePath = path.join(config.dir, `${config.prefix}Pretext.txt`);
    try {
        const { content } = req.body;
        if (!fs.existsSync(config.dir)) {
            fs.mkdirSync(config.dir, { recursive: true });
        }
        fs.writeFileSync(filePath, content, 'utf-8');
        res.json({ success: true, message: `${config.prefix}Pretext updated successfully` });
    } catch (err) {
        res.status(500).json({ error: `Failed to write ${config.prefix}Pretext.txt: ` + err.message });
    }
});

// ─── Start Server ─────────────────────────────────────────────────────────────
mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log('[Dashboard API] ✅ Connected to MongoDB Atlas');
        await startChangeStreams();  // Start real-time watchers AFTER connection
    })
    .catch(err => console.error('[Dashboard API] MongoDB Connection Error:', err));

httpServer.listen(3001, () => {
    console.log('🌐 Dashboard API + Socket.io server running on http://localhost:3001');
    console.log('📡 Real-time WebSocket endpoint: ws://localhost:3001');
});
