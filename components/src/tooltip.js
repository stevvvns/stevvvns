import { comp, html, ref } from '@stevvvns/incomponent';
import tippy from 'tippy.js';
import tippyCss from 'tippy.js/dist/tippy.css';

comp(
  function LibTooltip() {
    const text = ref('');
    const placement = ref('auto');
    return { text, placement };
  },
  ['text', 'placement']
)
  .init((el) => {
    tippy(el.shadowRoot.querySelector('div'), {
      content: el.text.value,
      appendTo: el.shadowRoot,
      placement: el.placement.value
    });
  })
  .template(html`<div class="prnt"><slot></slot></div>`).style(`
.prnt {
  display: inline-block;
}
${tippyCss}`);
