export { html, svg } from 'lit-html';
export { classMap as cx } from 'lit-html/directives/class-map.js';
export { styleMap as sx } from 'lit-html/directives/style-map.js';
export { unsafeHTML } from 'lit-html/directives/unsafe-html.js';
export { unsafeSVG } from 'lit-html/directives/unsafe-svg.js';
export { repeat } from 'lit-html/directives/repeat.js';

export function css(strings: TemplateStringsArray, ...values: any[]): string;

export interface Ref<T> {
  value: T;
  mut(cb: (draft: T) => T | void): void;
  onChange(cb: (value: T) => void): void;
  toString(): string;
}

export function ref<T>(value: T): Ref<T>;

export function derive<T>(
  cb: (cleanup: (fn: () => void) => void) => T,
  deps?: ReadonlyArray<Ref<any>>
): Ref<T>;

export function store<T>(fn: () => T): () => T;

export function initStores(ast?: unknown): void;

export interface CompBuilder {
  template(tpl: (el: any) => unknown): CompBuilder;
  style(css: string): CompBuilder;
  init(cb: (el: any) => void | (() => void)): CompBuilder;
}

export function comp(
  setup: (el: any) => Record<string, any> | void,
  observeAttrs?: string[]
): CompBuilder;
