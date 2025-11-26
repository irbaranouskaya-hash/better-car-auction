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

  mongoUri: getEnvVar('MONGO_URI'),

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