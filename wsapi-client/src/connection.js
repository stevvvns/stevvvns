import { ref } from '@stevvvns/incomponent';

const CONNECTING = 0;
const OPEN = 1;

const NO_RETRY_CODES = new Set([
  1000, // normal closure
  1001, // going away
  1002, // protocol error
  1003, // unsupported data
  1007, // invalid frame payload data
  1008, // policy violation
  1009, // message too big
  1010, // missing extension
  1011 // internal server error
]);

// How often the nextRetryIn countdown updates, in milliseconds.
const COUNTDOWN_STEP = 100;

function defaultShouldRetry(evt) {
  return !NO_RETRY_CODES.has(evt.code);
}

function closeError(evt) {
  return new Error(`WebSocket closed (${evt.code})${evt.reason ? `: ${evt.reason}` : ''}`);
}

export function createConnection(url, opts = {}) {
  const {
    protocols,
    binaryType = 'arraybuffer',
    WebSocketImpl = globalThis.WebSocket,
    minDelay = 250,
    maxDelay = 30000,
    factor = 2,
    jitter = true,
    shouldRetry = defaultShouldRetry
  } = opts;

  const socket = ref(null);
  const connected = ref(false);
  const error = ref(null);
  const nextRetryIn = ref(null);

  const openHandlers = new Set();
  const messageHandlers = new Set();
  const closeHandlers = new Set();
  const errorHandlers = new Set();

  // reconnect()'s waiters: resolve on open, reject only on permanent failure.
  const pendingOpens = [];
  // send()'s waiters, keyed by the socket they're waiting on: reject on any close.
  const socketWaiters = new WeakMap();

  let attempts = 0;
  let timer = null;
  let countdown = null;

  function delayFor(attempt) {
    const base = Math.min(maxDelay, minDelay * Math.pow(factor, attempt - 1));
    return jitter ? base * (0.5 + Math.random() * 0.5) : base;
  }

  function stopCountdown() {
    if (countdown) {
      clearInterval(countdown);
      countdown = null;
    }
    nextRetryIn.value = null;
  }

  function startCountdown(delay) {
    stopCountdown();
    nextRetryIn.value = delay;
    countdown = setInterval(() => {
      const remaining = nextRetryIn.value - COUNTDOWN_STEP;
      nextRetryIn.value = remaining > 0 ? remaining : 0;
    }, COUNTDOWN_STEP);
  }

  function scheduleReconnect() {
    attempts += 1;
    const delay = delayFor(attempts);
    timer = setTimeout(open, delay);
    startCountdown(delay);
  }

  function waitForOpen() {
    return new Promise((resolve, reject) => {
      pendingOpens.push({ resolve, reject });
    });
  }

  function resolveOpens() {
    for (const { resolve } of pendingOpens) {
      resolve();
    }
    pendingOpens.length = 0;
  }

  function rejectOpens(reason) {
    for (const { reject } of pendingOpens) {
      reject(reason);
    }
    pendingOpens.length = 0;
  }

  function waitForSocket(sock) {
    return new Promise((resolve, reject) => {
      let waiters = socketWaiters.get(sock);
      if (!waiters) {
        waiters = new Set();
        socketWaiters.set(sock, waiters);
      }
      waiters.add({ resolve, reject });
    });
  }

  function settleSocket(sock, ok, reason) {
    const waiters = socketWaiters.get(sock);
    if (!waiters) {
      return;
    }
    socketWaiters.delete(sock);
    for (const waiter of waiters) {
      if (ok) {
        waiter.resolve();
      } else {
        waiter.reject(reason);
      }
    }
  }

  function attach(sock) {
    sock.onopen = () => {
      settleSocket(sock, true);
      if (sock !== socket.value) {
        return;
      }
      attempts = 0;
      connected.value = true;
      error.value = null;
      stopCountdown();
      for (const cb of openHandlers) {
        cb();
      }
      resolveOpens();
    };
    sock.onmessage = (evt) => {
      if (sock !== socket.value) {
        return;
      }
      for (const cb of messageHandlers) {
        cb(evt);
      }
    };
    sock.onerror = (evt) => {
      if (sock !== socket.value) {
        return;
      }
      error.value = new Error('WebSocket error');
      for (const cb of errorHandlers) {
        cb(evt);
      }
    };
    sock.onclose = (evt) => {
      const err = closeError(evt);
      settleSocket(sock, false, err);
      if (sock !== socket.value) {
        return;
      }
      socket.value = null;
      connected.value = false;
      for (const cb of closeHandlers) {
        cb(evt);
      }
      error.value = err;
      if (!shouldRetry(evt)) {
        rejectOpens(err);
        return;
      }
      scheduleReconnect();
    };
  }

  function open() {
    stopCountdown();
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    let sock;
    try {
      sock = new WebSocketImpl(url, protocols);
    } catch (ex) {
      // Constructor threw (e.g. bad URL) — treat it as a failed attempt.
      socket.value = null;
      connected.value = false;
      error.value = ex;
      scheduleReconnect();
      return;
    }
    sock.binaryType = binaryType;
    socket.value = sock;
    attach(sock);
  }

  function forceOpen() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    stopCountdown();
    attempts = 0;
    const old = socket.value;
    socket.value = null;
    connected.value = false;
    if (old) {
      try {
        old.close();
      } catch {
        // ignore
      }
    }
    open();
  }

  function reconnect() {
    forceOpen();
    return waitForOpen();
  }

  function close(code = 1000, reason = '') {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    stopCountdown();
    const old = socket.value;
    socket.value = null;
    connected.value = false;
    error.value = null;
    if (old) {
      try {
        old.close(code, reason);
      } catch {
        // ignore
      }
    }
    rejectOpens(closeError({ code, reason }));
  }

  function send(data) {
    const sock = socket.value;
    if (sock && sock.readyState === OPEN) {
      try {
        sock.send(data);
        return Promise.resolve();
      } catch (ex) {
        return Promise.reject(ex);
      }
    }
    // Not ready. If it's already connecting, wait on that socket; otherwise
    // force an immediate reconnect and wait on the fresh socket.
    if (!sock || sock.readyState !== CONNECTING) {
      forceOpen();
    }
    const target = socket.value;
    if (!target) {
      // The constructor threw; a backoff retry is scheduled, but this send fails.
      return Promise.reject(error.value ?? new Error('WebSocket failed to open'));
    }
    return waitForSocket(target).then(() => {
      const s = socket.value;
      if (!s || s.readyState !== OPEN) {
        throw new Error('WebSocket failed to open');
      }
      s.send(data);
    });
  }

  open();

  return {
    socket,
    connected,
    error,
    nextRetryIn,
    send,
    reconnect,
    close,
    onOpen(cb) {
      openHandlers.add(cb);
      return () => openHandlers.delete(cb);
    },
    onMessage(cb) {
      messageHandlers.add(cb);
      return () => messageHandlers.delete(cb);
    },
    onClose(cb) {
      closeHandlers.add(cb);
      return () => closeHandlers.delete(cb);
    },
    onError(cb) {
      errorHandlers.add(cb);
      return () => errorHandlers.delete(cb);
    }
  };
}
