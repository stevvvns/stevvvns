import { comp, css, html, ref, derive, cx, repeat } from '@stevvvns/incomponent';

comp(function LibTabs(el) {
  const current = ref('');
  const labels = ref([]);
  function change(evt) {
    current.value = evt.target.dataset.tab;
    el.emit('change', { tab: current.value });
  }
  return { current, labels, change };
})
  .init((el) => {
    const labels = [];
    const tabs = [];
    for (const tab of el.shadowRoot.querySelector('slot').assignedElements()) {
      if (tab.tagName !== 'INC-LIB-TAB') {
        console.warn('found non-tab element as direct child of <inc-lib-tabs>', tab);
        continue;
      }
      tabs.push(tab);
      const label = tab.getAttribute('label');
      labels.push(label);
      if (el.current.value === '') {
        el.current.value = label;
      }
    }
    derive(() => {
      for (const tab of tabs) {
        tab.style.display = tab.getAttribute('label') === el.current.value ? 'block' : 'none';
      }
    });
    el.labels.value = labels;
  })
  .template(
    (el) =>
      html`<ol>
          ${repeat(
            el.labels,
            (lbl) => lbl,
            (lbl) =>
              html`<li
                class=${cx({ current: lbl === el.current })}
                @click=${() => (el.current.value = lbl)}
              >
                <a @click=${el.change} data-tab=${lbl}> ${lbl} </a>
              </li>`
          )}
        </ol>
        <slot></slot>`
  )
  .style(css`
    :host {
      --_primary-color: var(--primary-color, #666);
    }
    ol {
      margin: 0;
      margin-bottom: 6px;
      padding: 0;
      list-style: none;
    }
    li {
      display: inline-block;
      margin-right: 1em;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: 120ms ease-in-out;
    }
    li.current {
      font-weight: bold;
      color: var(--_primary-color);
      border-bottom: 2px solid var(--_primary-color);
    }
  `);

comp('LibTab', ['label']).template(html`<slot></slot>`);
