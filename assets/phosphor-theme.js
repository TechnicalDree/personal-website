/**
 * Shared phosphor palettes for CRT UI + pixel city background.
 * Kept in sync with body.theme-* CSS in styles.css.
 */
(function () {
  const DEFAULT_SKY_DECOR = {
    hazeLine: 'rgba(71, 217, 255,',
    hazePillarA: 'rgba(71,217,255,0.08)',
    hazePillarB: 'rgba(255,63,166,0.07)',
    clouds: ['#16496a', '#235d7d', '#123d5e', '#1d5372', '#2a6f92', '#25617f'],
    horizonGlow: {
      top: 'rgba(71, 217, 255, 0)',
      mid: 'rgba(71, 217, 255, 0.42)',
      mag: 'rgba(255, 63, 166, 0.18)',
      bottom: 'rgba(71, 217, 255, 0)',
    },
  };

  const PALETTES = {
    default: {
      col: {
        sky1: [2, 7, 18],
        sky2: [4, 18, 35],
        sky3: [7, 36, 62],
        sky4: [14, 72, 112],
        sky5: [30, 98, 142],
        sky6: [52, 136, 174],
        cyan: '#36f5ff',
        cyanDk: '#178bb8',
        cyanDim: '#0e5f87',
        mag: '#ff2fb3',
        magDk: '#9b1d70',
        pink: '#ff70dc',
        violet: '#9b5cff',
        blue: '#158dff',
        yel: '#f6ff7a',
        amber: '#ffcc4d',
        org: '#ff8e3c',
        red: '#ff2f65',
        wht: '#e8fbff',
        grnLed: '#62ff9b',
        bld1: '#04101f',
        bld2: '#061a2e',
        bld3: '#082744',
        bld4: '#0b3656',
        bld5: '#104a70',
        glassBlue: '#124b76',
        streetDark: '#020a13',
        streetMid: '#061827',
      },
      skyDecor: DEFAULT_SKY_DECOR,
      twilightHorizon: [54, 245, 255],
      neonGL: { a: [0.2, 0.95, 1.0], b: [1.0, 0.15, 0.75] },
      starAlt: '#89c8e8',
      wash: null,
      sidewalk: { base: '#071827', edge: '#123a56', tile: '#174b6c' },
      chroma: [0.2, 0.95, 1.0],
      pulse: '#36f5ff',
    },
    amber: {
      col: {
        sky1: [14, 6, 2],
        sky2: [28, 12, 4],
        sky3: [52, 24, 8],
        sky4: [88, 44, 12],
        sky5: [120, 68, 18],
        sky6: [168, 104, 32],
        cyan: '#ffb84d',
        cyanDk: '#b87820',
        cyanDim: '#8a5818',
        mag: '#ff8844',
        magDk: '#994422',
        pink: '#ffaa66',
        violet: '#cc8844',
        blue: '#e89840',
        yel: '#ffe8a0',
        amber: '#ffcc4d',
        org: '#ff9944',
        red: '#ff5544',
        wht: '#fff0d8',
        grnLed: '#c8a860',
        bld1: '#120804',
        bld2: '#1a1006',
        bld3: '#241808',
        bld4: '#302010',
        bld5: '#3c2818',
        glassBlue: '#4a3018',
        streetDark: '#0a0604',
        streetMid: '#140c06',
      },
      skyDecor: {
        hazeLine: 'rgba(255, 184, 77,',
        hazePillarA: 'rgba(255,184,77,0.09)',
        hazePillarB: 'rgba(255,136,68,0.07)',
        clouds: ['#4a2810', '#5c3418', '#3a200c', '#503018', '#6a4020', '#483018'],
        horizonGlow: {
          top: 'rgba(255, 184, 77, 0)',
          mid: 'rgba(255, 184, 77, 0.38)',
          mag: 'rgba(255, 136, 68, 0.16)',
          bottom: 'rgba(255, 200, 100, 0)',
        },
      },
      twilightHorizon: [255, 184, 77],
      neonGL: { a: [1.0, 0.72, 0.28], b: [1.0, 0.45, 0.15] },
      starAlt: '#e8c890',
      wash: { color: 'rgba(255, 160, 60, 0.35)', alpha: 0.14, blend: 'soft-light' },
      sidewalk: { base: '#1a1008', edge: '#3a2818', tile: '#4a3420' },
      chroma: [1.0, 0.55, 0.15],
      pulse: '#ffb84d',
    },
    green: {
      col: {
        sky1: [2, 10, 6],
        sky2: [4, 20, 12],
        sky3: [6, 36, 22],
        sky4: [10, 58, 36],
        sky5: [16, 82, 50],
        sky6: [24, 110, 68],
        cyan: '#44ff88',
        cyanDk: '#1a9955',
        cyanDim: '#126640',
        mag: '#66ffcc',
        magDk: '#2a9970',
        pink: '#88ffaa',
        violet: '#44cc88',
        blue: '#28cc70',
        yel: '#b8ffcc',
        amber: '#88ff44',
        org: '#66ee88',
        red: '#44ff66',
        wht: '#d8ffe8',
        grnLed: '#62ff9b',
        bld1: '#021408',
        bld2: '#041c10',
        bld3: '#062818',
        bld4: '#083420',
        bld5: '#0c4428',
        glassBlue: '#0c5030',
        streetDark: '#020a06',
        streetMid: '#041810',
      },
      skyDecor: {
        hazeLine: 'rgba(68, 255, 136,',
        hazePillarA: 'rgba(68,255,136,0.08)',
        hazePillarB: 'rgba(102,255,204,0.06)',
        clouds: ['#0c4028', '#145030', '#083820', '#186038', '#1c6840', '#145030'],
        horizonGlow: {
          top: 'rgba(68, 255, 136, 0)',
          mid: 'rgba(68, 255, 136, 0.36)',
          mag: 'rgba(102, 255, 204, 0.14)',
          bottom: 'rgba(68, 255, 136, 0)',
        },
      },
      twilightHorizon: [68, 255, 136],
      neonGL: { a: [0.25, 1.0, 0.55], b: [0.4, 1.0, 0.8] },
      starAlt: '#88d8a8',
      wash: { color: 'rgba(40, 180, 90, 0.25)', alpha: 0.1, blend: 'soft-light' },
      sidewalk: { base: '#061810', edge: '#0c3020', tile: '#145030' },
      chroma: [0.25, 1.0, 0.55],
      pulse: '#44ff88',
    },
    mono: {
      col: {
        sky1: [6, 8, 12],
        sky2: [10, 14, 20],
        sky3: [16, 22, 30],
        sky4: [28, 36, 46],
        sky5: [44, 52, 62],
        sky6: [68, 76, 86],
        cyan: '#c8d0d8',
        cyanDk: '#687078',
        cyanDim: '#505860',
        mag: '#e8ecf0',
        magDk: '#9098a0',
        pink: '#b0b8c0',
        violet: '#989ea8',
        blue: '#889098',
        yel: '#d8dce0',
        amber: '#c0c4c8',
        org: '#a8acb0',
        red: '#b0b4b8',
        wht: '#f0f2f4',
        grnLed: '#a8b0b8',
        bld1: '#080a0e',
        bld2: '#0c1014',
        bld3: '#101418',
        bld4: '#141820',
        bld5: '#181c22',
        glassBlue: '#202428',
        streetDark: '#06080a',
        streetMid: '#0a0c10',
      },
      skyDecor: {
        hazeLine: 'rgba(180, 190, 200,',
        hazePillarA: 'rgba(180,190,200,0.06)',
        hazePillarB: 'rgba(140,150,160,0.05)',
        clouds: ['#283038', '#303840', '#242830', '#343c44', '#383e48', '#2c343c'],
        horizonGlow: {
          top: 'rgba(200, 210, 220, 0)',
          mid: 'rgba(200, 210, 220, 0.28)',
          mag: 'rgba(160, 168, 176, 0.12)',
          bottom: 'rgba(200, 210, 220, 0)',
        },
      },
      twilightHorizon: [200, 210, 220],
      neonGL: { a: [0.75, 0.8, 0.85], b: [0.9, 0.92, 0.95] },
      starAlt: '#a0a8b0',
      wash: { color: 'rgba(120, 128, 140, 0.4)', alpha: 0.22, blend: 'saturation' },
      sidewalk: { base: '#101418', edge: '#283038', tile: '#343c44' },
      chroma: [0.75, 0.8, 0.85],
      pulse: '#c8d0d8',
    },
  };

  const NAMES = ['default', 'amber', 'green', 'mono'];
  const LABELS = { default: 'CYAN', amber: 'AMBER', green: 'MATRIX', mono: 'MONO' };

  /** Window / facade hex not in COL — remapped via semantic key */
  const EXTRA_HEX = {
    '#9bdcf4': 'cyan',
    '#d9f8ff': 'wht',
    '#86d8ff': 'blue',
    '#b96fa6': 'magDk',
    '#5bb9d6': 'cyanDk',
    '#7aa9d8': 'blue',
    '#315f88': 'cyanDim',
    '#b8ecff': 'wht',
    '#1d5b7d': 'cyanDim',
    '#89c8e8': '__starAlt',
    '#020914': 'streetDark',
    '#04101f': 'bld1',
    '#0b5f83': 'cyanDk',
    '#e8fbff': 'wht',
    '#07030f': 'bld1',
    '#1a0a35': 'bld2',
  };

  /** @type {string} */
  let current = 'default';

  function readSaved() {
    try {
      const saved = localStorage.getItem('crtTheme');
      if (saved && PALETTES[saved]) return saved;
    } catch (_) {}
    return 'default';
  }

  current = readSaved();

  function get(name) {
    return PALETTES[name] || PALETTES.default;
  }

  function buildRemap(fromTheme, toTheme) {
    const from = get(fromTheme);
    const to = get(toTheme);
    const map = new Map();
    for (const key of Object.keys(from.col)) {
      const a = from.col[key];
      const b = to.col[key];
      if (typeof a === 'string' && typeof b === 'string') {
        map.set(a.toLowerCase(), b);
      }
    }
    for (const [hex, key] of Object.entries(EXTRA_HEX)) {
      if (key === '__starAlt') map.set(hex.toLowerCase(), to.starAlt);
      else if (to.col[key]) map.set(hex.toLowerCase(), to.col[key]);
    }
    return map;
  }

  function remapHex(hex, map) {
    if (!hex || typeof hex !== 'string') return hex;
    return map.get(hex.toLowerCase()) || hex;
  }

  function getWindowPalettes(col) {
    return [
      [col.yel, col.cyan, col.wht],
      [col.cyan, col.blue, col.wht],
      [col.pink, col.mag, col.magDk],
      [col.grnLed, col.cyan, col.cyanDk],
      [col.blue, col.cyanDim, col.wht],
    ];
  }

  function apply(name) {
    const prev = current;
    current = PALETTES[name] ? name : 'default';
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('phosphor-theme', {
        detail: { theme: current, previous: prev },
      }));
    }
    return current;
  }

  window.PhosphorTheme = {
    NAMES,
    LABELS,
    PALETTES,
    get,
    apply,
    readSaved,
    buildRemap,
    remapHex,
    getWindowPalettes,
    get current() { return current; },
  };
})();
