import mongoose from 'mongoose';
import User from '../models/User.model.js';
import { UserRole } from '../models/User.model.js';
import dotenv from 'dotenv';
import { config } from '../config.js';


dotenv.config();

const createAdmin = async () => {
  try {
    await mongoose.connect(config.mongoUri);
    
    const adminEmail = 'admin@example.com';
    const existingAdmin = await User.findOne({ email: adminEmail });
    
    if (existingAdmin) {
      console.log('Admin already exists');
      process.exit(0);
    }
    
    const admin = await User.create({
      name: 'Admin',
      email: adminEmail,
      password: 'admin123456',
      role: UserRole.ADMIN
    });
    
    console.log('Admin created successfully:', {
      id: admin._id,
      email: admin.email,
      role: admin.role
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin:', error);
    process.exit(1);
  }
};

createAdmin();