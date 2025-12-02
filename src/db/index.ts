import { config } from '../config.js';
import type { IUserRepository } from './interfaces/IUserRepository.js';
import type { ICarRepository } from './interfaces/ICarRepository.js';
import type { IAuctionRepository } from './interfaces/IAuctionRepository.js';
import type { IBidRepository } from './interfaces/IBidRepository.js';

export interface Repositories {
  user: IUserRepository;
  car: ICarRepository;
  auction: IAuctionRepository;
  bid: IBidRepository;
}

let repositories: Repositories | null = null;
let isInitialized = false;

export const initDatabase = async (): Promise<void> => {
  if (isInitialized) {
    return;
  }

  const dbType = config.dbType;

  if (dbType === 'postgresql') {
    throw new Error('PostgreSQL is not yet implemented. Please use mongodb.');
  }

  const {
    connectMongo,
    createMongoUserRepository,
    createMongoCarRepository,
    createMongoAuctionRepository,
    createMongoBidRepository,
  } = await import('./mongodb/index.js');

  await connectMongo();

  repositories = {
    user: createMongoUserRepository(),
    car: createMongoCarRepository(),
    auction: createMongoAuctionRepository(),
    bid: createMongoBidRepository(),
  };

  isInitialized = true;
  console.log(`Database initialized: ${dbType}`);
};

export const getRepositories = (): Repositories => {
  if (!repositories) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return repositories;
};

export const getRepo = getRepositories;

export const disconnectDatabase = async (): Promise<void> => {
  if (!isInitialized) {
    return;
  }

  const dbType = config.dbType;

  if (dbType === 'mongodb') {
    const { disconnectMongo } = await import('./mongodb/index.js');
    await disconnectMongo();
  }

  repositories = null;
  isInitialized = false;
};

export * from './interfaces/index.js';

