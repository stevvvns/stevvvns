import { comp, html, ref } from '@stevvvns/incomponent';
import initIdentity from '@stevvvns/identity-client';

const init = initIdentity(console.debug);

comp(function IdentityTest() {
  const msg = ref('hello world');
  const resp = ref();
  const accounts = ref();
  init.then(async (ident) => {
    accounts.value = await ident.accounts.getList();
  });
  async function submit() {
    const ident = await init;
    const signed = await ident.sign(msg.value);
    try {
      const res = await fetch('/echo', {
        method: 'POST',
        body: signed,
        headers: { 'content-type': 'application/octet-stream' }
      });
      if (!res.ok) {
        throw new Error('request failed');
      }
      resp.value = await res.text();
    } catch (ex) {
      resp.value = `an error occurred: ${ex}`;
    }
  }
  return { msg, submit, resp, accounts };
}).template(
  (el) => html`
    <h2>Accounts</h2>
    <pre>${JSON.stringify(el.accounts, null, 2)}</pre>
    <h2>Signing</h2>
    <textarea
      placeholder="Message to echo"
      @change=${(evt) => (el.msg.value = evt.target.value)}
    >
${el.msg}</textarea>
    <p><button @click=${el.submit}>submit</button></p>
    ${el.resp ? html`<p>server says: ${el.resp}</p>` : ''}
  `
);
