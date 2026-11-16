import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const unitDir = 'apps/api/test/unit';
const evidenceDir = 'test-evidence';

// Unit suites selected for the existing handover logs.
const specFiles = [
  'config/app-config.smoke.spec.ts',
  'modules/auth/services/auth.service.spec.ts',
  'modules/catalog/catalog.service.spec.ts',
  'modules/health/health.controller.spec.ts',
  'modules/auth/jwt.spec.ts',
  'modules/payments/mock-gateway.spec.ts',
  'modules/orders/order-state.spec.ts',
  'modules/orders/orders.controller.spec.ts',
  'modules/payments/payments.controller.spec.ts',
  'modules/payments/payments.service.spec.ts',
  'modules/catalog/recipe-capacity.spec.ts'
];

if (!fs.existsSync(evidenceDir)) {
  fs.mkdirSync(evidenceDir, { recursive: true });
}

for (const file of specFiles) {
  const filePath = path.join(unitDir, file);
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    continue;
  }

  const logName = path.basename(file).replace('.smoke.spec.ts', '.spec.ts').replace('.spec.ts', '-unit-test.log');
  const logPath = path.join(evidenceDir, logName);

  // If log already exists and has content > 1000 bytes, skip
  if (fs.existsSync(logPath) && fs.statSync(logPath).size > 1000) {
    console.log(`Skipping ${file} because ${logName} already exists (${fs.statSync(logPath).size} bytes).`);
    continue;
  }

  // Clear existing log file if any incomplete
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
    const cmd = `npm --prefix apps/api run test -- test/unit/${file} -t "${title}" >> "${logPath}" 2>&1`;

    const res = spawnSync('cmd.exe', ['/c', cmd], {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: false
    });

    if (res.status !== 0) {
      console.warn(`Warning: test "${title}" exited with code ${res.status}`);
    }
  }
}

console.log('\nAll unit test suites completed!');
