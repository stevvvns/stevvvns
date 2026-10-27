import { comp, html, repeat, ref } from '@stevvvns/incomponent';
import tippy, { hideAll } from 'tippy.js';

import { emojis } from '../vendor/emojis.json';

const lookup = [];
const variants = {};
for (const [cat, catEmojies] of Object.entries(emojis)) {
  for (const [subcat, subcatEmojies] of Object.entries(catEmojies)) {
    for (const emoji of subcatEmojies) {
      const [name, variant] = emoji.name.split(':');
      if (variant) {
        if (!variants[name]) {
          variants[name] = [];
        }
        variants[name].push([name, variant, emoji.emoji]);
      } else {
        lookup.push([`${cat} ${subcat} : ${emoji.name}`.toLowerCase(), emoji.emoji]);
      }
    }
  }
}

function getVariantsList(name, select) {
  if (variants[name]) {
    return html`
      <ol class="variants">
        ${repeat(
          variants[name],
          ([_name, _variant, emoji]) => emoji,
          ([name, variant, emoji]) => html`<li @click=${select(emoji, name, variant.trim())}>${emoji}</li>`
        )}
      </ol>
    `;
  }
  return '';
}

function massage(list, search) {
  return list.filter(([descr]) => {
    return !search || descr.includes(search);
  }).sort(([a], [b]) => {
    if (!search) {
      return 0;
    }
    const [_catA, nameA] = a.split(' : ');
    const [_catB, nameB] = b.split(' : ');
    for (const word of nameA.split(' ')) {
      if (word.startsWith(search)) {
        return -1;
      }
    }
    for (const word of nameB.split(' ')) {
      if (word.startsWith(search)) {
        return 1;
      }
    }
    return 0;
  });
}

comp(function LibEmojiPicker() {
  const recent = ref([]);
  return {
    search: ref(''),
    select(emoji, name, variant) {
      return () => {
        if (this.props.saveLast.value > 0) {
          this.recent.mut((draft) => {
            const idx = draft.findIndex((used) => used.name === name);
            if (idx !== -1) {
              draft.splice(idx, 1);
            }
            draft.unshift({ emoji, name, variant });
          });
          localStorage.setItem(
            this.saveKey.value,
            JSON.stringify(this.recent.value.slice(0, this.props.saveLast.value))
          );
        }
        this.emit('select', { emoji, name, variant });
      };
    },
    saveLast: ref(26),
    saveKey: ref('emojis'),
    recent
  };
})
  .init((el) => {
    const cancelOnClickOutside = (evt) => {
      if (!evt.composedPath().includes(el.shadowRoot.querySelector('#prnt'))) {
        el.emit('cancel');
      }
    };
    document.addEventListener('click', cancelOnClickOutside);
    try {
      el.recent.value = JSON.parse(localStorage.getItem(el.saveKey.value));
    } catch {
      // fine
    } finally {
      if (!el.recent.value) {
        el.recent.value = [];
      }
    }
    el.shadowRoot.querySelector('input').focus();
    return () => document.removeEventListener('click', cancelOnClickOutside);
  })
  .template((el) => {
    requestAnimationFrame(() => {
      for (const vars of el.shadowRoot.querySelectorAll('.variants')) {
        const a = vars.parentNode.querySelector('a');
        if (a) {
          tippy(a, {
            content: vars,
            interactive: true,
            delay: [200, 100],
            placement: 'bottom-start',
            offset: [0, 0]
          });
        }
      }
    });
    const recent = el.recent && !el.search.trim() ? html`
      <ol id="recent">
        ${repeat(el.recent.slice(0, el.saveLast), ({ emoji }) => emoji, (emoji) => html`
          <li title=${emoji.name} @click=${el.select(emoji.emoji, emoji.name, emoji.variant)}>${emoji.emoji}</li>
        `)}
      </ol>` : '';
    return html`
      <div id="prnt">
        <input autofocus placeholder="Search" @keyup=${(evt) => el.search.value = evt.target.value.trim().toLowerCase()} />
        ${recent}
        <ol id="outer" @scroll=${() => hideAll({ duration: 0 })}>
          ${repeat(massage(lookup, el.search), ([_, emoji]) => emoji, ([descr, emoji]) => {
            const [_, name] = descr.split(' : ');
            return html`
              <li title=${name}>
                <a @click=${el.select(emoji, name)}>${emoji}</a>
                ${getVariantsList(name, el.select)}
              </li>`;
          })}
        </ol>
      </div>
    `;
  })
  .style(`
#prnt {
  position: relative;
  background: white;
  border-radius: 2px;
  padding: 12px 0 12px 12px;
  border: 1px solid #eee;
  max-width: 400px;
  & > input {
    width: 93%;
    padding: 8px;
    border: 0;
    margin-bottom: 10px;
  }
  &::before {
    pointer-events: none;
    content: '';
    width: 100%;
    height: 160px;
    position: absolute;
    left: 0;
    bottom: 0;
    background: linear-gradient(transparent 120px, white), linear-gradient(white 0px, transparent 20px);
  }
}
ol {
  list-style: none;
  font-size: 24px;
  margin: 0;
}
#outer {
  height: 140px;
  overflow: auto;
  padding: 0;
  padding-top: 5px;
  user-select: none;
}
li {
  display: inline-flex;
  cursor: pointer;
  width: 24px;
  justify-content: center;
}
.variants {
  background: white;
  border-radius: 2px;
  padding: 4px 6px 4px 10px;
  border: 1px solid #ddd;
  & > li {
    margin-right: 4px;
  }
}
#recent {
  padding: 0;
  width: 97%;
  border-bottom: 1px solid #eee;
  padding-bottom: 4px;
  margin-bottom: 8px;
}
input {
  background: #fafafa;
  &:focus {
    outline: 1px solid #eee;
  }
}
@media (prefers-color-scheme: dark) {
  #prnt {
    background: #222;
    border-color: #393939;
    &::before {
      background: linear-gradient(transparent 120px, #222), linear-gradient(#222 0px, transparent 20px);
    }
  }
  #recent {
    border-color: #393939;
  }
  .variants {
    background: #050505;
    border-color: #393939;
  }
  input {
    color: #ddd;
    background: #2a2a2a;
    &:focus {
      outline: 1px solid #555;
    }
  }
}
  `);
