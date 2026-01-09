import type { IAuctionRepository, AuctionFilters, IAuctionWithCars } from '../../interfaces/IAuctionRepository.js';
import type { IAuction, CreateAuctionData, SortParams } from '../../interfaces/types.js';
import { getPool } from '../connection.js';

const calculateStatus = (startDate: Date, endDate: Date, isClosed: boolean): 'upcoming' | 'active' | 'ended' | 'closed' => {
  if (isClosed) return 'closed';
  const now = new Date();
  if (now < startDate) return 'upcoming';
  if (now >= startDate && now <= endDate) return 'active';
  return 'ended';
};

const calculateDurationHours = (startDate: Date, endDate: Date): number => {
  const diff = endDate.getTime() - startDate.getTime();
  return Math.round(diff / (1000 * 60 * 60));
};

const calculateTimeUntilStart = (startDate: Date): number => {
  const now = new Date();
  if (now >= startDate) return 0;
  const diff = startDate.getTime() - now.getTime();
  return Math.round(diff / (1000 * 60));
};

const mapRowToAuction = (row: any, carIds: string[] = []): IAuction => ({
  id: row.id,
  name: row.name,
  startDate: row.start_date,
  endDate: row.end_date,
  createdBy: row.created_by,
  cars: carIds,
  isClosed: row.is_closed,
  status: calculateStatus(row.start_date, row.end_date, row.is_closed),
  durationHours: calculateDurationHours(row.start_date, row.end_date),
  timeUntilStart: calculateTimeUntilStart(row.start_date),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const camelToSnake = (str: string): string => {
  const map: Record<string, string> = {
    startDate: 'start_date',
    endDate: 'end_date',
    createdBy: 'created_by',
    isClosed: 'is_closed',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  };
  return map[str] || str;
};

export const createPostgresAuctionRepository = (): IAuctionRepository => ({
  async findById(id) {
    const result = await getPool().query('SELECT * FROM auctions WHERE id = $1', [id]);
    if (!result.rows[0]) return null;

    const carsResult = await getPool().query(
      'SELECT car_id FROM auction_cars WHERE auction_id = $1',
      [id]
    );
    const carIds = carsResult.rows.map(r => r.car_id);

    return mapRowToAuction(result.rows[0], carIds);
  },

  async findByIdWithDetails(id) {
    const result = await getPool().query(
      `SELECT a.*, u.name as creator_name, u.email as creator_email
       FROM auctions a
       LEFT JOIN users u ON a.created_by = u.id
       WHERE a.id = $1`,
      [id]
    );
    if (!result.rows[0]) return null;

    const carsResult = await getPool().query(
      `SELECT c.id, c.vin, c.brand, c.model, c.year, c.msrp, c.grade, c.optimized_price
       FROM cars c
       INNER JOIN auction_cars ac ON c.id = ac.car_id
       WHERE ac.auction_id = $1`,
      [id]
    );

    const row = result.rows[0];
    const carIds = carsResult.rows.map(c => c.id);
    const auction = mapRowToAuction(row, carIds);

    const auctionWithCars: IAuctionWithCars = {
      ...auction,
      carsData: carsResult.rows.map(c => ({
        id: c.id,
        VIN: c.vin,
        brand: c.brand,
        model: c.model,
        year: c.year,
        msrp: parseFloat(c.msrp),
        grade: parseFloat(c.grade),
        optimizedPrice: parseFloat(c.optimized_price),
      })),
    };

    if (row.creator_name && row.creator_email) {
      auctionWithCars.creator = {
        id: row.created_by,
        name: row.creator_name,
        email: row.creator_email,
      };
    }

    return auctionWithCars;
  },

  async create(data) {
    const result = await getPool().query(
      `INSERT INTO auctions (name, start_date, end_date, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.name, data.startDate, data.endDate, data.createdBy]
    );

    if (data.cars && data.cars.length > 0) {
      const values = data.cars.map((carId, i) => `($1, $${i + 2})`).join(', ');
      await getPool().query(
        `INSERT INTO auction_cars (auction_id, car_id) VALUES ${values}`,
        [result.rows[0].id, ...data.cars]
      );
    }

    return mapRowToAuction(result.rows[0], data.cars || []);
  },

  async update(id, data) {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.startDate !== undefined) {
      updates.push(`start_date = $${paramIndex++}`);
      values.push(data.startDate);
    }
    if (data.endDate !== undefined) {
      updates.push(`end_date = $${paramIndex++}`);
      values.push(data.endDate);
    }
    if (data.isClosed !== undefined) {
      updates.push(`is_closed = $${paramIndex++}`);
      values.push(data.isClosed);
    }

    if (updates.length === 0) return this.findById(id);

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await getPool().query(
      `UPDATE auctions SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (!result.rows[0]) return null;

    const carsResult = await getPool().query(
      'SELECT car_id FROM auction_cars WHERE auction_id = $1',
      [id]
    );
    return mapRowToAuction(result.rows[0], carsResult.rows.map(r => r.car_id));
  },

  async delete(id) {
    const result = await getPool().query('DELETE FROM auctions WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  },

  async findAll(filters, pagination, sort) {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    const now = new Date();

    if (filters.createdBy) {
      conditions.push(`a.created_by = $${paramIndex++}`);
      values.push(filters.createdBy);
    }
    if (filters.name) {
      conditions.push(`a.name ILIKE $${paramIndex++}`);
      values.push(`%${filters.name}%`);
    }
    if (filters.isClosed !== undefined) {
      conditions.push(`a.is_closed = $${paramIndex++}`);
      values.push(filters.isClosed);
    }

    if (filters.status === 'closed') {
      conditions.push(`a.is_closed = true`);
    } else if (filters.status === 'upcoming') {
      conditions.push(`a.start_date > $${paramIndex++}`);
      values.push(now);
      conditions.push(`a.is_closed = false`);
    } else if (filters.status === 'active') {
      conditions.push(`a.start_date <= $${paramIndex++}`);
      values.push(now);
      conditions.push(`a.end_date >= $${paramIndex++}`);
      values.push(now);
      conditions.push(`a.is_closed = false`);
    } else if (filters.status === 'ended') {
      conditions.push(`a.end_date < $${paramIndex++}`);
      values.push(now);
      conditions.push(`a.is_closed = false`);
    }

    if (filters.startDateGt) {
      conditions.push(`a.start_date > $${paramIndex++}`);
      values.push(filters.startDateGt);
    }
    if (filters.startDateLte) {
      conditions.push(`a.start_date <= $${paramIndex++}`);
      values.push(filters.startDateLte);
    }
    if (filters.endDateGte) {
      conditions.push(`a.end_date >= $${paramIndex++}`);
      values.push(filters.endDateGte);
    }
    if (filters.endDateLt) {
      conditions.push(`a.end_date < $${paramIndex++}`);
      values.push(filters.endDateLt);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sortColumn = camelToSnake(sort.sortField);
    const sortDir = sort.sortOrder === 1 ? 'ASC' : 'DESC';

    const countResult = await getPool().query(
      `SELECT COUNT(*) FROM auctions a ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await getPool().query(
      `SELECT a.*, u.name as creator_name, u.email as creator_email
       FROM auctions a
       LEFT JOIN users u ON a.created_by = u.id
       ${whereClause}
       ORDER BY a.${sortColumn} ${sortDir}
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...values, pagination.limit, pagination.skip]
    );

    const auctionIds = result.rows.map(r => r.id);
    let carsMap: Record<string, any[]> = {};

    if (auctionIds.length > 0) {
      const carsResult = await getPool().query(
        `SELECT ac.auction_id, c.id, c.vin, c.brand, c.model, c.year, c.msrp, c.grade, c.optimized_price
         FROM cars c
         INNER JOIN auction_cars ac ON c.id = ac.car_id
         WHERE ac.auction_id = ANY($1)`,
        [auctionIds]
      );

      for (const car of carsResult.rows) {
        if (!carsMap[car.auction_id]) carsMap[car.auction_id] = [];
        carsMap[car.auction_id].push(car);
      }
    }

    const data: IAuctionWithCars[] = result.rows.map(row => {
      const cars = carsMap[row.id] || [];
      const auction = mapRowToAuction(row, cars.map(c => c.id));
      const auctionWithCars: IAuctionWithCars = {
        ...auction,
        carsData: cars.map(c => ({
          id: c.id,
          VIN: c.vin,
          brand: c.brand,
          model: c.model,
          year: c.year,
          msrp: parseFloat(c.msrp),
          grade: parseFloat(c.grade),
          optimizedPrice: parseFloat(c.optimized_price),
        })),
      };

      if (row.creator_name && row.creator_email) {
        auctionWithCars.creator = {
          id: row.created_by,
          name: row.creator_name,
          email: row.creator_email,
        };
      }

      return auctionWithCars;
    });

    return {
      data,
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

    if (filters.createdBy) {
      conditions.push(`created_by = $${paramIndex++}`);
      values.push(filters.createdBy);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await getPool().query(`SELECT COUNT(*) FROM auctions ${whereClause}`, values);
    return parseInt(result.rows[0].count, 10);
  },

  async findOverlapping(startDate, endDate, excludeId) {
    let query = `
      SELECT * FROM auctions
      WHERE (
        (start_date <= $1 AND end_date >= $1)
        OR (start_date <= $2 AND end_date >= $2)
        OR (start_date >= $1 AND end_date <= $2)
      )
    `;
    const values: any[] = [startDate, endDate];

    if (excludeId) {
      query += ` AND id != $3`;
      values.push(excludeId);
    }

    const result = await getPool().query(query, values);
    if (!result.rows[0]) return null;

    const carsResult = await getPool().query(
      'SELECT car_id FROM auction_cars WHERE auction_id = $1',
      [result.rows[0].id]
    );
    return mapRowToAuction(result.rows[0], carsResult.rows.map(r => r.car_id));
  },

  async findExpired() {
    const result = await getPool().query(
      `SELECT * FROM auctions WHERE end_date < NOW() AND is_closed = false ORDER BY end_date ASC`
    );

    const auctions: IAuction[] = [];
    for (const row of result.rows) {
      const carsResult = await getPool().query(
        'SELECT car_id FROM auction_cars WHERE auction_id = $1',
        [row.id]
      );
      auctions.push(mapRowToAuction(row, carsResult.rows.map(r => r.car_id)));
    }
    return auctions;
  },

  async close(id) {
    const result = await getPool().query(
      `UPDATE auctions SET is_closed = true, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    if (!result.rows[0]) return null;

    const carsResult = await getPool().query(
      'SELECT car_id FROM auction_cars WHERE auction_id = $1',
      [id]
    );
    return mapRowToAuction(result.rows[0], carsResult.rows.map(r => r.car_id));
  },

  async addCar(auctionId, carId) {
    await getPool().query(
      `INSERT INTO auction_cars (auction_id, car_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [auctionId, carId]
    );
    return this.findById(auctionId);
  },

  async removeCar(auctionId, carId) {
    await getPool().query(
      `DELETE FROM auction_cars WHERE auction_id = $1 AND car_id = $2`,
      [auctionId, carId]
    );
    return this.findById(auctionId);
  },
});


