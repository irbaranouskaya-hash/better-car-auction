import { getRedisClient } from '../redis.js';
import { config } from '../config.js';
import crypto from 'crypto';

/**
 * Генерирует уникальный refresh token
 */
export const generateRefreshTokenForRedis = (): string => {
  return crypto.randomBytes(64).toString('hex');
};

/**
 * Ключ для хранения refresh token в Redis
 * Формат: refresh:{userId}:{tokenId}
 */
const getRefreshTokenKey = (userId: string, tokenId: string): string => {
  return `refresh:${userId}:${tokenId}`;
};

/**
 * Ключ для хранения всех токенов пользователя
 * Формат: user:{userId}:tokens
 */
const getUserTokensKey = (userId: string): string => {
  return `user:${userId}:tokens`;
};

/**
 * Сохраняет refresh token в Redis
 * @param userId ID пользователя
 * @param refreshToken Refresh token
 * @param deviceInfo Информация об устройстве (user-agent)
 * @param ipAddress IP адрес
 * @returns tokenId - уникальный идентификатор токена
 */
export const saveRefreshToken = async (
  userId: string,
  refreshToken: string,
  deviceInfo?: string,
  ipAddress?: string
): Promise<string> => {
  const redis = getRedisClient();
  const tokenId = crypto.randomBytes(16).toString('hex');
  const key = getRefreshTokenKey(userId, tokenId);
  
  const tokenData = {
    token: refreshToken,
    userId,
    tokenId,
    deviceInfo: deviceInfo || 'Unknown',
    ipAddress: ipAddress || 'Unknown',
    createdAt: new Date().toISOString(),
  };

  // Сохраняем токен с TTL (время жизни в секундах)
  const ttlSeconds = config.jwt.refreshTokenExpiryDays * 24 * 60 * 60;
  
  await redis.setEx(
    key,
    ttlSeconds,
    JSON.stringify(tokenData)
  );

  // Добавляем tokenId в список токенов пользователя (для logout everywhere)
  await redis.sAdd(getUserTokensKey(userId), tokenId);
  await redis.expire(getUserTokensKey(userId), ttlSeconds);

  return tokenId;
};

/**
 * Проверяет валидность refresh token
 * @param userId ID пользователя
 * @param refreshToken Refresh token для проверки
 * @returns tokenId если токен валиден, null если нет
 */
export const verifyRefreshToken = async (
  userId: string,
  refreshToken: string
): Promise<string | null> => {
  const redis = getRedisClient();
  const userTokensKey = getUserTokensKey(userId);
  
  // Получаем все tokenId пользователя
  const tokenIds = await redis.sMembers(userTokensKey);
  
  // Проверяем каждый токен
  for (const tokenId of tokenIds) {
    const key = getRefreshTokenKey(userId, tokenId);
    const tokenDataStr = await redis.get(key);
    
    if (tokenDataStr) {
      const tokenData = JSON.parse(tokenDataStr);
      if (tokenData.token === refreshToken) {
        return tokenId;
      }
    }
  }
  
  return null;
};

/**
 * Удаляет refresh token из Redis (logout)
 * @param userId ID пользователя
 * @param refreshToken Refresh token для удаления
 */
export const removeRefreshToken = async (
  userId: string,
  refreshToken: string
): Promise<boolean> => {
  const redis = getRedisClient();
  const tokenId = await verifyRefreshToken(userId, refreshToken);
  
  if (!tokenId) {
    return false;
  }
  
  const key = getRefreshTokenKey(userId, tokenId);
  await redis.del(key);
  await redis.sRem(getUserTokensKey(userId), tokenId);
  
  return true;
};

/**
 * Удаляет все refresh токены пользователя (logout everywhere)
 * @param userId ID пользователя
 */
export const removeAllRefreshTokens = async (userId: string): Promise<number> => {
  const redis = getRedisClient();
  const userTokensKey = getUserTokensKey(userId);
  
  // Получаем все tokenId пользователя
  const tokenIds = await redis.sMembers(userTokensKey);
  
  if (tokenIds.length === 0) {
    return 0;
  }
  
  // Удаляем все токены
  const keys = tokenIds.map(tokenId => getRefreshTokenKey(userId, tokenId));
  await redis.del(keys);
  
  // Удаляем список токенов
  await redis.del(userTokensKey);
  
  return tokenIds.length;
};

/**
 * Получает информацию о всех активных сессиях пользователя
 * @param userId ID пользователя
 */
export const getUserActiveSessions = async (userId: string): Promise<Array<{
  tokenId: string;
  deviceInfo: string;
  ipAddress: string;
  createdAt: string;
}>> => {
  const redis = getRedisClient();
  const userTokensKey = getUserTokensKey(userId);
  
  const tokenIds = await redis.sMembers(userTokensKey);
  const sessions = [];
  
  for (const tokenId of tokenIds) {
    const key = getRefreshTokenKey(userId, tokenId);
    const tokenDataStr = await redis.get(key);
    
    if (tokenDataStr) {
      const tokenData = JSON.parse(tokenDataStr);
      sessions.push({
        tokenId: tokenData.tokenId,
        deviceInfo: tokenData.deviceInfo,
        ipAddress: tokenData.ipAddress,
        createdAt: tokenData.createdAt,
      });
    }
  }
  
  return sessions;
};

/**
 * Удаляет конкретную сессию по tokenId
 * @param userId ID пользователя
 * @param tokenId ID токена для удаления
 */
export const removeSessionByTokenId = async (
  userId: string,
  tokenId: string
): Promise<boolean> => {
  const redis = getRedisClient();
  const key = getRefreshTokenKey(userId, tokenId);
  
  const result = await redis.del(key);
  await redis.sRem(getUserTokensKey(userId), tokenId);
  
  return result > 0;
};

