/**
 * Main Processor
 * Connects the MQTT fetcher with the Database Logic core
 * Completely decoupled from the frontend APIs perfectly!
 */

const fetcher = require('./fetcher');
const db = require('./dbLogic');

console.log("🚀 Starting Pure Cold-Chain MQTT Processor...");
console.log("⏳ Waiting for MQTT data...");

// 1. Listen for Gate Scans (RFID Check-in/Check-out)
fetcher.on('gateData', async (data) => {
    try {
        console.log(`\n🔔 [GATE EVENT] Received scan for truck: ${data.truck_id}`);
        await db.handleGateScan(data.truck_id, data.weight);
    } catch (err) {
        console.error("❌ Error processing gate scan:", err);
    }
});

// 2. Listen for Truck Sensor Data (Temperature & Motion from road)
fetcher.on('truckData', async (data) => {
    try {
        await db.updateSensorData(
            data.truck_id,
            { avg: data.temperature, min: data.temperature, max: data.temperature },
            { max_accel: data.shock_g, harsh_event: data.shock_alert }
        );
    } catch (err) {
        console.error("❌ Error processing truck sensor data:", err);
    }
});

// Handle safe exit
process.on('SIGINT', () => {
    console.log("\n🛑 Stopping Processor gracefully...");
    process.exit(0);
});
