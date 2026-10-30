import { html, svg, render, nothing } from 'lit-html';
import { classMap } from 'lit-html/directives/class-map.js';
import { styleMap } from 'lit-html/directives/style-map.js';
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';
import { unsafeSVG } from 'lit-html/directives/unsafe-svg.js';
import { repeat } from 'lit-html/directives/repeat.js';

const cx = classMap;
const sx = styleMap;
export { html, svg, cx, sx, unsafeHTML, unsafeSVG, repeat };

// Tagged template that returns the composed string unchanged. The `css` tag
// exists only so tooling (prettier, editors) treats the contents as CSS.
export function css(strings, ...values) {
  return String.raw({ raw: strings.raw }, ...values);
}

let asyncStore;

export function initStores(ast = false) {
  asyncStore = ast;
}

export function store(fn) {
  return function use(...args) {
    if (!asyncStore) {
      if (!fn._globalInst) {
        fn._globalInst = fn(...args);
      }
      return fn._globalInst;
    }
    const st = asyncStore.getStore();
    if (!('_storeCache' in st)) {
      st._storeCache = new Map();
    }
    if (!st._storeCache.has(fn)) {
      st._storeCache.set(fn, fn(...args));
    }

    return st._storeCache.get(fn);
  };
}

class Ref {
  constructor(value) {
    this._value = value;
  }

  static forDerived(cb, deps) {
    if (Ref.spy) {
      throw new Error('derive() cannot be nested inside another derive');
    }
    let id, regCleanup;
    if (Ref.registerCleanups) {
      id = Symbol();
      regCleanup = Ref.registerCleanups;
    }
    const lastClean = ref(() => {});
    function setClean(cb) {
      lastClean.value = cb;
      if (regCleanup) {
        regCleanup(id, cb);
      }
    }
    const depSet = new Set(deps);
    Ref.spy = (r) => depSet.add(r);
    let value;
    try {
      value = cb(setClean);
    } finally {
      Ref.spy = null;
    }

    const rv = ref(value);
    rv.compute = cb;
    for (const dep of depSet) {
      dep.onChange(() => {
        lastClean.value();
        rv.value = cb(setClean);
      });
    }

    return rv;
  }

  static spy = null;
  mutListeners = [];
  compute = null;

  get value() {
    if (Ref.spy) {
      Ref.spy(this);
    }
    return this._value;
  }

  set value(value) {
    if (value === this._value) {
      return;
    }
    this._value = value;
    for (const cb of this.mutListeners) {
      cb(this._value);
    }
  }

  mut(cb) {
    const draft = structuredClone(this.value);
    const result = cb(draft);
    this.value = result === undefined ? draft : result;
  }

  onChange(cb) {
    this.mutListeners.push(cb);
  }

  toString() {
    return `Ref: ${this.value}`;
  }
}

export function ref(value) {
  return new Ref(value);
}

export function derive(cb, deps = []) {
  return Ref.forDerived(cb, deps);
}

const prefix = 'inc';
export function comp(setup, observeAttrs = []) {
  const camelName = typeof setup === 'string' ? setup : setup.name;
  const name = camelName.replace(/([A-Z])/g, '-$1').toLowerCase();
  let template = () => nothing;
  const styleSheet = new CSSStyleSheet();
  let initializer = () => {};
  const dashedAttrs = observeAttrs.map((name) =>
    name.replace(/([A-Z])/g, (ma) => '-' + ma[0].toLowerCase())
  );
  let cleanup = () => {};

  const klass = class extends HTMLElement {
    static observedAttributes = dashedAttrs;
    willRender = null;
    isInitialized = false;

    constructor() {
      super();
      this.deriveCleanups = {};
      this.attachShadow({ mode: 'open' });
      Ref.registerCleanups = (id, cb) => {
        this.deriveCleanups[id] = cb;
      };
      this.props = {
        ...dashedAttrs.reduce((acc, attr) => ({ ...acc, [attr]: this.getAttribute(attr) }), {}),
        ...((typeof setup === 'string' ? () => {} : setup)(this) ?? {})
      };
      Ref.registerCleanups = null;
      const attrs = this.getAttributeNames();
      for (const [prop, val] of Object.entries(this.props)) {
        this._setProp(prop, typeof val === 'function' ? val.bind(this) : val);
        for (const attrName of [
          prop.replace(/[A-Z]/g, (x) => `-${x}`).toLowerCase(),
          prop.toLowerCase()
        ]) {
          if (attrs.includes(attrName)) {
            let attrVal = this.getAttribute(attrName);
            switch (val instanceof Ref ? typeof val.value : typeof val) {
              case 'boolean':
                this._setProp(prop, true);
                break;
              case 'number':
                this._setProp(prop, parseFloat(attrVal));
                break;
              default:
                try {
                  this._setProp(prop, JSON.parse(attrVal));
                } catch {
                  this._setProp(prop, attrVal);
                }
            }
          }
        }
        Object.defineProperty(this, prop, {
          get() {
            const rv = this.props[prop];
            if (this.rendering && rv instanceof Ref) {
              return rv.value;
            }
            return rv;
          },
          set(val) {
            this._setProp(prop, val);
            this.render();
          }
        });
      }
      this.shadowRoot.adoptedStyleSheets = [styleSheet];
    }

    _setProp(prop, val) {
      if (this.props[prop] instanceof Ref && !(val instanceof Ref)) {
        this.props[prop].value = val;
      } else {
        this.props[prop] = val;
      }
      if (val instanceof Ref) {
        val.onChange(() => {
          this.render();
        });
      }
    }

    connectedCallback() {
      this.render();
    }

    attributeChangedCallback(prop, _oldVal, val) {
      for (const name of [prop, prop.replace(/-(.)/g, (ma) => ma[1].toUpperCase())]) {
        if (this.props[name] instanceof Ref) {
          this.props[name].value = val;
        } else {
          this.props[name] = val;
        }
      }
      this.render();
    }

    disconnectedCallback() {
      for (const sym of Object.getOwnPropertySymbols(this.deriveCleanups)) {
        try {
          this.deriveCleanups[sym]();
        } catch (ex) {
          console.error('derive cleanup', ex);
        }
      }
      cleanup();
    }

    render() {
      if (this.willRender !== null) {
        cancelAnimationFrame(this.willRender);
      }
      this.willRender = requestAnimationFrame(() => {
        this.rendering = true;
        render(template(this), this.shadowRoot);
        this.rendering = false;
        if (!this.isInitialized) {
          const rv = initializer(this);
          if (typeof rv === 'function') {
            cleanup = rv;
          }
          this.isInitialized = true;
        }
        this.willRender = null;
      });
    }

    emit(evt, detail = {}) {
      this.dispatchEvent(new CustomEvent(evt, { bubbles: true, composed: true, detail }));
    }
  };
  try {
    customElements.define(prefix + name, klass);
  } catch {
    // ...
  }

  const rv = {
    template(tpl) {
      template = typeof tpl === 'function' ? tpl : () => tpl;
      return rv;
    },
    style(style) {
      styleSheet.replaceSync(style);
      return rv;
    },
    init(cb) {
      initializer = cb;
      return rv;
    }
  };
  return rv;
}
