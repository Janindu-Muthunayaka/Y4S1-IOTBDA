const mqtt = require('mqtt');
const { startTrip, endTrip, updateSensorData } = require('./dbLogic');

// Connect to HiveMQ Public Broker
const client = mqtt.connect('mqtt://broker.hivemq.com');

client.on('connect', () => {
    console.log('[TruckProcessor] Connected to MQTT broker');

    // Subscribe to Truck Topic
    client.subscribe('IOTBDATruckOne', (err) => {
        if (err) console.error('[TruckProcessor] Subscription error:', err);
        else console.log('[TruckProcessor] Subscribed to IOTBDATruckOne');
    });
});

client.on('message', async (topic, message) => {
    try {
        const payload = JSON.parse(message.toString());
        console.log(`[TruckProcessor] Received message on ${topic}:`, payload);

        // Process message dynamically based on its source intent
        switch (payload.type) {
            case 'trip_start':
                await startTrip(payload.truck_id);
                break;
            case 'trip_end':
                await endTrip(payload.truck_id);
                break;
            case 'sensor_data':
                await updateSensorData(
                    payload.truck_id,
                    payload.temperature,
                    payload.motion
                );
                break;
            default:
                console.log(`[TruckProcessor] Ignored unknown payload type: ${payload.type}`);
        }
    } catch (error) {
        console.error('[TruckProcessor] Error processing MQTT message:', error.message);
    }
});
