import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

// Full payload endpoint (for polling fallback)
app.get('/api/dashboard/full', async (req, res) => {
    try {
        const payload = await buildFullPayload();
        if (!payload) return res.status(500).json({ error: 'Failed to build payload' });
        res.json(payload);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Chatbot Storage API ──────────────────────────────────────────────────────
const CHATBOT_DIR = path.join(__dirname, 'src', 'components', 'qa-inspector', 'Chatbot');

app.get('/api/chatbot/persona', (req, res) => {
    try {
        const content = fs.readFileSync(path.join(CHATBOT_DIR, 'Persona.txt'), 'utf-8');
        res.json({ content });
    } catch (err) {
        res.status(500).json({ error: 'Failed to read Persona.txt: ' + err.message });
    }
});

app.get('/api/chatbot/pretext', (req, res) => {
    try {
        const content = fs.readFileSync(path.join(CHATBOT_DIR, 'Pretext.txt'), 'utf-8');
        res.json({ content });
    } catch (err) {
        res.status(500).json({ error: 'Failed to read Pretext.txt: ' + err.message });
    }
});

app.post('/api/chatbot/pretext', (req, res) => {
    try {
        fs.writeFileSync(path.join(CHATBOT_DIR, 'Pretext.txt'), req.body.content, 'utf-8');
        res.json({ success: true, message: 'Pretext updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to write Pretext.txt: ' + err.message });
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
