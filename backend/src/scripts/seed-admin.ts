import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../modules/users/entities/user.entity';

async function seedAdmin() {
  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: [User],
    synchronize: true,
  });

  await dataSource.initialize();
  const userRepo = dataSource.getRepository(User);

  const existing = await userRepo.findOne({ where: { username: 'admin' } });
  if (existing) {
    console.log('Admin user already exists, skipping seed.');
    await dataSource.destroy();
    return;
  }

  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = userRepo.create({
    username: 'admin',
    password: hashedPassword,
    nickname: '管理员',
    role: 1,
  });
  await userRepo.save(admin);
  console.log('Admin user created: username=admin, password=admin123');
  await dataSource.destroy();
}

seedAdmin().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
