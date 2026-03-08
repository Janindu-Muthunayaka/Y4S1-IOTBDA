const mqtt = require('mqtt');
const { handleGateScan } = require('./dbLogic');

// Connect to HiveMQ Public Broker
const client = mqtt.connect('mqtt://broker.hivemq.com');

client.on('connect', () => {
    console.log('[GateProcessor] Connected to MQTT broker');
    
    // Subscribe to Gate Topic
    client.subscribe('IOTBDAGateOne', (err) => {
        if (err) console.error('[GateProcessor] Subscription error:', err);
        else console.log('[GateProcessor] Subscribed to IOTBDAGateOne');
    });
});

client.on('message', async (topic, message) => {
    try {
        const payload = JSON.parse(message.toString());
        console.log(`[GateProcessor] Received message on ${topic}:`, payload);
        
        // Ensure message format is correct processing
        if (payload.type === 'gate_scan') {
            await handleGateScan(
                payload.truck_id, 
                payload.weight, 
                payload.trip_direction
            );
        } else {
            console.log('[GateProcessor] Ignored unknown message type.');
        }
    } catch (error) {
        console.error('[GateProcessor] Error processing MQTT message:', error.message);
    }
});
