#!/usr/bin/env bun
import { Command } from 'commander';
import { startServer } from './server.ts';
import open from 'open';

const program = new Command();

program
  .name('rpm')
  .description('Review Pull Request Manager - A local web UI for GitHub PR reviews')
  .version('0.1.0');

program
  .command('start')
  .description('Start the RPM server and open the web UI')
  .option('-p, --port <port>', 'Port to run the server on', '3000')
  .option('--no-open', 'Do not open browser automatically')
  .action(async (options) => {
    const port = parseInt(options.port, 10);
    console.log(`Starting RPM on http://localhost:${port}...`);
    
    try {
      await startServer(port);
      console.log(`✓ Server running on http://localhost:${port}`);
      
      if (options.open) {
        await open(`http://localhost:${port}`);
      }
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  });

program
  .command('pr <number>')
  .description('Open a specific PR by number')
  .option('-p, --port <port>', 'Port to run the server on', '3000')
  .action(async (prNumber, options) => {
    const port = parseInt(options.port, 10);
    console.log(`Starting RPM and opening PR #${prNumber}...`);
    
    try {
      await startServer(port);
      console.log(`✓ Server running on http://localhost:${port}`);
      await open(`http://localhost:${port}?pr=${prNumber}`);
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  });

program.parse();
