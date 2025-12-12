const mongoose = require('mongoose');

const connectDB = async (mongoUri) => {
  if (!mongoUri) {
    console.log('No MongoDB URI provided - skipping database connection');
    return;
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    console.log('Continuing without MongoDB...');
    // Don't exit - continue running without MongoDB
  }
};

module.exports = connectDB;
