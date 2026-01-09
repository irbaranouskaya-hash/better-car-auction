import { closeExpiredAuctions } from './closeExpiredAuctions.js';
import { initDatabase, disconnectDatabase } from '../db/index.js';

const CHECK_INTERVAL = parseInt(process.env.AUCTION_CHECK_INTERVAL || '300000', 10);

let isRunning = false;

const checkAndCloseAuctions = async () => {
  if (isRunning) {
    console.log('⚠️  Previous check is still running, skipping...');
    return;
  }

  isRunning = true;
  const startTime = new Date();

  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`⏰ Starting check: ${startTime.toLocaleString()}`);
    console.log('='.repeat(60));

    await closeExpiredAuctions();

    const duration = Date.now() - startTime.getTime();
    console.log(`⏱️  Duration: ${duration}ms`);
  } catch (error) {
    console.error('❌ Error checking auctions:', error);
  } finally {
    isRunning = false;
  }
};

export const startScheduler = async () => {
  console.log('🕐 Starting auction closing scheduler...');
  console.log(`📅 Check interval: ${CHECK_INTERVAL / 1000} seconds (${CHECK_INTERVAL / 60000} minutes)`);

  await initDatabase();

  await checkAndCloseAuctions();

  setInterval(checkAndCloseAuctions, CHECK_INTERVAL);

  console.log('✅ Scheduler started');
};

export const stopScheduler = async () => {
  console.log('🛑 Stopping scheduler...');
  await disconnectDatabase();
  console.log('👋 Scheduler stopped');
};

process.on('SIGINT', async () => {
  console.log('\n⚠️  Received SIGINT signal, shutting down...');
  await stopScheduler();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️  Received SIGTERM signal, shutting down...');
  await stopScheduler();
  process.exit(0);
});

if (import.meta.url.endsWith('scheduleAuctionClosing.ts') || import.meta.url.endsWith('scheduleAuctionClosing.js')) {
  startScheduler().catch((error) => {
    console.error('❌ Error starting scheduler:', error);
    process.exit(1);
  });
}
