#!/usr/bin/env node

import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const IGNORE_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'release',
  'playwright-report',
  'test-results',
]);

function collectJsFiles(dirPath, output) {
  const entries = readdirSync(dirPath);
  for (const entry of entries) {
    if (entry.startsWith('.')) continue;
    if (IGNORE_DIRS.has(entry)) continue;

    const fullPath = path.join(dirPath, entry);
    const relativePath = path.relative(ROOT, fullPath);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      collectJsFiles(fullPath, output);
      continue;
    }

    if (stats.isFile() && relativePath.endsWith('.js')) {
      output.push(relativePath);
    }
  }
}

function runNodeCheck(filePath) {
  const result = spawnSync(process.execPath, ['--check', filePath], {
    stdio: 'inherit',
  });
  if (result.error) {
    throw result.error;
  }
  return result.status === 0;
}

function run() {
  const shouldFix = process.argv.includes('--fix');
  if (shouldFix) {
    console.log('lint:fix is not implemented for syntax lint; running checks only.');
  }

  const files = [];
  collectJsFiles(ROOT, files);
  files.sort();

  if (files.length === 0) {
    console.log('No JavaScript files found to lint.');
    return;
  }

  console.log(`Linting ${files.length} JavaScript file(s) with node --check...`);
  for (const file of files) {
    const ok = runNodeCheck(file);
    if (!ok) {
      process.exit(1);
    }
  }

  console.log('Lint checks passed.');
}

run();
