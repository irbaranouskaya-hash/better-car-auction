import { initDatabase, getRepo, disconnectDatabase } from '../db/index.js';
import { config } from '../config.js';

const createAdmin = async () => {
  try {
    await initDatabase();
    
    const { user: userRepo } = getRepo();
    
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

    const existingAdmin = await userRepo.findByEmail(adminEmail);
    
    if (existingAdmin) {
      console.log('Admin already exists');
      await disconnectDatabase();
      process.exit(0);
    }
    
    const admin = await userRepo.create({
      name: adminName,
      email: adminEmail,
      password: adminPassword,
      role: 'admin'
    });
    
    console.log('Admin created successfully:', {
      id: admin.id,
      email: admin.email,
      role: admin.role
    });
    
    await disconnectDatabase();
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin:', error);
    await disconnectDatabase();
    process.exit(1);
  }
};

createAdmin();
