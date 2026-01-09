import mongoose from 'mongoose';
import { config } from '../config.js';
import Auction from '../models/Auction.model.js';
import User from '../models/User.model.js';

const createTestExpiredAuction = async () => {
  try {
    console.log('🚀 Creating test expired auction...\n');

    await mongoose.connect(config.mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      console.error('❌ Admin user not found. Run npm run create-admin first.');
      process.exit(1);
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const testAuction = new Auction({
      name: 'Test Expired Auction',
      startDate: twoDaysAgo,
      endDate: yesterday,
      createdBy: admin._id,
      cars: [],
      isClosed: false
    });
    
    await testAuction.save({ validateBeforeSave: false });

    console.log('✅ Test auction created:');
    console.log(`   ID: ${testAuction._id}`);
    console.log(`   Name: ${testAuction.name}`);
    console.log(`   Start Date: ${testAuction.startDate.toLocaleString()}`);
    console.log(`   End Date: ${testAuction.endDate.toLocaleString()}`);
    console.log(`   Status: ${testAuction.status}`);

    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
    console.log('\n✅ Now run: npm run close-auctions');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

createTestExpiredAuction();

