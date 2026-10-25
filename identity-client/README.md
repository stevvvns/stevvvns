# identity-client

## What?
This library provides a device signing key, a list of accounts, and some managment function for the accounts.

## Why?
This supports local-first authentication. You are meant to maintain a list of accounts a device is allowed to perform as on the server, and use the signature of the device to prove the authz.

## How?
`$ npm i @stevvvns/identity-client`

This is mostly intended to use with `incomponent` library utilizing the store:

```javascript
import { useIdentity } from '@stevvvns/identity-client';

const { accountList, currentAccount, addAccount, removeAccount, sign } = useIdentity();

await addAccount('work');

// sign a message object; the current account id is stamped onto it
const buffer = await sign({ text: 'hello' });
```

If you're not using `incomponent`, you can use the default `{ sign, accounts }` export to build similar functionality.

## TODO
 * Include helpers for mitigations of local-first pitfalls: recovery codes, device linking/revocation
 * Make account metadata customizable
   * Currently includes a `name` that must be unique (for 1:1 device<->account you can just ignore the name), and a `seed` that is a random number used to generate recognizable avatars/color schemes for each account

