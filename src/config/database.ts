import { DataSource } from 'typeorm';
import { Item } from '@/models/Item';
import { ItemChannel } from '@/models/ItemChannel';
import { UserSession } from '@/models/UserSession';
import { SessionView } from '@/models/SessionView';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL!,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  entities: [Item, ItemChannel, UserSession, SessionView],
  migrations: ['src/migrations/*.ts'],
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  extra: {
    connectionLimit: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
});

export const initializeDatabase = async (): Promise<void> => {
  try {
    await AppDataSource.initialize();
    console.log('Database connection established successfully');
  } catch (error) {
    console.error('Error during database connection:', error);
    process.exit(1);
  }
};