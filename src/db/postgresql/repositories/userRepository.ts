import bcrypt from 'bcryptjs';
import type { IUserRepository } from '../../interfaces/IUserRepository.js';
import type { IUser, CreateUserData } from '../../interfaces/types.js';
import { getPool } from '../connection.js';

const mapRowToUser = (row: any): IUser => ({
  id: row.id,
  name: row.name,
  email: row.email,
  password: row.password,
  role: row.role,
  tokenVersion: row.token_version,
  passwordChangedAt: row.password_changed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const createPostgresUserRepository = (): IUserRepository => ({
  async findById(id) {
    const result = await getPool().query(
      'SELECT id, name, email, role, token_version, password_changed_at, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] ? mapRowToUser(result.rows[0]) : null;
  },

  async findByIdWithPassword(id) {
    const result = await getPool().query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] ? mapRowToUser(result.rows[0]) : null;
  },

  async findByEmail(email) {
    const result = await getPool().query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] ? mapRowToUser(result.rows[0]) : null;
  },

  async create(data) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(data.password, salt);

    const result = await getPool().query(
      `INSERT INTO users (name, email, password, role, token_version)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.name, data.email, hashedPassword, data.role, data.tokenVersion ?? 0]
    );
    return mapRowToUser(result.rows[0]);
  },

  async update(id, data) {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(data.email);
    }
    if (data.password !== undefined) {
      const salt = await bcrypt.genSalt(10);
      updates.push(`password = $${paramIndex++}`);
      values.push(await bcrypt.hash(data.password, salt));
    }
    if (data.role !== undefined) {
      updates.push(`role = $${paramIndex++}`);
      values.push(data.role);
    }
    if (data.tokenVersion !== undefined) {
      updates.push(`token_version = $${paramIndex++}`);
      values.push(data.tokenVersion);
    }
    if (data.passwordChangedAt !== undefined) {
      updates.push(`password_changed_at = $${paramIndex++}`);
      values.push(data.passwordChangedAt);
    }

    if (updates.length === 0) return this.findById(id);

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await getPool().query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0] ? mapRowToUser(result.rows[0]) : null;
  },

  async delete(id) {
    const result = await getPool().query('DELETE FROM users WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  },

  async comparePassword(user, password) {
    return bcrypt.compare(password, user.password);
  },

  async hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  },

  async incrementTokenVersion(id) {
    const result = await getPool().query(
      `UPDATE users SET token_version = token_version + 1, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0] ? mapRowToUser(result.rows[0]) : null;
  },

  async setPasswordChangedAt(id, date) {
    const result = await getPool().query(
      `UPDATE users SET password_changed_at = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [date, id]
    );
    return result.rows[0] ? mapRowToUser(result.rows[0]) : null;
  },
});


