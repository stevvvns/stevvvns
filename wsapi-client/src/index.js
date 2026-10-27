import { store } from '@stevvvns/incomponent';
import { createConnection } from './connection.js';

export { useApi } from './transport.js';

const useWebsocketStore = store(function websocketStore(url, opts = {}) {
  return createConnection(url, opts);
});

export function useWebsocket(url, opts = {}) {
  if (!url) {
    throw new Error('useWebsocket() requires a url');
  }
  return useWebsocketStore(url, opts);
}

export { createConnection };
