import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureWorkspace } from '../storage/workspace.js';
import { loadAgentContext, parseIdentity, buildAgentSystemPrompt } from './context.js';

test('workspace creates AGENTS identity soul user memory tools context files', async () => {
  const home = await mkdtemp(join(tmpdir(), 'zeroclaw-agent-'));
  const oldHome = process.env.ZEROCLAW_HOME;
  process.env.ZEROCLAW_HOME = home;
  try {
    await ensureWorkspace();
    const files = await loadAgentContext('default');
    assert.deepEqual(files.map((file) => file.name), ['AGENTS.md', 'IDENTITY.md', 'SOUL.md', 'USER.md', 'MEMORY.md', 'TOOLS.md']);
    const identity = parseIdentity(files);
    assert.equal(identity.name, 'Zeroclaw');
    const prompt = buildAgentSystemPrompt(files, 'Extra chat guidance.');
    assert.match(prompt, /Current agent identity: Zeroclaw/);
    assert.match(prompt, /<AGENTS\.md>/);
    assert.match(prompt, /<IDENTITY\.md>/);
    assert.match(prompt, /Extra chat guidance/);
    assert.doesNotMatch(prompt, /API_KEY=/);
  } finally {
    if (oldHome === undefined) delete process.env.ZEROCLAW_HOME; else process.env.ZEROCLAW_HOME = oldHome;
    await rm(home, { recursive: true, force: true });
  }
});
