import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const unitDir = 'apps/web/tests/unit';
const evidenceDir = 'test-evidence';

// All unit test files in apps/web/tests/unit
const specFiles = [
  'auth-api.test.mjs',
  'auth-session.test.mjs',
  'auth-ui.test.mjs',
  'cart-store.test.mjs',
  'catalog-api.test.mjs',
  'catalog.test.mjs',
  'checkout-session.test.mjs',
  'coupons-api.test.mjs',
  'health.test.mjs',
  'inventory-api.test.mjs',
  'loyalty-api.test.mjs',
  'loyalty-page.test.mjs',
  'menu-states.test.mjs',
  'orders-payments-auth.test.mjs',
  'product-detail-modal.test.mjs',
  'scroll-header.test.mjs',
  'staff-api.test.mjs'
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

  const logName = file.replace('.test.mjs', '-web-unit-test.log');
  const logPath = path.join(evidenceDir, logName);

  // If log already exists and has content > 300 bytes, skip
  if (fs.existsSync(logPath) && fs.statSync(logPath).size > 300) {
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

    // Command matching formula in tests/REAME.md for apps/web:
    const cmd = `node --test --test-name-pattern="${title}" apps\\web\\tests\\unit\\${file} >> "${logPath}" 2>&1`;

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

console.log('\nAll web unit test suites completed!');
