import mongoose from 'mongoose';
import { config } from './config.js';

const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(config.mongoUri);
    console.log('MongoDB connected');
  } catch (err: any) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};

export default connectDB;
