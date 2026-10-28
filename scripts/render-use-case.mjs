import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const check = args.includes('--check');
const positional = args.filter((arg) => arg !== '--check');
if (positional.length < 1 || positional.length > 2) {
  throw new Error('Usage: node scripts/render-use-case.mjs <plantuml-1.2026.8.jar> [java-executable] [--check]');
}

const [jar, java = 'java'] = positional;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const jarSha256 = '5e1ecfa8ecd32c90b03bbf3b1eb6f020943f98ab0fcf4032be31a0002ee2c462';
if (sha256(readFileSync(jar)) !== jarSha256) {
  throw new Error('Expected the pinned PlantUML 1.2026.8 jar; SHA-256 mismatch');
}

const sourcePath = 'docs/diagrams/use-case-overview.puml';
const source = readFileSync(resolve(root, sourcePath), 'utf8').replaceAll('\r\n', '\n');
const outputs = {};
const saveOrCheck = (path, bytes) => {
  if (check) {
    if (!readFileSync(resolve(root, path)).equals(bytes)) {
      throw new Error(`${path} differs from its rendered source; regenerate with the pinned environment`);
    }
  } else {
    writeFileSync(resolve(root, path), bytes);
  }
};

for (const format of ['svg', 'png']) {
  const result = spawnSync(java, [
    '-Djava.awt.headless=true', '-DPLANTUML_LIMIT_SIZE=12000',
    '-jar', resolve(jar), '-charset', 'UTF-8', '-failfast2', `-t${format}`, '-pipe',
  ], { input: Buffer.from(source, 'utf8'), maxBuffer: 40 * 1024 * 1024, timeout: 60000, windowsHide: true });
  if (result.error || result.status !== 0 || !result.stdout?.length) {
    throw new Error(`${format}: ${result.error ?? result.stderr?.toString('utf8') ?? 'render failed'}`);
  }
  const output = sourcePath.replace(/\.puml$/, `.${format}`);
  saveOrCheck(output, result.stdout);
  outputs[output] = sha256(result.stdout);
  console.log(`${check ? 'Checked' : 'Rendered'} ${output}`);
}

const manifest = Buffer.from(JSON.stringify({
  renderer: 'PlantUML 1.2026.8',
  environment: 'Java 27 / Windows / Arial / Graphviz 2.44.1',
  jarSha256,
  sourceNormalization: 'UTF-8, CRLF -> LF',
  source: sourcePath,
  sourceSha256: sha256(source),
  outputs,
}, null, 2) + '\n', 'utf8');
saveOrCheck('docs/diagrams/use-case-overview.manifest.json', manifest);
console.log(`${check ? 'Checked' : 'Wrote'} source/output manifest`);
