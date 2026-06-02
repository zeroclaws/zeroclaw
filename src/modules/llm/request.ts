import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { ZeroclawConfig } from '../storage/config.js';
import { dataDir } from '../../shared/paths.js';

export type ChatRole = 'system' | 'user' | 'assistant';
export type ProviderRequestMode = 'chat-completions' | 'responses' | 'openai-oauth';
export interface ChatMessage { role: ChatRole; content: string }

export interface LlmAttempt {
  index: number;
  model: string;
  requestMode: ProviderRequestMode;
  status: 'success' | 'failed' | 'credential-error';
  statusCode?: number;
  durationMs: number;
  fallbackReason?: string;
  error?: string;
}

export interface NormalizedProviderResponse {
  reply: string;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
}

export interface LlmRunResult {
  ok: boolean;
  model: string;
  requestMode?: ProviderRequestMode;
  provider?: unknown;
  normalized?: NormalizedProviderResponse;
  attempts: LlmAttempt[];
  statusCode?: number;
  errorText?: string;
}

export function modelFallbackChain(config: ZeroclawConfig): string[] {
  const configured = config.provider.fallbackModels ?? [];
  return Array.from(new Set([config.provider.model, ...configured].map((model) => model.trim()).filter(Boolean))).slice(0, 9);
}

export function providerRequestModes(config: ZeroclawConfig): ProviderRequestMode[] {
  const explicit = config.provider.requestMode ?? 'auto';
  if (explicit === 'chat-completions') return ['chat-completions'];
  if (explicit === 'responses') return ['responses'];
  if (explicit === 'openai-oauth') return ['openai-oauth'];
  const oauthLike = config.provider.credentialRef.startsWith('oauth:');
  return oauthLike ? ['openai-oauth', 'responses', 'chat-completions'] : ['chat-completions', 'responses'];
}

function metadata(config: ZeroclawConfig, sessionId: string) {
  return {
    runtime: 'zeroclaw',
    agent_id: config.agent.defaultAgent,
    session_id: sessionId,
    provider_preset: config.provider.preset
  };
}

export function buildChatCompletionsRequest(config: ZeroclawConfig, messages: ChatMessage[], model: string, sessionId: string) {
  return { model, messages, metadata: metadata(config, sessionId) };
}

export function buildResponsesRequest(config: ZeroclawConfig, messages: ChatMessage[], model: string, sessionId: string, mode: ProviderRequestMode = 'responses') {
  const system = messages.find((message) => message.role === 'system')?.content;
  const input = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({ role: message.role, content: message.content }));
  return {
    model,
    input,
    ...(system ? { instructions: system } : {}),
    metadata: { ...metadata(config, sessionId), request_mode: mode },
    store: false
  };
}

function requestForMode(config: ZeroclawConfig, messages: ChatMessage[], model: string, sessionId: string, mode: ProviderRequestMode) {
  if (mode === 'chat-completions') return { path: '/chat/completions', body: buildChatCompletionsRequest(config, messages, model, sessionId) };
  return { path: '/responses', body: buildResponsesRequest(config, messages, model, sessionId, mode) };
}

export function isCredentialFailure(status: number, text: string): boolean {
  if ([401, 403].includes(status)) return true;
  const lowered = text.toLowerCase();
  return lowered.includes('incorrect api key')
    || lowered.includes('invalid api key')
    || lowered.includes('invalid_api_key')
    || lowered.includes('invalid token')
    || lowered.includes('expired token')
    || lowered.includes('unauthorized')
    || lowered.includes('forbidden')
    || lowered.includes('insufficient_scope')
    || lowered.includes('missing scopes')
    || lowered.includes('missing scope');
}

