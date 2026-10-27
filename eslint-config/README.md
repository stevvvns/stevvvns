# @stevvvns/eslint-config

Shared ESLint flat config (house style) for `@stevvvns/*` packages and the apps
that consume them.

```js
import { houseStyle } from '@stevvvns/eslint-config';

export default houseStyle({
  nodeGlobs: ['server/**/*.{js,mjs,cjs}']
});
```
