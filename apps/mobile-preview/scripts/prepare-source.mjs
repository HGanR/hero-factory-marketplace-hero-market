import { readFile, writeFile, mkdir, rm, copyFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { builtinModules } from 'node:module';
import ts from 'typescript';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(app, '../..');
const destination = path.join(app, 'shared');
const pkg = JSON.parse(await readFile(path.join(app, 'package.json'), 'utf8'));
const manifest = { schema: 'mobile-preview-source-v1', files: {}, packages: [] };
const external = new Set();
const visited = new Set();
const entries = ['src/app/mobile/route.ts', 'src/app/mobile/terms/route.ts', 'src/app/mobile/icon.png/route.ts', 'src/app/api/mobile/session/route.ts'];

// Copy the actual dependency closure. No auth/database replacement or generated handlers.
async function visit(relative) {
  if (visited.has(relative)) return;
  if (!relative.startsWith('src/') || relative.includes('..')) throw new Error(`Source outside approved tree: ${relative}`);
  visited.add(relative);
  const bytes = await readFile(path.join(root, relative));
  manifest.files[relative] = createHash('sha256').update(bytes).digest('hex');
  const target = path.join(destination, relative);
  await mkdir(path.dirname(target), {recursive: true});
  await writeFile(target, bytes);
  const imports = ts.preProcessFile(bytes.toString('utf8'), true, true).importedFiles;
  for (const {fileName: specifier} of imports) {
    if (specifier.startsWith('@/') || specifier.startsWith('.')) {
      const base = specifier.startsWith('@/') ? 'src/' + specifier.slice(2) : path.posix.join(path.posix.dirname(relative), specifier);
      let found;
      for (const candidate of [base, base+'.ts', base+'.tsx', base+'/index.ts']) {
        try { if ((await stat(path.join(root, candidate))).isFile()) { found=candidate; break; } } catch {}
      }
      if (!found) throw new Error(`Unresolved source: ${relative} -> ${specifier}`);
      await visit(found);
    } else if (!specifier.startsWith('node:') && !builtinModules.includes(specifier)) {
      const name = specifier.startsWith('@') ? specifier.split('/').slice(0,2).join('/') : specifier.split('/')[0];
      if (!pkg.dependencies[name] && !pkg.devDependencies[name]) throw new Error(`Undeclared preview dependency: ${name}`);
      external.add(name);
    }
  }
}
await rm(destination, {recursive: true, force: true});
await rm(path.join(app, 'public'), {recursive: true, force: true});
for (const entry of entries) await visit(entry);
const publicFiles = (await readdir(path.join(root, 'public/mobile'))).map(name=>'public/mobile/'+name);
publicFiles.push('public/smart-trust-mobile-sw.js');
for (const relative of publicFiles) {
  const bytes = await readFile(path.join(root, relative));
  manifest.files[relative] = createHash('sha256').update(bytes).digest('hex');
  await mkdir(path.dirname(path.join(app, relative)), {recursive:true});
  await copyFile(path.join(root, relative), path.join(app, relative));
}
manifest.packages = [...external].sort();
await writeFile(path.join(app, 'source-manifest.json'), JSON.stringify(manifest,null,2)+'\n');
console.log(`Prepared ${Object.keys(manifest.files).length} verified source/assets; website login and database code copied unchanged.`);
