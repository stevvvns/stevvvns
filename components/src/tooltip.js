import { comp, css, html, ref } from '@stevvvns/incomponent';
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
    const inst = tippy(el.shadowRoot.querySelector('div'), {
      content: el.text.value,
      appendTo: el.shadowRoot,
      placement: el.placement.value
    });
    el.text.onChange((v) => inst.setContent(v));
    el.placement.onChange((v) => inst.setProps({ placement: v }));
  })
  .template(html`<div class="prnt"><slot></slot></div>`)
  .style(css`
    .prnt {
      display: inline-block;
    }
    ${tippyCss}
  `);
