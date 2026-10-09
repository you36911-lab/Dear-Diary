/* Dear Diary — constants, presets, shapes */
const APP_NAME = 'Dear Diary';
const PW = 560, PH = 834;          // logical page size (matches cover texture ratio)
const BOARD = 14;                  // cover board margin around the pages

const TEXTURE_FILES = ('gingham-black gingham-green gingham-pink gingham-red glossy-babyblue glossy-babypink glossy-black glossy-coffee glossy-cyan glossy-darkbrown glossy-gray glossy-green glossy-hotpink glossy-lavender glossy-navy glossy-neongreen glossy-offwhite glossy-red glossy-winered glossy-yellow glossy-strawberry glossy-strawberrymilk glossy-pastelgreen fur-strawberry fur-matchagreen hardcover-babyblue hardcover-babypink hardcover-beige hardcover-black hardcover-cyan hardcover-darkbrown hardcover-gray hardcover-green hardcover-hotpink hardcover-lavender hardcover-navy hardcover-neongreen hardcover-offwhite hardcover-red hardcover-winered hardcover-yellow plushie-babyblue plushie-babypink plushie-black plushie-coffee plushie-cyan plushie-darkbrown plushie-gray plushie-green plushie-hotpink plushie-lavender plushie-navy plushie-neongreen plushie-offwhite plushie-red plushie-winered plushie-yellow plushie-strawberry plushie-matchagreen plushie-pastelgreen').split(' ');
const MATERIALS = [
  { id: 'plushie', name: 'Plushie' },
  { id: 'fur', name: 'Fur' },
  { id: 'glossy', name: 'Glossy' },
  { id: 'hardcover', name: 'Hardcover' },
  { id: 'gingham', name: 'Gingham' },
];
const RIBBONS = 'babypink hotpink red winered orange yellow offwhite matchagreen emeraldgreen babyblue cyan navy lavender purple gray darkbrown black'.split(' ');
const ribbonUrl = n => `ribbons/${RIBBONS.includes(n) ? n : 'babypink'}.webp`;
const texUrl = n => `textures/${n}.webp`;
const texThumb = n => `textures/thumbs/${n}.webp`;
const prettyColor = s => s.replace('babyblue','baby blue').replace('babypink','baby pink').replace('darkbrown','dark brown').replace('hotpink','hot pink').replace('neongreen','neon green').replace('offwhite','off-white').replace('winered','wine red');

const PAPER_COLORS = [
  ['White', '#FFFFFF'], ['Ivory', '#FBF7EE'], ['Butter', '#FBF2D2'], ['Blush', '#FBE8EC'],
  ['Lilac', '#EEEAF7'], ['Sky', '#E6EFF8'], ['Mint', '#E6F3EA'], ['Fog', '#EFEFED'],
  ['Kraft', '#D9C3A0'], ['Night', '#25232B'],
];
const PAPER_TYPES = [
  ['blank', 'Blank'], ['grid', 'Grid'], ['dot', 'Dots'], ['lined', 'Lined'],
];
const INK_COLORS = [
  ['Ink', '#1F1D24'], ['Charcoal', '#3A3A3D'], ['Sepia', '#4A3326'], ['Navy', '#1C2A4D'],
  ['Forest', '#1E3A2C'], ['Plum', '#3E2342'], ['Wine', '#5B1C2C'], ['Slate', '#2D3F49'],
];
const BRIGHT_COLORS = ['#E2456F', '#F08A4B', '#E9B949', '#5DAA68', '#3E8ED0', '#7C5CD6', '#FFFFFF'];
const NOTE_COLORS = ['#FFF3A6', '#FFD3DE', '#CDEBFF', '#D7F5D0', '#E6DCFF', '#FFE1BF', '#FFFFFF', '#F3EAD8'];

const FONT_GROUPS = [
  { name: 'Handwriting', fonts: ['Caveat', 'Patrick Hand', 'Indie Flower', 'Shadows Into Light', 'Homemade Apple', 'Reenie Beanie', 'Gochi Hand', 'Kalam'] },
  { name: 'Korean', fonts: ['Gaegu', 'Nanum Pen Script', 'Gamja Flower', 'Hi Melody', 'Jua', 'Gowun Dodum', 'Gowun Batang', 'Noto Sans KR'] },
  { name: 'Serif', fonts: ['Lora', 'Playfair Display', 'Cormorant Garamond', 'DM Serif Display', 'Young Serif'] },
  { name: 'Sans', fonts: ['Plus Jakarta Sans', 'Fredoka', 'Figtree', 'Quicksand', 'Nunito', 'Poppins', 'Space Grotesk'] },
  { name: 'Display', fonts: ['Bagel Fat One', 'Spicy Rice', 'Chango', 'Titan One', 'Lilita One', 'Rubik Bubbles', 'Modak', 'Shrikhand', 'Gloock', 'Instrument Serif', 'Unbounded', 'Swanky and Moo Moo', 'Hachi Maru Pop', 'Mochiy Pop One', 'DynaPuff', 'Chewy', 'Coiny', 'Darumadrop One', 'Sniglet', 'Pacifico', 'Dancing Script', 'Amatic SC', 'Monoton'] },
  { name: 'Typewriter', fonts: ['Special Elite', 'Courier Prime', 'Cutive Mono'] },
];
const GOOGLE_FONTS = new Set(FONT_GROUPS.flatMap(g => g.fonts));

