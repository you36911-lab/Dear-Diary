/* Dear Diary — inspector (right panel) */
const sec = (title, ...kids) => h('section', { class: 'insp-sec' }, title ? h('h3', {}, title) : null, ...kids);
const row = (label, ctl, cls = '') => h('div', { class: 'row ' + cls }, h('span', { class: 'row-label' }, label), ctl);

function slider(val, min, max, step, onInput, onChange, unit = '') {
  const out = h('output', {}, fmtNum(val) + unit);
  const r = h('input', { type: 'range', min, max, step, value: val });
  r.addEventListener('input', () => { out.textContent = fmtNum(+r.value) + unit; onInput(+r.value); });
  r.addEventListener('change', () => onChange && onChange(+r.value));
  return h('div', { class: 'slider' }, r, out);
}
const fmtNum = v => Math.round(v * 100) / 100;
function swatches(list, cur, onPick, { custom = true, label = 'Colour' } = {}) {
  const w = h('div', { class: 'swatches', role: 'group', 'aria-label': label });
  const recent = (S.meta.recentColors || []).filter(c => !list.some(l => (Array.isArray(l) ? l[1] : l).toLowerCase() === c.toLowerCase())).slice(0, 4);
  list.concat(recent).forEach(item => {
    const [name, c] = Array.isArray(item) ? item : [item, item];
    w.append(h('button', { class: 'sw' + ((cur || '').toLowerCase() === c.toLowerCase() ? ' on' : ''), style: { background: c }, title: name, 'aria-label': name, onclick: () => onPick(c) }));
  });
  if (custom) {
    const inp = h('input', { type: 'color', value: /^#[\da-f]{6}$/i.test(cur || '') ? cur : '#888888', 'aria-label': 'Custom colour' });
    inp.addEventListener('input', () => onPick(inp.value, true));
    inp.addEventListener('change', () => { rememberColor(inp.value); onPick(inp.value); });
    w.append(h('label', { class: 'sw sw-custom', title: 'Custom colour' }, inp));
  }
  return w;
}
function rememberColor(c) { const r = S.meta.recentColors || []; S.meta.recentColors = [c].concat(r.filter(x => x !== c)).slice(0, 6); saveMeta(); }
function seg(opts, cur, onPick, cls = '') {
  const w = h('div', { class: 'seg ' + cls, role: 'group' });
  opts.forEach(([v, label, title]) => w.append(h('button', { class: cur === v ? 'on' : '', title: title || (typeof label === 'string' ? label : ''), 'aria-pressed': cur === v ? 'true' : 'false', onclick: () => onPick(v), html: label })));
  return w;
}
function toggle(label, on, onChange) {
  const i = h('input', { type: 'checkbox' }); i.checked = !!on;
  i.addEventListener('change', () => onChange(i.checked));
  return h('label', { class: 'toggle' }, i, h('span', { class: 'track' }), h('span', {}, label));
}
function fontSelect(cur, onPick) {
  const s = h('select', { class: 'input', 'aria-label': 'Font' });
  const all = ((S.meta.customFonts || []).length ? [['My fonts', S.meta.customFonts.map(f => f.name)]] : []).concat(FONT_GROUPS.map(g => [g.name, g.fonts])).concat((S.meta.localFonts || []).length ? [['On this computer', S.meta.localFonts]] : []);
  let found = false;
  all.forEach(([name, fonts]) => { const og = h('optgroup', { label: name }); fonts.forEach(f => { if (f === cur) found = true; og.append(h('option', { value: f, selected: f === cur, style: { fontFamily: fontStack(f) } }, f)); }); s.append(og); });
  if (cur && !found) s.prepend(h('option', { value: cur, selected: true }, cur));
  s.append(h('option', { value: '__local' }, 'Use fonts on this computer…'));
  s.addEventListener('change', async () => {
    if (s.value === '__local') { await loadLocalFonts(); renderInspector(); return; }
    ensureFont(s.value); onPick(s.value);
  });
  preloadAllFonts();
  return s;
}
async function loadLocalFonts() {
  if (!('queryLocalFonts' in window)) {
    const name = await promptBox('Use a font from this computer', '', 'Font name exactly as installed (e.g. Georgia)', 'Add font');
    if (name) { S.meta.localFonts = [...new Set((S.meta.localFonts || []).concat(name))].sort(); saveMeta(); toast(`Added “${name}”`); }
    return;
  }
  try {
    const fonts = await window.queryLocalFonts();
    S.meta.localFonts = [...new Set(fonts.map(f => f.family))].sort(); saveMeta();
    toast(`Found ${S.meta.localFonts.length} fonts on this computer`);
  } catch (e) { toast('Font access was not allowed.'); }
}
function shapeGrid(cur, onPick, list = Object.keys(SHAPES)) {
  const g = h('div', { class: 'shape-grid' });
  list.forEach(k => g.append(h('button', { class: cur === k ? 'on' : '', title: SHAPES[k].name, 'aria-label': SHAPES[k].name, html: shapeIcon(k), onclick: () => onPick(k) })));
  return g;
}
function iconBtn(icon, label, fn, cls = '') { return h('button', { class: 'tbtn ' + cls, title: label, 'aria-label': label, onclick: fn, html: ICON[icon] + `<span>${label}</span>` }); }

/* live: update DOM without history; final: commit */
function bindSel(fn, label) { return { live: v => updateSel(e => fn(e, v), label, true), done: () => commit(label) }; }

function renderInspector() {
  const box = $('#inspector'); if (!box || S.view !== 'book') return;
  const scroll = box.scrollTop;
  box.innerHTML = '';
  if (S.closed) { box.append(diaryPanel()); return; }
  const els = selEls();
  if (els.length) box.append(elementPanel(els));
  else if (S.tool !== 'select') box.append(toolPanel(S.tool));
  else box.append(pagePanel());
  box.scrollTop = scroll;
}

/* ---------------- Diary (closed) ---------------- */
function diaryPanel() {
  const d = S.diary;
  const frag = h('div', { class: 'insp' });
  frag.append(h('h2', { class: 'insp-title' }, d.name));
  frag.append(h('p', { class: 'muted' }, `${d.pages.length} page${d.pages.length === 1 ? '' : 's'}. Click the cover to open.`));
  frag.append(sec(null,
    h('button', { class: 'btn primary block', onclick: openBook }, 'Open diary'),
    h('button', { class: 'btn block', onclick: () => coverEditor(d) }, 'Edit cover'),
    h('button', { class: 'btn block', onclick: () => renameDiary(d) }, 'Rename')));
  return frag;
}

/* ---------------- Page ---------------- */
function pagePanel() {
  const frag = h('div', { class: 'insp' });
  const page = activePageObj();
  if (!page) {
    frag.append(h('h2', { class: 'insp-title' }, 'Calendar'), h('p', { class: 'muted' }, 'Days with a dot have pages. Click one to jump there. You can hide these pages from the Index.'));
    return frag;
  }
  const n = pageNumber(page);
  const set = (fn, label, live) => { fn(page); rerenderPageDOM(page.id); if (!live) { commit(label); } };
  frag.append(h('h2', { class: 'insp-title' }, `Page ${n}`, h('span', { class: 'muted small' }, page.date ? ' · ' + fmtShort(page.date) : '')));

  const date = h('input', { type: 'date', class: 'input', value: page.date || '' });
  date.addEventListener('change', () => set(p => p.date = date.value, 'Change date'));
  const title = h('input', { class: 'input', placeholder: 'Shown in the index', value: page.title || '' });
  title.addEventListener('change', () => set(p => p.title = title.value.trim(), 'Rename page'));
  const tags = h('input', { class: 'input', placeholder: 'travel, friends', value: (page.tags || []).join(', ') });
  tags.addEventListener('change', () => set(p => p.tags = tags.value.split(',').map(t => t.trim().toLowerCase()).filter(Boolean), 'Edit tags'));
  frag.append(sec('Details', row('Date', date), row('Title', title), row('Tags', tags)));
  frag.append(sec('Mood and weather',
    emojiPick(MOODS, page.mood, v => set(p => p.mood = p.mood === v ? '' : v, 'Set mood')),
    emojiPick(WEATHERS, page.weather, v => set(p => p.weather = p.weather === v ? '' : v, 'Set weather'))));
  frag.append(sec('On the page',
    toggle('Bookmark ribbon', page.bookmarked, v => { set(p => p.bookmarked = v, v ? 'Bookmark' : 'Remove bookmark'); updateNav(); renderInspector(); }),
    page.bookmarked ? ribbonPicker(page.ribbon || S.diary.settings.ribbon || 'babypink', c => { set(p => p.ribbon = c, 'Ribbon colour'); S.diary.settings.ribbon = c; renderInspector(); }) : null,
    toggle('Show the date', page.showDate !== false, v => set(p => p.showDate = v, v ? 'Show date' : 'Hide date')),
    h('div', { class: 'mini-actions' }, 'Every page:',
      h('button', { class: 'link small', onclick: () => { S.diary.pages.forEach(p => p.showDate = false); S.diary.settings.showDates = false; commit('Hide all dates'); renderBook(); renderInspector(); toast('Dates are hidden on every page, including new ones.'); } }, 'Hide dates'),
      h('button', { class: 'link small', onclick: () => { S.diary.pages.forEach(p => p.showDate = true); S.diary.settings.showDates = true; commit('Show all dates'); renderBook(); renderInspector(); toast('Dates are shown on every page.'); } }, 'Show dates'))));

  const hs = hiddenSection(page); if (hs) frag.append(hs);
  const paper = page.paper;
  frag.append(sec('Paper',
    seg(PAPER_TYPES, paper.type, v => { set(p => p.paper.type = v, 'Change paper'); renderInspector(); }),
    swatches(PAPER_COLORS, paper.color, (c, live) => { set(p => p.paper.color = c, 'Paper colour', live); if (!live) renderInspector(); }, { label: 'Paper colour' }),
    paper.type !== 'blank' ? row('Spacing', slider(paper.spacing || 24, 12, 48, 1, v => set(p => p.paper.spacing = v, '', true), () => commit('Paper spacing'), 'px')) : null,
    paper.type !== 'blank' ? row('Lines', swatches([['Auto', ''], ['Rose', 'rgba(226,69,111,.28)'], ['Blue', 'rgba(62,142,208,.3)'], ['Green', 'rgba(93,170,104,.3)'], ['Brown', 'rgba(120,90,60,.3)']].map(([n, c]) => [n, c || 'transparent']), paper.line || 'transparent', c => { set(p => p.paper.line = c === 'transparent' ? '' : c, 'Line colour'); renderInspector(); }, { custom: false, label: 'Line colour' })) : null,
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn small', onclick: () => { S.diary.pages.forEach(p => p.paper = clone(paper)); commit('Paper for all pages'); renderBook(); toast('Every page now uses this paper.'); } }, 'Use on all pages'),
      h('button', { class: 'btn small', onclick: () => { S.diary.settings.defaultPaper = clone(paper); commit('Default paper'); toast('New pages will start with this paper.'); } }, 'Default for new pages'))));

  // Music
  const url = h('input', { class: 'input', placeholder: 'Paste a YouTube or YouTube Music link', value: page.music?.url || '' });
  const setSong = () => {
    const v = url.value.trim();
    if (!v) { set(p => p.music = null, 'Remove song'); renderInspector(); return; }
    const id = ytId(v);
    if (!id) { toast("That link doesn't look like a YouTube video."); return; }
    set(p => p.music = { id, url: v, title: '' }, 'Set page song'); renderInspector();
    Music.pageChanged(true);
  };
  url.addEventListener('keydown', e => { if (e.key === 'Enter') setSong(); });
  frag.append(sec('Song for this page',
    h('p', { class: 'muted small' }, 'Plays when you open to this page with page music turned on.'),
    h('div', { class: 'inline' }, url, h('button', { class: 'btn small', onclick: setSong }, page.music ? 'Update' : 'Set')),
    page.music ? h('div', { class: 'song-row' }, h('span', { html: ICON.music }), h('span', { class: 'song-title' }, page.music.title || 'YouTube song'), h('button', { class: 'link', onclick: () => { url.value = ''; setSong(); } }, 'Remove')) : null,
    toggle('Show the ♪ mark on pages with a song', S.diary.settings.showMusicTag !== false, v => { S.diary.settings.showMusicTag = v; commit(v ? 'Show music marks' : 'Hide music marks'); renderBook(); renderInspector(); })));

  frag.append(sec('Layout',
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn small', onclick: () => openFlyout('layouts') }, 'Apply a layout'),
      h('button', { class: 'btn small', onclick: () => saveLayoutFromPage(page) }, 'Save as layout'))));

  frag.append(sec('Page',
    h('div', { class: 'tool-grid' },
      iconBtn('plus', 'Add after', () => addPage(page.id)),
      iconBtn('copy', 'Duplicate', () => duplicatePage(page.id)),
      iconBtn('left', 'Move earlier', () => movePage(page.id, -1)),
      iconBtn('right', 'Move later', () => movePage(page.id, 1)),
      iconBtn('trash', 'Delete page', () => deletePage(page.id), 'danger'))));
  return frag;
}
function ribbonPicker(cur, onPick) {
  const w = h('div', { class: 'ribbon-pick', role: 'group', 'aria-label': 'Ribbon colour' });
  RIBBONS.forEach(c => w.append(h('button', { class: c === cur ? 'on' : '', title: c, 'aria-label': c, onclick: () => onPick(c) }, h('img', { src: ribbonUrl(c), alt: '', loading: 'lazy' }))));
  return w;
}
function hiddenSection(page) {
  const hid = page.elements.filter(e => e.hidden); if (!hid.length) return null;
  const names = { image: 'Image', text: 'Text', note: 'Sticky note', washi: 'Washi tape', stroke: 'Drawing' };
  const label = e => { const d = document.createElement('div'); d.innerHTML = e.html || e.caption || ''; const t = d.textContent.trim(); return t ? `${names[e.type]} · ${t.slice(0, 22)}` : names[e.type]; };
  return sec(`Hidden items (${hid.length})`,
    h('div', { class: 'hidden-list' }, hid.map(e => h('div', { class: 'hidden-row' }, h('span', { class: 'hidden-name' }, label(e)), h('button', { class: 'btn small', onclick: () => showHidden(page.id, e.id) }, h('span', { html: ICON.eye }), 'Show')))),
    hid.length > 1 ? h('button', { class: 'btn small', onclick: () => showHidden(page.id) }, 'Show all') : null);
}
function emojiPick(list, cur, onPick) {
  const w = h('div', { class: 'emoji-pick' });
  list.forEach(([em, name]) => w.append(h('button', { class: cur === em ? 'on' : '', title: name, 'aria-label': name, onclick: () => onPick(em) }, em)));
  return w;
}

