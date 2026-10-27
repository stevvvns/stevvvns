import type { Ref } from '@stevvvns/incomponent';

export interface ConnectionOptions {
  /** Subprotocols passed through to the underlying WebSocket. */
  protocols?: string | string[];
  /** Type of `message` event data: 'blob' or 'arraybuffer'. Defaults to 'arraybuffer'. */
  binaryType?: 'blob' | 'arraybuffer';
  /** Base delay (ms) before the first retry. Defaults to 250. */
  minDelay?: number;
  /** Upper bound (ms) on the retry delay. Defaults to 30000. */
  maxDelay?: number;
  /** Multiplier applied per consecutive failure. Defaults to 2. */
  factor?: number;
  /** When true (default), the delay is jittered to [base/2, base]. */
  jitter?: boolean;
  /** WebSocket constructor, injectable for tests. Defaults to globalThis.WebSocket. */
  WebSocketImpl?: typeof WebSocket;
  /** Decide whether a close event is worth retrying. */
  shouldRetry?: (event: CloseEvent) => boolean;
}

export interface WebSocketConnection {
  /** The current underlying socket, or null while disconnected. */
  socket: Ref<WebSocket | null>;
  /** True only while the socket is OPEN. */
  connected: Ref<boolean>;
  /** Last failure (close reason or error), or null once connected. */
  error: Ref<Error | null>;
  /** Milliseconds until the next reconnect attempt, or null when not backing off. */
  nextRetryIn: Ref<number | null>;
  /** Sends now if connected; otherwise reconnects and resolves once sent, rejecting if that reconnect attempt fails. */
  send(data: string | ArrayBuffer | Blob | ArrayBufferView): Promise<void>;
  /** Immediately reconnect; resolves once open, rejects on permanent failure. */
  reconnect(): Promise<void>;
  /** Permanently close and stop reconnecting. */
  close(code?: number, reason?: string): void;
  onOpen(cb: () => void): () => void;
  onMessage(cb: (event: MessageEvent) => void): () => void;
  onClose(cb: (event: CloseEvent) => void): () => void;
  onError(cb: (event: Event) => void): () => void;
}

export function createConnection(
  url: string,
  options?: ConnectionOptions
): WebSocketConnection;

export function useWebsocket(
  url: string,
  options?: ConnectionOptions
): WebSocketConnection;

export interface ApiOptions extends ConnectionOptions {
  /** Logger for debug messages. Defaults to console. */
  log?: Console;
  /** Per-request timeout in ms; 0 disables it. Defaults to 30000. */
  timeout?: number;
}

export interface ApiClient {
  connected: Ref<boolean>;
  nextRetryIn: Ref<number | null>;
  /** RPC methods are untyped; any property access sends a signed request. */
  [method: string]: unknown;
}

export function useApi(url: string, options?: ApiOptions): ApiClient;
