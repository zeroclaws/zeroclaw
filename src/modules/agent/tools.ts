import type { ZeroclawConfig } from '../storage/config.js';

export interface ToolSchema {
  name: string;
  description: string;
  enabled: boolean;
  inputSchema: Record<string, unknown>;
  permission: 'safe' | 'guarded' | 'disabled';
}

export interface ParsedToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolExecutionResult {
  id: string;
  name: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

export function listToolSchemas(config: ZeroclawConfig): ToolSchema[] {
  return [
    {
      name: 'memory.append',
      description: 'Append a user-approved note to local Zeroclaw memory.',
      enabled: true,
      permission: 'guarded',
      inputSchema: { type: 'object', properties: { content: { type: 'string' }, file: { type: 'string', default: 'MEMORY.md' } }, required: ['content'] }
    },
    {
      name: 'web.fetch',
      description: 'Fetch readable content from a URL. Execution adapter is not implemented yet.',
      enabled: config.tools.webFetch,
      permission: config.tools.webFetch ? 'guarded' : 'disabled',
      inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] }
    },
    {
      name: 'workspace.read',
      description: 'Read workspace files through a future permission-guarded adapter.',
      enabled: config.tools.workspaceFiles,
      permission: config.tools.workspaceFiles ? 'guarded' : 'disabled',
      inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] }
    },
    {
      name: 'shell.exec',
      description: 'Execute shell commands. Disabled by default and requires an explicit future guard.',
      enabled: config.tools.shell,
      permission: config.tools.shell ? 'guarded' : 'disabled',
      inputSchema: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] }
    }
  ];
}

export function parseToolCalls(providerPayload: unknown): ParsedToolCall[] {
  const payload = providerPayload as Record<string, unknown>;
  const calls: ParsedToolCall[] = [];
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  for (const choice of choices) {
    const message = (choice as Record<string, unknown>).message as Record<string, unknown> | undefined;
    const toolCalls = Array.isArray(message?.tool_calls) ? message.tool_calls : [];
    for (const call of toolCalls) {
      const record = call as Record<string, unknown>;
      const fn = record.function as Record<string, unknown> | undefined;
      const rawArgs = typeof fn?.arguments === 'string' ? fn.arguments : '{}';
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(rawArgs) as Record<string, unknown>; } catch { args = {}; }
      if (typeof fn?.name === 'string') calls.push({ id: typeof record.id === 'string' ? record.id : `${fn.name}-${calls.length}`, name: fn.name, arguments: args });
    }
  }
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    const record = item as Record<string, unknown>;
    if (record.type !== 'function_call' || typeof record.name !== 'string') continue;
    let args: Record<string, unknown> = {};
    try { args = typeof record.arguments === 'string' ? JSON.parse(record.arguments) as Record<string, unknown> : (record.arguments as Record<string, unknown> ?? {}); } catch { args = {}; }
    calls.push({ id: typeof record.call_id === 'string' ? record.call_id : `${record.name}-${calls.length}`, name: record.name, arguments: args });
  }
  return calls;
}

export async function executeToolCall(config: ZeroclawConfig, call: ParsedToolCall): Promise<ToolExecutionResult> {
  const schema = listToolSchemas(config).find((tool) => tool.name === call.name);
  if (!schema) return { id: call.id, name: call.name, ok: false, error: 'unknown tool' };
  if (!schema.enabled) return { id: call.id, name: call.name, ok: false, error: 'tool disabled' };
  return { id: call.id, name: call.name, ok: false, error: 'tool execution loop is not enabled yet; approval guard required' };
}
