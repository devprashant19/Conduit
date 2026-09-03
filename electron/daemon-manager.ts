import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import http from 'http';
import { app } from 'electron';

export class DaemonManager {
  private daemonProcess: ChildProcess | null = null;
  private serverProcess: ChildProcess | null = null;
  private isShuttingDown = false;

  public async startServices(rootPath: string): Promise<{ ready: boolean; port: number }> {
    const isDev = !app.isPackaged;
    const daemonScript = path.join(rootPath, 'dist', 'daemon', 'daemon.js');
    const serverScript = path.join(rootPath, 'dist', 'server.js');

    console.log('[DaemonManager] Spawning daemon process:', daemonScript);
    this.daemonProcess = spawn(process.execPath, [daemonScript], {
      env: { ...process.env, NODE_ENV: isDev ? 'development' : 'production' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.daemonProcess.stdout?.on('data', (data) => {
      console.log(`[Daemon]: ${data.toString().trim()}`);
    });

    this.daemonProcess.stderr?.on('data', (data) => {
      console.error(`[Daemon ERR]: ${data.toString().trim()}`);
    });

    console.log('[DaemonManager] Spawning server process:', serverScript);
    this.serverProcess = spawn(process.execPath, [serverScript], {
      env: { ...process.env, PORT: '3200', HOST: '127.0.0.1', NODE_ENV: isDev ? 'development' : 'production' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.serverProcess.stdout?.on('data', (data) => {
      console.log(`[Server]: ${data.toString().trim()}`);
    });

    this.serverProcess.stderr?.on('data', (data) => {
      console.error(`[Server ERR]: ${data.toString().trim()}`);
    });

    // Wait until server is responding on 127.0.0.1:3200
    const ready = await this.waitForHealthCheck(3200, 15000);
    return { ready, port: 3200 };
  }

  private async waitForHealthCheck(port: number, timeoutMs: number): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (this.isShuttingDown) return false;
      const isUp = await new Promise<boolean>((resolve) => {
        const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
          resolve(res.statusCode !== undefined);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(500, () => {
          req.destroy();
          resolve(false);
        });
      });

      if (isUp) return true;
      await new Promise((r) => setTimeout(r, 400));
    }
    return false;
  }

  public stopServices(): void {
    this.isShuttingDown = true;
    console.log('[DaemonManager] Terminating child services...');
    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');
      this.serverProcess = null;
    }
    if (this.daemonProcess) {
      this.daemonProcess.kill('SIGTERM');
      this.daemonProcess = null;
    }
  }
}
