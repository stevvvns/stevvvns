# identity-server

## What?
Server-side signature verification for messages signed by `@stevvvns/identity-client`.

## Why?
So a server can confirm a request came from one of your personas, without ever seeing the browser's device key.

## How?
`$ npm i @stevvvns/identity-server`

```javascript
import { verify } from '@stevvvns/identity-server';

const { publicKey, payload } = await verify(buffer);
// payload is the msgpack-decoded message object, with the account id stamped on it
```