/* ---------------- Tools ---------------- */
function toolPanel(tool) {
  const frag = h('div', { class: 'insp' });
  const o = S.toolOpts[tool];
  if (tool === 'pen') {
    frag.append(h('h2', { class: 'insp-title' }, 'Pen'), h('p', { class: 'muted small' }, 'Draw on the page. Works with a stylus too.'));
    frag.append(sec('Pen type', seg(Object.entries(PEN_TYPES).map(([k, v]) => [k, v.name]), o.type, v => { o.type = v; o.width = PEN_TYPES[v].width; renderInspector(); })));
    frag.append(sec('Colour', swatches(INK_COLORS.concat(BRIGHT_COLORS.map(c => [c, c])), o.color, (c, live) => { o.color = c; if (!live) renderInspector(); })));
    frag.append(sec('Thickness', slider(o.width, 1, 40, 1, v => o.width = v, null, 'px')));
    frag.append(sec('Stylus', toggle('Pressure changes the thickness', o.pressure !== false, v => o.pressure = v), h('p', { class: 'muted small' }, 'Works with a drawing tablet or Apple Pencil. A mouse always draws an even line.')));
  } else if (tool === 'eraser') {
    frag.append(h('h2', { class: 'insp-title' }, 'Eraser'), h('p', { class: 'muted small' }, 'Drag over pen strokes to remove them. Other items can be deleted with the Delete key.'));
    frag.append(sec('Size', slider(o.size, 4, 60, 1, v => o.size = v, null, 'px')));
  } else if (tool === 'washi') {
    frag.append(h('h2', { class: 'insp-title' }, 'Washi tape'), h('p', { class: 'muted small' }, 'Pick a tape, then drag across the page. Hold Shift for straight angles.'));
    frag.append(sec('Tapes', tapeGrid(o.tape, t => { o.tape = clone(t); renderInspector(); })));
    frag.append(sec('Width', slider(o.width, 12, 80, 1, v => o.width = v, null, 'px')));
    frag.append(sec('Design your own', tapeDesigner(o.tape, (t, live) => { o.tape = t; if (!live) renderInspector(); }),
      h('button', { class: 'btn small', onclick: () => { S.meta.washiCustom = (S.meta.washiCustom || []).concat(Object.assign(clone(o.tape), { name: 'My tape' })); saveMeta(); renderInspector(); toast('Saved to your tapes'); } }, 'Save to my tapes')));
  } else if (tool === 'text') {
    frag.append(h('h2', { class: 'insp-title' }, 'Text'), h('p', { class: 'muted small' }, 'Click anywhere on the page to start writing.'));
    frag.append(sec('Font', fontSelect(o.font, f => { o.font = f; })));
    frag.append(sec('Size', slider(o.size, 10, 120, 1, v => o.size = v, null, 'px')));
    frag.append(sec('Colour', swatches(INK_COLORS, o.color, (c, live) => { o.color = c; if (!live) renderInspector(); })));
  } else if (tool === 'note') {
    frag.append(h('h2', { class: 'insp-title' }, 'Sticky note'), h('p', { class: 'muted small' }, 'Click on the page to stick a note.'));
    frag.append(sec('Colour', swatches(NOTE_COLORS, o.color, (c, live) => { o.color = c; if (!live) renderInspector(); })));
    frag.append(sec('Shape', shapeGrid(o.shape, v => { o.shape = v; renderInspector(); }, Object.keys(SHAPES).filter(k => k !== 'ticket'))));
  }
  return frag;
}
function tapeSwatch(t) { const s = h('span', { class: 'tape-sw' }); s.style.background = washiBg(t); return s; }
function tapeGrid(cur, onPick) {
  const g = h('div', { class: 'tape-grid' });
  const all = WASHI_PRESETS.map(t => [t, false]).concat((S.meta.washiCustom || []).map((t, i) => [t, i]));
  all.forEach(([t, ci]) => {
    const on = cur && t.kind === cur.kind && t.c1 === cur.c1 && t.c2 === cur.c2 && t.blobId === cur.blobId;
    const b = h('button', { class: 'tape-btn' + (on ? ' on' : ''), title: t.name || 'Tape', onclick: () => onPick(t) }, tapeSwatch(t));
    if (ci !== false) b.append(h('span', { class: 'tape-x', title: 'Remove from my tapes', onclick: ev => { ev.stopPropagation(); S.meta.washiCustom.splice(ci, 1); saveMeta(); renderInspector(); } }, '×'));
    g.append(b);
  });
  return g;
}
function tapeDesigner(t, onChange) {
  const w = h('div', { class: 'tape-designer' });
  const kinds = [['solid', 'Solid'], ['stripes', 'Stripes'], ['dots', 'Dots'], ['gingham', 'Gingham'], ['grid', 'Grid'], ['hearts', 'Hearts'], ['stars', 'Stars'], ['image', 'Photo']];
  const sel = h('select', { class: 'input', 'aria-label': 'Pattern' }, kinds.map(([v, l]) => h('option', { value: v, selected: t.kind === v }, l)));
  sel.addEventListener('change', async () => {
    if (sel.value === 'image') {
      const f = await pickFile('image/*'); if (!f) { sel.value = t.kind; return; }
      const n = await normalizeImage(f, 900); const id = await putBlob(n.blob);
      onChange(Object.assign(clone(t), { kind: 'image', blobId: id }));
    } else onChange(Object.assign(clone(t), { kind: sel.value }));
  });
  w.append(row('Pattern', sel));
  w.append(row('Base', swatches(['#F7B6C8', '#CFEBDD', '#E3DAF7', '#FFF6D6', '#DDEBFA', '#CDB38E', '#FFFFFF', '#24305E'], t.c1, (c, live) => onChange(Object.assign(clone(t), { c1: c }), live), { label: 'Base colour' })));
  if (!['solid', 'image'].includes(t.kind)) w.append(row('Print', swatches(['#FFFFFF', '#E2456F', '#F2C94C', '#7FA9D8', '#2B2A30', '#5DAA68', '#9ED3BA', '#F6E7B4'], t.c2, (c, live) => onChange(Object.assign(clone(t), { c2: c }), live), { label: 'Pattern colour' })));
  w.prepend(h('div', { class: 'tape-preview' }, tapeSwatch(t)));
  return w;
}
function pickFile(accept) {
  return new Promise(res => { const i = h('input', { type: 'file', accept }); i.onchange = () => res(i.files[0] || null); i.click(); });
}

