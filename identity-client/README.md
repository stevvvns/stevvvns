# identity-client

## What?
Browser-side identity for `@stevvvns` apps: an ECDSA device key for signing, plus IndexedDB-backed "accounts" (personas) you can switch between.

## Why?
Accounts are personas — work, friends, family. Each carries a seed that drives the UI's look, so the context you're posting in stays visually distinct from the others.

## How?
`$ npm i @stevvvns/identity-client`

```javascript
import { useIdentity } from '@stevvvns/identity-client';

const { accountList, currentAccount, addAccount, removeAccount, sign } = useIdentity();

await addAccount('work');

// sign a message object; the current account id is stamped onto it
const buffer = await sign({ text: 'hello' });
```

For a non-reactive API, the default export `initIdentity()` returns `{ sign, accounts }`.
