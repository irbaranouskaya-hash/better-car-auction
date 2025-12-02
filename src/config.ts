import dotenv from "dotenv";

dotenv.config();

export const getEnvVar = (name: string): string => {
  const value = process.env[name];
    if (undefined === value) {
      throw new Error(`Expected env var ${name} to be defined`);
    }
    
  return value;
};

export const config = {
  port: getEnvVar('PORT'),

  dbType: (process.env.DB_TYPE || 'mongodb') as 'mongodb' | 'postgresql',

  mongoUri: getEnvVar('MONGO_URI'),

  postgresql: {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432', 10),
    database: process.env.PG_DATABASE || 'better_car_auction',
    username: process.env.PG_USERNAME || 'postgres',
    password: process.env.PG_PASSWORD || '',
  },

  clientUrl: getEnvVar('CLIENT_URL'),

  redis: {
    host: getEnvVar('REDIS_HOST'),
    port: parseInt(getEnvVar('REDIS_PORT'), 10),
    password: getEnvVar('REDIS_PASSWORD'),
  },

  jwt: {
    secret: getEnvVar('JWT_SECRET'),
    accessTokenExpiry: getEnvVar('JWT_EXPIRES_IN'),
    refreshTokenExpiryDays: parseInt(getEnvVar('REFRESH_TOKEN_EXPIRES_DAYS'), 10),
  },

  admin: {
    name: getEnvVar('ADMIN_NAME'),
    email: getEnvVar('ADMIN_EMAIL'),
    password: getEnvVar('ADMIN_PASSWORD'),
  },
};