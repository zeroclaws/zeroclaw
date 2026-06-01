import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';
import { DEFAULT_AGENT_ID, DEFAULT_SETUP_PORT, ZEROCLAW_SPEC_VERSION } from '../../shared/constants.js';
import { configPath, databasePath } from '../../shared/paths.js';

export const ConfigSchema = z.object({
  version: z.string().default(ZEROCLAW_SPEC_VERSION),
  agent: z.object({ defaultAgent: z.string().default(DEFAULT_AGENT_ID) }).default({ defaultAgent: DEFAULT_AGENT_ID }),
  provider: z.object({
    preset: z.string().default('openai-oauth'),
    type: z.string().default('openai-oauth-compatible'),
    baseUrl: z.string().default('https://api.openai.com/v1'),
    model: z.string().default('gpt-4o-mini'),
    credentialRef: z.string().default('oauth:openai')
  }).prefault({}),
  telegram: z.object({
    enabled: z.boolean().default(false),
    botTokenRef: z.string().default('env:ZEROCLAW_TELEGRAM_BOT_TOKEN'),
    privateChatOnly: z.boolean().default(true),
    groupMode: z.string().default('disabled')
  }).prefault({}),
  dashboard: z.object({ setupPort: z.number().int().default(DEFAULT_SETUP_PORT), mode: z.string().default('temporary') }).prefault({}),
  storage: z.object({ databasePath: z.string().default(databasePath()), jsonlFallback: z.boolean().default(true) }).prefault({}),
  tools: z.object({
    webFetch: z.boolean().default(true),
    webSearch: z.boolean().default(false),
    workspaceFiles: z.boolean().default(true),
    reminders: z.boolean().default(true),
    shell: z.boolean().default(false)
  }).prefault({})
});

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
