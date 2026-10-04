import { describe, expect, it } from 'vitest';
import { LlmTransportError } from './llm-client';
import { createOpenRouterClient } from './openrouter-client';

/** A `fetch` that records the request and answers with `status` and `body`. CI never calls OpenRouter. */
function fakeFetch(status: number, body: unknown) {
  const calls: Array<{ url: string; headers: unknown; body: unknown }> = [];
  const fn: typeof fetch = async (url, init) => {
    calls.push({
      url: url as string,
      headers: init?.headers,
      body: JSON.parse(init?.body as string),
    });
    return new Response(JSON.stringify(body), { status });
  };
  return { calls, fetch: fn };
}

const request = {
  system: 'system prompt',
  user: 'user prompt',
  schema: { name: 'deck', schema: { type: 'object' } },
  maxTokens: 1000,
};

function client(
  fetch: typeof globalThis.fetch,
  fallbackModels: string[] = [],
  requireParameters = true,
) {
  return createOpenRouterClient({
    apiKey: 'sk-test',
    model: 'anthropic/claude-sonnet-5.5',
    fallbackModels,
    requireParameters,
    appUrl: 'https://pictiotheme.test',
    fetch,
  });
}

const okBody = {
  model: 'anthropic/claude-sonnet-5.5',
  provider: 'Anthropic',
  choices: [{ finish_reason: 'stop', message: { content: '{"cards":[]}', refusal: null } }],
  usage: { prompt_tokens: 900, completion_tokens: 7000, cost: 0.072 },
};

describe('OpenRouter client', () => {
  it('sends structured-output, privacy and attribution settings', async () => {
    const f = fakeFetch(200, okBody);
    await client(f.fetch, ['openai/gpt-5-mini']).completeJson(request);

    const call = f.calls[0];
    expect(call?.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(call?.headers).toMatchObject({
      authorization: 'Bearer sk-test',
      'http-referer': 'https://pictiotheme.test',
      'x-title': 'PictioTheme',
    });
    expect(call?.body).toMatchObject({
      model: 'anthropic/claude-sonnet-5.5',
      models: ['anthropic/claude-sonnet-5.5', 'openai/gpt-5-mini'],
      messages: [
        { role: 'system', content: 'system prompt' },
        { role: 'user', content: 'user prompt' },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'deck', strict: true, schema: { type: 'object' } },
      },
      provider: { require_parameters: true, data_collection: 'deny' },
      max_tokens: 1000,
    });
  });

  it('can allow providers that ignore some parameters', async () => {
    const f = fakeFetch(200, okBody);
    await client(f.fetch, [], false).completeJson(request);
    expect(f.calls[0]?.body).toMatchObject({
      provider: { require_parameters: false, data_collection: 'deny' },
    });
  });

  it('leaves out the models list without fallbacks', async () => {
    const f = fakeFetch(200, okBody);
    await client(f.fetch).completeJson(request);
    expect(f.calls[0]?.body).not.toHaveProperty('models');
  });

  it('maps the reply, usage and cost', async () => {
    const f = fakeFetch(200, okBody);
    expect(await client(f.fetch).completeJson(request)).toEqual({
      content: '{"cards":[]}',
      finishReason: 'stop',
      refusal: null,
      model: 'anthropic/claude-sonnet-5.5',
      provider: 'Anthropic',
      usage: { inputTokens: 900, outputTokens: 7000, costUsd: 0.072 },
    });
  });

  it('throws a transport error on non-2xx replies, retryable only for 429 and 5xx', async () => {
    const limited = client(fakeFetch(429, { error: { message: 'Rate limited' } }).fetch);
    await expect(limited.completeJson(request)).rejects.toMatchObject({
      name: 'LlmTransportError',
      status: 429,
      retryable: true,
      message: 'OpenRouter returned 429: Rate limited',
    });

    const unauthorized = client(fakeFetch(401, { error: { message: 'No auth' } }).fetch);
    await expect(unauthorized.completeJson(request)).rejects.toMatchObject({ retryable: false });
  });

  it('treats a 200 reply carrying an upstream error as that error', async () => {
    const upstream = fakeFetch(200, {
      error: { message: "Upstream error from Inception: I can't help with that.", code: 502 },
    });
    await expect(client(upstream.fetch).completeJson(request)).rejects.toMatchObject({
      status: 502,
      retryable: true,
      message: "OpenRouter returned 502: Upstream error from Inception: I can't help with that.",
    });
  });

  it('includes the start of an unexpected reply in the error', async () => {
    const odd = client(fakeFetch(200, { weird: 'shape' }).fetch);
    await expect(odd.completeJson(request)).rejects.toMatchObject({
      message: 'OpenRouter returned an unexpected response: {"weird":"shape"}',
    });
  });

  it('says when the request timed out', async () => {
    const slow: typeof fetch = async () => {
      throw new DOMException('The operation timed out.', 'TimeoutError');
    };
    await expect(client(slow).completeJson(request)).rejects.toMatchObject({
      message: 'OpenRouter request timed out after 180s',
      retryable: true,
    });
  });

  it('throws a retryable transport error when the network fails', async () => {
    const failing: typeof fetch = async () => {
      throw new TypeError('fetch failed');
    };
    const err: unknown = await client(failing)
      .completeJson(request)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LlmTransportError);
    expect(err).toMatchObject({ status: null, retryable: true });
  });
});
