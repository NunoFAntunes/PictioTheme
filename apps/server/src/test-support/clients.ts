import type { ClientMessage, JoinRoomResponse, ServerMessage } from '@pictiotheme/protocol';
import { WebSocket, type RawData } from 'ws';
import { testAvatar } from './avatar';

function rawToString(data: RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  return Buffer.from(new Uint8Array(data)).toString('utf8');
}

/** HTTP and WebSocket clients for end-to-end tests against a listening app. */

type Msg<T extends ServerMessage['t']> = Extract<ServerMessage, { t: T }>;

export class TestSocket {
  readonly received: ServerMessage[] = [];
  private consumed = new Set<number>();
  private listeners: (() => void)[] = [];
  readonly closed: Promise<{ code: number; reason: string }>;
  readonly socket: WebSocket;

  constructor(socket: WebSocket) {
    this.socket = socket;
    socket.on('message', (data) => {
      this.received.push(JSON.parse(rawToString(data)) as ServerMessage);
      for (const l of this.listeners) l();
    });
    this.closed = new Promise((resolve) =>
      socket.on('close', (code, reason) => resolve({ code, reason: reason.toString() })),
    );
  }

  send(msg: ClientMessage): void {
    this.socket.send(JSON.stringify(msg));
  }

  /** The next not-yet-consumed message of this type (optionally matching), waiting if needed. */
  next<T extends ServerMessage['t']>(
    t: T,
    match: (m: Msg<T>) => boolean = () => true,
    timeoutMs = 2_000,
  ): Promise<Msg<T>> {
    return new Promise((resolve, reject) => {
      const check = () => {
        const index = this.received.findIndex(
          (m, i) => !this.consumed.has(i) && m.t === t && match(m as Msg<T>),
        );
        if (index === -1) return false;
        this.consumed.add(index);
        cleanup();
        resolve(this.received[index] as Msg<T>);
        return true;
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(
          new Error(`timed out waiting for ${t}; got ${this.received.map((m) => m.t).join(', ')}`),
        );
      }, timeoutMs);
      const cleanup = () => {
        clearTimeout(timer);
        this.listeners = this.listeners.filter((l) => l !== listener);
      };
      const listener = () => void check();
      this.listeners.push(listener);
      check();
    });
  }

  close(): void {
    this.socket.close();
  }
}

export class TestPlayer {
  private cookie = '';
  readonly baseUrl: string;
  readonly origin: string;

  constructor(baseUrl: string, origin: string) {
    this.baseUrl = baseUrl;
    this.origin = origin;
  }

  async request(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        origin: this.origin,
        ...(this.cookie && { cookie: this.cookie }),
        ...(body !== undefined && { 'content-type': 'application/json' }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) this.cookie = setCookie.split(';')[0] ?? '';
    const json: unknown = await res.json();
    return { status: res.status, body: json };
  }

  async startSession(): Promise<string> {
    const res = await this.request('POST', '/api/session/guest');
    return (res.body as { playerId: string }).playerId;
  }

  async createRoom(name: string, isPublic = false, deckId?: string): Promise<JoinRoomResponse> {
    const res = await this.request('POST', '/api/rooms', {
      name: `${name}'s room`,
      isPublic,
      displayName: name,
      avatar: testAvatar([255, 0, 0]),
      ...(deckId && { deckId }),
    });
    if (res.status !== 200) throw new Error(`create failed: ${JSON.stringify(res.body)}`);
    return res.body as JoinRoomResponse;
  }

  async joinRoom(code: string, name: string): Promise<JoinRoomResponse> {
    const res = await this.request('POST', `/api/rooms/${code}/join`, {
      displayName: name,
      avatar: testAvatar([0, 0, 255]),
    });
    if (res.status !== 200) throw new Error(`join failed: ${JSON.stringify(res.body)}`);
    return res.body as JoinRoomResponse;
  }

  async quickPlay(name: string, language?: string): Promise<JoinRoomResponse> {
    const res = await this.request('POST', '/api/rooms/quick-play', {
      displayName: name,
      avatar: testAvatar([0, 160, 0]),
      ...(language && { language }),
    });
    if (res.status !== 200) throw new Error(`quick play failed: ${JSON.stringify(res.body)}`);
    return res.body as JoinRoomResponse;
  }

  connect(token: string): Promise<TestSocket> {
    const url = `${this.baseUrl.replace('http', 'ws')}/ws?token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(url, { headers: { origin: this.origin } });
    const client = new TestSocket(socket);
    return new Promise((resolve, reject) => {
      socket.once('open', () => resolve(client));
      socket.once('unexpected-response', (_req, res) =>
        reject(new Error(`upgrade rejected: ${res.statusCode}`)),
      );
      socket.once('error', reject);
    });
  }
}
