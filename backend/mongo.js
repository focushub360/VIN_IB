const mongoose = require('mongoose');

async function connectMongo() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('❌ MONGODB_URI is not set in .env');
        process.exit(1);
    }
    try {
        await mongoose.connect(uri);
        console.log('✅ MongoDB connected:', mongoose.connection.host, '/', mongoose.connection.name);
    } catch (err) {
        console.error('❌ MongoDB connection failed:', err.message);
        process.exit(1);
    }
}

module.exports = { connectMongo, mongoose };