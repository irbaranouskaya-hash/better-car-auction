import mongoose from 'mongoose';
import { config } from '../config.js';
import Auction from '../models/Auction.model.js';

const migrateAuctions = async () => {
  try {
    console.log('🚀 Starting auction migration...\n');

    await mongoose.connect(config.mongoUri);
    console.log('✅ Connected to MongoDB\n');

    console.log('📊 Removing isActive and status fields from all auctions...');
    
    const result = await Auction.updateMany(
      {},
      { 
        $unset: { isActive: '', status: '' }
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} auctions`);
    console.log(`📋 Matched ${result.matchedCount} auctions\n`);

    console.log('📊 Ensuring isClosed field exists for all auctions...');
    
    const ensureClosedResult = await Auction.updateMany(
      { isClosed: { $exists: false } },
      { $set: { isClosed: false } }
    );
    console.log(`✅ Set isClosed field for ${ensureClosedResult.modifiedCount} auctions\n`);

    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
    console.log('\n✅ Migration completed successfully!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

migrateAuctions();

