const mongoose = require('mongoose');
const fetcher = require('./fetcher');

// --- DATABASE CONNECTION ---
// Update URI to match your local or MongoDB Atlas deployment
const MONGO_URI = 'mongodb+srv://janindumuthunayaka:janindumuthunayaka@clusteriotbda.oj7twy4.mongodb.net/coldchain_logistics';
mongoose.connect(MONGO_URI)
    .then(() => console.log('[Database] Connected securely to MongoDB.'))
    .catch(err => console.error('[Database] Connection Error:', err));

// --- MONGOOSE SCHEMAS ---

// 1. Trips Collection
const tripSchema = new mongoose.Schema({
    trip_id: String,
    truck_id: String,
    trip_direction: String, // removing enum to allow 'Complete' and 'TOBEDECLARED'
    timestamp: Date,
    weight: Number,
    status: { type: String, enum: ['ACTIVE', 'COMPLETED'] }
});

// 2. Sensor Readings Collection (Time-Series)
const sensorReadingSchema = new mongoose.Schema({
    trip_id: String,
    truck_id: String,
    start_time: Date,
    temperature_data: [{
        time: String,
        avg: Number,
        min: Number,
        max: Number
    }],
    motion_data: [{
        time: String,
        max_accel: Number,
        harsh_event: Boolean
    }],
    last_updated: Date
});

const Trip = mongoose.model('Trip', tripSchema);
const SensorData = mongoose.model('SensorData', sensorReadingSchema);

// --- BUSINESS LOGIC CONTROLLERS ---

/**
 * Triggered by Gate sensor verifying a truck checkout/checkin
 */
async function handleGateScan(truck_id, weight) {
    // Check if there is an active trip for this truck
    const activeTrip = await Trip.findOne({ truck_id, status: 'ACTIVE' });

    if (activeTrip) {
        // Second RFID trap: seal the data record
        // By changing status to COMPLETED, updateSensorData will ignore any further data for this trip
        activeTrip.status = 'COMPLETED';
        activeTrip.weight = weight;

        await activeTrip.save();
        console.log(`[DB] Active trip ${activeTrip.trip_id} for truck ${truck_id} sealed (marked as COMPLETED).`);

        // Clear the truck's latest data in fetcher to ensure next trip calculation starts fresh
        if (typeof fetcher.clearTruckData === 'function') {
            fetcher.clearTruckData(truck_id);
        }
    } else {
        // First RFID trap: Create a new record
        const trip_id = `TRIP_${Date.now()}`;
        const timestamp = new Date();

        // Direction logic: based on updated flow
        // OUTBOUND: Driver presses button to start data -> Scans gate to leave. (Data exists at gate scan)
        // INBOUND: Driver taps RFID to leave -> Scans gate. Data is sent later. (No data exists at first gate scan)
        let direction = "INBOUND";
        if (fetcher.getLatestTruckData(truck_id)) {
            direction = "OUTBOUND";
        }

        const newTrip = new Trip({
            trip_id,
            truck_id,
            trip_direction: direction,
            timestamp,
            weight,
            status: 'ACTIVE' // This makes the trip active so updateSensorData will save incoming data
        });

        await newTrip.save();
        console.log(`[DB] New ACTIVE Trip ${trip_id} recorded for ${truck_id} via gate scan. Direction: ${direction}`);

        // Create blank sensor data document for the newly started trip
        await SensorData.create({
            trip_id,
            truck_id,
            start_time: timestamp,
            temperature_data: [],
            motion_data: [],
            last_updated: timestamp
        });
        console.log(`[DB] Created blank sensor data document for ${trip_id}.`);
    }
}

/**
 * Triggered by Truck ESP32 start button press (Typically for INBOUND trips from retail)
 */
async function startTrip(truck_id) {
    const trip_id = `TRIP_${Date.now()}`;
    const timestamp = new Date();

    const newTrip = new Trip({
        trip_id,
        truck_id,
        trip_direction: "INBOUND",
        timestamp,
        weight: 0, // Inbound weight isn't known until they scan at the destination gate
        status: "ACTIVE"
    });
    await newTrip.save();

    await SensorData.create({
        trip_id,
        truck_id,
        start_time: timestamp,
        temperature_data: [],
        motion_data: [],
        last_updated: timestamp
    });

    console.log(`[DB] Trip ${trip_id} started manually by truck button for ${truck_id}.`);
}

/**
 * Triggered by Truck ESP32 end button press (Arrival at Retail destination)
 */
async function endTrip(truck_id) {
    // Find the currently active trip for this truck and conclude it
    const activeTrip = await Trip.findOne({ truck_id, status: 'ACTIVE' });
    if (activeTrip) {
        activeTrip.status = 'COMPLETED';
        await activeTrip.save();
        console.log(`[DB] Trip ${activeTrip.trip_id} manually ended via truck button.`);
    } else {
        console.log(`[DB] Could not find an ACTIVE trip to end for ${truck_id}.`);
    }
}

/**
 * Called every 3-minutes by the truck uploading environmental stats
 */
async function updateSensorData(truck_id, tempData, motionData) {
    const activeTrip = await Trip.findOne({ truck_id, status: 'ACTIVE' });
    if (!activeTrip) {
        console.log(`[DB] Sensor data ignored - no ACTIVE trip for ${truck_id}.`);
        return;
    }

    const sensorDoc = await SensorData.findOne({ trip_id: activeTrip.trip_id });
    if (sensorDoc) {
        const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        sensorDoc.temperature_data.push({
            time: timeStr,
            avg: tempData.avg,
            min: tempData.min,
            max: tempData.max
        });

        sensorDoc.motion_data.push({
            time: timeStr,
            max_accel: motionData.max_accel,
            harsh_event: motionData.harsh_event
        });

        sensorDoc.last_updated = new Date();
        await sensorDoc.save();

        console.log(`[DB] Logged 3-minute sensor pulse for trip ${activeTrip.trip_id}.`);
    }
}

/**
 * Returns all trips sorted by newest first
 */
async function getAllTrips() {
    return await Trip.find().sort({ timestamp: -1 });
}

/**
 * Returns specific trip details and its associated sensor data
 */
async function getTripSensorData(trip_id) {
    const trip = await Trip.findOne({ trip_id });
    const sensorData = await SensorData.findOne({ trip_id });
    return { trip, sensorData };
}

// Export functions for usage in processor files
module.exports = {
    handleGateScan,
    startTrip,
    endTrip,
    updateSensorData,
    getAllTrips,
    getTripSensorData
};
