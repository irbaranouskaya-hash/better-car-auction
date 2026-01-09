import type { ICarRepository, CarFilters } from '../../interfaces/ICarRepository.js';
import type { ICar, CreateCarData, SortParams } from '../../interfaces/types.js';
import { getPool } from '../connection.js';

const mapRowToCar = (row: any): ICar => ({
  id: row.id,
  userId: row.user_id,
  VIN: row.vin,
  brand: row.brand,
  model: row.model,
  odometerValue: row.odometer_value,
  year: row.year,
  exteriorColor: row.exterior_color,
  interiorColor: row.interior_color,
  haveStrongScratches: row.have_strong_scratches,
  haveSmallScratches: row.have_small_scratches,
  haveMalfunctions: row.have_malfunctions,
  haveElectricFailures: row.have_electric_failures,
  msrp: parseFloat(row.msrp),
  grade: parseFloat(row.grade),
  optimizedPrice: parseFloat(row.optimized_price),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapRowWithOwner = (row: any): ICar & { user?: { name: string; email: string } } => {
  const car = mapRowToCar(row);
  if (row.user_name && row.user_email) {
    return {
      ...car,
      user: {
        name: row.user_name,
        email: row.user_email,
      },
    };
  }
  return car;
};

const calculateGradeAndPrice = (data: CreateCarData): { grade: number; optimizedPrice: number } => {
  let grade = 5;
  if (data.haveStrongScratches) grade -= 1.5;
  if (data.haveSmallScratches) grade -= 0.5;
  if (data.haveMalfunctions) grade -= 1.5;
  if (data.haveElectricFailures) grade -= 1;
  grade = Math.max(1, Math.min(5, grade));

  const ageDepreciation = Math.min(0.5, (new Date().getFullYear() - data.year) * 0.03);
  const odometerDepreciation = Math.min(0.3, data.odometerValue / 500000);
  const conditionMultiplier = grade / 5;
  const optimizedPrice = data.msrp * (1 - ageDepreciation) * (1 - odometerDepreciation) * conditionMultiplier;

  return { grade: Math.round(grade * 10) / 10, optimizedPrice: Math.round(optimizedPrice * 100) / 100 };
};

const camelToSnake = (str: string): string => {
  const map: Record<string, string> = {
    userId: 'user_id',
    VIN: 'vin',
    odometerValue: 'odometer_value',
    exteriorColor: 'exterior_color',
    interiorColor: 'interior_color',
    haveStrongScratches: 'have_strong_scratches',
    haveSmallScratches: 'have_small_scratches',
    haveMalfunctions: 'have_malfunctions',
    haveElectricFailures: 'have_electric_failures',
    optimizedPrice: 'optimized_price',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  };
  return map[str] || str;
};

export const createPostgresCarRepository = (): ICarRepository => ({
  async findById(id) {
    const result = await getPool().query('SELECT * FROM cars WHERE id = $1', [id]);
    return result.rows[0] ? mapRowToCar(result.rows[0]) : null;
  },

  async findByIdWithOwner(id) {
    const result = await getPool().query(
      `SELECT c.*, u.name as user_name, u.email as user_email
       FROM cars c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.id = $1`,
      [id]
    );
    return result.rows[0] ? mapRowWithOwner(result.rows[0]) : null;
  },

  async findByVIN(vin) {
    const result = await getPool().query('SELECT * FROM cars WHERE vin = $1', [vin]);
    return result.rows[0] ? mapRowToCar(result.rows[0]) : null;
  },

  async findByVINExcluding(vin, excludeId) {
    const result = await getPool().query('SELECT * FROM cars WHERE vin = $1 AND id != $2', [vin, excludeId]);
    return result.rows[0] ? mapRowToCar(result.rows[0]) : null;
  },

  async create(data) {
    const { grade, optimizedPrice } = calculateGradeAndPrice(data);

    const result = await getPool().query(
      `INSERT INTO cars (user_id, vin, brand, model, odometer_value, year, exterior_color, interior_color,
        have_strong_scratches, have_small_scratches, have_malfunctions, have_electric_failures, msrp, grade, optimized_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        data.userId, data.VIN, data.brand, data.model, data.odometerValue, data.year,
        data.exteriorColor, data.interiorColor, data.haveStrongScratches, data.haveSmallScratches,
        data.haveMalfunctions, data.haveElectricFailures, data.msrp, grade, optimizedPrice
      ]
    );
    return mapRowToCar(result.rows[0]);
  },

  async update(id, data) {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fields = ['VIN', 'brand', 'model', 'odometerValue', 'year', 'exteriorColor', 'interiorColor',
      'haveStrongScratches', 'haveSmallScratches', 'haveMalfunctions', 'haveElectricFailures', 'msrp'];

    for (const field of fields) {
      if ((data as any)[field] !== undefined) {
        updates.push(`${camelToSnake(field)} = $${paramIndex++}`);
        values.push((data as any)[field]);
      }
    }

    if (updates.length === 0) return this.findById(id);

    const needsRecalc = ['haveStrongScratches', 'haveSmallScratches', 'haveMalfunctions', 'haveElectricFailures', 'msrp', 'year', 'odometerValue']
      .some(f => (data as any)[f] !== undefined);

    if (needsRecalc) {
      const current = await this.findById(id);
      if (current) {
        const merged = { ...current, ...data } as CreateCarData;
        const { grade, optimizedPrice } = calculateGradeAndPrice(merged);
        updates.push(`grade = $${paramIndex++}`);
        values.push(grade);
        updates.push(`optimized_price = $${paramIndex++}`);
        values.push(optimizedPrice);
      }
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await getPool().query(
      `UPDATE cars SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0] ? mapRowToCar(result.rows[0]) : null;
  },

  async delete(id) {
    const result = await getPool().query('DELETE FROM cars WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  },

  async findAll(filters, pagination, sort) {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters.userId) {
      conditions.push(`c.user_id = $${paramIndex++}`);
      values.push(filters.userId);
    }
    if (filters.VIN) {
      conditions.push(`c.vin = $${paramIndex++}`);
      values.push(filters.VIN);
    }
    if (filters.brand) {
      conditions.push(`c.brand ILIKE $${paramIndex++}`);
      values.push(`%${filters.brand}%`);
    }
    if (filters.model) {
      conditions.push(`c.model ILIKE $${paramIndex++}`);
      values.push(`%${filters.model}%`);
    }
    if (filters.exteriorColor) {
      conditions.push(`c.exterior_color = $${paramIndex++}`);
      values.push(filters.exteriorColor);
    }
    if (filters.interiorColor) {
      conditions.push(`c.interior_color = $${paramIndex++}`);
      values.push(filters.interiorColor);
    }
    if (filters.minOdometer !== undefined) {
      conditions.push(`c.odometer_value >= $${paramIndex++}`);
      values.push(filters.minOdometer);
    }
    if (filters.maxOdometer !== undefined) {
      conditions.push(`c.odometer_value <= $${paramIndex++}`);
      values.push(filters.maxOdometer);
    }
    if (filters.minYear !== undefined) {
      conditions.push(`c.year >= $${paramIndex++}`);
      values.push(filters.minYear);
    }
    if (filters.maxYear !== undefined) {
      conditions.push(`c.year <= $${paramIndex++}`);
      values.push(filters.maxYear);
    }
    if (filters.haveStrongScratches !== undefined) {
      conditions.push(`c.have_strong_scratches = $${paramIndex++}`);
      values.push(filters.haveStrongScratches);
    }
    if (filters.haveSmallScratches !== undefined) {
      conditions.push(`c.have_small_scratches = $${paramIndex++}`);
      values.push(filters.haveSmallScratches);
    }
    if (filters.haveMalfunctions !== undefined) {
      conditions.push(`c.have_malfunctions = $${paramIndex++}`);
      values.push(filters.haveMalfunctions);
    }
    if (filters.haveElectricFailures !== undefined) {
      conditions.push(`c.have_electric_failures = $${paramIndex++}`);
      values.push(filters.haveElectricFailures);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sortColumn = camelToSnake(sort.sortField);
    const sortDir = sort.sortOrder === 1 ? 'ASC' : 'DESC';

    const countResult = await getPool().query(
      `SELECT COUNT(*) FROM cars c ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await getPool().query(
      `SELECT c.*, u.name as user_name, u.email as user_email
       FROM cars c
       LEFT JOIN users u ON c.user_id = u.id
       ${whereClause}
       ORDER BY c.${sortColumn} ${sortDir}
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...values, pagination.limit, pagination.skip]
    );

    return {
      data: result.rows.map(mapRowWithOwner),
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

    if (filters.userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      values.push(filters.userId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await getPool().query(`SELECT COUNT(*) FROM cars ${whereClause}`, values);
    return parseInt(result.rows[0].count, 10);
  },

  async findSimilar(year, odometerValue, excludeId, limit) {
    const SIMILAR_YEAR_RANGE = 2;
    const SIMILAR_ODOMETER_RANGE = 0.2;

    const result = await getPool().query(
      `SELECT * FROM cars
       WHERE year BETWEEN $1 AND $2
       AND odometer_value BETWEEN $3 AND $4
       AND id != $5
       LIMIT $6`,
      [
        year - SIMILAR_YEAR_RANGE,
        year + SIMILAR_YEAR_RANGE,
        odometerValue * (1 - SIMILAR_ODOMETER_RANGE),
        odometerValue * (1 + SIMILAR_ODOMETER_RANGE),
        excludeId,
        limit
      ]
    );
    return result.rows.map(mapRowToCar);
  },
});


