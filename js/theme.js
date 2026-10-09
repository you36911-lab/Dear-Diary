/* Dear Diary — colour themes (background + accent), with automatic contrast */
const THEMES = [
  ['Blush', '#FFE9F1', '#D9608E'], ['Parchment', '#F2E8CF', '#2B2724'], ['Cocoa', '#EFE6D8', '#5A3B2E'], ['Lemon', '#FFF1A6', '#4450B8'],
  ['Matcha', '#A6C673', '#FAD3E5'], ['Strawberry milk', '#FAD3E5', '#F9829E'], ['Rose', '#F6D8D6', '#604734'], ['Peony', '#F0C5D4', '#604734'],
  ['Cherry sky', '#B7CBE3', '#B01013'], ['Cherry cream', '#F4F2E2', '#B01013'], ['Mist', '#D6E9ED', '#684F48'], ['Pistachio', '#CFD78C', '#700143'],
  ['Butter', '#F9F6BD', '#700143'], ['Peach cream', '#E9ACBB', '#FCEBBF'], ['Paprika', '#BA3801', '#FFEC89'], ['Cobalt', '#4A69B3', '#FFEC89'],
  ['Petal', '#FFE4ED', '#B14052'], ['Lavender', '#CABCCD', '#4D3329'], ['Raspberry', '#CD5782', '#DCD3AA'], ['Hot pink', '#F2619C', '#EDE986'],
  ['Mocha', '#AA7F66', '#F2CFCA'], ['Mint', '#F2FFE9', '#005F87'], ['Ice', '#DAE8FB', '#0C0D45'], ['Lilac night', '#F2D2FF', '#0C0D45'],
  ['Sprout', '#E6FBDA', '#0C2D45'], ['Dusty rose', '#F1CFD3', '#5E504B'], ['Celery', '#D9EFBD', '#A33E79'], ['Lime', '#CAFFA6', '#204654'],
];
const DEFAULT_THEME = { bg: '#FFE9F1', accent: '#D9608E', flip: false };
const _rgb = hx => { const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hx); return m ? [1, 2, 3].map(i => parseInt(m[i], 16)) : [255, 255, 255]; };
const _hex = c => '#' + c.map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
const mixHex = (a, b, t) => { const x = _rgb(a), y = _rgb(b); return _hex(x.map((v, i) => v + (y[i] - v) * t)); };
const lumHex = hx => { const [r, g, b] = _rgb(hx).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
const contrastHex = (a, b) => { const [x, y] = [lumHex(a), lumHex(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };

function themeColors(t) {
  let bg = t.flip ? t.accent : t.bg, ac = t.flip ? t.bg : t.accent;
  const panel = lumHex(bg) > .3 ? mixHex(bg, '#FFFFFF', .8) : mixHex(bg, '#FFFFFF', .92);
  const sat = hx => { const c = _rgb(hx), mx = Math.max(...c), mn = Math.min(...c); return mx ? (mx - mn) / mx : 0; };
  const darken = hx => { let x = hx; for (let i = 0; i < 16 && contrastHex(x, panel) < 4.6; i++) x = mixHex(x, '#120F14', .12); return x; };
  // accent text colour: the accent itself if readable, else the background if it is, else the more colourful of the two, darkened
  let ai = contrastHex(ac, panel) >= 4.5 ? ac : contrastHex(bg, panel) >= 4.5 ? bg : darken(sat(ac) >= sat(bg) * .8 ? ac : bg);
  // white text whenever the accent is deep enough to carry it (3:1, the bar for bold UI text); dark text only on light accents
  const onAc = contrastHex(ac, '#FFFFFF') >= 3 ? '#FFFFFF' : '#1C1820';
  const ink = mixHex('#1F1B22', ai, .2);
  const deskInk = contrastHex(bg, '#FFFFFF') > contrastHex(bg, ink) ? '#FFFFFF' : ink;
  let titleOnDesk = contrastHex(ac, bg) >= 3 ? ac : contrastHex(ai, bg) >= 3 ? ai : deskInk;
  const aui = contrastHex(ac, panel) >= 3 ? ac : ai;
  return { bg, ac, ai, aui, onAc, panel, ink, deskInk, titleOnDesk,
    ink2: mixHex(ink, panel, .35), ink3: mixHex(ink, panel, .58),
    line: mixHex(ai, panel, .85), lineStrong: mixHex(ai, panel, .68), hover: mixHex(ai, panel, .94), soft: mixHex(ai, panel, .88), soft2: mixHex(ai, panel, .8),
    sel: contrastHex(ac, '#FFFFFF') >= 2 ? ac : ai };
}
function applyTheme() {
  const t = Object.assign({}, DEFAULT_THEME, S.meta.theme || {});
  const c = themeColors(t), r = document.documentElement.style, [pr, pg, pb] = _rgb(c.panel);
  const vars = { '--bg': c.bg, '--accent': c.ac, '--on-accent': c.onAc, '--accent-ink': c.ai, '--accent-ui': c.aui, '--accent-soft': c.soft, '--soft-2': c.soft2,
    '--ink': c.ink, '--ink-2': c.ink2, '--ink-3': c.ink3, '--line': c.line, '--line-strong': c.lineStrong, '--hover': c.hover,
    '--panel-solid': c.panel, '--panel': `rgba(${pr},${pg},${pb},.96)`, '--desk-ink': c.deskInk, '--title-shadow': contrastHex(c.ac, c.bg) < 2 ? (lumHex(c.ac) > lumHex(c.bg) ? '0 1px 2px rgba(0,0,0,.28)' : '0 1px 1px rgba(255,255,255,.6)') : 'none', '--title-on-desk': c.titleOnDesk, '--sel': c.sel };
  Object.entries(vars).forEach(([k, v]) => r.setProperty(k, v));
  try { localStorage.setItem('dd-theme-vars', JSON.stringify(vars)); } catch (e) {}
  const b = document.body;
  const u = t.deskImage ? blobURL(t.deskImage) : '';
  b.style.background = u ? `url("${u}") center/cover fixed, ${c.bg}` : `radial-gradient(ellipse at 50% 20%, ${mixHex(c.bg, '#FFFFFF', .22)} 0%, ${c.bg} 65%)`;
  b.classList.remove('desk-dark');
  const tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.content = c.bg;
}
function themePicker() {
  const cur = () => Object.assign({}, DEFAULT_THEME, S.meta.theme || {});
  const save = () => { applyTheme(); saveMeta(); };
  const grid = h('div', { class: 'theme-grid', role: 'group', 'aria-label': 'Colour themes' });
  const mark = () => $$('.theme-dot', grid).forEach(d => { const t = cur(), on = d.dataset.bg === t.bg && d.dataset.ac === t.accent; d.classList.toggle('on', on); d.classList.toggle('flipped', on && !!t.flip); d.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  THEMES.forEach(([name, bg, ac]) => {
    const d = h('button', { class: 'theme-dot', title: name, 'aria-label': name, 'data-bg': bg, 'data-ac': ac, style: { '--a': bg, '--b': ac } });
    d.addEventListener('click', () => {
      const t = cur();
      if (t.bg === bg && t.accent === ac) t.flip = !t.flip; else Object.assign(t, { bg, accent: ac, flip: false });
      S.meta.theme = t; save(); mark(); syncCustom();
    });
    grid.append(d);
  });
  const bgIn = h('input', { type: 'color', 'aria-label': 'Background colour' }), acIn = h('input', { type: 'color', 'aria-label': 'Accent colour' });
  const syncCustom = () => { const c = themeColors(cur()); bgIn.value = c.bg; acIn.value = c.ac; };
  const custom = () => { S.meta.theme = Object.assign(cur(), { bg: bgIn.value, accent: acIn.value, flip: false }); applyTheme(); mark(); };
  bgIn.addEventListener('input', custom); acIn.addEventListener('input', custom);
  bgIn.addEventListener('change', save); acIn.addEventListener('change', save);
  syncCustom(); mark();
  const photoRow = h('div', { class: 'btn-row' });
  const drawPhoto = () => {
    photoRow.innerHTML = '';
    photoRow.append(h('button', { class: 'btn small', onclick: async () => { const f = await pickFile('image/*'); if (!f) return; const n = await normalizeImage(f, 2400); const id = await putBlob(n.blob); S.meta.theme = Object.assign(cur(), { deskImage: id }); save(); drawPhoto(); } }, h('span', { html: ICON.image }), cur().deskImage ? 'Change desk photo' : 'Use a photo on the desk'));
    if (cur().deskImage) photoRow.append(h('button', { class: 'btn small', onclick: () => { const t = cur(); delete t.deskImage; S.meta.theme = t; save(); drawPhoto(); } }, 'Remove photo'));
  };
  drawPhoto();
  modal({ title: 'Theme', wide: true, body: h('div', { class: 'theme-body' },
    h('section', { class: 'th-sec' },
      h('p', { class: 'th-intro' }, 'Pick a ', h('strong', {}, 'colour pair'), '. Tap the same one again to swap the background and accent.'),
      grid,
      h('div', { class: 'theme-custom' },
        h('label', { class: 'color-field' }, h('span', { class: 'color-chip' }, bgIn), h('span', {}, 'Background')),
        h('label', { class: 'color-field' }, h('span', { class: 'color-chip' }, acIn), h('span', {}, 'Accent')))),
    h('section', { class: 'th-sec' },
      h('p', { class: 'th-intro' }, 'Pick a ', h('strong', {}, 'title font'), '. Used for the app name, the splash screen and headings.'),
      titleFontPicker()),
    h('section', { class: 'th-sec' },
      h('p', { class: 'th-intro' }, 'Add a ', h('strong', {}, 'desk photo'), ' if you like. Your theme colours stay the same; only the surface behind the diaries changes.'),
      photoRow)),
    actions: [{ label: 'Done', kind: 'primary' }] });
}

/* ---------- Title (logo) font ---------- */
const TITLE_FONTS = [['Bagel Fat One'], ['Spicy Rice'], ['Chango'], ['Titan One'], ['Lilita One'], ['Rubik Bubbles'], ['Modak'], ['Shrikhand'], ['Gloock'], ['Instrument Serif', true], ['Unbounded'], ['Swanky and Moo Moo'], ['Hachi Maru Pop'], ['Mochiy Pop One'], ['DynaPuff'], ['Chewy'], ['Coiny'], ['Darumadrop One'], ['Sniglet']];
const allTitleFonts = () => TITLE_FONTS.concat((S.meta.customFonts || []).map(f => [f.name]));
function applyTitleFont(f) {
  f = f || (S.meta && S.meta.titleFont) || 'Bagel Fat One';
  const it = (allTitleFonts().find(x => x[0] === f) || [])[1];
  ensureFont(f);
  if (it && !document.querySelector('link[data-italic="' + f + '"]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.dataset.italic = f; l.href = 'https://fonts.googleapis.com/css2?family=' + f.replace(/ /g, '+') + ':ital@1&display=swap'; document.head.append(l); }
  const r = document.documentElement.style;
  r.setProperty('--display', `"${f}", "Plus Jakarta Sans", system-ui, sans-serif`);
  r.setProperty('--display-style', it ? 'italic' : 'normal');
  try { localStorage.setItem('dd-title-font', f); } catch (e) {}
  applyWordmark();
}
function applyWordmark() {
  $$('.app-name, .sp-word').forEach(e => { e.textContent = APP_NAME; e.removeAttribute('aria-label'); });
}
async function loadCustomFonts() {
  for (const f of S.meta.customFonts || []) {
    try { const b = await getBlob(f.blobId); if (!b) continue; const ff = new FontFace(f.name, await b.arrayBuffer()); await ff.load(); document.fonts.add(ff); } catch (e) { console.warn('font', f.name, e); }
  }
}
async function addCustomFont(after) {
  const file = await pickFile('.ttf,.otf,.woff,.woff2,font/*'); if (!file) return;
  const name = file.name.replace(/\.(ttf|otf|woff2?)$/i, '').replace(/[-_]+/g, ' ').replace(/\s+(regular|demo)$/i, '').trim() || 'My font';
  try {
    const ff = new FontFace(name, await file.arrayBuffer()); await ff.load(); document.fonts.add(ff);
  } catch (e) { toast("That file couldn't be read as a font."); return; }
  const blobId = await putBlob(new Blob([file], { type: file.type || 'font/ttf' }));
  S.meta.customFonts = (S.meta.customFonts || []).filter(x => x.name !== name).concat({ name, blobId });
  await saveMeta(); toast(`Added “${name}”`); after && after();
}
function titleFontPicker() {
  preloadAllFonts();
  const wrap = h('div', { class: 'title-fonts', role: 'group', 'aria-label': 'Title font' });
  const cur = () => S.meta.titleFont || 'Bagel Fat One';
  allTitleFonts().forEach(([f, it]) => {
    const b = h('button', { class: 'title-font' + (cur() === f ? ' on' : ''), 'aria-pressed': cur() === f ? 'true' : 'false' },
      h('span', { class: 'tf-sample', style: { fontFamily: `"${f}", sans-serif`, fontStyle: it ? 'italic' : 'normal' } }, 'Dear Diary'),
      h('span', { class: 'tf-name' }, f));
    b.addEventListener('click', () => { S.meta.titleFont = f; saveMeta(); applyTitleFont(f); $$('.title-font', wrap).forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); }); });
    wrap.append(b);
  });
  const box = h('div', { class: 'tf-box' }, wrap,
    h('div', { class: 'tf-extra' },
      h('button', { class: 'btn small', onclick: () => addCustomFont(() => box.replaceWith(titleFontPicker())) }, h('span', { html: ICON.upload }), 'Add a font file'),
      h('p', { class: 'muted small' }, 'A .ttf, .otf or .woff2 file stays on this device and also shows up in the text font list. Check that its licence allows how you use it.')));
  return box;
}
