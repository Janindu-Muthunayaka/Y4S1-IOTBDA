const fetcher = require('./fetcher');
const mongoose = require('mongoose');

// Connect to MongoDB using the same URI as the frontend dashboard
const MONGO_URI = 'mongodb://janindumuthunayaka:janindumuthunayaka@ac-hlhiljp-shard-00-00.oj7twy4.mongodb.net:27017,ac-hlhiljp-shard-00-01.oj7twy4.mongodb.net:27017,ac-hlhiljp-shard-00-02.oj7twy4.mongodb.net:27017/coldchain_logistics?ssl=true&replicaSet=atlas-ingym5-shard-0&authSource=admin&appName=ClusterIOTBDA';

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ [dbLogic] Connected to MongoDB Atlas'))
    .catch(err => console.error('❌ [dbLogic] MongoDB connection error:', err));

// Dynamic Schema (strict: false) just like in server.js
const tripSchema = new mongoose.Schema({}, { strict: false, collection: 'trips' });
const Trip = mongoose.model('Trip', tripSchema);

const sensorDataSchema = new mongoose.Schema({}, { strict: false, collection: 'sensordatas' });
const SensorData = mongoose.model('SensorData', sensorDataSchema);

// Helper function to update status and record the state change
async function updateTripStatus(tripDoc, newStatus) {
    if (tripDoc.status === newStatus) return tripDoc; // No change needed

    const updateTime = new Date();
    
    await Trip.updateOne(
        { _id: tripDoc._id },
        { 
            $set: { status: newStatus },
            $push: { stateChange: { status: newStatus, timestamp: updateTime } }
        }
    );

    // Update local object so subsequent code knows the new state
    tripDoc.status = newStatus;
    if (!tripDoc.stateChange) tripDoc.stateChange = [];
    tripDoc.stateChange.push({ status: newStatus, timestamp: updateTime });

    return tripDoc;
}

async function handleGateScan(truck_id, weight) {
    const activeTrip = await Trip.findOne({ truck_id, active: true }).sort({ timestamp: -1 });
    const event_type = activeTrip ? 'ENTRY' : 'EXIT';

    // Check if data was received in the last 5 seconds
    const timestamps = fetcher.getTruckTimestamps();
    const lastTime = timestamps[truck_id] || 0;
    const is_transmitting = (Date.now() - lastTime) <= 5000;

    console.log(`[GATE] Truck ${truck_id} ${event_type} - Transmitting: ${is_transmitting}`);

    if (event_type === 'EXIT') {
        // --- START NEW TRIP ---
        const trip_type = is_transmitting ? 'OUTGOING' : 'INCOMING';
        const initial_status = is_transmitting ? 'Out for Delivery' : 'Out to Pickup';

        // Generate a new unique trip identifier
        const new_trip_id = `TRIP-${truck_id}-${Date.now()}`;
        const startTime = new Date();

        const newTrip = new Trip({
            trip_id: new_trip_id,
            truck_id: truck_id,
            trip_type: trip_type,
            status: initial_status,
            active: true,
            timestamp: startTime, // Departure time
            startWeight: weight,
            stateChange: [{
                status: initial_status,
                timestamp: startTime
            }]
        });

        await newTrip.save();
        console.log(`[DB] Created new trip ${new_trip_id} with status: ${initial_status}`);
    }
    else if (event_type === 'ENTRY') {
        // --- END CURRENT TRIP ---
        const endTime = new Date();
        
        await Trip.updateOne(
            { _id: activeTrip._id },
            {
                $set: {
                    status: 'Complete',
                    active: false,
                    endTime: endTime,
                    endWeight: weight
                },
                $push: {
                    stateChange: { status: 'Complete', timestamp: endTime }
                }
            }
        );
        
        console.log(`[DB] Ended trip ${activeTrip.trip_id} at ${endTime}`);
    }
}

async function updateSensorData(truck_id, tempStats, motionStats) {
    const trip = await Trip.findOne({ truck_id, active: true }).sort({ timestamp: -1 });
    if (!trip) return;

    const latestData = fetcher.getLatestTruckData(truck_id) || {};
    // Since the hardware button directly controls data transmission, 
    // the mere fact that this function is called means the button is ON and data is flowing.

    // If this is an INCOMING trip and we just started receiving data, 
    // it means the driver arrived at the pickup location and pressed the button.
    if (trip.trip_type === 'INCOMING' && trip.status === 'Out to Pickup') {
        await updateTripStatus(trip, 'Reached pickup location and loading');
        console.log(`[DB] Trip ${trip.trip_id} status updated to: Reached pickup location and loading`);
    }

    // Because the truck only sends data when the button is ON,
    // any data received here should be recorded.
    const is_recording = true;

    if (is_recording) {
        const currentTime = new Date().toISOString();
        const updateDoc = {
            $setOnInsert: { truck_id: truck_id },
            $set: { last_updated: currentTime }
        };

        const pushDoc = {};
        
        if (tempStats && tempStats.avg !== undefined) {
            pushDoc.temperature_data = {
                time: currentTime,
                avg: tempStats.avg,
                min: tempStats.min,
                max: tempStats.max
            };
        }

        if (motionStats && motionStats.max_accel !== undefined) {
            pushDoc.motion_data = {
                time: currentTime,
                max_accel: motionStats.max_accel,
                harsh_event: motionStats.harsh_event
            };
        }

        if (Object.keys(pushDoc).length > 0) {
            updateDoc.$push = pushDoc;
        }

        await SensorData.updateOne(
            { trip_id: trip.trip_id },
            updateDoc,
            { upsert: true }
        );
    }
}

// Background task to monitor outgoing trips for data timeouts (simulating the button turning OFF)
setInterval(async () => {
    try {
        // Only look for active, outgoing trips that are currently 'Out for Delivery'
        const trips = await Trip.find({ 
            active: true, 
            trip_type: 'OUTGOING', 
            status: 'Out for Delivery' 
        });

        if (trips.length === 0) return;

        const timestamps = fetcher.getTruckTimestamps();
        const now = Date.now();

        for (const trip of trips) {
            const lastTime = timestamps[trip.truck_id] || 0;
            
            // If no data has been received in the last 5 seconds, it means the switch was turned OFF.
            if (now - lastTime > 5000) {
                await updateTripStatus(trip, 'Delivered and returning');
                console.log(`[DB] Trip ${trip.trip_id} stopped transmitting for >5s. Status updated to: Delivered and returning`);
            }
        }
    } catch (err) {
        console.error('❌ Error in background status checker:', err.message);
    }
}, 2000);

module.exports = {
    handleGateScan,
    updateSensorData
};
