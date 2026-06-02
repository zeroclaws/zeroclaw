import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { logPath } from '../../shared/paths.js';

export type RuntimeState = 'stopped' | 'running';

let state: RuntimeState = 'stopped';
let startedAt: string | undefined;

async function writeLog(line: string): Promise<void> {
  const path = logPath();
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${new Date().toISOString()} ${line}\n`, { mode: 0o600 });
}

export async function runtimeStatus() {
  return { status: state, running: state === 'running', startedAt, logPath: logPath(), health: state === 'running' ? 'ok' : 'idle' };
}

export async function startRuntime() {
  if (state !== 'running') {
    state = 'running';
    startedAt = new Date().toISOString();
    await writeLog('runtime start requested');
  }
  return runtimeStatus();
}

export async function stopRuntime() {
  if (state !== 'stopped') {
    await writeLog('runtime stop requested');
    state = 'stopped';
    startedAt = undefined;
  }
  return runtimeStatus();
}

export async function restartRuntime() {
  await writeLog('runtime restart requested');
  state = 'running';
  startedAt = new Date().toISOString();
  return runtimeStatus();
}

export async function runtimeLogs(limit = 200): Promise<{ logPath: string; lines: string[] }> {
  const path = logPath();
  if (!existsSync(path)) return { logPath: path, lines: [] };
  const raw = await readFile(path, 'utf8');
  return { logPath: path, lines: raw.split('\n').filter(Boolean).slice(-Math.max(1, Math.min(limit, 1000))) };
}
