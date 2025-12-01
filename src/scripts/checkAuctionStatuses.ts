import mongoose from 'mongoose';
import { config } from '../config.js';
import Auction from '../models/Auction.model.js';

const checkStatuses = async () => {
  try {
    await mongoose.connect(config.mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const auctions = await Auction.find({});
    
    console.log(`📊 Total auctions: ${auctions.length}\n`);
    
    auctions.forEach(auction => {
      console.log(`Auction: ${auction.name}`);
      console.log(`  Status: ${auction.status}`);
      console.log(`  Start: ${auction.startDate.toLocaleString()}`);
      console.log(`  End: ${auction.endDate.toLocaleString()}`);
      console.log('');
    });

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkStatuses();

