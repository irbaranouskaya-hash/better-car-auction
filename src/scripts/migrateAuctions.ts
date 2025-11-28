import mongoose from 'mongoose';
import { config } from '../config.js';
import Auction from '../models/Auction.model.js';

const migrateAuctions = async () => {
  try {
    console.log('🚀 Starting auction migration...\n');

    await mongoose.connect(config.mongoUri);
    console.log('✅ Connected to MongoDB\n');

    console.log('📊 Removing isActive field from all auctions...');
    
    const result = await Auction.updateMany(
      {},
      { 
        $unset: { isActive: '' }
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} auctions`);
    console.log(`📋 Matched ${result.matchedCount} auctions\n`);

    console.log('📊 Checking for auctions that need to be marked as closed...');
    
    const now = new Date();
    const expiredAuctions = await Auction.find({
      endDate: { $lt: now },
      isClosed: { $ne: true }
    });

    console.log(`📋 Found ${expiredAuctions.length} expired auctions without isClosed flag`);

    if (expiredAuctions.length > 0) {
      const closeResult = await Auction.updateMany(
        {
          endDate: { $lt: now },
          isClosed: { $ne: true }
        },
        {
          $set: { isClosed: true }
        }
      );

      console.log(`✅ Marked ${closeResult.modifiedCount} auctions as closed\n`);
    }

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

