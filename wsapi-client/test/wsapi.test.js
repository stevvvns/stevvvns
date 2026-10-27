import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createConnection, useWebsocket } from '../src/index.js';

// A controllable WebSocket double. Each test gets its own class so the
// `instances` array is never shared across tests.
function makeMock() {
  const instances = [];
  class MockWebSocket {
    constructor(url, protocols) {
      this.url = url;
      this.protocols = protocols;
      this.readyState = 0; // CONNECTING
      this.sent = [];
      instances.push(this);
    }
    open() {
      this.readyState = 1; // OPEN
      this.onopen?.({ target: this });
    }
    receive(data) {
      this.onmessage?.({ data, target: this });
    }
    close(code = 1006, reason = '') {
      this.readyState = 3; // CLOSED
      this.onclose?.({ code, reason, target: this });
    }
    send(data) {
      this.sent.push(data);
    }
  }
  return { MockWebSocket, instances };
}

test('starts disconnected and opens on connect', () => {
  const { MockWebSocket, instances } = makeMock();
  const conn = createConnection('ws://example.com', { WebSocketImpl: MockWebSocket });

  assert.equal(conn.connected.value, false);
  assert.equal(conn.socket.value, instances[0]);

  instances[0].open();
  assert.equal(conn.connected.value, true);
  assert.equal(conn.error.value, null);
});

test('sets binaryType to arraybuffer by default', () => {
  const { MockWebSocket, instances } = makeMock();
  createConnection('ws://example.com', { WebSocketImpl: MockWebSocket });
  assert.equal(instances[0].binaryType, 'arraybuffer');
});

test('allows overriding binaryType', () => {
  const { MockWebSocket, instances } = makeMock();
  createConnection('ws://example.com', {
    WebSocketImpl: MockWebSocket,
    binaryType: 'blob'
  });
  assert.equal(instances[0].binaryType, 'blob');
});

test('retries a retryable close after the backoff delay', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const { MockWebSocket, instances } = makeMock();
  const conn = createConnection('ws://example.com', {
    WebSocketImpl: MockWebSocket,
    minDelay: 100,
    factor: 2,
    jitter: false
  });

  instances[0].open();
  instances[0].close(1006); // abnormal closure
  assert.equal(conn.connected.value, false);
  assert.equal(instances.length, 1);

  t.mock.timers.tick(99);
  assert.equal(instances.length, 1);

  t.mock.timers.tick(1);
  assert.equal(instances.length, 2);
});

test('backoff grows exponentially and resets on success', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const { MockWebSocket, instances } = makeMock();
  const conn = createConnection('ws://example.com', {
    WebSocketImpl: MockWebSocket,
    minDelay: 100,
    factor: 2,
    jitter: false
  });

  instances[0].open();
  instances[0].close(1006); // attempt 1 -> 100ms
  t.mock.timers.tick(100);
  assert.equal(instances.length, 2);

  instances[1].close(1006); // attempt 2 -> 200ms
  t.mock.timers.tick(199);
  assert.equal(instances.length, 2);
  t.mock.timers.tick(1);
  assert.equal(instances.length, 3);

  instances[2].open(); // success resets the counter
  instances[2].close(1006); // attempt 1 again -> 100ms
  t.mock.timers.tick(100);
  assert.equal(instances.length, 4);
});

test('gives up on a permanent close code', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const { MockWebSocket, instances } = makeMock();
  const conn = createConnection('ws://example.com', {
    WebSocketImpl: MockWebSocket,
    jitter: false
  });

  instances[0].open();
  instances[0].close(1008); // policy violation
  assert.equal(instances.length, 1);
  assert.ok(conn.error.value);

  t.mock.timers.tick(60000);
  assert.equal(instances.length, 1);
});

test('reconnect() bypasses the backoff and cancels the pending timer', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const { MockWebSocket, instances } = makeMock();
  const conn = createConnection('ws://example.com', {
    WebSocketImpl: MockWebSocket,
    minDelay: 10000,
    jitter: false
  });

  instances[0].open();
  instances[0].close(1006); // schedules a 10s retry
  assert.equal(instances.length, 1);

  conn.reconnect(); // should open a fresh socket immediately
  assert.equal(instances.length, 2);

  // the pending timer was cancelled, so nothing else should reconnect
  t.mock.timers.tick(60000);
  assert.equal(instances.length, 2);
});

