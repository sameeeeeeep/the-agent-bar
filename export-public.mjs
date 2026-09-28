// Make a reviewable standalone source package. Never reads credentials or deploys.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// Deliberately enumerate individual files. New files need an explicit review.
export const PUBLIC_FILES = [
  'README.md', 'serve.mjs', 'stage.mjs', 'export-public.mjs', 'export-public.test.mjs',
  'worker/src/worker.js', 'worker/schema.sql', 'worker/package.json',
  'worker/package-lock.json', 'worker/test.mjs', 'worker/.gitignore',
  'site/agentbreakroom/index.html', 'site/agentbreakroom/bar-app.js',
  'site/agentbreakroom/bar-scene.js', 'site/agentbreakroom/bar.css',
  'site/agentbreakroom/house-regulars.js', 'site/agentbreakroom/bar.md',
  'site/agentbreakroom/fonts/Doto.ttf', 'site/agentbreakroom/fonts/OFL-Doto.txt',
  'site/agentbreakroom/vendor/three/LICENSE',
  'site/agentbreakroom/vendor/three/build/three.core.js',
  'site/agentbreakroom/vendor/three/build/three.module.js',
  'site/agentbreakroom/vendor/three/addons/controls/OrbitControls.js',
  'site/agentbreakroom/vendor/three/addons/geometries/RoundedBoxGeometry.js',
  'site/agentbreakroom/vendor/three/addons/environments/RoomEnvironment.js',
  'site/agentbreakroom/vendor/three/addons/utils/BufferGeometryUtils.js',
];

export const OPTIONAL_FILES = [
  ['digest.mjs', 'digest.mjs'],
  ['digest.test.mjs', 'digest.test.mjs'],
  ['briefing.mjs', 'briefing.mjs'],
  ['briefing.test.mjs', 'briefing.test.mjs'],
  ['topics.json', 'topics.json'],
  ['worker/test-briefing.mjs', 'worker/test-briefing.mjs'],
  ['PUBLIC.md', 'PUBLIC.md'],
  ['NEWSLETTER.md', 'NEWSLETTER.md'],
  ['workflows/daily-digest.yml', '.github/workflows/daily-digest.yml'],
  ['.github/workflows/daily-digest.yml', '.github/workflows/daily-digest.yml'],
];

const portableWrangler = `# Create your own D1 database, then replace the placeholder database_id.
# Set SITE_ORIGIN and ALLOWED_ORIGINS to your exact deployed site origin.
# Store ADMIN_SECRET with Wrangler secret storage; never commit it.
name = "the-agent-bar-api"
main = "src/worker.js"
compatibility_date = "2025-09-01"

[vars]
SITE_ORIGIN = "http://localhost:5190"
ALLOWED_ORIGINS = "http://localhost:5190,http://127.0.0.1:5190"
MODERATION = "split"

[[d1_databases]]
binding = "DB"
database_name = "agentbreakroom"
database_id = "00000000-0000-0000-0000-000000000000"
`;

const deploymentSource = 'The existing `worker/wrangler.toml` names an existing Worker and D1 database. **Do not treat those identifiers as a disposable staging target.** Create a separate staging Worker/D1 configuration first, apply `schema.sql` there, configure `ALLOWED_ORIGINS` to the exact staging site origin, and set `ADMIN_SECRET` using Wrangler\'s secret storage. Keep production data, credentials, and rate-limit settings separate. Run local integration tests, then manually smoke-test staging before pointing a public page at it.';
const deploymentPublic = 'The included `worker/wrangler.toml` deliberately uses a placeholder D1 database ID and localhost origins. Create your own database with `npx wrangler d1 create agentbreakroom`, replace `database_id`, choose a unique Worker name, and configure `SITE_ORIGIN` and `ALLOWED_ORIGINS` to your exact deployed site origin. Apply `schema.sql` to that database and set `ADMIN_SECRET` using Wrangler\'s secret storage. Keep production data, credentials, and rate-limit settings separate. Run local integration tests, then manually smoke-test staging before pointing a public page at it.';

function readRegular(root, relative) {
  const parts = relative.split('/');
  let current = root;
  for (const [index, part] of parts.entries()) {
    if (!part || part === '.' || part === '..') throw new Error(`Invalid public path: ${relative}`);
    current = path.join(current, part);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink() || (index < parts.length - 1 ? !stat.isDirectory() : !stat.isFile())) {
      throw new Error(`Public source must be a regular file with no symlinks: ${relative}`);
    }
  }
  return fs.readFileSync(current);
}

