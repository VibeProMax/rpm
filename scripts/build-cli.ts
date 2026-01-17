#!/usr/bin/env bun
/**
 * RPM CLI Build Script
 * Builds the web app and prepares the CLI for distribution
 */

import { resolve } from 'path';
import { existsSync } from 'fs';

const rootDir = resolve(import.meta.dir, '..');

console.log('📦 Building RPM CLI...\n');

// Step 1: Check if web dist already exists
const webDist = resolve(rootDir, 'packages/web/dist');
if (existsSync(webDist)) {
  console.log('✓ Web app already built (using existing dist/)\n');
} else {
  // Build web first
  console.log('1️⃣  Building web app...');
  const webBuild = Bun.spawnSync(['bun', 'run', 'build'], {
    cwd: resolve(rootDir, 'packages/web'),
    stdout: 'inherit',
    stderr: 'inherit',
  });

  if (webBuild.exitCode !== 0) {
    console.error('❌ Web build failed');
    console.error('\nTry rebuilding dependencies:');
    console.error('  cd packages/web && bun install && cd ../..');
    process.exit(1);
  }

  // Verify web dist exists
  if (!existsSync(webDist)) {
    console.error('❌ Web dist directory not found after build');
    process.exit(1);
  }

  console.log('✅ Web app built successfully\n');
}

// Step 2: Verify CLI structure
console.log('2️⃣  Verifying CLI structure...');
const cliBin = resolve(rootDir, 'packages/cli/bin/rpm.js');
if (!existsSync(cliBin)) {
  console.error('❌ CLI bin/rpm.js not found');
  process.exit(1);
}

console.log('✅ CLI structure verified\n');

console.log('✨ RPM CLI build complete!\n');
console.log('To install globally for development:');
console.log('  bun link --cwd packages/cli');
console.log('\nTo test the command:');
console.log('  rpm --help');
