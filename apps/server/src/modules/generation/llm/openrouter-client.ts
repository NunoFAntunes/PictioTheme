import { z } from 'zod';
import { LlmTransportError, type LlmClient, type LlmCompletion } from './llm-client';

/**
 * OpenRouter's OpenAI-compatible chat completions API, called with plain `fetch`.
 * Request settings follow docs/technical/ai-deck-pipeline.md#request-settings.
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const APP_TITLE = 'PictioTheme';
/** A full deck is several thousand output tokens plus reasoning. */
const REQUEST_TIMEOUT_MS = 180_000;

/** Only the fields we use. Everything else in the reply is ignored. */
const ChatCompletionResponse = z.object({
  model: z.string(),
  provider: z.string().nullish(),
  choices: z
    .array(
      z.object({
        finish_reason: z.string().nullish(),
        message: z.object({
          content: z.string().nullish(),
          refusal: z.string().nullish(),
        }),
      }),
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number(),
      completion_tokens: z.number(),
      cost: z.number().nullish(),
    })
    .nullish(),
});

const ErrorResponse = z.object({
  error: z.object({ message: z.string(), code: z.number().int().optional() }),
});

export type OpenRouterOptions = {
  apiKey: string;
  model: string;
  /** Tried in order when the primary model is down or rejects the request. */
  fallbackModels: readonly string[];
  /**
   * Only route to providers that honour every parameter, so the JSON schema is enforced.
   * Off for models without structured-output support: the reply is still validated with zod.
   */
  requireParameters: boolean;
  /** Sent as HTTP-Referer so usage is attributed to the app on OpenRouter. */
  appUrl: string;
  /** Injectable for tests. CI never calls OpenRouter. */
  fetch?: typeof fetch;
};

export function createOpenRouterClient(options: OpenRouterOptions): LlmClient {
  const doFetch = options.fetch ?? fetch;

  return {
    async completeJson(request) {
      const body = {
        model: options.model,
        ...(options.fallbackModels.length > 0 && {
          models: [options.model, ...options.fallbackModels],
        }),
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content: request.user },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: request.schema.name, strict: true, schema: request.schema.schema },
        },
        provider: {
          require_parameters: options.requireParameters,
          // Never send user themes to providers that may train on them.
          data_collection: 'deny',
        },
        reasoning: { effort: 'medium' },
        max_tokens: request.maxTokens,
        usage: { include: true },
      };

      let res: Response;
      try {
        res = await doFetch(OPENROUTER_URL, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${options.apiKey}`,
            'content-type': 'application/json',
            'http-referer': options.appUrl,
            'x-title': APP_TITLE,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (err) {
        const timedOut = err instanceof Error && err.name === 'TimeoutError';
        const message = timedOut ? `timed out after ${REQUEST_TIMEOUT_MS / 1000}s` : 'failed';
        throw new LlmTransportError(`OpenRouter request ${message}`, null, { cause: err });
      }

      // The timeout also covers reading the body: OpenRouter sends headers before the model finishes.
      let text: string;
      try {
        text = await res.text();
      } catch (err) {
        const timedOut = err instanceof Error && err.name === 'TimeoutError';
        const message = timedOut
          ? `timed out after ${REQUEST_TIMEOUT_MS / 1000}s`
          : 'body unreadable';
        throw new LlmTransportError(`OpenRouter request ${message}`, null, { cause: err });
      }
      const json = parseJsonOrNull(text);
      // Upstream failures can arrive as a 200 whose body is an error with its own code.
      const error = ErrorResponse.safeParse(json);
      if (!res.ok || error.success) {
        const status = error.success ? (error.data.error.code ?? res.status) : res.status;
        const message = error.success ? error.data.error.message : res.statusText;
        throw new LlmTransportError(`OpenRouter returned ${status}: ${message}`, status);
      }

      const parsed = ChatCompletionResponse.safeParse(json);
      if (!parsed.success) {
        throw new LlmTransportError(
          `OpenRouter returned an unexpected response: ${text.slice(0, 300)}`,
          res.status,
        );
      }
      const { model, provider, choices, usage } = parsed.data;
      const choice = choices[0];
      return {
        content: choice?.message.content ?? null,
        finishReason: choice?.finish_reason ?? null,
        refusal: choice?.message.refusal ?? null,
        model,
        provider: provider ?? null,
        usage: {
          inputTokens: usage?.prompt_tokens ?? 0,
          outputTokens: usage?.completion_tokens ?? 0,
          costUsd: usage?.cost ?? null,
        },
      } satisfies LlmCompletion;
    },
  };
}

function parseJsonOrNull(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