/* ---------------- Elements ---------------- */
function elementPanel(els) {
  const frag = h('div', { class: 'insp' });
  const types = [...new Set(els.map(e => e.type))];
  const e = els[0], one = els.length === 1, type = types.length === 1 ? types[0] : null;
  const names = { image: 'Image', text: 'Text', note: 'Sticky note', washi: 'Washi tape', stroke: 'Drawing' };
  const grouped = els.length > 1 && els.every(x => x.group && x.group === els[0].group);
  frag.append(h('h2', { class: 'insp-title' }, one ? names[e.type] : grouped ? `Group of ${els.length}` : `${els.length} items selected`));
  if (els.some(x => x.locked)) frag.append(h('p', { class: 'lock-note' }, h('span', { html: ICON.lock }), ' Locked. Unlock to move or edit.', h('button', { class: 'link', onclick: toggleLock }, 'Unlock')));

  if (type === 'image') imagePanel(frag, els);
  if (type === 'text') textPanel(frag, els);
  if (type === 'note') notePanel(frag, els);
  if (type === 'washi') washiPanel(frag, els);
  if (type === 'stroke') strokePanel(frag, els);

  const op = bindSel((x, v) => x.opacity = v / 100, 'Opacity');
  frag.append(sec('Look',
    row('Opacity', slider(Math.round((e.opacity ?? 1) * 100), 5, 100, 1, op.live, op.done, '%')),
    one ? row('Rotation', slider(Math.round(e.rot || 0), -180, 180, 1, v => updateSel(x => x.rot = v, '', true), () => commit('Rotate'), '°')) : null));

  frag.append(sec('Arrange',
    h('div', { class: 'tool-grid' },
      iconBtn('top', 'To front', () => layerSel('top')),
      iconBtn('up', 'Forward', () => layerSel('up')),
      iconBtn('down', 'Backward', () => layerSel('down')),
      iconBtn('bottom', 'To back', () => layerSel('bottom')),
      iconBtn('copy', 'Duplicate', duplicateSel),
      els.length > 1 ? iconBtn('flipH', 'Flip', () => flipSel('h')) : null,
      els.length > 1 ? iconBtn('flipV', 'Flip vertical', () => flipSel('v')) : null,
      iconBtn('eyeOff', 'Hide', hideSel),
      els.length > 1 && !(els.every(x => x.group && x.group === els[0].group)) ? iconBtn('group', 'Group', groupSel) : null,
      els.some(x => x.group) ? iconBtn('ungroup', 'Ungroup', ungroupSel) : null,
      iconBtn(els.every(x => x.locked) ? 'unlock' : 'lock', els.every(x => x.locked) ? 'Unlock' : 'Lock', toggleLock),
      iconBtn('trash', 'Delete', deleteSel, 'danger'))));
  return frag;
}

