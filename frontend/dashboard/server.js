import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect natively to the shared MongoDB database independently 
//const MONGO_URI = 'mongodb+srv://janindumuthunayaka:janindumuthunayaka@clusteriotbda.oj7twy4.mongodb.net/coldchain_logistics';
const MONGO_URI = 'mongodb://janindumuthunayaka:janindumuthunayaka@ac-hlhiljp-shard-00-00.oj7twy4.mongodb.net:27017,ac-hlhiljp-shard-00-01.oj7twy4.mongodb.net:27017,ac-hlhiljp-shard-00-02.oj7twy4.mongodb.net:27017/coldchain_logistics?ssl=true&replicaSet=atlas-ingym5-shard-0&authSource=admin&appName=ClusterIOTBDA';
mongoose.connect(MONGO_URI)
    .then(() => console.log('[Dashboard API] Connected securely to MongoDB.'))
    .catch(err => console.error('[Dashboard API] Connection Error:', err));

// Dynamically read from the collections
const tripSchema = new mongoose.Schema({}, { strict: false, collection: 'trips' });
const sensorReadingSchema = new mongoose.Schema({}, { strict: false, collection: 'sensordatas' });

const Trip = mongoose.model('Trip', tripSchema);
const SensorData = mongoose.model('SensorData', sensorReadingSchema);

// Setup Express Layer exclusively for Dashboard
const app = express();
app.use(cors());
app.use(express.json());

const CHATBOT_DIR = path.join(__dirname, 'src', 'components', 'qa-inspector', 'Chatbot');

// Fetch all trips for main table UI
app.get('/api/trips', async (req, res) => {
    try {
        const trips = await Trip.find().sort({ timestamp: -1 });
        res.json(trips);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Fetch exact trip and its historical sensor graph arrays
app.get('/api/trips/:trip_id/sensors', async (req, res) => {
    try {
        const trip = await Trip.findOne({ trip_id: req.params.trip_id });
        const sensorData = await SensorData.findOne({ trip_id: req.params.trip_id });
        res.json({ trip, sensorData });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Chatbot Storage API ---

app.get('/api/chatbot/persona', (req, res) => {
    try {
        const filePath = path.join(CHATBOT_DIR, 'Persona.txt');
        const content = fs.readFileSync(filePath, 'utf-8');
        res.json({ content });
    } catch (err) {
        res.status(500).json({ error: 'Failed to read Persona.txt: ' + err.message });
    }
});

app.get('/api/chatbot/pretext', (req, res) => {
    try {
        const filePath = path.join(CHATBOT_DIR, 'Pretext.txt');
        const content = fs.readFileSync(filePath, 'utf-8');
        res.json({ content });
    } catch (err) {
        res.status(500).json({ error: 'Failed to read Pretext.txt: ' + err.message });
    }
});

app.post('/api/chatbot/pretext', (req, res) => {
    try {
        const { content } = req.body;
        const filePath = path.join(CHATBOT_DIR, 'Pretext.txt');
        fs.writeFileSync(filePath, content, 'utf-8');
        res.json({ success: true, message: 'Pretext updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to write Pretext.txt: ' + err.message });
    }
});

app.listen(3001, () => {
    console.log("🌐 Standalone Frontend API running on http://localhost:3001");
});
