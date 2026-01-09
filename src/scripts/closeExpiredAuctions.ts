import { initDatabase, getRepo, disconnectDatabase } from '../db/index.js';

interface WinnerInfo {
  carId: string;
  carName: string;
  bidId: string;
  oderId: string;
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

const determineWinners = async (auctionId: string): Promise<WinnerInfo[]> => {
  const { bid: bidRepo, car: carRepo, user: userRepo } = getRepo();
  
  const allBids = await bidRepo.findByAuction(auctionId);

  if (allBids.length === 0) {
    console.log(`   ⚠️  No bids for auction ${auctionId}`);
    return [];
  }

  await bidRepo.resetWinningForAuction(auctionId);

  const carIds = [...new Set(allBids.map(bid => bid.carId))];
  
  const winners: WinnerInfo[] = [];

  for (const carId of carIds) {
    const highestBid = await bidRepo.findHighestForCar(auctionId, carId);

    if (highestBid) {
      await bidRepo.setWinning(highestBid.id, true);

      const car = await carRepo.findById(highestBid.carId);
      const user = await userRepo.findById(highestBid.userId);

      if (car && user) {
        winners.push({
          carId: car.id,
          carName: `${car.brand} ${car.model} (${car.year})`,
          bidId: highestBid.id,
          oderId: user.id,
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
  const { auction: auctionRepo, bid: bidRepo } = getRepo();
  
  console.log(`\n🔨 Closing auction: ${auction.name}`);
  console.log(`   📅 End date: ${auction.endDate.toLocaleString()}`);
  console.log(`   🚗 Cars in auction: ${auction.cars.length}`);

  const winners = await determineWinners(auction.id);

  const totalBids = await bidRepo.countByAuction(auction.id);

  await auctionRepo.close(auction.id);

  console.log(`   🏆 Winners: ${winners.length}`);
  console.log(`   📊 Total bids: ${totalBids}`);

  return {
    auctionId: auction.id,
    auctionName: auction.name,
    totalCars: auction.cars.length,
    winners,
    totalBids
  };
};

export const closeExpiredAuctions = async (): Promise<AuctionResult[]> => {
  try {
    const { auction: auctionRepo } = getRepo();
    
    console.log('🔍 Searching for expired auctions...\n');

    const expiredAuctions = await auctionRepo.findExpired();

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
    await initDatabase();
    console.log('');

    await closeExpiredAuctions();

    await disconnectDatabase();

    process.exit(0);
  } catch (error) {
    console.error('❌ Critical error:', error);
    await disconnectDatabase();
    process.exit(1);
  }
};

if (import.meta.url.endsWith('closeExpiredAuctions.ts') || import.meta.url.endsWith('closeExpiredAuctions.js')) {
  runStandalone();
}
