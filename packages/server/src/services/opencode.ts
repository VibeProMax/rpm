import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as path from 'path';
import { createServer } from 'net';

const execAsync = promisify(exec);

/**
 * Custom error class for OpenCode service errors
 */
export class OpenCodeServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: string
  ) {
    super(message);
    this.name = 'OpenCodeServiceError';
  }
}

/**
 * OpenCode service for managing OpenCode server lifecycle and TUI spawning
 */
export class OpencodeManager {
  private serverProcess: ChildProcess | null = null;
  private serverUrl: string | null = null;
  private serverPort: number | null = null;
  private repoPath: string | null = null;

  /**
   * Check if OpenCode CLI is installed
   */
  async isInstalled(): Promise<boolean> {
    try {
      const command = os.platform() === 'win32' ? 'where opencode' : 'which opencode';
      await execAsync(command);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get OpenCode version
   */
  async getVersion(): Promise<string | null> {
    try {
      const { stdout } = await execAsync('opencode --version');
      return stdout.trim();
    } catch {
      return null;
    }
  }

  /**
   * Start OpenCode server in headless mode
   */
  async startServer(repoPath: string): Promise<string> {
    if (this.serverProcess) {
      return this.serverUrl!; // Already running, return existing URL
    }

    const installed = await this.isInstalled();
    if (!installed) {
      throw new OpenCodeServiceError(
        'OpenCode CLI not found. This feature requires OpenCode to be installed.',
        'NOT_INSTALLED',
        'Install from https://opencode.ai'
      );
    }

    try {
      // Find available port with proper checking
      const port = await this.findAvailablePort();
      this.serverPort = port;
      this.repoPath = repoPath;

      // Start OpenCode server
      // Use 'serve' command which starts headless server
      const args = [
        'serve',
        '--port', port.toString(),
        '--hostname', '127.0.0.1' // Localhost only for security
      ];

      console.log(`Starting OpenCode server: opencode ${args.join(' ')}`);
      
      // Set environment variables to prevent gcloud credential issues
      const env = {
        ...process.env,
        // Disable automatic credential loading from gcloud
        GOOGLE_APPLICATION_CREDENTIALS: '',
        // Disable gcloud CLI credential helper
        CLOUDSDK_CONFIG: '',
      };
      
      this.serverProcess = spawn('opencode', args, {
        cwd: repoPath,
        detached: false, // Keep it attached to parent process
        stdio: ['ignore', 'pipe', 'pipe'],
        env, // Pass modified environment
      });

      // Log output for debugging
      this.serverProcess.stdout?.on('data', (data) => {
        console.log(`[OpenCode] ${data.toString().trim()}`);
      });

      this.serverProcess.stderr?.on('data', (data) => {
        console.error(`[OpenCode Error] ${data.toString().trim()}`);
      });

      this.serverProcess.on('exit', (code) => {
        console.log(`OpenCode server exited with code ${code}`);
        this.serverProcess = null;
        this.serverUrl = null;
        this.serverPort = null;
      });

      this.serverProcess.on('error', (error) => {
        console.error('OpenCode server error:', error);
        this.cleanup();
      });

      // Wait for server to be ready with timeout
      this.serverUrl = `http://127.0.0.1:${port}`;
      const ready = await this.waitForServerReady(this.serverUrl, 10000);
      
      if (!ready) {
        await this.cleanup();
        throw new OpenCodeServiceError(
          'OpenCode server failed to start within timeout',
          'STARTUP_TIMEOUT',
          'The server did not respond within 10 seconds'
        );
      }

      console.log(`OpenCode server started at ${this.serverUrl}`);
      return this.serverUrl;
    } catch (error) {
      await this.cleanup();
      
      if (error instanceof OpenCodeServiceError) {
        throw error;
      }
      
      // Handle spawn errors
      if ((error as any).code === 'ENOENT') {
        throw new OpenCodeServiceError(
          'OpenCode executable not found',
          'NOT_FOUND',
          'Make sure OpenCode is installed and in your PATH'
        );
      }
      
      throw new OpenCodeServiceError(
        `Failed to start OpenCode server: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'STARTUP_FAILED',
        error instanceof Error ? error.stack : undefined
      );
    }
  }

  /**
   * Spawn OpenCode TUI in a new terminal window
   */
  async spawnTUI(prompt?: string): Promise<void> {
    if (!this.serverUrl || !this.repoPath) {
      throw new Error('OpenCode server is not running');
    }

    // If we have a prompt, first send it to create a session, then attach to it
    let sessionId: string | undefined;
    if (prompt) {
      try {
        console.log('\n=== Creating OpenCode session with PR context ===');
        console.log(`Server URL: ${this.serverUrl}`);
        console.log(`Model: github-copilot/gpt-4.1`);
        console.log(`Prompt length: ${prompt.length} characters`);
        console.log(`Prompt preview (first 500 chars):\n${prompt.substring(0, 500)}...\n`);
        
        // Create a new session
        const response = await fetch(`${this.serverUrl}/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            title: 'PR Review'
          }),
        });
        
        if (response.ok) {
          const session = await response.json() as any;
          sessionId = session.id;
          console.log(`✓ Created session: ${sessionId}`);
          
          // Send the prompt message to the session
          console.log(`\nSending PR context to session ${sessionId}...`);
          const promptResponse = await fetch(`${this.serverUrl}/session/${sessionId}/prompt_async`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: { providerID: 'github-copilot', modelID: 'gpt-4.1' },
              parts: [{ type: 'text', text: prompt }],
            }),
          });
          
          if (promptResponse.ok) {
            console.log('✓ PR context sent successfully to OpenCode');
            console.log(`\nYou can now interact with the AI about this PR in the OpenCode interface.`);
            console.log(`Session ID: ${sessionId}\n`);
          } else {
            const errorText = await promptResponse.text();
            console.warn(`✗ Failed to send prompt (status ${promptResponse.status}):`, errorText);
          }
        } else {
          const errorText = await response.text();
          console.warn(`✗ Failed to create session (status ${response.status}):`, errorText);
        }
      } catch (error) {
        console.warn('✗ Failed to create session with prompt, falling back to plain attach:', error);
      }
    }

    // Build OpenCode attach command
    const sessionFlag = sessionId ? `--session ${sessionId}` : '';
    const opencodeCmd = `opencode attach ${this.serverUrl} --dir "${this.repoPath}" ${sessionFlag}`.trim();

    console.log(`\n=== Launching OpenCode TUI ===`);
    console.log(`Command: ${opencodeCmd}`);
    console.log(`Working directory: ${this.repoPath}`);
    if (sessionId) {
      console.log(`Session: ${sessionId} (with PR context loaded)`);
    }
    console.log(`\nNote: OpenCode will open in this terminal window.`);
    console.log(`Press Ctrl+C or exit OpenCode to return to RPM.\n`);
    
    // Set environment variables to prevent gcloud credential issues
    const env = {
      ...process.env,
      // Disable automatic credential loading from gcloud
      GOOGLE_APPLICATION_CREDENTIALS: '',
      // Disable gcloud CLI credential helper
      CLOUDSDK_CONFIG: '',
    };
    
    // Use the current terminal by spawning in foreground
    const tuiProcess = spawn('sh', ['-c', opencodeCmd], {
      stdio: 'inherit', // Use parent's stdio (current terminal)
      cwd: this.repoPath,
      env, // Pass modified environment
    });

    // Don't detach - let it run in the current process
    // This way it runs in the same terminal where RPM was started
  }

  /**
   * Cleanup and shutdown OpenCode server
   */
  async cleanup(): Promise<void> {
    if (this.serverProcess) {
      console.log('Stopping OpenCode server...');
      
      // Try graceful shutdown first
      this.serverProcess.kill('SIGTERM');
      
      // Wait 2 seconds, then force kill if still running
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.serverProcess && !this.serverProcess.killed) {
            console.log('Force killing OpenCode server');
            this.serverProcess.kill('SIGKILL');
          }
          resolve();
        }, 2000);

        this.serverProcess?.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.serverProcess = null;
      this.serverUrl = null;
      this.serverPort = null;
      console.log('OpenCode server stopped');
    }
  }

  /**
   * Get current server status
   */
  getStatus() {
    return {
      running: this.serverProcess !== null,
      url: this.serverUrl,
      port: this.serverPort,
      repoPath: this.repoPath,
    };
  }

  /**
   * Find an available port
   */
  private async findAvailablePort(): Promise<number> {
    const maxAttempts = 10;
    
    for (let i = 0; i < maxAttempts; i++) {
      const port = Math.floor(Math.random() * 4096) + 4096; // Port range 4096-8191
      
      if (await this.isPortAvailable(port)) {
        return port;
      }
    }
    
    throw new OpenCodeServiceError(
      'Could not find available port after 10 attempts',
      'NO_PORT',
      'All attempted ports in range 4096-8191 were in use'
    );
  }

  /**
   * Check if a port is available
   */
  private async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = createServer();
      
      server.once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          resolve(false);
        } else {
          resolve(false);
        }
      });
      
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      
      server.listen(port, '127.0.0.1');
    });
  }

  /**
   * Wait for OpenCode server to be ready
   */
  private async waitForServerReady(url: string, timeout = 10000): Promise<boolean> {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(500)
        });
        // If we get ANY response (even errors), the server is up
        console.log(`✓ OpenCode server is ready (status: ${response.status})`);
        return true;
      } catch (error: any) {
        // Check if it's a connection error vs timeout
        if (error.name === 'AbortError') {
          // Timeout - server might be up but slow to respond
          console.log(`✓ OpenCode server is up (slow response)`);
          return true;
        }
        // Connection refused - server not ready yet, continue waiting
      }
      
      // Wait 500ms before next attempt
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return false;
  }

  /**
   * Detect Linux terminal emulator
   */
  private async detectLinuxTerminal(): Promise<string> {
    const terminals = ['gnome-terminal', 'konsole', 'xterm', 'x-terminal-emulator'];
    
    for (const terminal of terminals) {
      try {
        await execAsync(`which ${terminal}`);
        return terminal;
      } catch {
        continue;
      }
    }
    
    return 'xterm'; // Default fallback
  }
}

// Singleton instance
export const opencodeManager = new OpencodeManager();

// Add graceful cleanup on process termination
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, cleaning up OpenCode server...');
  await opencodeManager.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, cleaning up OpenCode server...');
  await opencodeManager.cleanup();
  process.exit(0);
});

// Cleanup on uncaught exceptions
process.on('uncaughtException', async (error) => {
  console.error('Uncaught exception:', error);
  await opencodeManager.cleanup();
  process.exit(1);
});
