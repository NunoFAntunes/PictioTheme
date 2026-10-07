/**
 * The model behind deck generation (rule B9: a second implementation exists, the fake in tests).
 * Production uses OpenRouter. See docs/technical/ai-deck-pipeline.md#client.
 */

export type LlmJsonRequest = {
  /** Static instructions. Keep byte-identical across requests so providers can cache it. */
  system: string;
  /** The per-request message, with user input in clearly labelled fields. */
  user: string;
  /** JSON Schema the reply must follow (structured output). Validate the reply anyway (rule B25). */
  schema: { name: string; schema: Record<string, unknown> };
  maxTokens: number;
  /**
   * How hard a reasoning model thinks first. Default `medium`. Null leaves the parameter out,
   * for models that don't reason (with `require_parameters`, sending it can rule them out).
   */
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high' | null;
};

export type LlmUsage = {
  inputTokens: number;
  outputTokens: number;
  /** In USD, as reported by the provider. Null when it isn't reported. */
  costUsd: number | null;
};

export type LlmCompletion = {
  /** The raw reply text, expected to be JSON. Null when the model returned no content. */
  content: string | null;
  /** `stop` on success. `length` and `content_filter` mean the reply can't be used. */
  finishReason: string | null;
  /** Set when the model refused instead of answering. */
  refusal: string | null;
  /** The model and provider that actually served the request (fallbacks may differ from config). */
  model: string;
  provider: string | null;
  usage: LlmUsage;
};

export type LlmClient = {
  completeJson(request: LlmJsonRequest): Promise<LlmCompletion>;
};

/** The request never produced a completion: network failure, timeout or a non-2xx reply. */
export class LlmTransportError extends Error {
  readonly status: number | null;
  /** 429 and 5xx are worth retrying later; other failures (bad key, bad request) aren't. */
  readonly retryable: boolean;

  constructor(message: string, status: number | null, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'LlmTransportError';
    this.status = status;
    this.retryable = status === null || status === 429 || status >= 500;
  }
}
