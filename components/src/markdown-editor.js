import { comp, html, ref, unsafeSVG } from '@stevvvns/incomponent';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import {
  syntaxHighlighting,
  defaultHighlightStyle
} from '@codemirror/language';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';

import './tooltip.js';
import './button.js';
import './emoji-picker.js';

import imageIcon from './icons/image.svg';
import emojiIcon from './icons/emoji.svg';

async function sha256(data) {
  const hashed = await crypto.subtle.digest('SHA-256', data);
  return toB64(hashed);
}

function toB64(u8) {
  const bytes = u8 instanceof ArrayBuffer ? new Uint8Array(u8) : u8;
  return btoa(
    bytes.reduce((data, byte) => data + String.fromCharCode(byte), '')
  );
}

function toDataUrl(format, data) {
  return `data:${format};base64,${toB64(data)}`;
}

function assertImageRenders(format, data) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject('invalid format');
    img.onload = resolve;
    img.src = toDataUrl(format, data);
  });
}

comp(
  function LibMarkdownEditor() {
    const editor = ref();
    const text = ref('');
    const transferErrors = ref([]);
    const showEmojiPicker = ref(false);

    function insertEmoji({ detail: { emoji } }) {
      const cm = editor.value;
      cm.dispatch(cm.state.replaceSelection(emoji));
      showEmojiPicker.value = false;
      cm.focus();
    }
    return {
      editor,
      text,
      placeholder: 'Markdown',
      initialValue: '',
      transferErrors,
      showEmojiPicker,
      insertEmoji
    };
  },
  ['placeholder', 'initialValue']
)
  .init((el) => {
    const isTransferring = ref(false);
    el.text.value = el.initialValue;

    function processFiles(files, cm) {
      el.transferErrors.value = [];
      isTransferring.value = true;
      for (const file of [...files]) {
        if (!/^image[/]/.test(file.type)) {
          continue;
        }
        const pushError = (msg) => {
          el.transferErrors.mut((draft) => {
            draft.push(`${file.name}: ${msg}`);
          });
          isTransferring.value = false;
        };
        const reader = new FileReader();
        reader.onerror = () => pushError('Failed to read');
        reader.onload = async () => {
          if (reader.result) {
            try {
              await assertImageRenders(file.type, reader.result);
              const hash = await sha256(reader.result);
              const loc = await new Promise((resolve, reject) => {
                el.emit('upload', {
                  data: new Uint8Array(reader.result),
                  type: file.type,
                  name: file.name,
                  hash,
                  resolve,
                  reject
                });
              });
              isTransferring.value = false;
              cm.dispatch(
                cm.state.replaceSelection(
                  `![Alt text](${loc} "${file.name.replace(/[""()]/g, '')}")\n`
                )
              );
            } catch (ex) {
              console.error(ex);
              pushError(ex instanceof Error ? ex.message : ex.toString());
            }
          } else {
            pushError('Failed to read');
          }
        };
        reader.readAsArrayBuffer(file);
      }
    }
    const prnt = el.shadowRoot.querySelector('#prnt');
    const editor = new EditorView({
      doc: el.text.value,
      extensions: [
        placeholder(el.placeholder),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        markdown({
          base: markdownLanguage
        }),
        EditorView.updateListener.of((upd) => {
          if (upd.docChanged) {
            el.text.value = editor.state.doc.toString();
            el.emit('change', { value: el.text.value });
          }
        }),
        EditorState.transactionFilter.of((tr) => {
          if (isTransferring.value) {
            return [];
          }
          return [tr];
        }),
        EditorView.domEventHandlers({
          paste(evt, cm) {
            if (
              evt.clipboardData instanceof DataTransfer &&
              evt.clipboardData.files.length > 0
            ) {
              evt.preventDefault();
              processFiles(evt.clipboardData.files, cm);
            }
          }
        })
      ],
      parent: prnt
    });
    el.editor.value = editor;
    prnt.addEventListener('drop', (evt) => {
      if (evt.dataTransfer?.files.length > 0) {
        evt.preventDefault();
        processFiles(evt.dataTransfer.files, editor);
      }
    });
    prnt.querySelector('#upload-image').addEventListener('change', (evt) => {
      if (evt.target.files.length > 0) {
        processFiles(evt.target.files, editor);
      }
    });
    prnt.querySelector('.image-button').addEventListener('click', () => {
      prnt.querySelector('#upload-image').click();
    });
  })
  .template(
    (el) =>
      html`
        <div id="prnt">
          <div id="add-special">
            <label for="upload-image">
              <input id="upload-image" type="file" accept="image/*" multiple />
              <inc-lib-tooltip placement="bottom" text="Insert images">
                <inc-lib-icon-button class="image-button">${unsafeSVG(imageIcon)}</inc-lib-icon-button>
              </inc-lib-tooltip>
            </label>
            <inc-lib-tooltip placement="bottom" text="Insert emoji">
              <inc-lib-icon-button class="emoji-button" @click=${() => {
                el.showEmojiPicker.value = true;
              }}>${unsafeSVG(emojiIcon)}</inc-lib-icon-button>
            </inc-lib-tooltip>
            ${el.showEmojiPicker ? html`<inc-lib-emoji-picker @select=${el.insertEmoji} @cancel=${() => el.showEmojiPicker.value = false}></inc-lib-emoji-picker>` : ''}
          </div>
        </div>
        ${el.transferErrors.length > 0
          ? html`<ul class="errors">
              ${el.transferErrors.map((err) => html`<li>${err}</li>`)}
            </ul>`
          : ''}`
  ).style(`
:host {
  --_primary-color: var(--primary-color, #666);
}
.upload-icon {
  width: 15px;
}
.errors {
  color: #900;
  list-style: none;
  border-left: 8px solid #900;
  padding-left: 10px;
  width: 70ch;
  font-size: small;
}
#prnt {
   position: relative;
   width: 75ch;
}
#add-special {
  position: absolute;
  right: 6px;
  bottom: 6px;
  z-index: 2;
  & > inc-lib-emoji-picker {
    position: absolute;
    top: 40px;
    left: -320px;
  }
}
#upload-image {
  display: none;
}
.image-button, .emoji-button {
  opacity: 0;
  transition: opacity 300ms ease;
}
#prnt:hover .image-button, #prnt:hover .emoji-button {
  opacity: 0.9;
}
.image-button svg {
  width: 16px;
}
.cm-editor {
  padding: 6px;
  background: white;
  border: 1px solid #eee;
  border-radius: 2px;
  max-width: 80ch;
  min-height: 12ex;
}
.cm-scroller {
  padding-bottom: 16px;
}
.ͼ1 .cm-scroller {
  font-family: serif;
}
.ͼb, .ͼ6 {
  color: var(--_primary-color);
}
@media (prefers-color-scheme: dark) {
  .cm-editor {
    background: #222;
    border-color: #393939;
    color: #fafafa;
  }
  .ͼ2 .cm-content {
    caret-color: #777;
  }
  .errors {
    color: #e99;
    border-color: #b00;
  }
  .ͼ4 {
    color: #777;
  }
}
`);
