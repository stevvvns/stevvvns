import { comp, html } from '@stevvvns/incomponent';

comp('LibTextInput', ['value', 'placeholder', 'autofocus'])
  .init((el) => {
    if (el.autofocus !== null && el.autofocus !== false) {
      el.shadowRoot.querySelector('input').focus();
    }
  })
  .template((el) => html`<input value=${el.value} placeholder=${el.placeholder} />`)
  .style(`
input {
  width: 100%;
  border-radius: 2px;
  border: 1px solid var(--primary-color);
  outline: 1px solid var(--primary-color);
  padding: 5px 10px;
}
`);
