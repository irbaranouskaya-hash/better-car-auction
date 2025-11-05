import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config.js';

interface TokenPayload {
  userId: string;
  tokenVersion: number;
  type: 'access' | 'refresh';
}

export const generateAccessToken = (userId: string, tokenVersion: number): string => {
  const secret = config.jwt.secret;
  
  return jwt.sign(
    { 
      userId, 
      tokenVersion,
      type: 'access'
    } as TokenPayload, 
    secret, 
    {
      expiresIn: config.jwt.accessTokenExpiry
    } as SignOptions
  );
};

export const generateRefreshToken = (): string => {
  return crypto.randomBytes(64).toString('hex');
};

export const verifyAccessToken = (token: string): TokenPayload | null => {
  try {
    const secret = config.jwt.secret;
    const decoded = jwt.verify(token, secret) as TokenPayload;
    
    if (decoded.type !== 'access') {
      return null;
    }
    
    return decoded;
  } catch (error) {
    return null;
  }
};

export const getRefreshTokenExpiration = (): Date => {
  const now = new Date();
  return new Date(now.getTime() + config.jwt.refreshTokenExpiryDays * 24 * 60 * 60 * 1000);
};