const MOODS = [['😊','Happy'],['🥰','Loved'],['😌','Calm'],['🤩','Excited'],['😴','Tired'],['😢','Sad'],['😤','Annoyed'],['🤒','Unwell']];
const WEATHERS = [['☀️','Sunny'],['⛅','Partly cloudy'],['☁️','Cloudy'],['🌧️','Rainy'],['⛈️','Stormy'],['❄️','Snowy'],['🌫️','Foggy'],['🌬️','Windy']];

const DESKS = [
  { id: 'dream',  name: 'Dream',  css: 'linear-gradient(160deg, #FFE9F1 0%, #F7E6F8 55%, #E8EEFC 100%)' },
  { id: 'bubble', name: 'Bubblegum', css: 'radial-gradient(ellipse at 50% 35%, #FFD9E8, #F7B9D1)' },
  { id: 'felt',   name: 'Felt',   css: 'radial-gradient(ellipse at 50% 40%, #CBD1D9 0%, #AEB6C1 100%)' },
  { id: 'walnut', name: 'Walnut', css: 'repeating-linear-gradient(92deg, rgba(0,0,0,.05) 0 2px, transparent 2px 11px), repeating-linear-gradient(88deg, rgba(255,255,255,.04) 0 1px, transparent 1px 23px), linear-gradient(180deg, #6B4A35, #4E3426)' },
  { id: 'linen',  name: 'Linen',  css: 'repeating-linear-gradient(0deg, rgba(120,100,80,.06) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(120,100,80,.06) 0 1px, transparent 1px 3px), #E7DFD3' },
  { id: 'blush',  name: 'Blush',  css: 'radial-gradient(ellipse at 50% 30%, #F6E1E4, #E7C7CD)' },
  { id: 'sage',   name: 'Sage',   css: 'radial-gradient(ellipse at 50% 30%, #D9E2D4, #B9C7B3)' },
  { id: 'night',  name: 'Night',  css: 'radial-gradient(ellipse at 50% 30%, #3A3746, #1E1C25)' },
];

const WASHI_PRESETS = [
  { kind: 'solid',   c1: '#F7B6C8', c2: '#ffffff', name: 'Petal' },
  { kind: 'stripes', c1: '#CFEBDD', c2: '#9ED3BA', name: 'Mint stripe' },
  { kind: 'dots',    c1: '#E3DAF7', c2: '#FFFFFF', name: 'Lilac dot' },
  { kind: 'gingham', c1: '#FFF6D6', c2: '#F2C94C', name: 'Butter check' },
  { kind: 'grid',    c1: '#DDEBFA', c2: '#7FA9D8', name: 'Sky grid' },
  { kind: 'solid',   c1: '#CDB38E', c2: '#ffffff', name: 'Kraft' },
  { kind: 'gingham', c1: '#FFFFFF', c2: '#E2456F', name: 'Picnic' },
  { kind: 'dots',    c1: '#24305E', c2: '#F6E7B4', name: 'Night dot' },
  { kind: 'stripes', c1: '#FFFFFF', c2: '#2B2A30', name: 'Mono stripe' },
  { kind: 'hearts',  c1: '#FFE3EA', c2: '#E2456F', name: 'Hearts' },
  { kind: 'stars',   c1: '#2C3E73', c2: '#F2D16B', name: 'Starry' },
  { kind: 'solid',   c1: '#B9E3E9', c2: '#ffffff', name: 'Aqua' },
];

