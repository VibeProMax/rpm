#!/usr/bin/env bun
/**
 * RPM CLI Launcher
 * This file is the entry point for the global command
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliPath = resolve(__dirname, '../src/index.ts');

// Import and run the CLI
import(cliPath).catch(error => {
  console.error('Failed to start RPM:', error.message);
  process.exit(1);
});
