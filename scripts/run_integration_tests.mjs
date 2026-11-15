import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const intDir = 'apps/api/test/integration';
const evidenceDir = 'test-evidence';

// All integration test files in apps/api/test/integration
const specFiles = [
  'catalog-seed.integration-spec.ts',
  'foundation.integration-spec.ts',
  'inventory-concurrency.integration-spec.ts',
  'inventory-expiry.integration-spec.ts',
  'loyalty-redemption.integration-spec.ts',
  'order-state-machine.integration-spec.ts',
  'orders-inventory.integration-spec.ts',
  'orders.integration-spec.ts',
  'payment-expiry.integration-spec.ts',
  's1.integration-spec.ts',
  'staff-inventory.integration-spec.ts'
];

if (!fs.existsSync(evidenceDir)) {
  fs.mkdirSync(evidenceDir, { recursive: true });
}

// Ensure default SMOKE_DATABASE_URL if not set
if (!process.env.SMOKE_DATABASE_URL) {
  process.env.SMOKE_DATABASE_URL = 'postgresql://brewlite:123456@localhost:5432/brewlite_foundation_smoke_local?schema=public';
}

for (const file of specFiles) {
  const filePath = path.join(intDir, file);
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    continue;
  }

  const logName = file.replace('.integration-spec.ts', '-integration-test.log');
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

    // Command matching formula in tests/REAME.md
    const cmd = `npm --prefix apps/api run test:integration -- ${file} -t "${title}" >> "${logPath}" 2>&1`;

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

console.log('\nAll integration test suites completed!');