function imagePanel(frag, els) {
  const e = els[0], one = els.length === 1;
  const set = (fn, label) => { updateSel(fn, label); renderInspector(); };
  if (one) frag.append(sec(null, h('div', { class: 'tool-grid' },
    iconBtn('crop', 'Crop', () => cropModal(e)),
    iconBtn('flipH', 'Flip', () => flipSel('h')),
    iconBtn('flipV', 'Flip vertical', () => flipSel('v')),
    iconBtn('wand', 'Cut out', () => cutoutModal(e)),
    iconBtn('drawer', 'Save to drawer', () => saveToDrawer(e)))));
  if (one && e.origBlobId) frag.append(h('button', { class: 'link small', onclick: () => set(x => { x.blobId = x.origBlobId; delete x.origBlobId; }, 'Restore original image') }, 'Restore the original image'));
  frag.append(sec('Shape', shapeGrid(e.shape || 'none', v => set(x => { x.shape = v; if (SHAPES[v].square) { const s = Math.max(x.w, x.h); x.w = x.h = s; } }, 'Change shape'))));
  const cap = h('input', { class: 'input', placeholder: 'Write a caption', value: e.caption || '' });
  cap.addEventListener('input', () => updateSel(x => x.caption = cap.value, '', true));
  cap.addEventListener('change', () => commit('Edit caption'));
  frag.append(sec('Frame',
    toggle('Polaroid frame', e.polaroid, v => set(x => { x.polaroid = v; if (v) { x.h = Math.round(x.h * 1.18); x.w = Math.round(x.w * 1.06); } else { x.h = Math.round(x.h / 1.18); x.w = Math.round(x.w / 1.06); } }, v ? 'Polaroid frame' : 'Remove frame')),
    e.polaroid ? row('Caption', cap) : null,
    e.polaroid ? row('Caption font', fontSelect(e.capFont || 'Caveat', f => set(x => x.capFont = f, 'Caption font'))) : null,
    toggle('Shadow', e.shadow, v => set(x => x.shadow = v, 'Shadow'))));
  const bw = bindSel((x, v) => x.border = Object.assign({}, x.border, { width: v }), 'Border');
  frag.append(sec('Border',
    h('p', { class: 'muted small' }, 'Follows the shape, so a white border on a cut-out makes a sticker edge.'),
    row('Width', slider(e.border?.width || 0, 0, 16, 1, bw.live, bw.done, 'px')),
    swatches(['#FFFFFF', '#F8F1E4', '#1F1D24', '#E2456F', '#F2C94C', '#7FA9D8', '#9ED3BA'], e.border?.color || '#FFFFFF', (c, live) => { updateSel(x => x.border = Object.assign({ width: 4 }, x.border, { color: c, width: x.border?.width || 4 }), 'Border colour', live); if (!live) renderInspector(); })));
  const fg = h('div', { class: 'chips' });
  Object.keys(IMAGE_FILTERS).forEach(k => fg.append(h('button', { class: 'chip' + ((e.filter || 'none') === k ? ' on' : ''), onclick: () => set(x => x.filter = k, 'Filter') }, k === 'none' ? 'Original' : k[0].toUpperCase() + k.slice(1))));
  const adj = (key, label) => { const b = bindSel((x, v) => x.adjust = Object.assign({ b: 100, c: 100, s: 100 }, x.adjust, { [key]: v }), label); return row(label, slider(e.adjust?.[key] ?? 100, 40, 160, 1, b.live, b.done, '%')); };
  frag.append(sec('Filter', fg, adj('b', 'Brightness'), adj('c', 'Contrast'), adj('s', 'Saturation')));
}

