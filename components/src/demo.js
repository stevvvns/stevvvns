import { comp, ref, html } from '@stevvvns/incomponent';

comp(function ToggleModal() {
  const isOpen = ref(false);
  const action = ref();
  function open() {
    isOpen.value = true;
  }
  function close() {
    isOpen.value = false;
    action.value = 'canceled';
  }
  function submit() {
    isOpen.value = false;
    action.value = 'submitted';
  }
  return { isOpen, action, open, close, submit };
}).template((el) => html`
  ${el.isOpen ? html`<inc-lib-modal heading="Heading" cancel="Cancel" submit="Ok" @close=${el.close} @submit=${el.submit}><p>Modal body content</p></inc-lib-modal>` : html`${el.action ?? ''}`}
  <inc-lib-button @click=${el.open}>Show</inc-lib-button>
`);

function toB64(u8) {
  const bytes = u8 instanceof ArrayBuffer ? new Uint8Array(u8) : u8;
  return btoa(bytes.reduce((data, byte) => data + String.fromCharCode(byte), ''));
}
function toDataUrl(format, data) {
  return `data:${format};base64,${toB64(data)}`;
}

document.addEventListener('DOMContentLoaded', () => {
  const inp = document.querySelector('input[type=color]');
  const setColor = (color) => document.body.style.setProperty('--primary-color', color);
  inp.addEventListener('change', () => {
    setColor(inp.value);
    localStorage.setItem('color', inp.value);
  });
  const color = localStorage.getItem('color');
  if (color) {
    setColor(color);
    inp.value = color;
  }

  const mdRenderer = document.querySelector('inc-lib-markdown-renderer');
  const mdEditor = document.querySelector('inc-lib-markdown-editor');
  mdEditor.addEventListener('change', (evt) => (mdRenderer.markdown.value = evt.detail.value));

  const images = {};
  mdEditor.addEventListener('upload', ({ detail: { hash, type, resolve, data } }) => {
    images[hash] = { type, data };
    resolve(hash);
  });
  mdRenderer.addEventListener('rendered', ({ detail: { parsed, resolve } }) => {
    resolve(
      parsed.replace(/<img (.*?)src="([^"]+)/g, (_, pre, href) => {
        if (images[href]) {
          return `<img ${pre} src="${toDataUrl(images[href].type, images[href].data)}`;
        }
        return `<img ${pre} src="${href}`;
      })
    );
  });

  document
    .querySelector('inc-lib-emoji-picker')
    .addEventListener('select', (evt) => console.log(evt.detail));
});
