import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';
import { DEFAULT_AGENT_ID, DEFAULT_SETUP_PORT, ZEROCLAW_SPEC_VERSION } from '../../shared/constants.js';
import { configPath, databasePath } from '../../shared/paths.js';

const credentialRefSchema = z.string().regex(/^(env:[A-Z_][A-Z0-9_]*|oauth:[A-Za-z0-9._-]+)$/, 'credentialRef must be env:NAME or oauth:name');

const baseUrlSchema = z.string().url().refine((value) => {
  const url = new URL(value);
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
}, 'baseUrl must use https unless it targets localhost or 127.0.0.1');

export const ConfigSchema = z.object({
  version: z.string().default(ZEROCLAW_SPEC_VERSION),
  agent: z.object({ defaultAgent: z.string().default(DEFAULT_AGENT_ID) }).strict().default({ defaultAgent: DEFAULT_AGENT_ID }),
  provider: z.object({
    preset: z.string().default('openai-oauth'),
    type: z.string().default('openai-oauth-compatible'),
    baseUrl: baseUrlSchema.default('https://api.openai.com/v1'),
    model: z.string().default('gpt-4o-mini'),
    fallbackModels: z.array(z.string().min(1)).max(8).default([]),
    requestMode: z.enum(['auto', 'chat-completions', 'responses', 'openai-oauth']).default('auto'),
    credentialRef: credentialRefSchema.default('oauth:openai')
  }).strict().prefault({}),
  telegram: z.object({
    enabled: z.boolean().default(false),
    botTokenRef: credentialRefSchema.default('env:ZEROCLAW_TELEGRAM_BOT_TOKEN'),
    privateChatOnly: z.literal(true).default(true),
    groupMode: z.literal('disabled').default('disabled')
  }).strict().prefault({}),
  dashboard: z.object({
    setupPort: z.number().int().default(DEFAULT_SETUP_PORT),
    mode: z.string().default('temporary'),
    passwordHash: z.object({
      algorithm: z.literal('scrypt'),
      hash: z.string(),
      salt: z.string(),
      keyLength: z.number().int().positive().default(64)
    }).strict().optional()
  }).strict().prefault({}),
  chat: z.object({
    enabled: z.boolean().default(true),
    systemPrompt: z.string().default(''),
    historyLimit: z.number().int().min(1).max(100).default(20)
  }).strict().prefault({}),
  storage: z.object({ databasePath: z.string().default(databasePath()), jsonlFallback: z.boolean().default(true) }).strict().prefault({}),
  tools: z.object({
    webFetch: z.boolean().default(true),
    webSearch: z.boolean().default(false),
    workspaceFiles: z.boolean().default(true),
    reminders: z.boolean().default(true),
    shell: z.boolean().default(false)
  }).strict().prefault({})
}).strict();

export type ZeroclawConfig = z.infer<typeof ConfigSchema>;

export function defaultConfig(): ZeroclawConfig {
  return ConfigSchema.parse({});
}

export async function loadConfig(): Promise<ZeroclawConfig> {
  const path = configPath();
  if (!existsSync(path)) return defaultConfig();
  const raw = await readFile(path, 'utf8');
  return ConfigSchema.parse(JSON.parse(raw));
}

export async function saveConfig(config: ZeroclawConfig): Promise<void> {
  const path = configPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
}
