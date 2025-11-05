import jwt from 'jsonwebtoken';
import crypto from 'crypto';

interface TokenPayload {
  userId: string;
  tokenVersion: number;
  type: 'access' | 'refresh';
}

export const generateAccessToken = (userId: string, tokenVersion: number): string => {
  const secret = process.env.JWT_SECRET || 'default_secret';
  
  return jwt.sign(
    { 
      userId, 
      tokenVersion,
      type: 'access'
    } as TokenPayload, 
    secret, 
    { expiresIn: '1h' } // 1 час
  );
};

export const generateRefreshToken = (): string => {
  return crypto.randomBytes(64).toString('hex');
};

export const verifyAccessToken = (token: string): TokenPayload | null => {
  try {
    const secret = process.env.JWT_SECRET || 'default_secret';
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
  return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
};