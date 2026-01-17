import { startExpressServer } from '../../server/src/app.ts';
import { opencodeManager } from '../../server/src/services/opencode.ts';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function startServer(port: number): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const server = startExpressServer(port);
      
      server.on('listening', async () => {
        // Start OpenCode server after Express is ready
        try {
          const opencodeInstalled = await opencodeManager.isInstalled();
          if (opencodeInstalled) {
            // Get repo path
            const { stdout } = await execAsync('git rev-parse --show-toplevel');
            const repoPath = stdout.trim();
            
            console.log('Starting OpenCode server...');
            await opencodeManager.startServer(repoPath);
            console.log('✓ OpenCode server ready');
          } else {
            console.log('⚠️  OpenCode not installed - AI chat will be unavailable');
            console.log('   Install from: https://opencode.ai');
          }
        } catch (error: any) {
          // Don't fail if OpenCode fails to start - just warn
          console.warn('⚠️  Could not start OpenCode server:', error.message);
          console.warn('   AI chat will be unavailable');
        }
        
        resolve();
      });
      
      server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`Port ${port} is already in use. Try a different port with --port <port>`);
        }
        reject(error);
      });

      // Cleanup on exit
      const cleanup = async () => {
        console.log('\nShutting down...');
        await opencodeManager.cleanup();
        process.exit(0);
      };

      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);
      process.on('exit', cleanup);
      
    } catch (error) {
      reject(error);
    }
  });
}