/* ---------- Shapes (100x100 viewBox, used as stretchable SVG masks) ---------- */
function starPts(n, outer, inner) {
  const p = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? inner : outer, a = Math.PI / n * i - Math.PI / 2;
    p.push((50 + r * Math.cos(a)).toFixed(2) + ',' + (50 + r * Math.sin(a) + (n === 5 ? 3 : 0)).toFixed(2));
  }
  return p.join(' ');
}
function moonPath() {
  // outer circle C1 (50,50,r46) minus C2 (68,36,r40)
  const [x1, y1, r1, x2, y2, r2] = [50, 50, 46, 68, 36, 40];
  const d = Math.hypot(x2 - x1, y2 - y1), a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(r1 * r1 - a * a);
  const xm = x1 + a * (x2 - x1) / d, ym = y1 + a * (y2 - y1) / d;
  const px = -(y2 - y1) * h / d, py = (x2 - x1) * h / d;
  const A = [xm + px, ym + py], B = [xm - px, ym - py];
  return `M${A[0].toFixed(2)} ${A[1].toFixed(2)} A${r1} ${r1} 0 1 1 ${B[0].toFixed(2)} ${B[1].toFixed(2)} A${r2} ${r2} 0 0 0 ${A[0].toFixed(2)} ${A[1].toFixed(2)}Z`;
}
const SHAPES = {
  none:    { name: 'None' },
  rounded: { name: 'Rounded', svg: '<rect x="0" y="0" width="100" height="100" rx="12"/>' },
  circle:  { name: 'Circle', square: true, svg: '<ellipse cx="50" cy="50" rx="50" ry="50"/>' },
  ellipse: { name: 'Oval', svg: '<ellipse cx="50" cy="50" rx="50" ry="50"/>' },
  heart:   { name: 'Heart', svg: '<path d="M50 95C20 73 0 55 0 31 0 13 13 3 27 3 38 3 45 9 50 18 55 9 62 3 73 3 87 3 100 13 100 31 100 55 80 73 50 95Z"/>' },
  star:    { name: 'Star', svg: `<polygon points="${starPts(5, 52, 22)}"/>` },
  sparkle: { name: 'Sparkle', svg: '<path d="M50 0C54 36 64 46 100 50 64 54 54 64 50 100 46 64 36 54 0 50 36 46 46 36 50 0Z"/>' },
  moon:    { name: 'Crescent', svg: `<path d="${moonPath()}"/>` },
  flower:  { name: 'Flower', svg: [0,1,2,3,4,5].map(i => { const a = i * Math.PI / 3; return `<circle cx="${(50 + 28 * Math.cos(a)).toFixed(1)}" cy="${(50 + 28 * Math.sin(a)).toFixed(1)}" r="22"/>`; }).join('') + '<circle cx="50" cy="50" r="26"/>' },
  clover:  { name: 'Clover', svg: [[50,27],[73,50],[50,73],[27,50]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="23"/>`).join('') + '<circle cx="50" cy="50" r="20"/>' },
  scallop: { name: 'Scallop', svg: '<circle cx="50" cy="50" r="42"/>' + Array.from({length: 14}, (_, i) => { const a = i * Math.PI * 2 / 14; return `<circle cx="${(50 + 42 * Math.cos(a)).toFixed(1)}" cy="${(50 + 42 * Math.sin(a)).toFixed(1)}" r="8"/>`; }).join('') },
  ticket:  { name: 'Ticket', svg: '<defs><mask id="m"><rect width="100" height="100" fill="#fff"/><circle cx="0" cy="50" r="9" fill="#000"/><circle cx="100" cy="50" r="9" fill="#000"/></mask></defs><rect width="100" height="100" rx="5" mask="url(#m)"/>' },
  stamp:   { name: 'Stamp', svg: '<defs><mask id="m"><rect width="100" height="100" fill="#fff"/>' + Array.from({length: 11}, (_, i) => { const t = 4.5 + i * 9.1; return `<circle cx="${t}" cy="0" r="3.2" fill="#000"/><circle cx="${t}" cy="100" r="3.2" fill="#000"/><circle cx="0" cy="${t}" r="3.2" fill="#000"/><circle cx="100" cy="${t}" r="3.2" fill="#000"/>`; }).join('') + '</mask></defs><rect width="100" height="100" mask="url(#m)"/>' },
  cloud:   { name: 'Cloud', svg: '<circle cx="30" cy="58" r="24"/><circle cx="52" cy="40" r="28"/><circle cx="74" cy="58" r="24"/><rect x="28" y="56" width="48" height="26" rx="4"/><circle cx="50" cy="66" r="22"/>' },
};
const _maskCache = {};
function shapeMask(id) {
  if (!SHAPES[id] || !SHAPES[id].svg) return '';
  if (!_maskCache[id]) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">${SHAPES[id].svg}</svg>`;
    _maskCache[id] = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }
  return _maskCache[id];
}
function shapeIcon(id, fill = 'currentColor') {
  if (id === 'none') return `<svg viewBox="0 0 100 100" width="22" height="22"><rect x="6" y="6" width="88" height="88" fill="none" stroke="${fill}" stroke-width="8" stroke-dasharray="14 10"/></svg>`;
  return `<svg viewBox="0 0 100 100" width="22" height="22" fill="${fill}">${SHAPES[id].svg.replace(/id="m"/g, 'id="m-' + id + '"').replace(/url\(#m\)/g, 'url(#m-' + id + ')')}</svg>`;
}

const IMAGE_FILTERS = {
  none: 'none',
  vintage: 'sepia(.35) contrast(1.08) saturate(.85) brightness(1.04)',
  mono: 'grayscale(1) contrast(1.05)',
  sepia: 'sepia(.85)',
  faded: 'contrast(.82) brightness(1.1) saturate(.7)',
  warm: 'sepia(.2) saturate(1.3) hue-rotate(-8deg)',
  cool: 'saturate(.9) hue-rotate(14deg) brightness(1.03)',
  vivid: 'saturate(1.55) contrast(1.08)',
};

const PEN_TYPES = {
  pen:         { name: 'Pen', width: 3, opacity: 1, cap: 'round' },
  marker:      { name: 'Marker', width: 8, opacity: .92, cap: 'round' },
  highlighter: { name: 'Highlighter', width: 18, opacity: .38, cap: 'butt', blend: 'multiply' },
  pencil:      { name: 'Pencil', width: 2, opacity: .7, cap: 'round', pencil: true },
};

/* Built-in layouts. Elements use page coordinates (560 x 834). */
function builtinTemplates() {
  const t = (type, o) => Object.assign({ id: uid(), type, rot: 0, opacity: 1, locked: false }, o);
  const txt = (x, y, w, h, html, extra = {}) => t('text', Object.assign({ x, y, w, h, html, font: 'Caveat', size: 30, color: '#1F1D24', align: 'left', lineHeight: 1.3, letterSpacing: 0, bold: false, italic: false, underline: false, effect: 'none', effectColor: '#FFE38A' }, extra));
  const note = (x, y, w, h, color, html, shape = 'none', rot = 0) => t('note', { x, y, w, h, color, html, shape, rot, font: 'Patrick Hand', size: 20, textColor: '#1F1D24' });
  const tape = (x, y, w, rot, preset) => t('washi', Object.assign({ x, y, w, h: 32, rot, tape: Object.assign({}, WASHI_PRESETS[preset]) }));
  return [
    { id: 'tpl-daily', name: 'Daily page', builtin: true, paper: { type: 'lined' }, elements: [
      txt(48, 40, 360, 64, 'Today was…', { size: 42 }),
      tape(380, 46, 150, 8, 0),
      note(330, 520, 190, 190, '#FFF3A6', 'Little wins:<br>·<br>·', 'none', 4),
      tape(380, 506, 90, -12, 3),
    ]},
    { id: 'tpl-weekly', name: 'Weekly', builtin: true, paper: { type: 'dot' }, elements: [
      txt(40, 30, 480, 60, 'This week', { size: 40, font: 'DM Serif Display' }),
      ...['Mon','Tue','Wed','Thu','Fri','Sat · Sun'].map((d, i) => txt(40, 110 + i * 116, 480, 100, d, { size: 24, font: 'Patrick Hand' })),
    ]},
    { id: 'tpl-todo', name: 'To-do list', builtin: true, paper: { type: 'grid' }, elements: [
      txt(48, 40, 300, 60, 'To do', { size: 46, font: 'Pacifico' }),
      tape(330, 58, 140, -6, 9),
      txt(56, 140, 440, 420, '☐ <br>☐ <br>☐ <br>☐ <br>☐ <br>☐ ', { size: 30, lineHeight: 1.9 }),
      note(320, 600, 180, 160, '#FFD3DE', "Don't forget!", 'none', -5),
    ]},
    { id: 'tpl-gratitude', name: 'Three good things', builtin: true, paper: { type: 'blank', color: '#FBF7EE' }, elements: [
      txt(60, 40, 440, 60, 'Three good things', { size: 40, align: 'center', font: 'Lora', italic: true }),
      note(70, 140, 200, 200, '#CDEBFF', '1.', 'circle', -4),
      note(290, 320, 200, 200, '#FFD3DE', '2.', 'heart', 3),
      note(80, 540, 210, 210, '#D7F5D0', '3.', 'flower', -2),
    ]},
    { id: 'tpl-memo', name: 'Memory page', builtin: true, paper: { type: 'blank', color: '#F3EAD8' }, elements: [
      tape(30, 30, 200, -30, 5),
      txt(60, 600, 440, 60, 'A day to remember', { size: 36, font: 'Homemade Apple', align: 'center' }),
      txt(60, 680, 440, 100, 'Where · Who · What happened', { size: 22, font: 'Special Elite', align: 'center', color: '#4A3326' }),
      tape(380, 770, 160, -20, 5),
    ]},
  ];
}
