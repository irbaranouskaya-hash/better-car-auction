import type { IUser, CreateUserData } from './types.js';

export interface IUserRepository {
  findById(id: string): Promise<IUser | null>;
  findByEmail(email: string): Promise<IUser | null>;
  create(data: CreateUserData): Promise<IUser>;
  update(id: string, data: Partial<IUser>): Promise<IUser | null>;
  delete(id: string): Promise<boolean>;
  comparePassword(user: IUser, password: string): Promise<boolean>;
  hashPassword(password: string): Promise<string>;
  incrementTokenVersion(id: string): Promise<IUser | null>;
  setPasswordChangedAt(id: string, date: Date): Promise<IUser | null>;
  findByIdWithPassword(id: string): Promise<IUser | null>;
}