function textPanel(frag, els) {
  const e = els[0];
  const set = (fn, label) => { updateSel(fn, label); renderInspector(); };
  const sz = bindSel((x, v) => x.size = v, 'Text size');
  frag.append(sec('Font',
    fontSelect(e.font, f => set(x => x.font = f, 'Change font')),
    row('Size', slider(e.size, 8, 160, 1, sz.live, sz.done, 'px')),
    h('div', { class: 'seg-row' },
      seg([['b', '<b>B</b>', 'Bold']], e.bold ? 'b' : '', () => set(x => x.bold = !x.bold, 'Bold'), 'mini'),
      seg([['i', '<i>I</i>', 'Italic']], e.italic ? 'i' : '', () => set(x => x.italic = !x.italic, 'Italic'), 'mini'),
      seg([['u', '<u>U</u>', 'Underline']], e.underline ? 'u' : '', () => set(x => x.underline = !x.underline, 'Underline'), 'mini'),
      seg([['left', alignIcon('left'), 'Align left'], ['center', alignIcon('center'), 'Centre'], ['right', alignIcon('right'), 'Align right']], e.align || 'left', v => set(x => x.align = v, 'Align'), 'mini'))));
  frag.append(sec('Colour', swatches(INK_COLORS.concat(BRIGHT_COLORS.map(c => [c, c])), e.color, (c, live) => { updateSel(x => x.color = c, 'Text colour', live); if (!live) renderInspector(); })));
  const lh = bindSel((x, v) => x.lineHeight = v, 'Line spacing'), ls = bindSel((x, v) => x.letterSpacing = v, 'Letter spacing');
  frag.append(sec('Spacing', row('Lines', slider(e.lineHeight || 1.3, .8, 2.6, .05, lh.live, lh.done)), row('Letters', slider(e.letterSpacing || 0, -3, 12, .5, ls.live, ls.done, 'px'))));
  frag.append(sec('Effect',
    seg([['none', 'None'], ['highlight', 'Marker'], ['shadow', 'Shadow'], ['outline', 'Outline'], ['sticker', 'Sticker'], ['glow', 'Glow']], e.effect || 'none', v => set(x => x.effect = v, 'Text effect'), 'wrap'),
    (e.effect && e.effect !== 'none') ? swatches(['#FFE38A', '#FFC4D6', '#BDE6FF', '#C9F2C7', '#FFFFFF', '#1F1D24'], e.effectColor || '#FFE38A', (c, live) => { updateSel(x => x.effectColor = c, 'Effect colour', live); if (!live) renderInspector(); }) : null));
  if (els.length === 1) frag.append(h('p', { class: 'muted small hint' }, 'Double-click the text (or press Enter) to edit it.'));
}
const alignIcon = a => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">${a === 'left' ? '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>' : a === 'center' ? '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>' : '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>'}</svg>`;

