import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  Prisma,
  PrismaClient,
  UserRole,
} from '../src/generated/prisma/client.js';
import { DEMO_ACCOUNTS } from './demo-accounts.js';

const demoAccounts = [
  {
    username: 'demo.customer',
    role: UserRole.CUSTOMER,
    secret: 'DEMO_CUSTOMER_PASSWORD',
  },
  {
    username: 'demo.barista',
    role: UserRole.BARISTA,
    secret: 'DEMO_BARISTA_PASSWORD',
  },
  {
    username: 'demo.operator',
    role: UserRole.PAYMENT_OPERATOR,
    secret: 'DEMO_OPERATOR_PASSWORD',
  },
] as const;

class DemoSeedError extends Error {}

function getPrivateAccounts() {
  if (demoAccounts.every(({ secret }) => process.env[secret] === undefined)) {
    return [];
  }

  const accounts = demoAccounts.map(({ username, role, secret }) => {
    const password = process.env[secret];
    if (
      !password ||
      Buffer.byteLength(password) < 24 ||
      Buffer.byteLength(password) > 72
    ) {
      throw new DemoSeedError(
        `${secret} must contain a private password of 24–72 bytes.`,
      );
    }
    return { username, role, password };
  });
  if (
    new Set(accounts.map(({ password }) => password)).size !== accounts.length
  ) {
    throw new DemoSeedError(
      'Each production demo account requires a different password.',
    );
  }
  return accounts;
}

async function main() {
  const courseworkAccounts =
    process.env.SEED_COURSEWORK_DEMO_ACCOUNTS === 'true'
      ? DEMO_ACCOUNTS.filter(
          ({ role }) => role === UserRole.CUSTOMER || role === UserRole.BARISTA,
        )
      : [];
  const accounts = [...getPrivateAccounts(), ...courseworkAccounts];
  if (accounts.length === 0) {
    console.log('Production demo provisioning is disabled.');
    return;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new DemoSeedError('DATABASE_URL is required.');

  const users = await Promise.all(
    accounts.map(async ({ username, role, password }) => ({
      username,
      role,
      passwordHash: await bcrypt.hash(password, 12),
    })),
  );
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  try {
    const created = await prisma.$transaction(async (tx) => {
      const { count } = await tx.user.createMany({
        data: users,
        skipDuplicates: true,
      });
      const existing = await tx.user.findMany({
        where: { username: { in: users.map(({ username }) => username) } },
        select: {
          username: true,
          role: true,
          passwordHash: true,
          isActive: true,
        },
      });

      for (const { username, role, password } of accounts) {
        const user = existing.find((row) => row.username === username);
        if (user?.role !== role) {
          throw new DemoSeedError(
            `Demo username ${username} has an unexpected role.`,
          );
        }
        if (
          user.isActive &&
          !(await bcrypt.compare(password, user.passwordHash))
        ) {
          throw new DemoSeedError(
            `The configured password does not match existing demo user ${username}.`,
          );
        }
      }
      return count;
    });
    console.log(`Production demo accounts checked (${created} created).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  if (error instanceof DemoSeedError) {
    console.error(error.message);
  } else {
    const code =
      error instanceof Prisma.PrismaClientKnownRequestError
        ? ` (${error.code})`
        : '';
    console.error(
      `Production demo provisioning failed${code}. Check the database connection and schema.`,
    );
  }
  process.exitCode = 1;
});
