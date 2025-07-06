import 'reflect-metadata';
import { DataSource } from 'typeorm';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL!,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  entities: ['src/models/*.ts'],
  migrations: ['src/migrations/*.ts'],
  synchronize: false, // Always false for migrations
  logging: process.env.NODE_ENV === 'development',
});

export default AppDataSource;