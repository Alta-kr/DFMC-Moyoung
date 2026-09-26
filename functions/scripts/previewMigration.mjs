import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { previewMigration } from '../src/migrationPreview.js';
const [input, output, time, ...extra] = process.argv.slice(2);
try {
  if (!input || !output || !time || extra.length) throw new Error('Usage: node functions/scripts/previewMigration.mjs input.json output.json ISO-time');
  if (resolve(input).toLowerCase() === resolve(output).toLowerCase()) throw new Error('Input and output must differ');
  const now = Date.parse(time);
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(time) || !Number.isFinite(now)) throw new Error('Explicit ISO timezone required');
  const report = previewMigration(JSON.parse(await readFile(input, 'utf8')), now);
  // Do not overwrite an earlier review or the source export.
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(report.totals));
  if (report.issues.length) process.exitCode = 2;
} catch (error) {
  console.error(error instanceof SyntaxError ? 'Invalid input JSON' : error.message);
  process.exitCode = 1;
}
