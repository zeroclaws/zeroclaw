import { appendFile, mkdir, readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { dataDir } from '../../shared/paths.js';

export type ConversationRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ConversationMessage {
  id: string;
  timestamp: string;
  role: ConversationRole;
  content: string;
  model?: string;
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
  metadata?: Record<string, unknown>;
}

export interface ConversationSummary {
  sessionId: string;
  messageCount: number;
  updatedAt?: string;
}

const SESSION_ID_RE = /^[A-Za-z0-9._:-]{1,120}$/;

export function normalizeSessionId(sessionId = 'dashboard'): string {
  const trimmed = sessionId.trim() || 'dashboard';
  if (SESSION_ID_RE.test(trimmed)) return trimmed;
  return trimmed.replace(/[^A-Za-z0-9._:-]+/g, '-').slice(0, 120) || 'dashboard';
}

function sessionsDir(): string { return join(dataDir(), 'sessions'); }
function sessionFile(sessionId: string): string { return join(sessionsDir(), `${normalizeSessionId(sessionId)}.jsonl`); }

function safeMessage(message: Omit<ConversationMessage, 'id' | 'timestamp'> & Partial<Pick<ConversationMessage, 'id' | 'timestamp'>>): ConversationMessage {
  return {
    id: message.id ?? randomUUID(),
    timestamp: message.timestamp ?? new Date().toISOString(),
    role: message.role,
    content: message.content.slice(0, 40_000),
    model: message.model,
    usage: message.usage,
    metadata: message.metadata
  };
}

export async function appendConversationMessage(sessionId: string, message: Omit<ConversationMessage, 'id' | 'timestamp'> & Partial<Pick<ConversationMessage, 'id' | 'timestamp'>>): Promise<ConversationMessage> {
  await mkdir(sessionsDir(), { recursive: true });
  const record = safeMessage(message);
  await appendFile(sessionFile(sessionId), JSON.stringify(record) + '\n', { mode: 0o600 });
  return record;
}

export async function readConversation(sessionId: string, limit = 100): Promise<ConversationMessage[]> {
  const file = sessionFile(sessionId);
  if (!existsSync(file)) return [];
  const raw = await readFile(file, 'utf8');
  const lines = raw.split('\n').filter(Boolean).slice(-Math.max(1, Math.min(limit, 500)));
  const messages: ConversationMessage[] = [];
  for (const line of lines) {
    try {
      const value = JSON.parse(line) as ConversationMessage;
      if (value && typeof value.content === 'string' && typeof value.role === 'string') messages.push(value);
    } catch { /* skip malformed jsonl line */ }
  }
  return messages;
}

export async function listConversationSessions(): Promise<ConversationSummary[]> {
  if (!existsSync(sessionsDir())) return [];
  const files = await readdir(sessionsDir());
  const summaries: ConversationSummary[] = [];
  for (const file of files.filter((name) => name.endsWith('.jsonl'))) {
    const sessionId = file.slice(0, -'.jsonl'.length);
    const messages = await readConversation(sessionId, 500);
    summaries.push({ sessionId, messageCount: messages.length, updatedAt: messages.at(-1)?.timestamp });
  }
  return summaries.sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')));
}

export async function exportConversation(sessionId: string): Promise<{ sessionId: string; messages: ConversationMessage[] }> {
  return { sessionId: normalizeSessionId(sessionId), messages: await readConversation(sessionId, 500) };
}
