import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const evidenceDir = 'test-evidence';
if (!fs.existsSync(evidenceDir)) {
  fs.mkdirSync(evidenceDir, { recursive: true });
}

// Ensure default DATABASE_URL for E2E if not set
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://brewlite:123456@localhost:5432/brewlite_local_e2e?schema=public';
}

// All web E2E files requested (excluding tests/e2e/vnpay)
const e2eFiles = [
  'apps/web/tests/e2e/checkout-paid-recovery.spec.ts',
  'apps/web/tests/e2e/checkout.spec.ts',
  'apps/web/tests/e2e/inventory.spec.ts',
  'apps/web/tests/e2e/order-payment-retry.spec.ts',
  'apps/web/tests/e2e/orders-session.spec.ts',
  'apps/web/tests/e2e/staff.spec.ts',
  'apps/web/tests/e2e/delivery/checkout-flow.spec.ts',
  'apps/web/tests/e2e/fixtures/vnpay-fixtures.test.ts'
];

for (const filePath of e2eFiles) {
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    continue;
  }

  const rawBase = path.basename(filePath);
  let baseName = rawBase;
  if (baseName.endsWith('.spec.ts')) {
    baseName = baseName.replace('.spec.ts', '');
  } else if (baseName.endsWith('.test.ts')) {
    baseName = baseName.replace('.test.ts', '');
  }

  const logName = `${baseName}-web-e2e-test.log`;
  const logPath = path.join(evidenceDir, logName);

  // If log already exists and has content > 1000 bytes, skip
  if (fs.existsSync(logPath) && fs.statSync(logPath).size > 1000) {
    console.log(`Skipping ${filePath} because ${logName} already exists (${fs.statSync(logPath).size} bytes).`);
    continue;
  }

  // Clear existing log file if incomplete
  if (fs.existsSync(logPath)) {
    fs.unlinkSync(logPath);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const titles = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^\s*(?:it|test)(?:\.skip)?\s*\(\s*(['"`])(.*?)\1/);
    if (match) {
      let t = match[2].trim();
      if (t.includes('${')) {
        t = t.split('$')[0].trim();
      }
      if (t.length > 0 && !titles.includes(t)) {
        titles.push(t);
      }
    }
  }

  console.log(`\n==================================================`);
  console.log(`Processing ${filePath} (${titles.length} tests) -> ${logName}`);
  console.log(`==================================================`);

  for (let i = 0; i < titles.length; i++) {
    const title = titles[i];
    console.log(`[${i + 1}/${titles.length}] Running: ${title}`);

    // Command matching Playwright test formula in tests/REAME.md
    const cmd = `npm --prefix apps/web run test:e2e -- ${filePath} -g "${title}" >> "${logPath}" 2>&1`;

    const res = spawnSync('cmd.exe', ['/c', cmd], {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: false,
      env: process.env
    });

    if (res.status !== 0) {
      console.warn(`Warning: test "${title}" exited with code ${res.status}`);
    }
  }
}

console.log('\nAll web E2E test suites completed!');
