import { mkdir, writeFile, chmod } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { agentDir, dataDir, envPath } from '../../shared/paths.js';
import { defaultConfig, saveConfig } from './config.js';

const templates: Record<string, string> = {
  'AGENT.md': '# AGENT.md\n\nYou are Zeroclaw, a lightweight personal AI agent. Be concise, helpful, and safe.\n',
  'USER.md': '# USER.md\n\nPreferred language: Indonesian unless the user asks otherwise.\n',
  'MEMORY.md': '# MEMORY.md\n\nDurable notes approved by the user go here.\n',
  'TOOLS.md': '# TOOLS.md\n\nBuilt-in tools are scoped to this agent workspace. Shell is disabled by default.\n'
};

export async function ensureWorkspace(): Promise<void> {
  await mkdir(join(dataDir(), 'logs'), { recursive: true });
  await mkdir(join(agentDir(), 'workspace'), { recursive: true });
  await mkdir(join(agentDir(), 'sessions', 'exports'), { recursive: true });

  for (const [name, content] of Object.entries(templates)) {
    const path = join(agentDir(), name);
    if (!existsSync(path)) await writeFile(path, content, 'utf8');
  }

  if (!existsSync(envPath())) {
    await writeFile(envPath(), '# Zeroclaw local secrets\n# ZEROCLAW_TELEGRAM_BOT_TOKEN=\n# OPENAI_API_KEY=\n# OPENGATEWAY_API_KEY=\n', { mode: 0o600 });
    await chmod(envPath(), 0o600).catch(() => undefined);
  }

  if (!existsSync(join(dataDir(), 'zeroclaw.json'))) {
    await saveConfig(defaultConfig());
  }
}
