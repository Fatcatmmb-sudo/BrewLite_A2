import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const e2eDir = 'apps/api/test/e2e';
const evidenceDir = 'test-evidence';

// All API E2E test files in apps/api/test/e2e
const specFiles = [
  'app.e2e-spec.ts',
  'auth.e2e-spec.ts',
  'checkout.e2e-spec.ts',
  'staff-orders.e2e-spec.ts'
];

if (!fs.existsSync(evidenceDir)) {
  fs.mkdirSync(evidenceDir, { recursive: true });
}

// Ensure default SMOKE_DATABASE_URL if not set
if (!process.env.SMOKE_DATABASE_URL) {
  process.env.SMOKE_DATABASE_URL = 'postgresql://brewlite:123456@localhost:5432/brewlite_foundation_smoke_local?schema=public';
}

for (const file of specFiles) {
  const filePath = path.join(e2eDir, file);
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    continue;
  }

  const logName = file.replace('.e2e-spec.ts', '-e2e-test.log');
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
    const cmd = `npm --prefix apps/api run test:e2e -- ${file} -t "${title}" >> "${logPath}" 2>&1`;

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

console.log('\nAll E2E API test suites completed!');
