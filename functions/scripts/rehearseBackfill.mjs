import { readFile, open } from 'node:fs/promises';
import { rehearseLocalBackfill } from '../src/localBackfill.js';
const [input, output, time, ...extra] = process.argv.slice(2);
let report;
try {
  if (!input || !output || !time || extra.length) throw new Error('Usage: node functions/scripts/rehearseBackfill.mjs input.json new-report.json ISO-time');
  const now = Date.parse(time);
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(time) || !Number.isFinite(now)) throw new Error('Explicit ISO timezone required');
  const snapshot = JSON.parse(await readFile(input, 'utf8'));
  report = await open(output, 'wx'); // Refuse overwriting input or existing reports before changing the emulator.
  const result = await rehearseLocalBackfill(snapshot, now);
  await report.writeFile(JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
  if (!result.matched) process.exitCode = 2;
} catch (error) {
  if (report) await report.writeFile(JSON.stringify({ completed: false, message: 'Rehearsal failed; inspect terminal and rerun after resolving the cause' }) + '\n');
  console.error(error instanceof SyntaxError ? 'Invalid input JSON' : error.message);
  process.exitCode = 1;
} finally { await report?.close(); }
