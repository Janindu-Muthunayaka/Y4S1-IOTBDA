const mqtt = require('mqtt');
const EventEmitter = require('events');

class DataFetcher extends EventEmitter {
    constructor() {
        super();
        // Assuming "site-broker.hivemq.com" meant the standard broker "mqtt://broker.hivemq.com"
        this.client = mqtt.connect('mqtt://broker.hivemq.com');

        // Cache to store the latest data so other modules can retrieve it at any time
        this.gateData = null;
        this.truckData = {}; // Store latest data per truck_id

        this.client.on('connect', () => {
            console.log('🚢 [Fetcher] Connected to MQTT broker');

            // Subscribe to the required topics
            this.client.subscribe('IOTBDAGateOne', (err) => {
                if (!err) console.log('✅ Subscribed to IOTBDAGateOne');
            });

            this.client.subscribe('IOTBDATruckOne', (err) => {
                if (!err) console.log('✅ Subscribed to IOTBDATruckOne');
            });
        });

        this.client.on('message', (topic, message) => {
            try {
                const data = JSON.parse(message.toString());
                // console.log(`[${topic}] received:`, data);

                if (topic === 'IOTBDAGateOne') {
                    this.gateData = data;
                    // Emit event so other modules can listen in real-time if they want
                    this.emit('gateData', data);
                } else if (topic === 'IOTBDATruckOne') {
                    if (data.truck_id) {
                        this.truckData[data.truck_id] = data;
                    }
                    // Emit event
                    this.emit('truckData', data);
                }
            } catch (err) {
                console.error(`❌ [Fetcher] Failed to parse message on ${topic}:`, err.message);
            }
        });

        this.client.on('error', (err) => {
            console.error('❌ [Fetcher] MQTT connection error:', err);
        });
    }

    /**
     * Retrieves the most recently fetched gate data
     * @returns {Object|null}
     */
    getLatestGateData() {
        return this.gateData;
    }

    /**
     * Retrieves the most recently fetched truck data. 
     * If a truck_id is provided, returns data for that specific truck.
     * Otherwise returns an object with all known trucks.
     * @param {string} [truckId] 
     * @returns {Object|null}
     */
    getLatestTruckData(truckId) {
        if (truckId) {
            return this.truckData[truckId] || null;
        }
        return this.truckData;
    }

    /**
     * Clears the cached truck data to reset state between trips
     * @param {string} truckId 
     */
    clearTruckData(truckId) {
        if (truckId) {
            delete this.truckData[truckId];
        } else {
            this.truckData = {};
        }
    }
}

// Export a singleton instance so the connection is shared across your app 
const fetcherInstance = new DataFetcher();
module.exports = fetcherInstance;
