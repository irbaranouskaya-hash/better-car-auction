import mongoose from 'mongoose';
import User from '../models/User.model.js';
import { UserRole } from '../models/User.model.js';
import dotenv from 'dotenv';
import { config } from '../config.js';


dotenv.config();

const createAdmin = async () => {
  try {
    await mongoose.connect(config.mongoUri);
    
    const adminName = config.admin.name;
    const adminEmail = config.admin.email;
    const adminPassword = config.admin.password;

    if (!adminName || !adminEmail || !adminPassword) {
      console.error('Error: Admin credentials not found in environment variables');
      console.log('Please set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD in .env file');
      process.exit(1);
    }

    if (adminPassword.length < 8) {
      console.error('Error: ADMIN_PASSWORD must be at least 8 characters long');
      process.exit(1);
    }

    const existingAdmin = await User.findOne({ email: adminEmail });
    
    if (existingAdmin) {
      console.log('Admin already exists');
      process.exit(0);
    }
    
    const admin = await User.create({
      name: adminName,
      email: adminEmail,
      password: adminPassword,
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