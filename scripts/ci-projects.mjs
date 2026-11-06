import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const projects = ['apps/api', 'apps/web'];
const stages = ['lint', 'test', 'build'];

export function runStage(action, { root = process.cwd(), execute = spawnSync } = {}) {
  if (!['validate', 'install', ...stages].includes(action)) {
    throw new Error('Usage: node scripts/ci-projects.mjs validate|install|lint|test|build');
  }

  // Validate both apps before running any command. Missing runtime must never pass.
  for (const project of projects) {
    const manifest = resolve(root, project, 'package.json');
    const lock = resolve(root, project, 'package-lock.json');
    if (!existsSync(manifest) || !existsSync(lock)) {
      throw new Error(`${project} needs package.json and package-lock.json before CI can run.`);
    }
    let pkg;
    try {
      pkg = JSON.parse(readFileSync(manifest, 'utf8'));
    } catch (error) {
      throw new Error(`Invalid ${project}/package.json: ${error.message}`);
    }
    for (const stage of stages) {
      if (typeof pkg?.scripts?.[stage] !== 'string' || !pkg.scripts[stage].trim()) {
        throw new Error(`${project}/package.json needs a non-empty ${stage} script.`);
      }
    }
  }

  if (action === 'validate') return;
  for (const project of projects) {
    console.log(`CI ${action}: ${project}`);
    const args = action === 'install' ? ['ci'] : ['run', action];
    const result = execute(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
      cwd: resolve(root, project), stdio: 'inherit', shell: process.platform === 'win32',
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`${project}: npm ${args.join(' ')} failed (status ${result.status}, signal ${result.signal ?? 'none'}).`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    runStage(process.argv[2]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
