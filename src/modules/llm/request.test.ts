import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig } from '../storage/config.js';
import { buildChatCompletionsRequest, buildResponsesRequest, modelFallbackChain, normalizeProviderResponse, providerRequestModes, runChatCompletionsWithFallbacks } from './request.js';

const messages = [{ role: 'user' as const, content: 'hello' }];

test('buildChatCompletionsRequest includes OpenClaw-like metadata', () => {
  const config = defaultConfig();
  const body = buildChatCompletionsRequest(config, messages, 'gpt-5.5', 'session-1');
  assert.equal(body.model, 'gpt-5.5');
  assert.equal(body.metadata.runtime, 'zeroclaw');
  assert.equal(body.metadata.agent_id, 'default');
  assert.equal(body.metadata.session_id, 'session-1');
  assert.deepEqual(body.messages, messages);
});

test('modelFallbackChain keeps primary model first and removes duplicates', () => {
  const config = defaultConfig();
  config.provider.model = 'gpt-5.5';
  config.provider.fallbackModels = ['gpt-5.4', 'gpt-5.5', 'gpt-4o-mini'];
  assert.deepEqual(modelFallbackChain(config), ['gpt-5.5', 'gpt-5.4', 'gpt-4o-mini']);
});

test('providerRequestModes respects explicit mode and oauth auto routing', () => {
  const config = defaultConfig();
  config.provider.credentialRef = 'env:ZEROCLAW_TEST_KEY';
  assert.deepEqual(providerRequestModes(config), ['chat-completions', 'responses']);
  config.provider.requestMode = 'responses';
  assert.deepEqual(providerRequestModes(config), ['responses']);
  config.provider.requestMode = 'auto';
  config.provider.credentialRef = 'oauth:openai';
  assert.deepEqual(providerRequestModes(config), ['openai-oauth', 'responses', 'chat-completions']);
});

test('buildResponsesRequest maps system prompt to instructions and user history to input', () => {
  const config = defaultConfig();
  const body = buildResponsesRequest(config, [{ role: 'system', content: 'guide' }, { role: 'user', content: 'hi' }], 'gpt-5.5', 's1');
  assert.equal(body.model, 'gpt-5.5');
  assert.equal(body.instructions, 'guide');
  assert.deepEqual(body.input, [{ role: 'user', content: 'hi' }]);
  assert.equal(body.store, false);
});

test('runChatCompletionsWithFallbacks retries model fallback and redacts failed attempts', async () => {
  const config = defaultConfig();
  config.provider.baseUrl = 'http://127.0.0.1:3000/v1';
  config.provider.credentialRef = 'env:ZEROCLAW_TEST_KEY';
  config.provider.requestMode = 'chat-completions';
  config.provider.model = 'bad-model';
  config.provider.fallbackModels = ['good-model'];
  const seen: Array<{ url: string; body: any; authorization?: string }> = [];
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    seen.push({ url: String(url), body, authorization: String((init?.headers as Record<string, string>)?.authorization ?? '') });
    if (body.model === 'bad-model') return new Response('{"error":"model unavailable sk-secret"}', { status: 500 });
    return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }), { status: 200 });
  };
  const result = await runChatCompletionsWithFallbacks({ config, messages, accessToken: 'sk-secret', sessionId: 's1', fetchImpl: fetchImpl as typeof fetch });
  assert.equal(result.ok, true);
  assert.equal(result.model, 'good-model');
  assert.equal(result.requestMode, 'chat-completions');
  assert.equal(result.attempts.length, 2);
  assert.equal(result.attempts[0].status, 'failed');
  assert.doesNotMatch(result.attempts[0].error ?? '', /sk-secret/);
  assert.equal(seen[1].body.metadata.runtime, 'zeroclaw');
});

test('runChatCompletionsWithFallbacks can fall back from responses/openai-oauth to chat completions', async () => {
  const config = defaultConfig();
  config.provider.baseUrl = 'http://127.0.0.1:3000/v1';
  config.provider.model = 'primary';
  config.provider.fallbackModels = [];
  const urls: string[] = [];
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    urls.push(String(url));
    const body = JSON.parse(String(init?.body));
    if (String(url).endsWith('/responses')) return new Response('{"error":"endpoint unavailable"}', { status: 404 });
    return new Response(JSON.stringify({ choices: [{ message: { content: `ok ${body.model}` } }] }), { status: 200 });
  };
  const result = await runChatCompletionsWithFallbacks({ config, messages, accessToken: 'oauth-token', sessionId: 's1', fetchImpl: fetchImpl as typeof fetch });
  assert.equal(result.ok, true);
  assert.equal(result.requestMode, 'chat-completions');
  assert.deepEqual(urls.map((url) => url.replace('http://127.0.0.1:3000/v1', '')), ['/responses', '/responses', '/chat/completions']);
});

test('normalizeProviderResponse supports chat completions, responses, and custom text', () => {
  assert.equal(normalizeProviderResponse({ choices: [{ message: { content: 'chat ok' } }], usage: { prompt_tokens: 1, completion_tokens: 2 } }).reply, 'chat ok');
  assert.equal(normalizeProviderResponse({ output_text: 'responses ok', usage: { input_tokens: 3, output_tokens: 4 } }).reply, 'responses ok');
  assert.equal(normalizeProviderResponse({ output: [{ content: [{ text: 'nested ok' }] }] }).reply, 'nested ok');
  assert.equal(normalizeProviderResponse({ response: 'custom ok' }).reply, 'custom ok');
});

test('runChatCompletionsWithFallbacks stops on credential failure', async () => {
  const config = defaultConfig();
  config.provider.baseUrl = 'http://127.0.0.1:3000/v1';
  config.provider.model = 'primary';
  config.provider.fallbackModels = ['fallback'];
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return new Response('{"error":"Missing scopes: api.responses.write"}', { status: 403 }); };
  const result = await runChatCompletionsWithFallbacks({ config, messages, accessToken: 'token', sessionId: 's1', fetchImpl: fetchImpl as typeof fetch });
  assert.equal(result.ok, false);
  assert.equal(calls, 1);
  assert.equal(result.attempts[0].status, 'credential-error');
});
