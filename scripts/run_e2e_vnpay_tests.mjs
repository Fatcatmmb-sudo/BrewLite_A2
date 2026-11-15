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

const vnpayDir = 'apps/web/tests/e2e/vnpay';
const specFiles = [
  'vnpay-double-click.spec.ts',
  'vnpay-error-messages.spec.ts',
  'vnpay-happy-path.spec.ts',
  'vnpay-idempotency.spec.ts',
  'vnpay-ipn-race.spec.ts',
  'vnpay-network-loss.spec.ts',
  'vnpay-polling.spec.ts',
  'vnpay-signature.spec.ts',
  'vnpay-timeout-recovery.spec.ts'
];

for (const file of specFiles) {
  const filePath = path.join(vnpayDir, file);
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    continue;
  }

  const baseName = file.replace('.spec.ts', '');
  const logName = `${baseName}-e2e-test.log`;
  const logPath = path.join(evidenceDir, logName);

  // If log already exists and has content > 1000 bytes, skip
  if (fs.existsSync(logPath) && fs.statSync(logPath).size > 1000) {
    console.log(`Skipping ${file} because ${logName} already exists (${fs.statSync(logPath).size} bytes).`);
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
  console.log(`Processing ${file} (${titles.length} tests) -> ${logName}`);
  console.log(`==================================================`);

  for (let i = 0; i < titles.length; i++) {
    const title = titles[i];
    console.log(`[${i + 1}/${titles.length}] Running: ${title}`);

    // Command matching Playwright test:e2e:vnpay formula in tests/REAME.md
    const cmd = `npm --prefix apps/web run test:e2e:vnpay -- ${filePath} -g "${title}" >> "${logPath}" 2>&1`;

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

console.log('\nAll VNPay E2E test suites completed!');
