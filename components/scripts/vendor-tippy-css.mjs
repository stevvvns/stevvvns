import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

const START = '// __tippy-css-start__';
const END = '// __tippy-css-end__';

// Emit a single-quoted JS string literal (matches the house style). Backslashes
// are escaped first so quotes escaped after them don't get double-escaped.
function toJsString(value) {
  return (
    "'" +
    value
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029') +
    "'"
  );
}

const cssPath = require.resolve('tippy.js/dist/tippy.css');
const css = readFileSync(cssPath, 'utf8').trim();

const tooltipPath = resolve(dirname(fileURLToPath(import.meta.url)), '../src/tooltip.js');
const source = readFileSync(tooltipPath, 'utf8');

const start = source.indexOf(START);
const end = source.indexOf(END);
if (start === -1 || end === -1 || end < start) {
  console.error(`Could not find ${START} ... ${END} markers in ${tooltipPath}`);
  process.exit(1);
}

// Keep the declaration prettier-stable: break after `=` and indent the string.
const replacement = `${START}\nconst tippyCss =\n  ${toJsString(css)};\n${END}`;
const next = source.slice(0, start) + replacement + source.slice(end + END.length);

if (next === source) {
  console.log(`tippy CSS is already up to date in ${tooltipPath}`);
} else {
  writeFileSync(tooltipPath, next);
  console.log(`vendored ${cssPath} -> ${tooltipPath}`);
}
