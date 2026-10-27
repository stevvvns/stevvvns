import { comp, html, ref, derive, unsafeHTML } from '@stevvvns/incomponent';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.use({
  pedantic: false,
  gfm: true,
  breaks: true
});

DOMPurify.addHook('afterSanitizeElements', (el) => {
  if (el.nodeName === 'A') {
    el.setAttribute('rel', 'nofollow noopener noreferrer');
  }
});

comp(
  function LibMarkdownRenderer(el) {
    const markdown = ref('');
    const rendered = ref('');
    const postProcess = ref(false);

    const update = () => {
      setTimeout(async () => {
        let parsed = DOMPurify.sanitize(marked.parse(markdown.value));
        if (postProcess.value) {
          parsed = await new Promise((resolve) => {
            el.emit('rendered', { parsed, resolve });
          });
        }
        rendered.value = DOMPurify.sanitize(parsed, {
          ALLOW_UNKNOWN_PROTOCOLS: true
        });
      }, 0);
    };
    derive(update, [markdown, postProcess]);
    return { markdown, rendered, update, postProcess };
  },
  ['markdown', 'postProcess']
)
  .init((el) => {
    el.update();
  })
  .template((el) => html`${unsafeHTML(el.rendered)}`).style(`
:host {
  --_primary-color: var(--primary-color, #666);
}
h1, h2, h3, h4, h5, h6 {
  font-family: sans-serif;
  color: var(--_primary-color);
  margin-bottom: 0;
  padding-bottom: 0;
}
a {
  color: var(--_primary-color);
}
img {
  max-width: 100%;
}
p:first-child {
  margin-top: 0;
}
`);

export async function render(markdown) {
  const parsed = await marked.parse(markdown);
  return DOMPurify.sanitize(parsed);
}
