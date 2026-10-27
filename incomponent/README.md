# incomponent

## What?
This is a minimal component library that rips off most of Vue's composition API, and uses `lit-html` for rendering.

You get a setup function that gets called _once_ per component instance, so you don't have to worry about crap like the Rules of Hooks or memoizing everything.

You set up `ref`s to state, `derive` effects and calculated dependent `refs` from them, and then get reactive rendering by means of plain old functions. Without the use of proxies making `console.log` debugging horrible!

In return, you get native web components that can be dropped into any other framework or vanilla JS page.

## Why?
IDK. I like the name of the library. You have to pronounce it with the same stress and rhythm as "incompetent". You should use Vue instead if that's somehow not a compelling enough reason.

I was writing a little game in vanilla JS, and after getting tired of ersatz rendering functions I cobbled together only the things I liked from Vue to make `lit-html` work reactively. Maybe the set of things I like aligns with your taste?

## How?
`$ npm i @stevvvns/incomponent`

### Build configuration 
Since function name become component names, you need to preserve them.

In esbuild this is `keepNames: true` (`--keep-names` CLI), vite `esbuild.keepNames: true`, webpack `optimization.minimizer: [new TerserPlugin({ keep_fnames: true })]`

### Example

This is what using the library generally looks like. API details below.

```javascript
import { comp, html, ref, derive } from '@stevvvns/incomponent';

export const scoreStore = (() => {
  const score = ref(0);
  const doubled = derive(() => score.value * 2);
  const increment = amount => score.value += amount;
  return { score, doubled, increment };
})();

// <inc-score>
comp(function Score() {
  const { score, doubled, increment } = scoreStore;
  const byAmount = ref(1);
  function add() {
	  byAmount.value += 1;
	  increment(byAmount.value);
  }
  return { score, doubled, add };
})
.template(el => html`
  <p>Score: <strong>${el.score}</strong> [${el.doubled}]</p>
  <p><button @click=${el.add}>More</button></p>
`);

document.addEventListener('DOMContentLoaded', () => {
  // yay native components, they're just HTML tags you can drop in anywhere
  document.body.innerHTML = '<inc-score></inc-score>';
});
```
This does about what you'd expect, giving you a button you can click to see two numbers go up. [`example.html`](./example.html) has a much more involved version of the same concept demonstrating more of the API.

### Concepts

#### `ref(value)`
* Creates a reference with a `.value` property initialized with the argument.
* Changing `.value` causes reactive updates in templates and derives that use the ref. (More on those below)
* Also provides `.mut(draft => { /* modify draft, or return a new version */ })` which sets the value to a new immutable version.
	* This useful if your value is an array or an object, and you want to modify it internally:
		```javascript
		const list = ref([]);
		derive(() => console.log(list.value.length));
		list.value.push(1); // same array! won't retrigger
		list.mut(draft => { draft.push(1) }); // new array, retriggers
		list.value = [...list.value, 1]; // also a new array, also retriggers
		```
	* Also prefer `mut()` when making more than one update to the same `ref`, like removing an array item and replacing it at a different index. `mut()` batches updates to the draft and avoids excessive retriggering.

#### `derive(callback(cleanup: (fn) => void), deps = [])`
 * Can derive a value by returning: `const double = derive(() => points.value * 2)`
 * Can derive an effect by not returning: `derive(() => console.log(points.value))`
 * Can do both at the same time if you're feeling spicy
 * If you return a value, it is a `ref`, and hence can be used in further derives
 * The callback is invoked once immediately, and then again any time the `ref`s it depends on change.
	 * Any `ref`s that you read the `.value` of the first time the callback is invoked are tracked as dependencies automatically
	 * If there are additional `ref`s you evaluate only conditionally, you can include them in the optional second argument to track them as well.
 * If you call the cleanup parameter with a callback, it will be invoked before the derive is recalculated and after the component is unmounted.
 * **Derives cannot be `async`**, but you can resolve async functions inside and set refs from the result.
 * **Derives cannot be nested** — creating a derive inside another derive's callback throws. To depend on another derive, just read its `.value`.

#### `comp(function SetupFunction() {})`
 * This is how you make a web component.
 * Component names are `<inc-${dashCased(setupFunction.name)}`, so your function can't be anonymous, an arrow, or mangled/removed by your build system.
 * The function provided here is called once during the instantiation of each instance of your component.
	 * Your general goal here is to set up (hence "setup function") and return the mechanics of your component:
		 * `ref`s for state and props
            * Triggers re-renders when the template references them or any derivation of them.
		 * `derive`s for calculations that would be awkward in the template
		 * Regular old `function`s for state mutations
            * Functions are bound so that `this` is the component instance
 * **Setup functions cannot be async**
 * The return value of `comp`, which we'll call `builder`, is a collection of functions that can be called in any order (or not at all) to set the behavior of your component based on the setup:

#### ``builder.template(el => html`..`)``
 * HTML or SVG representation of your component's state
 * `el` is your web component instance, which has all the stuff you would expect on a native web component. Plus, anything you return from your setup function is bound as a property.
	 * **`refs` are auto-unwrapped during evaluation of the template**. For example:
```javascript
	// auto-unwrapped
	html`<p>hello, ${el.name}</p>`
	// this will be evaluated later, still need to use .value
	html`<button @click=${() => console.log(el.name.value)}></button>`
```
 * A few of `lit-html`'s [directives](https://lit.dev/docs/templates/directives/) are re-exported by incomponent:
	 * `cx`, `sx` aliases for `classMap` and `styleMap` respectively, ergonomic helpers for setting `class` and `style` attributes using objects rather than interpolating strings.
	 * `unsafeHTML`, `unsafeSVG` for when/if you need raw access to write HTML, for example when rendering markdown like this.
	 * `repeat(items, keyFn, subtemplate)` an important utility to render dynamic lists into `<li>` or similar.
		 * `keyFn` returns a unique id for each item that `lit-html` can use to track the item during updates instead of using its index in the list, which may be volatile and result in mixed up renders.
	 * You can add other directives by including `lit-html` as your own direct dependency

#### ``builder.style(`...`)``
 * Scoped styles contained to the element's shadow DOM

#### `builder.init(callback)`
 * This is called just after the template is first rendered into the DOM, so you can use it do things like DOM measurements, attaching observers, etc.
 * If you return a function from the callback, it will be registered as a cleanup function and called when the component is going to leave the DOM (e.g., to disconnect and dispose those observers)

### Events
It's worth taking a look at [the docs for writing lit-html templates](https://lit.dev/docs/v1/lit-html/writing-templates/) if you're not familiar with it.

Subscribing to events is covered by `lit-html`'s `@` sigil: ``html`<a @click=${el.doSomething}>click me</a>``

To emit your own events, call `.emit(eventName, detail)` on the component instance, where `detail` is an arbitrary structure. Recall that in addition to the builder callbacks being passed the component instance as an argument, `this` is the component instance in functions returned from your setup function.

### Resources

 * There is a configuration of [router5](https://github.com/router5/router5) you can use for routing, [@stevvvns/inc-router](https://github.com/stevvvns/inc-router).
 * There are a handful of generic components made with incomponent, [@stevvvns/components](../components/README.md). Thanks to the magic of native components you don't have to know shit about this library to use these, but there are some more usage examples to be found here if you're interested.
