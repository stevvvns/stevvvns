# identity-server

## What?
Server-side signature verification for messages signed by `@stevvvns/identity-client`.

## Why?
Currently just a stub for signature verification, or to run as a dev test to manually verify changes to the identity library.

## How?
`$ npm i @stevvvns/identity-server`

```javascript
import { verify } from '@stevvvns/identity-server';

const { publicKey, payload } = await verify(buffer);
// payload has _account: some uuid, if your app is not 1:1 device<->account
```

## TODO
 * Support the client library in mitigations for local-first pitfalls: recovery codes, device linking/revocation
