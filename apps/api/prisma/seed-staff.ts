import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { DEMO_ACCOUNTS } from './demo-accounts.js';

export { DEMO_ACCOUNTS } from './demo-accounts.js';

export async function seedDemoUsers(prisma: PrismaClient) {
  for (const { username, password, role } of DEMO_ACCOUNTS) {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.upsert({
      where: { username },
      update: { passwordHash, role, isActive: true },
      create: { username, passwordHash, role },
    });
    console.log(`Demo account ready: ${username} (${role}).`);
  }
}

const isDirectRun = process.argv[1]?.includes('seed-staff');
if (isDirectRun) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Lỗi: Biến môi trường DATABASE_URL chưa được thiết lập.');
    process.exit(1);
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    console.log('Bắt đầu seed tài khoản demo vào database...');
    await seedDemoUsers(prisma);
    console.log('Seed tài khoản demo hoàn tất thành công!');
  } finally {
    await prisma.$disconnect();
  }
}