function safeErrorText(text: string): string {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [redacted]')
    .replace(/sk-[A-Za-z0-9_-]+/g, 'sk-[redacted]')
    .replace(/access[_-]?token["'\s:=]+[A-Za-z0-9._~+\/-]+/gi, 'access_token=[redacted]')
    .slice(0, 600);
}

function textFromContent(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (!Array.isArray(value)) return [];
  const parts: string[] = [];
  for (const item of value) {
    if (typeof item === 'string') parts.push(item);
    else if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      if (typeof record.text === 'string') parts.push(record.text);
      else if (typeof record.output_text === 'string') parts.push(record.output_text);
      else if (typeof record.content === 'string') parts.push(record.content);
    }
  }
  return parts;
}

export function normalizeProviderResponse(providerPayload: unknown): NormalizedProviderResponse {
  const payload = providerPayload as Record<string, unknown>;
  const replyParts: string[] = [];

  if (typeof payload.output_text === 'string') replyParts.push(payload.output_text);
  if (typeof payload.response === 'string') replyParts.push(payload.response);
  if (typeof payload.message === 'string') replyParts.push(payload.message);

  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  for (const choice of choices) {
    const c = choice as Record<string, unknown>;
    const message = c.message as Record<string, unknown> | undefined;
    const delta = c.delta as Record<string, unknown> | undefined;
    replyParts.push(...textFromContent(message?.content));
    replyParts.push(...textFromContent(delta?.content));
    replyParts.push(...textFromContent(c.text));
  }

  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    const record = item as Record<string, unknown>;
    replyParts.push(...textFromContent(record.content));
    replyParts.push(...textFromContent(record.text));
  }

  const usage = (payload.usage as Record<string, unknown> | undefined) ?? {};
  const inputTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? usage.inputTokens ?? 0) || 0;
  const outputTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? usage.outputTokens ?? 0) || 0;
  const totalTokens = Number(usage.total_tokens ?? usage.totalTokens ?? inputTokens + outputTokens) || inputTokens + outputTokens;

  return {
    reply: replyParts.map((part) => part.trim()).filter(Boolean).join('\n').trim() || 'Provider returned a response, but no assistant text was found.',
    usage: { inputTokens, outputTokens, totalTokens }
  };
}

function llmAuditPath(): string { return join(dataDir(), 'logs', 'llm-attempts.jsonl'); }

async function appendAttemptAudit(sessionId: string, attempt: LlmAttempt): Promise<void> {
  const path = llmAuditPath();
  await mkdir(dirname(path), { recursive: true });
  const { error: _error, ...safeAttempt } = attempt;
  await appendFile(path, JSON.stringify({ timestamp: new Date().toISOString(), sessionId, ...safeAttempt }) + '\n', { mode: 0o600 });
}

export async function runChatCompletionsWithFallbacks(params: { config: ZeroclawConfig; messages: ChatMessage[]; accessToken: string; sessionId: string; fetchImpl?: typeof fetch; audit?: boolean }): Promise<LlmRunResult> {
  const fetcher = params.fetchImpl ?? fetch;
  const attempts: LlmAttempt[] = [];
  const baseUrl = params.config.provider.baseUrl.replace(/\/$/, '');
  const models = modelFallbackChain(params.config);
  const modes = providerRequestModes(params.config);
  const audit = params.audit !== false;
  let index = 0;

  for (const model of models) {
    for (const requestMode of modes) {
      const started = Date.now();
      const request = requestForMode(params.config, params.messages, model, params.sessionId, requestMode);
      let response: Response;
      let text = '';
      try {
        response = await fetcher(`${baseUrl}${request.path}`, {
          method: 'POST',
          headers: { authorization: `Bearer ${params.accessToken}`, 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(request.body)
        });
        text = await response.text();
      } catch (error) {
        const attempt: LlmAttempt = { index: index++, model, requestMode, status: 'failed', durationMs: Date.now() - started, fallbackReason: 'network-error', error: safeErrorText(error instanceof Error ? error.message : String(error)) };
        attempts.push(attempt);
        if (audit) await appendAttemptAudit(params.sessionId, attempt).catch(() => undefined);
        continue;
      }

      if (response.ok) {
        let provider: unknown = {};
        try { provider = text ? JSON.parse(text) : {}; } catch { provider = { response: text }; }
        const attempt: LlmAttempt = { index: index++, model, requestMode, status: 'success', statusCode: response.status, durationMs: Date.now() - started };
        attempts.push(attempt);
        if (audit) await appendAttemptAudit(params.sessionId, attempt).catch(() => undefined);
        return { ok: true, model, requestMode, provider, normalized: normalizeProviderResponse(provider), attempts, statusCode: response.status };
      }

      const sanitized = safeErrorText(text);
      const credentialFailure = isCredentialFailure(response.status, sanitized);
      const attempt: LlmAttempt = {
        index: index++,
        model,
        requestMode,
        status: credentialFailure ? 'credential-error' : 'failed',
        statusCode: response.status,
        durationMs: Date.now() - started,
        fallbackReason: credentialFailure ? 'credential' : `http-${response.status}`,
        error: sanitized
      };
      attempts.push(attempt);
      if (audit) await appendAttemptAudit(params.sessionId, attempt).catch(() => undefined);
      if (credentialFailure) return { ok: false, model, requestMode, attempts, statusCode: response.status, errorText: sanitized };
    }
  }

  return { ok: false, model: models.at(-1) ?? params.config.provider.model, requestMode: attempts.at(-1)?.requestMode, attempts, statusCode: attempts.at(-1)?.statusCode, errorText: attempts.at(-1)?.error };
}
