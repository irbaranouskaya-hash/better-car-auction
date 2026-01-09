import mongoose from 'mongoose';
import { config } from '../config.js';
import Car from '../models/Car.model.js';

const migrateCars = async () => {
  try {
    console.log('🚀 Starting car migration...\n');

    await mongoose.connect(config.mongoUri);
    console.log('✅ Connected to MongoDB\n');

    console.log('📊 Adding brand and model fields to cars without them...');
    
    const result = await Car.updateMany(
      { 
        $or: [
          { brand: { $exists: false } },
          { model: { $exists: false } }
        ]
      },
      { 
        $set: { 
          brand: 'Unknown',
          model: 'Unknown'
        }
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} cars`);
    console.log(`📋 Matched ${result.matchedCount} cars\n`);

    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB\n');

    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

migrateCars();

