import { comp, css, html } from '@stevvvns/incomponent';

comp(
  function LibIconButton() {
    return { disabled: false };
  },
  ['disabled']
)
  .template((el) => html`<button ?disabled=${el.disabled}><slot></slot></button>`)
  .style(css`
    button {
      border: 1px solid #555;
      border-radius: 2px;
      color: #555;
      background: white;
      padding: 2px 6px 0px 6px;
    }
    button:hover {
      cursor: pointer;
      filter: brightness(110%) drop-shadow(0 0 2px rgba(0, 0, 0, 0.2));
    }
    button:active {
      filter: brightness(90%) !important;
    }
    @media (prefers-color-scheme: dark) {
      button {
        color: #aaa;
        background: #222;
      }
    }
  `);

comp(
  function LibButton() {
    return { disabled: false };
  },
  ['type', 'disabled']
)
  .template(
    (el) =>
      html`<button
        class=${el.type === 'primary' ? 'primary' : 'secondary'}
        ?disabled=${el.disabled}
      >
        <span><slot></slot></span>
      </button>`
  )
  .style(css`
    :host {
      --_primary-color: var(--primary-color, #666);
    }
    button {
      border: 1px solid var(--_primary-color);
      border-radius: 2px;
      color: var(--_primary-color);
      background: white;
      padding: 6px 12px;
      transition: filter 100ms ease;
      font-weight: bold;
    }
    button span {
      filter: saturate(80%);
    }
    button:hover {
      cursor: pointer;
      filter: brightness(110%) drop-shadow(0 0 2px rgba(0, 0, 0, 0.2));
    }
    button.primary {
      background: var(--_primary-color);
      color: #f3f3f3;
    }
    button:active {
      filter: brightness(90%) !important;
    }
    button[disabled] {
      cursor: not-allowed;
      border-color: #aaa;
      color: #aaa;
    }
    button.primary[disabled] {
      background: #aaa;
      color: #f3f3f3;
    }
    button[disabled]:hover {
      background: white;
      filter: none;
    }
    button.primary[disabled]:hover {
      background: #aaa;
      filter: none;
    }
    svg {
      height: 14px;
    }
    @media (prefers-color-scheme: dark) {
      button {
        background: transparent;
      }
      button:hover {
        filter: brightness(110%) drop-shadow(0 0 2px rgba(255, 255, 255, 0.3));
      }
      button[disabled] {
        border-color: #555;
        color: #555;
      }
      button[disabled]:hover {
        background: transparent;
        filter: none;
      }
      button[disabled].primary,
      button[disabled].primary:hover {
        background: #222;
        border-color: #222;
        color: #aaa;
      }
    }
  `);
