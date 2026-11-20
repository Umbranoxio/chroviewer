import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { runnerImport } from 'vite-plus';
import { format } from 'vite-plus/fmt';

const root = resolve(import.meta.dirname, '../..');
const layoutsDirectory = join(root, 'src/core/share-layouts');
const codecPath = join(root, 'src/core/share-settings-codec.ts');

type Codec = typeof import('../../src/core/share-settings-codec.ts');

async function frozenVersions() {
  const files = await readdir(layoutsDirectory).catch(() => []);
  return files
    .map((file) => /^v(\d+)\.json$/.exec(file)?.[1])
    .filter((version) => version !== undefined)
    .map(Number)
    .sort((a, b) => a - b);
}

const check = process.argv.includes('--check');
const { module } = await runnerImport<Codec>(codecPath, { configFile: false, root, logLevel: 'silent' });
const authored: unknown = JSON.parse(JSON.stringify(module.authoredShareLayout()));

const versions = await frozenVersions();
const gap = versions.findIndex((version, index) => version !== index);
if (gap !== -1) throw new Error(`share-layouts must be numbered v0, v1, ... without gaps (found v${versions[gap]})`);

const latest = versions.at(-1);
const frozen: unknown =
  latest === undefined ? undefined : JSON.parse(await readFile(join(layoutsDirectory, `v${latest}.json`), 'utf8'));
if (isDeepStrictEqual(authored, frozen)) {
  console.log(`Share layout is up to date (v${latest}).`);
  process.exit(0);
}

const next = latest === undefined ? 0 : latest + 1;
if (check) {
  console.error(
    latest === undefined
      ? "This shouldn't be possible, but no share layout found. Run `vp run share-layout:generate`."
      : `Shared settings changed since share-layouts/v${latest}.json, so links made with it would decode ` +
          `differently. Run \`vp run share-layout:generate\` to create v${next}.json`,
  );
  process.exit(1);
}
const output = join(layoutsDirectory, `v${next}.json`);
const formatted = await format(output, JSON.stringify(authored, null, 2), { printWidth: 120 }); // as in vite.config.ts
if (formatted.errors.length > 0) throw new Error('share layout formatting failed', { cause: formatted.errors });
await writeFile(output, formatted.code);
console.log(`Wrote src/core/share-layouts/v${next}.json`);