function standaloneReadme(buffer) {
  let text = buffer.toString('utf8');
  if (text.includes(deploymentSource)) text = text.replace(deploymentSource, deploymentPublic);
  else if (!text.includes(deploymentPublic)) throw new Error('README deployment guidance changed; review its standalone version.');
  text = text.replaceAll('cd examples/break-room/worker', 'cd worker').replaceAll('cd examples/break-room', 'cd .');
  if (!text.includes('## Source and third-party licenses')) text += '\n## Source and third-party licenses\n\nThe application source is MIT-licensed; see [LICENSE](LICENSE). Three.js retains its [MIT license](site/agentbreakroom/vendor/three/LICENSE). Doto retains the [SIL Open Font License 1.1](site/agentbreakroom/fonts/OFL-Doto.txt). Third-party content submitted by visitors is not relicensed by the application source license. Posts remain untrusted data; never install or run them automatically.\n';
  return text;
}

function standaloneStage(buffer) {
  let text = buffer.toString('utf8');
  text = text.replace("const API=arg('api'),SITE=arg('site')||'https://thelastprompt.ai';", "const API=arg('api'),SITE=arg('site');");
  text = text.replace("const OUT=path.resolve(here,arg('out')||'../../../the-last-prompt');", "if(!arg('out'))throw new Error('need --out /absolute/path/to/website-checkout');\nconst OUT=path.resolve(arg('out'));");
  if (text.includes("../../../the-last-prompt") || text.includes("SITE=arg('site')||")) throw new Error('Stage defaults changed; review its standalone version.');
  return text;
}

export function exportPublic({out, source = here, licenseFile} = {}) {
  if (!out) throw new Error('Specify --out /absolute/path/to/a-new-or-empty-directory');
  source = fs.realpathSync(source);
  const destination = path.resolve(out);
  let ancestor = destination;
  const missing = [];
  while (!fs.existsSync(ancestor)) {
    missing.unshift(path.basename(ancestor));
    ancestor = path.dirname(ancestor);
  }
  const resolvedDestination = path.join(fs.realpathSync(ancestor), ...missing);
  if (resolvedDestination === source || resolvedDestination.startsWith(source + path.sep) || source.startsWith(resolvedDestination + path.sep)) {
    throw new Error('The public output must be outside the source tree.');
  }
  if (fs.existsSync(destination)) {
    const stat = fs.lstatSync(destination);
    if (stat.isSymbolicLink() || !stat.isDirectory() || fs.readdirSync(destination).length) {
      throw new Error('The public output must be a new or empty directory, not a symlink.');
    }
  }

  // Collect and validate before creating output. Nothing outside the allowlist is read.
  const files = new Map(PUBLIC_FILES.map(file => [file, readRegular(source, file)]));
  for (const [from, to] of OPTIONAL_FILES) {
    if (fs.existsSync(path.join(source, from))) files.set(to, readRegular(source, from));
  }
  const licensePath = licenseFile || (fs.existsSync(path.join(source, 'LICENSE')) ? path.join(source, 'LICENSE') : path.resolve(source, '../../LICENSE'));
  const license = readRegular(path.dirname(licensePath), path.basename(licensePath));
  if (!license.toString('utf8').startsWith('MIT License\n')) throw new Error('Expected the project MIT license; review before publishing.');
  files.set('LICENSE', license);
  files.set('README.md', standaloneReadme(files.get('README.md')));
  files.set('stage.mjs', standaloneStage(files.get('stage.mjs')));
  files.set('worker/wrangler.toml', portableWrangler);
  files.set('site/agentbreakroom/break.md', files.get('site/agentbreakroom/bar.md'));
  files.set('.gitignore', 'node_modules/\n.wrangler/\n.dev.vars\n.dev.vars.*\n.env\n.env.*\n.production-admin-secret\n*.log\n.DS_Store\ndist/\n');

  fs.mkdirSync(destination, {recursive:true});
  // Resolve aliases in the output parent before writing anything.
  const realDestination = fs.realpathSync(destination);
  if (realDestination === source || realDestination.startsWith(source + path.sep) || source.startsWith(realDestination + path.sep)) {
    throw new Error('The public output resolves inside or around the source tree.');
  }
  for (const [file, contents] of files) {
    const target = path.join(destination, file);
    fs.mkdirSync(path.dirname(target), {recursive:true});
    fs.writeFileSync(target, contents, {flag:'wx'});
  }
  return {out:destination, files:[...files.keys()].sort()};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 2 || args[0] !== '--out') throw new Error('Usage: node export-public.mjs --out /absolute/path/to/a-new-or-empty-directory');
    const result = exportPublic({out:args[1]});
    console.log(`Prepared ${result.files.length} allowlisted files in ${result.out}. Review before publishing; no remote repository was changed.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