test('send() returns a promise and resolves once sent', async () => {
  const { MockWebSocket, instances } = makeMock();
  const conn = createConnection('ws://example.com', { WebSocketImpl: MockWebSocket });

  // socket is still CONNECTING, so send() waits rather than reconnecting
  const p = conn.send('hello');
  assert.ok(p instanceof Promise);
  assert.equal(instances.length, 1);

  instances[0].open();
  await p;
  assert.deepEqual(instances[0].sent, ['hello']);
});

test('send() reconnects immediately when disconnected', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const { MockWebSocket, instances } = makeMock();
  const conn = createConnection('ws://example.com', {
    WebSocketImpl: MockWebSocket,
    minDelay: 10000,
    jitter: false
  });

  instances[0].open();
  instances[0].close(1006); // disconnected, 10s backoff scheduled
  assert.equal(instances.length, 1);

  const p = conn.send('hello'); // forces an immediate reconnect
  assert.equal(instances.length, 2);

  instances[1].open();
  await p;
  assert.deepEqual(instances[1].sent, ['hello']);
});

test('send() rejects if the reconnect attempt fails', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const { MockWebSocket, instances } = makeMock();
  const conn = createConnection('ws://example.com', {
    WebSocketImpl: MockWebSocket,
    minDelay: 100,
    jitter: false
  });

  instances[0].open();
  instances[0].close(1006); // disconnected
  assert.equal(instances.length, 1);

  const p = conn.send('hello'); // forces an immediate reconnect
  assert.equal(instances.length, 2);

  instances[1].close(1006); // that reconnect attempt fails
  await assert.rejects(p, /closed \(1006\)/);
});

test('reconnect() resolves once the new socket is open', async () => {
  const { MockWebSocket, instances } = makeMock();
  const conn = createConnection('ws://example.com', { WebSocketImpl: MockWebSocket });

  const p = conn.reconnect();
  assert.equal(instances.length, 2); // initial socket + a fresh one

  instances[1].open();
  await p;
  assert.equal(conn.connected.value, true);
});

test('reconnect() rejects when the connection permanently fails', async () => {
  const { MockWebSocket, instances } = makeMock();
  const conn = createConnection('ws://example.com', { WebSocketImpl: MockWebSocket });

  const p = conn.reconnect();
  instances[1].close(1008); // policy violation — not retried
  await assert.rejects(p, /closed \(1008\)/);
});

test('nextRetryIn reports the time until the next retry', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const { MockWebSocket, instances } = makeMock();
  const conn = createConnection('ws://example.com', {
    WebSocketImpl: MockWebSocket,
    minDelay: 100,
    factor: 2,
    jitter: false
  });

  assert.equal(conn.nextRetryIn.value, null);

  instances[0].open();
  assert.equal(conn.nextRetryIn.value, null);

  instances[0].close(1006); // first retry scheduled in 100ms
  assert.equal(conn.nextRetryIn.value, 100);

  t.mock.timers.tick(100); // retry fires, countdown clears
  assert.equal(conn.nextRetryIn.value, null);
});

test('handlers stay wired across reconnects', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const { MockWebSocket, instances } = makeMock();
  const conn = createConnection('ws://example.com', {
    WebSocketImpl: MockWebSocket,
    minDelay: 100,
    jitter: false
  });

  const received = [];
  conn.onMessage((event) => received.push(event.data));

  instances[0].open();
  instances[0].receive('a');
  assert.deepEqual(received, ['a']);

  instances[0].close(1006);
  t.mock.timers.tick(100);

  instances[1].open();
  instances[1].receive('b');
  assert.deepEqual(received, ['a', 'b']);
});

test('onClose fires on a network close but not on manual close()', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const { MockWebSocket, instances } = makeMock();
  const conn = createConnection('ws://example.com', {
    WebSocketImpl: MockWebSocket,
    jitter: false
  });

  let closed = 0;
  conn.onClose(() => closed++);

  instances[0].open();
  instances[0].close(1006);
  assert.equal(closed, 1);

  t.mock.timers.tick(1000); // reconnect
  instances[1].open();

  conn.close();
  assert.equal(closed, 1); // manual close does not notify
  assert.equal(conn.socket.value, null);
  assert.equal(conn.connected.value, false);
});

test('useWebsocket() returns a single shared connection', () => {
  const { MockWebSocket, instances } = makeMock();
  const options = { WebSocketImpl: MockWebSocket };

  const a = useWebsocket('ws://example.com/a', options);
  const again = useWebsocket('ws://example.com/b', options);

  assert.equal(a, again);
  assert.equal(instances.length, 1);

  assert.throws(() => useWebsocket(''), /requires a url/);
});
