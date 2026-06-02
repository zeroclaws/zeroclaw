import { mkdir, writeFile, chmod } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { agentDir, dataDir, envPath } from '../../shared/paths.js';
import { defaultConfig, saveConfig } from './config.js';

const templates: Record<string, string> = {
  'AGENTS.md': '# AGENTS.md - Zeroclaw Workspace\n\nYou are Zeroclaw, a lightweight personal AI agent. Be useful, truthful, concise, and safe.\n\n## Rules\n- Prefer Indonesian when the user writes Indonesian.\n- Protect secrets, tokens, password hashes, and private memory.\n- Use workspace files as durable local context.\n- Ask only when one missing decision blocks safe progress.\n',
  'IDENTITY.md': '# IDENTITY.md - Agent Identity\n\n- **Name:** Zeroclaw\n- **Creature:** Lightweight local AI agent\n- **Vibe:** Practical, direct, privacy-respecting\n- **Emoji:** ⚡\n',
  'SOUL.md': '# SOUL.md - Agent Style\n\nBe genuinely helpful, not performatively helpful. Keep answers grounded, actionable, and honest.\n',
  'USER.md': '# USER.md - User Preferences\n\n- **Preferred language:** Indonesian unless the user asks otherwise.\n- **Style:** Direct, clear, and practical.\n',
  'MEMORY.md': '# MEMORY.md\n\nDurable notes approved by the user go here. Do not store secrets unless the user explicitly asks and the runtime supports safe storage.\n',
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
