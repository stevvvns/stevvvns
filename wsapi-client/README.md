# @stevvvns/wsapi-client

## What?

A resilient WebSocket client. It wraps the native `WebSocket` and transparently
reconnects when the connection drops, with exponential backoff and jitter, and
is consumable through an incomponent store (`useWebsocket()`).

## Why?

A plain `WebSocket` dies the moment the network hiccups, the laptop sleeps, or
the server restarts, and leaves reconnecting up to you. This keeps the
connection alive and tells you when it's actually up.

## How

```javascript
import { useWebsocket } from '@stevvvns/wsapi-client';

const ws = useWebsocket('wss://example.com/socket', {
  minDelay: 250,
  maxDelay: 30000
});

ws.connected; //    Ref<boolean> — true only while the socket is OPEN
ws.socket; //      Ref<WebSocket | null> — the current socket, or null
ws.error; //        Ref<Error | null> — last failure reason, or null once connected
ws.nextRetryIn; //  Ref<number | null> — ms until the next reconnect attempt

ws.onMessage((event) => console.log(event.data));
await ws.send('hello'); // reconnects first if needed, resolves once sent
await ws.reconnect(); //   drop the current socket and reconnect immediately
ws.close(); //             stop reconnecting for good
```

`useWebsocket(url)` returns a shared connection per `url`: every call with the
same `url` gets the same connection (the first call's options win).

`createConnection(url, options)` is the same thing without the store, if you
want to wire the connection up yourself.

`send()` and `reconnect()` return promises. `reconnect()` resolves once the
connection is open and rejects on permanent failure. `send()` resolves once the
message is handed off; if it has to reconnect first and that attempt fails, it
rejects rather than waiting for the next backoff retry.

### Behavior

- Connects immediately and retries failed connections forever, backing off
  exponentially (`minDelay * factor^attempt`, capped at `maxDelay`) with jitter
  so a fleet of clients doesn't reconnect in lockstep.
- Retries abnormal closures (`1006`) and transient codes (`1012`, `1013`,
  `1014`), and gives up on clean/permanent codes (`1000`, `1001`, `1002`, …).
  Override with the `shouldRetry(event)` option.
- `onOpen`/`onMessage`/`onClose`/`onError` stay wired across reconnects, so you
  register them once instead of re-attaching to each new socket.
- `connected` is your answer to "is it up right now"; `error` is your answer to
  "why not". Both are `Ref`s, so components re-render when they change.