function notePanel(frag, els) {
  const e = els[0];
  const set = (fn, label) => { updateSel(fn, label); renderInspector(); };
  frag.append(sec('Colour', swatches(NOTE_COLORS, e.color, (c, live) => { updateSel(x => x.color = c, 'Note colour', live); if (!live) renderInspector(); })));
  frag.append(sec('Shape', shapeGrid(e.shape || 'none', v => set(x => { x.shape = v; if (SHAPES[v].square) { const s = Math.max(x.w, x.h); x.w = x.h = s; } }, 'Note shape'), Object.keys(SHAPES).filter(k => k !== 'ticket'))));
  const sz = bindSel((x, v) => x.size = v, 'Note text size');
  frag.append(sec('Writing',
    fontSelect(e.font, f => set(x => x.font = f, 'Note font')),
    row('Size', slider(e.size, 10, 60, 1, sz.live, sz.done, 'px')),
    seg([['left', alignIcon('left')], ['center', alignIcon('center')], ['right', alignIcon('right')]], e.align || 'left', v => set(x => x.align = v, 'Align'), 'mini'),
    swatches(INK_COLORS, e.textColor, (c, live) => { updateSel(x => x.textColor = c, 'Note text colour', live); if (!live) renderInspector(); }),
    toggle('Shadow', !e.noShadow, v => set(x => x.noShadow = !v, 'Note shadow'))));
  if (els.length === 1) frag.append(h('p', { class: 'muted small hint' }, 'Double-click the note to write on it.'));
}
function washiPanel(frag, els) {
  const e = els[0];
  const set = (fn, label) => { updateSel(fn, label); renderInspector(); };
  frag.append(sec('Tape', tapeGrid(e.tape, t => set(x => x.tape = clone(t), 'Change tape'))));
  frag.append(sec('Customise', tapeDesigner(e.tape, (t, live) => { updateSel(x => x.tape = clone(t), 'Customise tape', live); if (!live) renderInspector(); })));
  const th = bindSel((x, v) => { const cy = x.y + x.h / 2; x.h = v; x.y = Math.round(cy - v / 2); }, 'Tape width');
  const to = bindSel((x, v) => x.tapeOpacity = v / 100, 'Tape see-through');
  frag.append(sec('Size', row('Width', slider(e.h, 10, 90, 1, th.live, th.done, 'px')), row('See-through', slider(Math.round((e.tapeOpacity ?? .86) * 100), 30, 100, 1, to.live, to.done, '%'))));
}
function strokePanel(frag, els) {
  const e = els[0];
  frag.append(sec('Colour', swatches(INK_COLORS.concat(BRIGHT_COLORS.map(c => [c, c])), e.color, (c, live) => { updateSel(x => x.color = c, 'Drawing colour', live); if (!live) renderInspector(); })));
  const w = bindSel((x, v) => x.width = v, 'Line thickness');
  frag.append(sec('Line', e.filled ? h('p', { class: 'muted small' }, 'Drawn with pen pressure. Resize it to make it bolder or finer.') : row('Thickness', slider(e.width, 1, 40, 1, w.live, w.done, 'px')),
    seg(Object.entries(PEN_TYPES).map(([k, v]) => [k, v.name]), e.pen, v => { updateSel(x => x.pen = v, 'Pen type'); renderInspector(); }, 'wrap')));
}
