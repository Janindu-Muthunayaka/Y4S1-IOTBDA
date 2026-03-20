const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// Connect natively to the shared MongoDB database independently 
const MONGO_URI = 'mongodb+srv://janindumuthunayaka:janindumuthunayaka@clusteriotbda.oj7twy4.mongodb.net/coldchain_logistics';
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

app.listen(3001, () => {
    console.log("🌐 Standalone Frontend API running on http://localhost:3001");
});
