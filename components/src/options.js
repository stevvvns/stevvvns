import { comp, html, ref, repeat } from '@stevvvns/incomponent';

comp(function LibOptions() {
  return {
    data: ref([]),
    checked: ref()
  };
})
  .template((el) => html`
    ${repeat(el.data, ({ value }) => value, (opt, idx) => html`
      <label>
        <input type="radio" name="options" value=${opt.value} ?checked=${idx === 0} />
        ${opt.label}
      </label>
    `)}
  `)
  .style(`
:host {
  --_primary-color: var(--primary-color, #666);
}
label {
  display: block;
  margin-bottom: 8px;
}
input {
  appearance: none;
  width: 1.15em;
  height: 1.15em;
  border: 0.15em solid var(--_primary-color);
  border-radius: 50%;
  display: inline-grid;
  place-content: center;

  &::before {
    content: "";
    width: 1em;
    height: 1em;
    border-radius: 50%;
    transform: scale(0);
    transition: 300ms transform ease-in-out;
    box-shadow: inset 1em 1em var(--_primary-color);
  }

  &:checked::before {
    transform: scale(1);
  }
}
  `);
