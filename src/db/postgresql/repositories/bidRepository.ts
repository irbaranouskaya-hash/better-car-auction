import type { IBidRepository, BidFilters, IBidWithDetails } from '../../interfaces/IBidRepository.js';
import type { IBid, CreateBidData, SortParams } from '../../interfaces/types.js';
import { getPool } from '../connection.js';

const calculateAuctionStatus = (startDate: Date, endDate: Date, isClosed: boolean): string => {
  if (isClosed) return 'closed';
  const now = new Date();
  if (now < startDate) return 'upcoming';
  if (now >= startDate && now <= endDate) return 'active';
  return 'ended';
};

const mapRowToBid = (row: any): IBid => ({
  id: row.id,
  auctionId: row.auction_id,
  carId: row.car_id,
  userId: row.user_id,
  amount: parseFloat(row.amount),
  isWinning: row.is_winning,
  placedAt: row.placed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapRowWithDetails = (row: any): IBidWithDetails => {
  const bid = mapRowToBid(row);
  const result: IBidWithDetails = { ...bid };

  if (row.auction_name) {
    result.auction = {
      id: row.auction_id,
      name: row.auction_name,
      status: calculateAuctionStatus(row.auction_start_date, row.auction_end_date, row.auction_is_closed),
    };
  }

  if (row.car_vin) {
    result.car = {
      id: row.car_id,
      VIN: row.car_vin,
      brand: row.car_brand,
      model: row.car_model,
      year: row.car_year,
    };
  }

  if (row.user_name) {
    result.user = {
      id: row.user_id,
      name: row.user_name,
      email: row.user_email,
    };
  }

  return result;
};

const camelToSnake = (str: string): string => {
  const map: Record<string, string> = {
    auctionId: 'auction_id',
    carId: 'car_id',
    userId: 'user_id',
    isWinning: 'is_winning',
    placedAt: 'placed_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  };
  return map[str] || str;
};

export const createPostgresBidRepository = (): IBidRepository => ({
  async findById(id) {
    const result = await getPool().query('SELECT * FROM bids WHERE id = $1', [id]);
    return result.rows[0] ? mapRowToBid(result.rows[0]) : null;
  },

  async findByIdWithDetails(id) {
    const result = await getPool().query(
      `SELECT b.*,
        a.name as auction_name, a.start_date as auction_start_date, a.end_date as auction_end_date, a.is_closed as auction_is_closed,
        c.vin as car_vin, c.brand as car_brand, c.model as car_model, c.year as car_year,
        u.name as user_name, u.email as user_email
       FROM bids b
       LEFT JOIN auctions a ON b.auction_id = a.id
       LEFT JOIN cars c ON b.car_id = c.id
       LEFT JOIN users u ON b.user_id = u.id
       WHERE b.id = $1`,
      [id]
    );
    return result.rows[0] ? mapRowWithDetails(result.rows[0]) : null;
  },

  async create(data) {
    const result = await getPool().query(
      `INSERT INTO bids (auction_id, car_id, user_id, amount, placed_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [data.auctionId, data.carId, data.userId, data.amount]
    );
    return mapRowToBid(result.rows[0]);
  },

  async update(id, data) {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.amount !== undefined) {
      updates.push(`amount = $${paramIndex++}`);
      values.push(data.amount);
    }
    if (data.isWinning !== undefined) {
      updates.push(`is_winning = $${paramIndex++}`);
      values.push(data.isWinning);
    }
    if (data.placedAt !== undefined) {
      updates.push(`placed_at = $${paramIndex++}`);
      values.push(data.placedAt);
    }

    if (updates.length === 0) return this.findById(id);

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await getPool().query(
      `UPDATE bids SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0] ? mapRowToBid(result.rows[0]) : null;
  },

  async delete(id) {
    const result = await getPool().query('DELETE FROM bids WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  },

  async findAll(filters, pagination, sort) {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters.auctionId) {
      conditions.push(`b.auction_id = $${paramIndex++}`);
      values.push(filters.auctionId);
    }
    if (filters.carId) {
      conditions.push(`b.car_id = $${paramIndex++}`);
      values.push(filters.carId);
    }
    if (filters.userId) {
      conditions.push(`b.user_id = $${paramIndex++}`);
      values.push(filters.userId);
    }
    if (filters.isWinning !== undefined) {
      conditions.push(`b.is_winning = $${paramIndex++}`);
      values.push(filters.isWinning);
    }
    if (filters.minAmount !== undefined) {
      conditions.push(`b.amount >= $${paramIndex++}`);
      values.push(filters.minAmount);
    }
    if (filters.maxAmount !== undefined) {
      conditions.push(`b.amount <= $${paramIndex++}`);
      values.push(filters.maxAmount);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sortColumn = camelToSnake(sort.sortField);
    const sortDir = sort.sortOrder === 1 ? 'ASC' : 'DESC';

    const countResult = await getPool().query(
      `SELECT COUNT(*) FROM bids b ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await getPool().query(
      `SELECT b.*,
        a.name as auction_name, a.start_date as auction_start_date, a.end_date as auction_end_date, a.is_closed as auction_is_closed,
        c.vin as car_vin, c.brand as car_brand, c.model as car_model, c.year as car_year,
        u.name as user_name, u.email as user_email
       FROM bids b
       LEFT JOIN auctions a ON b.auction_id = a.id
       LEFT JOIN cars c ON b.car_id = c.id
       LEFT JOIN users u ON b.user_id = u.id
       ${whereClause}
       ORDER BY b.${sortColumn} ${sortDir}
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...values, pagination.limit, pagination.skip]
    );

    return {
      data: result.rows.map(mapRowWithDetails),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  },

  async count(filters) {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters.auctionId) {
      conditions.push(`auction_id = $${paramIndex++}`);
      values.push(filters.auctionId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await getPool().query(`SELECT COUNT(*) FROM bids ${whereClause}`, values);
    return parseInt(result.rows[0].count, 10);
  },

  async findExisting(auctionId, carId, userId) {
    const result = await getPool().query(
      'SELECT * FROM bids WHERE auction_id = $1 AND car_id = $2 AND user_id = $3',
      [auctionId, carId, userId]
    );
    return result.rows[0] ? mapRowToBid(result.rows[0]) : null;
  },

  async findHighestForCar(auctionId, carId) {
    const result = await getPool().query(
      'SELECT * FROM bids WHERE auction_id = $1 AND car_id = $2 ORDER BY amount DESC LIMIT 1',
      [auctionId, carId]
    );
    return result.rows[0] ? mapRowToBid(result.rows[0]) : null;
  },

  async findByAuction(auctionId) {
    const result = await getPool().query(
      'SELECT * FROM bids WHERE auction_id = $1',
      [auctionId]
    );
    return result.rows.map(mapRowToBid);
  },

  async findByAuctionAndCar(auctionId, carId) {
    const result = await getPool().query(
      'SELECT * FROM bids WHERE auction_id = $1 AND car_id = $2 ORDER BY amount DESC',
      [auctionId, carId]
    );
    return result.rows.map(mapRowToBid);
  },

  async setWinning(bidId, isWinning) {
    const result = await getPool().query(
      'UPDATE bids SET is_winning = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [isWinning, bidId]
    );
    return result.rows[0] ? mapRowToBid(result.rows[0]) : null;
  },

  async resetWinningForAuction(auctionId) {
    const result = await getPool().query(
      'UPDATE bids SET is_winning = false, updated_at = NOW() WHERE auction_id = $1',
      [auctionId]
    );
    return result.rowCount ?? 0;
  },

  async countByAuction(auctionId) {
    const result = await getPool().query(
      'SELECT COUNT(*) FROM bids WHERE auction_id = $1',
      [auctionId]
    );
    return parseInt(result.rows[0].count, 10);
  },

  async deleteByAuction(auctionId) {
    const result = await getPool().query(
      'DELETE FROM bids WHERE auction_id = $1',
      [auctionId]
    );
    return result.rowCount ?? 0;
  },
});


