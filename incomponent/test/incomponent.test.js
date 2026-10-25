import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register();

const { ref, derive, store, comp, html } = await import('../src/index.js');

test('ref: get and set', () => {
  const r = ref(1);
  assert.equal(r.value, 1);
  r.value = 2;
  assert.equal(r.value, 2);
});

test('ref: onChange fires only when the value changes', () => {
  const r = ref(1);
  const seen = [];
  r.onChange((v) => seen.push(v));
  r.value = 2;
  r.value = 2;
  assert.deepEqual(seen, [2]);
});

test('ref: mut deep-clones so the original is untouched', () => {
  const original = { a: { b: 1 } };
  const r = ref(original);
  r.mut((d) => {
    d.a.b = 2;
  });
  assert.equal(r.value.a.b, 2);
  assert.equal(original.a.b, 1);
});

test('ref: mut uses the callback return value when provided', () => {
  const r = ref({ a: 1 });
  r.mut(() => ({ a: 2 }));
  assert.deepEqual(r.value, { a: 2 });
});

test('ref: toString', () => {
  assert.equal(ref('x').toString(), 'Ref: x');
});

test('derive: computes', () => {
  const a = ref(2);
  const double = derive(() => a.value * 2, [a]);
  assert.equal(double.value, 4);
});

test('derive: auto-tracks dependencies', () => {
  const a = ref(1);
  const b = ref(2);
  const sum = derive(() => a.value + b.value);
  assert.equal(sum.value, 3);
  a.value = 10;
  assert.equal(sum.value, 12);
});

test('derive: explicit deps track a dep not read during initial compute', () => {
  const list = ref([]);
  const id = ref('x');
  let runs = 0;
  const found = derive(() => {
    runs++;
    return list.value.find((item) => item.id === id.value);
  }, [list, id]);
  assert.equal(found.value, undefined);
  assert.equal(runs, 1);
  id.value = 'y';
  assert.equal(runs, 2);
});

test('derive: computed of computed updates transitively', () => {
  const a = ref(1);
  const b = derive(() => a.value * 2, [a]);
  const c = derive(() => b.value + 1, [b]);
  assert.equal(c.value, 3);
  a.value = 5;
  assert.equal(c.value, 11);
});

test('derive: nesting throws', () => {
  const a = ref(1);
  assert.throws(() => {
    derive(() => {
      derive(() => a.value, [a]);
    });
  }, /cannot be nested/);
});

test('store: returns a singleton and runs setup once', () => {
  let runs = 0;
  const use = store(() => {
    runs++;
    return { count: ref(0) };
  });
  assert.equal(use(), use());
  assert.equal(runs, 1);
});

test('comp: renders a template into shadow DOM', async () => {
  comp(function Hello() {
    return {};
  }).template(() => html`<p>hello</p>`);

  const el = document.createElement('inc-hello');
  document.body.appendChild(el);

  await new Promise((resolve) => requestAnimationFrame(resolve));

  assert.ok(el.shadowRoot.textContent.includes('hello'));
});
