import { appendFile, mkdir, readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { dataDir } from '../../shared/paths.js';

const MAX_APPEND_CHARS = 20_000;
const MAX_READ_CHARS = 80_000;

function memoryDir(): string { return join(dataDir(), 'memory'); }
function memoryFile(name = 'MEMORY.md'): string {
  const safeName = name.replace(/[^A-Za-z0-9._/-]+/g, '-').replace(/^[/.-]+/, '') || 'MEMORY.md';
  const root = memoryDir();
  const target = normalize(resolve(root, safeName));
  if (!target.startsWith(root + sep) && target !== root) throw new Error('invalid memory path');
  return target;
}

export async function appendMemory(content: string, file = 'MEMORY.md'): Promise<{ ok: true; file: string; bytes: number }> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('memory content is required');
  const text = trimmed.slice(0, MAX_APPEND_CHARS);
  const target = memoryFile(file);
  await mkdir(dirname(target), { recursive: true });
  await appendFile(target, `${text}\n`, { mode: 0o600 });
  return { ok: true, file, bytes: Buffer.byteLength(text) };
}

export async function readMemory(file = 'MEMORY.md'): Promise<{ file: string; content: string; truncated: boolean }> {
  const target = memoryFile(file);
  if (!existsSync(target)) return { file, content: '', truncated: false };
  const raw = await readFile(target, 'utf8');
  return { file, content: raw.slice(0, MAX_READ_CHARS), truncated: raw.length > MAX_READ_CHARS };
}

export async function listMemoryFiles(): Promise<string[]> {
  const root = memoryDir();
  if (!existsSync(root)) return [];
  const files = await readdir(root, { recursive: true });
  return files.map(String).filter((name) => name.endsWith('.md')).sort();
}
