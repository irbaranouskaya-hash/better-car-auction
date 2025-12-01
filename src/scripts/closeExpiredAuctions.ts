import mongoose from 'mongoose';
import { config } from '../config.js';
import Auction from '../models/Auction.model.js';
import Bid from '../models/Bid.model.js';
import Car from '../models/Car.model.js';
import User from '../models/User.model.js';


interface WinnerInfo {
  carId: string;
  carName: string;
  bidId: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
}

interface AuctionResult {
  auctionId: string;
  auctionName: string;
  totalCars: number;
  winners: WinnerInfo[];
  totalBids: number;
}


const findExpiredAuctions = async () => {
  const now = new Date();
  
  const expiredAuctions = await Auction.find({
    endDate: { $lt: now },
    isClosed: false
  }).sort({ endDate: 1 });

  return expiredAuctions;
};

const determineWinners = async (auctionId: string): Promise<WinnerInfo[]> => {
  const allBids = await Bid.find({ auctionId });

  if (allBids.length === 0) {
    console.log(`   ⚠️  No bids for auction ${auctionId}`);
    return [];
  }

  await Bid.updateMany({ auctionId }, { isWinning: false });

  const carIds = [...new Set(allBids.map(bid => bid.carId.toString()))];
  
  const winners: WinnerInfo[] = [];

  for (const carId of carIds) {
    const highestBid = await Bid.findOne({
      auctionId,
      carId
    }).sort({ amount: -1 });

    if (highestBid) {
      highestBid.isWinning = true;
      await highestBid.save();

      const car = await Car.findById(highestBid.carId);
      const user = await User.findById(highestBid.userId);

      if (car && user) {
        winners.push({
          carId: car._id.toString(),
          carName: `${car.brand} ${car.model} (${car.year})`,
          bidId: highestBid._id.toString(),
          userId: user._id.toString(),
          userName: user.name,
          userEmail: user.email,
          amount: highestBid.amount
        });

        console.log(`   ✅ Winner for ${car.brand} ${car.model} (${car.year}): ${user.name} ($${highestBid.amount})`);
      }
    }
  }

  return winners;
};

const closeAuction = async (auction: any): Promise<AuctionResult> => {
  console.log(`\n🔨 Closing auction: ${auction.name}`);
  console.log(`   📅 End date: ${auction.endDate.toLocaleString()}`);
  console.log(`   🚗 Cars in auction: ${auction.cars.length}`);

  const winners = await determineWinners(auction._id.toString());

  const totalBids = await Bid.countDocuments({ auctionId: auction._id });

  auction.isClosed = true;
  await auction.save();

  console.log(`   🏆 Winners: ${winners.length}`);
  console.log(`   📊 Total bids: ${totalBids}`);

  return {
    auctionId: auction._id.toString(),
    auctionName: auction.name,
    totalCars: auction.cars.length,
    winners,
    totalBids
  };
};

export const closeExpiredAuctions = async (): Promise<AuctionResult[]> => {
  try {
    console.log('🔍 Searching for expired auctions...\n');

    const expiredAuctions = await findExpiredAuctions();

    if (expiredAuctions.length === 0) {
      console.log('✅ No auctions to close.');
      return [];
    }

    console.log(`📋 Found auctions to close: ${expiredAuctions.length}\n`);

    const results: AuctionResult[] = [];

    for (const auction of expiredAuctions) {
      const result = await closeAuction(auction);
      results.push(result);
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 FINAL STATISTICS');
    console.log('='.repeat(60));
    console.log(`✅ Closed auctions: ${results.length}`);
    console.log(`🏆 Total winners: ${results.reduce((sum, r) => sum + r.winners.length, 0)}`);
    console.log(`📊 Total bids: ${results.reduce((sum, r) => sum + r.totalBids, 0)}`);
    console.log(`💰 Total winning amount: $${results.reduce((sum, r) => 
      sum + r.winners.reduce((s, w) => s + w.amount, 0), 0
    ).toLocaleString()}`);
    console.log('='.repeat(60) + '\n');

    return results;
  } catch (error) {
    console.error('❌ Error closing auctions:', error);
    throw error;
  }
};

const runStandalone = async () => {
  console.log('🚀 Starting auction closing script...\n');

  try {
    await mongoose.connect(config.mongoUri);
    console.log('✅ Connected to MongoDB\n');

    await closeExpiredAuctions();

    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');

    process.exit(0);
  } catch (error) {
    console.error('❌ Critical error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

if (import.meta.url.endsWith('closeExpiredAuctions.ts') || import.meta.url.endsWith('closeExpiredAuctions.js')) {
  runStandalone();
}

