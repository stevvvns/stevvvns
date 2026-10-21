import { comp, html } from '@stevvvns/incomponent';
import { test } from '@stevvvns/identity';

comp(function IdentityTest() {
  (async () => {
    const sign = await test(console.debug);
    const signed = await sign('asdf');
  })();
}).template(html`<p>ok</p>`);
