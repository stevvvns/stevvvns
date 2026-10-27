import createRouter from 'router5';
import browserPlugin from 'router5-plugin-browser';
import { comp, ref, derive, html } from '@stevvvns/incomponent';

let router5;
export let navigate;
export const route = ref();
const navRef = ref();

let byName = {};

function mapRoutes(routes, prnts = [], paths = []) {
  for (const route of routes) {
    const prefix = prnts.join('.') + (prnts.length === 0 ? '' : '.');
    const pathPrefix = paths.join('/');
    byName[prefix + route.name] = {
      ...route,
      fullPath: pathPrefix + route.path
    };
    if (route.children) {
      mapRoutes(route.children, [...prnts, route.name], [...paths, route.path]);
    }
  }
}

comp(function Router() {
  const tpl = ref(html``);
  derive(() => {
    if (route.value) {
      tpl.value = route.value.template;
      if (route.value.title) {
        document.title = route.value.title;
      }
    }
  });
  return { tpl };
}).template((el) => el.tpl);

const isHashNav = ref(false);

comp(
  function Link(el) {
    const to = ref();
    const replace = ref(false);
    const params = ref({});
    const isCurrent = derive(() => {
      if (to.value && route.value) {
        return to.value === route.value.name;
      }
    }, [route]);
    const go = derive(() => {
      return (evt) => {
        evt.preventDefault();
        navRef.value(
          to.value,
          params.value,
          { replace: el.replace.value },
          (err) => {
            if (err) {
              console.error(err);
            }
          }
        );
      };
    }, [navRef]);
    const url = derive(() => {
      if (!to.value) {
        return;
      }
      return (isHashNav ? '#' : '') + byName[to.value].fullPath;
    });
    return { to, go, replace, params, url, isCurrent };
  },
  ['to']
).template((el) =>
  el.isCurrent
    ? html`<span part="current"><slot></slot></span>`
    : html`<a part="link" href=${el.url} @click=${el.go}><slot></slot></a>`
);

export function setRoutes(routes, options = {}) {
  byName = {};
  mapRoutes(routes);
  const { browser: browserOpts, routerOpts } = options;
  if (browserOpts?.useHash) {
    isHashNav.value = true;
  }
  router5 = createRouter(routes, routerOpts);
  router5.usePlugin(browserPlugin(browserOpts ?? {}));
  router5.subscribe((state) => {
    if (state.route) {
      route.value = { ...byName[state.route.name], ...state.route };
    } else {
      route.value = null;
    }
  });
  navigate = router5.navigate;
  navRef.value = navigate;
  router5.start();
}
