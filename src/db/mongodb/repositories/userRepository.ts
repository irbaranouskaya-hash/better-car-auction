import bcrypt from 'bcrypt';
import User from '../../../models/User.model.js';
import type { IUserRepository } from '../../interfaces/IUserRepository.js';
import type { IUser, CreateUserData } from '../../interfaces/types.js';

const mapToInterface = (doc: any): IUser => ({
  id: doc._id.toString(),
  name: doc.name,
  email: doc.email,
  password: doc.password,
  role: doc.role,
  tokenVersion: doc.tokenVersion || 0,
  passwordChangedAt: doc.passwordChangedAt,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export const createMongoUserRepository = (): IUserRepository => ({
  async findById(id) {
    const user = await User.findById(id);
    return user ? mapToInterface(user) : null;
  },

  async findByIdWithPassword(id) {
    const user = await User.findById(id).select('+password');
    return user ? mapToInterface(user) : null;
  },

  async findByEmail(email) {
    const user = await User.findOne({ email });
    return user ? mapToInterface(user) : null;
  },

  async create(data) {
    const user = await User.create({
      ...data,
      tokenVersion: data.tokenVersion ?? 0,
    });
    return mapToInterface(user);
  },

  async update(id, data) {
    const updateData: any = { ...data };
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(data.password, salt);
    }

    const user = await User.findByIdAndUpdate(id, updateData, { new: true });
    return user ? mapToInterface(user) : null;
  },

  async delete(id) {
    const result = await User.findByIdAndDelete(id);
    return !!result;
  },

  async comparePassword(user, password) {
    return bcrypt.compare(password, user.password);
  },

  async hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  },

  async incrementTokenVersion(id) {
    const user = await User.findByIdAndUpdate(
      id,
      { $inc: { tokenVersion: 1 } },
      { new: true }
    );
    return user ? mapToInterface(user) : null;
  },

  async setPasswordChangedAt(id, date) {
    const user = await User.findByIdAndUpdate(
      id,
      { passwordChangedAt: date },
      { new: true }
    );
    return user ? mapToInterface(user) : null;
  },
});

