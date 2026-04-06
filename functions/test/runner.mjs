import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Test runner script. Discovers all *.test.mjs files in this directory and
// executes them sequentially via dynamic import. Reports any failures and
// sets the process exit code accordingly.

const ROOT = path.join(process.cwd(), 'functions', 'test');
const files = (await fs.readdir(ROOT))
  .filter((f) => f.endsWith('.test.mjs'))
  .sort();

let fails = 0;
for (const f of files) {
  const fp = path.join(ROOT, f);
  console.log(`\n=== ${f} ===`);
  try {
    await import(pathToFileURL(fp).href);
  } catch (e) {
    console.error('ERR', e);
    fails++;
  }
}
if (fails) {
  console.error(`\n${fails} test file(s) failed`);
  process.exit(1);
} else {
  console.log('\nAll test files executed');
}
