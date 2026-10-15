const mongoose = require('mongoose');
const { mongoUri } = require('./env');

async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(mongoUri);
  console.log(`MongoDB connected: ${mongoose.connection.name}`);
  return mongoose.connection;
}

module.exports = { connectDB };
