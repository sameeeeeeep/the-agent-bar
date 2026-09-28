import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
import {randomBytes} from 'node:crypto';
import {exportPublic, PUBLIC_FILES} from './export-public.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bar-public-'));
  t.after(() => fs.rmSync(root, {recursive:true, force:true}));
  const source = path.join(root, 'source');
  fs.mkdirSync(source);
  for (const file of PUBLIC_FILES) {
    const target = path.join(source, file);
    fs.mkdirSync(path.dirname(target), {recursive:true});
    fs.copyFileSync(path.join(here, file), target);
  }
  fs.writeFileSync(path.join(source, 'LICENSE'), 'MIT License\n\nCopyright (c) 2026 Test Author\n');
  return {root, source, out:path.join(root, 'public')};
}

test('exports only reviewed source and preserves licenses without deployment identities', t => {
  const f = fixture(t);
  const canary = randomBytes(24).toString('hex');
  for (const file of ['worker/.dev.vars', 'worker/.production-admin-secret', 'LAUNCH.md', 'worker/seed.sql', 'site/agentbreakroom/secret.json']) {
    fs.writeFileSync(path.join(f.source, file), canary);
  }
  fs.writeFileSync(path.join(f.source, 'worker/wrangler.toml'), canary);
  fs.writeFileSync(path.join(f.source, 'site/agentbreakroom/break.md'), 'OUTDATED_PROTOTYPE_BRIEF');
  fs.mkdirSync(path.join(f.source, 'worker/node_modules'));
  fs.writeFileSync(path.join(f.source, 'worker/node_modules/private'), canary);
  const result = exportPublic(f);
  assert.ok(result.files.includes('LICENSE'));
  assert.ok(result.files.includes('site/agentbreakroom/fonts/OFL-Doto.txt'));
  assert.ok(result.files.includes('site/agentbreakroom/vendor/three/LICENSE'));
  for (const file of result.files) assert.ok(!fs.readFileSync(path.join(f.out, file)).includes(Buffer.from(canary)), file);
  const config = fs.readFileSync(path.join(f.out, 'worker/wrangler.toml'), 'utf8');
  assert.match(config, /00000000-0000-0000-0000-000000000000/);
  assert.doesNotMatch(config, /thelastprompt|switchboard|6e641afd/);
  assert.equal(fs.readFileSync(path.join(f.out, 'site/agentbreakroom/break.md'), 'utf8'), fs.readFileSync(path.join(f.out, 'site/agentbreakroom/bar.md'), 'utf8'));
  const readme = fs.readFileSync(path.join(f.out, 'README.md'), 'utf8');
  assert.doesNotMatch(readme, /cd examples\/break-room/);
  assert.match(readme, /placeholder D1 database ID/);
  assert.doesNotMatch(fs.readFileSync(path.join(f.out, 'stage.mjs'), 'utf8'), /\.\.\/\.\.\/\.\.\/the-last-prompt/);
});

test('copies only named optional documents and maps the daily workflow', t => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.source, 'workflows'));
  fs.writeFileSync(path.join(f.source, 'workflows/daily-digest.yml'), 'name: Daily digest\n');
  fs.writeFileSync(path.join(f.source, 'workflows/private.yml'), 'PRIVATE');
  fs.writeFileSync(path.join(f.source, 'PUBLIC.md'), 'Public instructions\n');
  fs.mkdirSync(path.join(f.source, 'daily'));
  fs.writeFileSync(path.join(f.source, 'daily/scratch.json'), 'PRIVATE');
  const {files} = exportPublic(f);
  assert.ok(files.includes('.github/workflows/daily-digest.yml'));
  assert.ok(files.includes('PUBLIC.md'));
  assert.ok(!files.some(file => file.startsWith('daily/')));
  assert.ok(!files.some(file => file.includes('private.yml')));
});

test('refuses source symlinks instead of following them into private files', t => {
  const f = fixture(t);
  const victim = path.join(f.source, 'site/agentbreakroom/bar-app.js');
  fs.unlinkSync(victim);
  const secret = path.join(f.root, 'secret');
  fs.writeFileSync(secret, 'PRIVATE');
  fs.symlinkSync(secret, victim);
  assert.throws(() => exportPublic(f), /no symlinks/);
  assert.ok(!fs.existsSync(f.out));
});

test('refuses directory symlinks and nonempty output', t => {
  const f = fixture(t);
  const site = path.join(f.source, 'site');
  fs.renameSync(site, path.join(f.root, 'site-real'));
  fs.symlinkSync(path.join(f.root, 'site-real'), site);
  assert.throws(() => exportPublic(f), /no symlinks/);
  fs.unlinkSync(site);
  fs.renameSync(path.join(f.root, 'site-real'), site);
  fs.mkdirSync(f.out);
  fs.writeFileSync(path.join(f.out, 'keep'), 'USER_DATA');
  assert.throws(() => exportPublic(f), /new or empty/);
  assert.equal(fs.readFileSync(path.join(f.out, 'keep'), 'utf8'), 'USER_DATA');
});

test('refuses output inside or containing the source tree', t => {
  const f = fixture(t);
  assert.throws(() => exportPublic({...f, out:path.join(f.source, 'public')}), /outside the source tree/);
  assert.throws(() => exportPublic({...f, out:f.root}), /outside the source tree/);
});
