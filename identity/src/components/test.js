import { comp, html } from '@stevvvns/incomponent';
import initIdentity from '@stevvvns/identity';

comp(function IdentityTest() {
  (async () => {
    const ident = await initIdentity(console.debug);
    const signed = await ident.sign('asdf');
    console.log(await ident.accounts.getList());
  })();
}).template(html`<p>ok</p>`);
