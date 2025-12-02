import mongoose from 'mongoose';
import { config } from '../../config.js';

export const connectMongo = async (): Promise<void> => {
  try {
    await mongoose.connect(config.mongoUri);
    console.log('MongoDB connected');
  } catch (err: any) {
    console.error('MongoDB connection error:', err.message);
    throw err;
  }
};

export const disconnectMongo = async (): Promise<void> => {
  await mongoose.disconnect();
  console.log('MongoDB disconnected');
};

