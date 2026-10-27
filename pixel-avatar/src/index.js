import seedrandom from 'seedrandom';

// cyrb53 (c) 2018 bryc (github.com/bryc). License: Public domain.
// a fast non-cryptographic hash with "decent collision resistance", ty bryc
function hash(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

function hslToRgb(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n, k = (n + h / 30) % 12) =>
    l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  return [f(0), f(8), f(4)].map((x) => Math.round(x * 255));
}

// make an hsl color for some bits in the string's hash
export function stringColor(str, scheme) {
  const num = hash(str);
  const hue = (num & 0xfff) % 360;
  const satMod = ((num << 3) & 0xff) % 20;
  const lightMod = ((num << 5) & 0xff) % 15;
  return [
    [hue, 50 + satMod, (scheme === 'light' ? 30 : 80) + lightMod],
    ['horizontal', 'vertical', 'quad'][num % 3]
  ];
}

function autoPalette([h, s, l]) {
  return [
    [h - 10, s, l],
    [h + 15, s, l],
    [h - 5, s + 20, l + 20],
    [h + 8, s + 20, l - 20]
  ].map(([h, s, l]) => hslToRgb(h, s / 100, l / 100));
}

// below adapted from https://github.com/LIMPIX31/randpix (MIT)
// a very cool library that no longer installs cleanly due to bit rot
// I changed a few parameter defaults to my taste, and this is focused on strong
// theming around a single color derived from a seed string as opposed to the
// original's curated library of color schemes
function reflect(symm, pattern, isOdd) {
  switch (symm) {
    case 'horizontal': {
      if (isOdd) {
        return [...pattern, ...pattern.reverse().slice(1)];
      }
      return [...pattern, ...pattern.reverse()];
    }
    case 'vertical': {
      if (isOdd) {
        return pattern.map((v) => [...v.slice(1).reverse(), ...v]);
      }
      return pattern.map((v) => [...v.slice().reverse(), ...v]);
    }
    case 'quad': {
      return reflect('horizontal', reflect('vertical', pattern, isOdd), isOdd);
    }
  }
}

/*
RandpixOptions {
  size?: number;
  scale?: number;
  color?: Color; // [r: number, g: number, b: number, a?: number]
  colorScheme: ColorScheme; // see https://github.com/LIMPIX31/randpix/blob/master/themes.ts, array of 3-4 Colors
  fillFactor?: number;
  symmetry?: 'horizontal' | 'vertical' | 'quad';
  seed: string;
  colorBias?: number;
  grayscaleBias?: boolean;
};
*/

export default function getAvatar(str, opts = {}) {
  const scheme =
    (opts.scheme ?? matchMedia('(prefers-color-scheme: dark)').matches)
      ? 'dark'
      : 'light';
  const [color, symmetry] = stringColor(str, scheme);
  return {
    imageUrl: randpix({
      colorScheme: autoPalette(color),
      size: 10,
      scale: 10,
      seed: str,
      colorBias: 50,
      symmetry,
      ...opts
    }),
    color
  };
}

export function randpix(options) {
  const rand = seedrandom(options.seed);

  const scaleBias = (bias) => Math.floor(rand() * bias - bias / 2);

  const randomColor = (set) => {
    const weights = set.map((v) => v[3] ?? 0);
    for (let i = 0; i < set.length; i++) {
      weights[i] += weights[i - 1] ?? 0;
    }
    const random = rand() * weights[weights.length - 1];
    for (let i = 0; i < weights.length; i++) {
      if (weights[i] > random) {
        return set[i];
      }
    }
    return set[(rand() * set.length) >> 0];
  };

  const createPattern = (
    w,
    h,
    colorScheme,
    chance,
    color,
    bias = 0,
    grayscaleBias = false
  ) => {
    const pattern = [];
    for (let i = 0; i < h; i++) {
      pattern[i] = [];
      for (let j = 0; j < w; j++) {
        if (rand() < chance) {
          pattern[i][j] = color ?? randomColor(colorScheme);
          if (bias > 0) {
            if (grayscaleBias) {
              const scaledBias = scaleBias(bias);
              pattern[i][j] = pattern[i][j].map((v, i) =>
                i < 3 ? v + scaledBias : v
              );
            } else {
              pattern[i][j] = pattern[i][j].map((v, i) =>
                i < 3 ? v + scaleBias(bias) : v
              );
            }
          }
        } else {
          pattern[i][j] = [-1, -1, -1];
        }
      }
    }
    return pattern;
  };

  const createFinalPattern = (
    w,
    h,
    symm,
    colorScheme,
    chance = 0.5,
    color,
    bias,
    grayscaleBias
  ) => {
    let size = [w, h];
    switch (symm) {
      case 'horizontal':
        size = [size[0], size[1] / 2];
        break;
      case 'vertical':
        size = [size[0] / 2, size[1]];
        break;
      case 'quad':
        size = [size[0] / 2, size[1] / 2];
        break;
    }
    return reflect(
      symm,
      createPattern(
        size[0],
        size[1],
        colorScheme,
        chance,
        color,
        bias,
        grayscaleBias
      ),
      !!size.find((v) => !Number.isInteger(v))
    );
  };

  const size = options?.size ?? 8;
  const scale = options?.scale ?? 1;
  const pattern = createFinalPattern(
    size,
    size,
    options?.symmetry ?? 'vertical',
    options?.colorScheme,
    options?.fillFactor ?? 0.6,
    options?.color,
    options?.colorBias,
    options?.grayscaleBias
  );

  const dim = size * scale;
  const canvas = document.createElement('canvas');
  canvas.width = dim;
  canvas.height = dim;
  const ctx = canvas.getContext('2d', { alpha: true });
  for (let i = 0; i < pattern.length; i++) {
    for (let j = 0; j < pattern[i].length; j++) {
      const color = pattern[i][j];
      if (color.includes(-1)) {
        continue;
      }
      ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
      ctx.fillRect(j * scale, i * scale, scale, scale);
    }
  }
  return canvas.toDataURL();
}
