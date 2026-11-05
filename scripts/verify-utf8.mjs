import fs from 'node:fs';
import path from 'node:path';

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'target',
  'out',
  'dist'
]);

const IGNORED_FILES = new Set([
  'package-lock.json',
  'Cargo.lock'
]);

const TEXT_EXTS = new Set([
  '.ts', '.tsx', '.rs', '.md', '.css', '.json',
  '.mjs', '.js', '.toml', '.yml', '.yaml', '.svg'
]);

const decoder = new TextDecoder('utf-8', { fatal: true });
let totalChecked = 0;
let errors = 0;
let warnings = 0;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.isFile()) {
      if (IGNORED_FILES.has(entry.name)) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (TEXT_EXTS.has(ext)) {
        checkFile(fullPath);
      }
    }
  }
}

function checkFile(filePath) {
  totalChecked++;
  const buf = fs.readFileSync(filePath);
  let text = '';
  try {
    text = decoder.decode(buf);
  } catch (err) {
    console.error(`[UTF-8 ERROR] Invalid UTF-8 sequence in ${filePath}:`, err.message);
    errors++;
    return;
  }

  // Check for potential mojibake / double-decode warning patterns (e.g. \u00C3 or \u00C2 followed by specific Latin-1 bytes)
  const suspiciousMojibakeRegex = /(?:\u00C3[\x80-\xbf]|\u00C2[\x80-\xbf])/g;
  const match = suspiciousMojibakeRegex.exec(text);
  if (match) {
    // We only warn, do not fail
    console.warn(`[UTF-8 WARNING] Potential double-encoded sequence at index ${match.index} in ${filePath}`);
    warnings++;
  }
}

console.log('Running UTF-8 verification...');
walk(process.cwd());
console.log(`Verified ${totalChecked} files. Errors: ${errors}, Warnings: ${warnings}.`);

if (errors > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
