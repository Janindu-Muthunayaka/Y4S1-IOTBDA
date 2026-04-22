
import mongoose from 'mongoose';

const MONGO_URI = 'mongodb://janindumuthunayaka:janindumuthunayaka@ac-hlhiljp-shard-00-00.oj7twy4.mongodb.net:27017,ac-hlhiljp-shard-00-01.oj7twy4.mongodb.net:27017,ac-hlhiljp-shard-00-02.oj7twy4.mongodb.net:27017/coldchain_logistics?ssl=true&replicaSet=atlas-ingym5-shard-0&authSource=admin&appName=ClusterIOTBDA';

async function checkDb() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');
        
        const targetTripId = 'TRIP_1774179331206';
        const trip = await mongoose.connection.db.collection('trips').findOne({ trip_id: targetTripId });
        console.log(`Trip ${targetTripId}:`, JSON.stringify(trip, null, 2));
        
        const sensorData = await mongoose.connection.db.collection('sensordatas').findOne({ trip_id: targetTripId });
        console.log(`SensorData ${targetTripId} Keys:`, Object.keys(sensorData || {}));
        
        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkDb();
