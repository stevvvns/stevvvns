# router

## What?

This is a router for apps that use [@stevvvns/incomponent](../incomponent/README.md) based on [router5](https://github.com/router5/router5).

## Why?

If you don't have complex needs for your router (eg., server-side usage) and you want to use incomponent (lol), this will save you a marginal amount of effort.

## How?

`$ npm i @stevvvns/router`

```javascript
import { setRoutes } from '@stevvvns/router';
import { comp, ref, html } from '@stevvvns/incomponent';

setRoutes(
  // routes defined as in router5 doc, but include template and title (optional) keys
  [
    { name: 'home', path: '/', title: 'Example', template: html`<p>home</p>` },
    { name: 'readme', path: '/readme', title: 'Read me', template: html`<p>readme</p>`, children: [
      { name: 'nested', path: '/nested', title: 'Nested Route', template: html`<p>nested</p>` }
    ]},
    { name: 'about', path: '/about', title: 'About', template: html`<p>about</p>` },
  ],
  // router5 createRouter options + { browser: router5-plugin-browser options }
  { defaultRoute: 'readme', browser: { useHash: true } }
);

// <inc-link also has .replace={bool} and .params={obj}
comp('App').template(html`
  <nav>
    <ul>
      <li><inc-link to="home">home</inc-link></li>
      <li><inc-link to="readme">readme</inc-link></li>
      <li><inc-link to="about">about</inc-link></li>
      <li><inc-link to="readme.nested">nested</inc-link></li>
    </ul>
  </nav>
  <inc-router></inc-router>
`).style(`
  inc-link {
    &::part(current) { font-weight: bold; }
    &::part(link) {
      color: red;
    }
    &::part(link):visited {
      color: blue;
    }
  }
`);

```

In other components, you can:
```javascript
import { route, navigate } from '@stevvvns/router';
import { comp, html, ref, derive } from '@stevvvns/incomponent';

comp(function Foo() {
    const title = ref('');
    // route is a ref, you can do stuff based on the router state if necessary
    derive(() => {
        if (route.value) {
            title.value = route.value.title;
        }
    });
    function go() {
        // you can programmatically navigate. see router5 docs
        navigate('about');
    }
    return { go, title };
}).template((el) => html`<h1>${el.title}</h1><button @click=${el.go}>go</button>`);

```

(See [example.html](./example.html))
