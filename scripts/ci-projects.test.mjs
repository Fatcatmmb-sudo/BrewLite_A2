import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { runStage } from './ci-projects.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'brewlite-ci-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const app of ['api', 'web']) {
    const dir = join(root, 'apps', app);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({
      name: app, version: '1.0.0',
      scripts: { lint: 'node -e "process.exit(0)"', test: 'node -e "process.exit(0)"', build: 'node -e "process.exit(0)"' },
    }));
    writeFileSync(join(dir, 'package-lock.json'), JSON.stringify({
      name: app, version: '1.0.0', lockfileVersion: 3,
      packages: { '': { name: app, version: '1.0.0' } },
    }));
  }
  return root;
}

test('dispatches Install -> Lint -> Unit Test -> Build for both applications', t => {
  const root = fixture(t);
  const calls = [];
  const execute = (command, args, options) => {
    calls.push([command, args, options.cwd]);
    return { status: 0 };
  };
  for (const action of ['validate', 'install', 'lint', 'test', 'build']) runStage(action, { root, execute });
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  assert.deepEqual(calls, ['install', 'lint', 'test', 'build'].flatMap(action =>
    ['api', 'web'].map(app => [npm, action === 'install' ? ['ci'] : ['run', action], join(root, 'apps', app)])));
});

for (const action of ['install', 'lint', 'test', 'build']) {
  test(`${action} failure stops the pipeline before later apps/stages`, t => {
    const root = fixture(t);
    const calls = [];
    assert.throws(() => {
      for (const stage of ['install', 'lint', 'test', 'build']) {
        runStage(stage, { root, execute: () => {
          calls.push(stage);
          return { status: stage === action ? 7 : 0 };
        } });
      }
    }, /failed \(status 7/);
    assert.equal(calls.at(-1), action);
    assert.equal(calls.filter(value => value === action).length, 1);
  });
}

test('missing manifest/lock in either app fails before executing npm', t => {
  for (const app of ['api', 'web']) {
    for (const file of ['package.json', 'package-lock.json']) {
      const root = fixture(t);
      rmSync(join(root, 'apps', app, file));
      assert.throws(() => runStage('install', { root, execute: () => assert.fail('must not execute') }), /needs package.json and package-lock.json/);
    }
  }
});

test('invalid JSON and missing/blank scripts fail validation', t => {
  for (const contents of ['{', 'null', '{"scripts":{}}', '{"scripts":{"lint":" ","test":"x","build":"x"}}']) {
    const root = fixture(t);
    writeFileSync(join(root, 'apps', 'web', 'package.json'), contents);
    assert.throws(() => runStage('validate', { root }), /Invalid|non-empty/);
  }
});

test('spawn errors and killed processes cannot pass', t => {
  const root = fixture(t);
  assert.throws(() => runStage('test', { root, execute: () => ({ error: new Error('npm unavailable') }) }), /npm unavailable/);
  assert.throws(() => runStage('test', { root, execute: () => ({ status: null, signal: 'SIGTERM' }) }), /SIGTERM/);
});

test('CLI returns a failing exit code for unknown actions and missing apps', t => {
  const root = fixture(t);
  const script = fileURLToPath(new URL('./ci-projects.mjs', import.meta.url));
  const unknown = spawnSync(process.execPath, [script, 'unknown'], { cwd: root, encoding: 'utf8' });
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /Usage:/);
  rmSync(join(root, 'apps', 'api', 'package.json'));
  const missing = spawnSync(process.execPath, [script, 'validate'], { cwd: root, encoding: 'utf8' });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /apps\/api needs/);
});

test('real npm completes fixture pipeline and propagates a failing unit test', t => {
  const root = fixture(t);
  for (const stage of ['install', 'lint', 'test', 'build']) runStage(stage, { root });
  const manifest = join(root, 'apps', 'api', 'package.json');
  writeFileSync(manifest, JSON.stringify({
    scripts: { lint: 'node -e "process.exit(0)"', test: 'node -e "process.exit(7)"', build: 'node -e "process.exit(0)"' },
  }));
  const script = fileURLToPath(new URL('./ci-projects.mjs', import.meta.url));
  const failed = spawnSync(process.execPath, [script, 'test'], { cwd: root, encoding: 'utf8' });
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /failed \(status 7/);
  assert.doesNotMatch(failed.stdout, /CI test: apps\/web/);
});
