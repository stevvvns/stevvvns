import { comp, html, ref, repeat } from '@stevvvns/incomponent';
import { useIdentity } from '@stevvvns/identity-client';

comp(
  function Account(el) {
    const ident = useIdentity();
    function setCurrent() {
      ident.setCurrentAccount(el.data.id);
    }
    function reroll() {
      ident.rerollAccountSeed(el.data.id);
    }
    function moveUp() {
      ident.moveAccount(el.idx - 1, el.data.id);
    }
    function moveDown() {
      ident.moveAccount(el.idx + 1, el.data.id);
    }
    function rename(evt) {
      ident.updateAccount({ name: evt.target.value }, el.data.id);
    }
    function removeAccount() {
      ident.removeAccount(el.data.id);
    }
    return { setCurrent, reroll, moveUp, moveDown, rename, removeAccount };
  },
  ['data']
).template(
  (el) => html`
    <div role="cell">
      ${el.idx < el.len - 1 ? html`<button @click=${el.moveDown}>⬇️</button>` : html`<span style="display: inline-block; width: 26px;" />`}
      ${el.idx > 0 ? html`<button @click=${el.moveUp}>⬆️</button>` : ''}
    </div>
    <div role="cell">
      ${el.iscurrent ? 'yes' : html`<button @click=${el.setCurrent}>no</button>`}
    </div>
    <div role="cell"><input value=${el.data.name} @change=${el.rename} /></div>
    <div role="cell" class="id-cell">
      <button class="remove" @click=${el.removeAccount}>✕</button>
      ${el.data.id}
    </div>
    <div role="cell">
      <button
        class="reroll"
        @click=${el.reroll}
        style="background: hsl(${el.data.seed % 360}, 80%, 50%)"
      ></button>
      ${el.data.seed}
    </div>
  `
).style(`
  :host {
    display: grid;
    grid-template-columns: var(--cols, minmax(0, 1fr));
  }
  [role='cell'] {
    min-width: 0;
  }
  [role='cell'] input {
    width: 100%;
    box-sizing: border-box;
  }
  .reroll {
    width: 40px;
    height: 40px;
    margin-right: 8px;
  }
  .id-cell {
    text-wrap: nowrap;
    overflow: hidden;
    margin-right: 8px;
  }
`);

comp(function Accounts() {
  const ident = useIdentity();
  const newName = ref('');
  const err = ref();

  async function add() {
    try {
      await ident.addAccount(newName.value);
    } catch (ex) {
      err.value = ex.toString();
    }
  }
  return {
    list: ident.accountList,
    current: ident.currentAccount,
    newName,
    add,
    err
  };
}).template(
  (el) => html`
    <h2>Accounts</h2>
    <div class="table" role="table">
      <div class="thead" role="row">
        <div role="columnheader"></div>
        <div role="columnheader">current</div>
        <div role="columnheader">name</div>
        <div role="columnheader">id</div>
        <div role="columnheader">seed</div>
      </div>
      <div class="tbody" role="rowgroup">
        ${repeat(
          el.list,
          (acc) => acc.id,
          (acc, idx) =>
            html`<inc-account
              role="row"
              .idx=${idx}
              .len=${el.list.length}
              .data=${acc}
              .iscurrent=${el.current?.id === acc.id}
            ></inc-account>`
        )}
      </div>
    </div>
    <input
      placeholder="account name"
      value=${el.newName}
      @keyup=${(evt) => (el.newName.value = evt.target.value)}
    />
    <p><button @click=${el.add}>add</button></p>
    ${el.err ? html`<p style="color: #900">${el.err}</p>` : ''}
  `
).style(`
  :host {
    --cols: repeat(5, minmax(0, 1fr));
  }
  .table {
    width: 600px;
  }
  .thead {
    display: grid;
    grid-template-columns: var(--cols);
  }
`);

comp(function IdentityTest() {
  const ident = useIdentity();
  const msg = ref('hello world');
  const resp = ref();
  async function submit() {
    try {
      const signed = await ident.sign({ text: msg.value });
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
  return { msg, submit, resp };
}).template(
  (el) => html`
    <inc-accounts></inc-accounts>
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
