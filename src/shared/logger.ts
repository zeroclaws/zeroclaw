export type LogLevel = 'info' | 'warn' | 'error';

export function log(level: LogLevel, message: string): void {
  const prefix = level.toUpperCase().padEnd(5);
  console.log(`[${prefix}] ${message}`);
}
