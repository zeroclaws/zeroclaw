import { homedir } from 'node:os';
import { join } from 'node:path';

export function dataDir(): string {
  return process.env.ZEROCLAW_HOME || join(homedir(), '.zeroclaw');
}

export function configPath(): string {
  return join(dataDir(), 'zeroclaw.json');
}

export function envPath(): string {
  return join(dataDir(), 'zeroclaw.env');
}

export function secretsPath(): string {
  return join(dataDir(), 'zeroclaw.secrets.json');
}

export function logPath(): string {
  return join(dataDir(), 'logs', 'zeroclaw.log');
}

export function databasePath(): string {
  return join(dataDir(), 'zeroclaw.sqlite');
}

export function agentDir(agentId = 'default'): string {
  return join(dataDir(), 'agents', agentId);
}
