import { comp, html } from '@stevvvns/incomponent';
import './button.js';

comp(function LibModal() {
}, ['cancel', 'submit', 'heading', 'disabled']).template((el) => {
  return html`
    <div id="overlay" @click=${() => el.emit('close')}>
      <div id="content" @click=${(evt) => evt.stopPropagation()}>
        <div id="header">
          <span id="heading">${el.heading}</span>
          <a @click=${() => el.emit('close')}>x</a>
        </div>
        <slot></slot>
        <div id="buttons">
          ${el.cancel && html`<inc-lib-button @click=${() => el.emit('close')}>${el.cancel}</inc-lib-button>`}
          ${el.submit && html`<inc-lib-button type="primary" @click=${() => el.emit('submit')} .disabled=${el.disabled}>${el.submit}</inc-lib-button>`}
        </div>
      </div>
    </div>
  `;
}).style(`
#overlay {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: grayscale(100%) blur(6px);
  z-index: 9;
  display: grid;
  grid-template-columns: 1fr calc(min(90vw, 800px)) 1fr;
}
#content {
  z-index: 10;
  background: #fff;
  border-radius: 2px;
  padding: 20px;
  padding-bottom: 40px;
  grid-column: 2;
  margin: 10vh 0;
  height: fit-content;
  position: relative;
}
#buttons {
  position: absolute;
  right: 10px;
}
#header {
  margin-bottom: 20px;
}
#header a {
  cursor: pointer;
  font-family: monospace;
  font-weight: bold;
  color: #ddd;
  position: absolute;
  top: 4px;
  right: 10px;
  font-size: 20px;
}
#header a:hover {
  color: #999;
}
#heading {
  font-weight: bold;
  font-family: sans-serif;
}
@media (prefers-color-scheme: dark) {
  #content {
    background: #000;
  }
}
`);
