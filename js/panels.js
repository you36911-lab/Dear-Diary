/* Dear Diary — left flyout panels */
let _flyout = null;
const _flyFilter = { q: '', bookmarked: false, photos: false, song: false, mood: '', tag: '', from: '', to: '' };
let _drawerCol = 'All';

function openFlyout(name) {
  if (_flyout === name) return closeFlyout();
  _flyout = name;
  $$('#rail [data-panel]').forEach(b => b.classList.toggle('on', b.dataset.panel === name));
  renderFlyout();
  $('#flyout').classList.add('show');
  document.body.classList.add('flyout-open'); requestAnimationFrame(() => { fitStage(); refreshSelection(); });
}
function closeFlyout() {
  _flyout = null;
  $$('#rail [data-panel]').forEach(b => b.classList.remove('on'));
  $('#flyout').classList.remove('show');
  document.body.classList.remove('flyout-open'); requestAnimationFrame(() => { if (S.view === 'book') { fitStage(); refreshSelection(); } });
}
function renderFlyout() {
  const f = $('#flyout'); if (!_flyout) return;
  const sc = f.querySelector('.fly-body')?.scrollTop || 0;
  f.innerHTML = '';
  const titles = { drawer: 'Ephemera Drawer', layouts: 'Layouts', index: 'Index', history: 'History' };
  f.append(h('div', { class: 'fly-head' }, h('h2', {}, titles[_flyout]), h('button', { class: 'icon-btn', 'aria-label': 'Close panel', html: ICON.x, onclick: closeFlyout })));
  const body = h('div', { class: 'fly-body' });
  ({ drawer: drawerPanel, layouts: layoutsPanel, index: indexPanel, history: historyPanel })[_flyout](body);
  f.append(body);
  body.scrollTop = sc;
}
function refreshDrawerThumbs() { if (_flyout === 'drawer' || _flyout === 'layouts') renderFlyout(); }

/* ---------------- Ephemera Drawer ---------------- */
function drawerPanel(body) {
  const cols = ['All'].concat(S.meta.collections);
  if (!cols.includes(_drawerCol)) _drawerCol = 'All';
  const tabs = h('div', { class: 'col-tabs' });
  cols.forEach(c => tabs.append(h('button', { class: 'chip' + (c === _drawerCol ? ' on' : ''), onclick: () => { _drawerCol = c; renderFlyout(); } }, c, h('span', { class: 'count' }, String(c === 'All' ? S.drawer.length : S.drawer.filter(d => d.collection === c).length)))));
  tabs.append(h('button', { class: 'chip add', title: 'New collection', onclick: newCollection, html: ICON.plus }));
  body.append(tabs);
  if (_drawerCol !== 'All') body.append(h('div', { class: 'btn-row tight' },
    h('button', { class: 'link small', onclick: () => renameCollection(_drawerCol) }, 'Rename collection'),
    _drawerCol !== 'Unsorted' ? h('button', { class: 'link small danger', onclick: () => deleteCollection(_drawerCol) }, 'Delete collection') : null));
  body.append(h('button', { class: 'btn block', onclick: addFilesToDrawer }, h('span', { html: ICON.upload }), 'Add images to the drawer'));
  const items = S.drawer.filter(d => _drawerCol === 'All' || d.collection === _drawerCol).sort((a, b) => b.created - a.created);
  if (!items.length) {
    body.append(h('div', { class: 'empty' }, h('p', {}, 'Your saved stickers and photos live here.'), h('p', { class: 'muted small' }, 'Select an image on a page and choose “Save to drawer”, or add images straight from your computer. Then drag them onto any page.')));
    return;
  }
  const grid = h('div', { class: 'drawer-grid' });
  items.forEach(it => {
    const url = blobURL(it.blobId);
    const st = it.style || {};
    const img = h('div', { class: 'dr-img', style: { backgroundImage: url ? `url("${url}")` : 'none', filter: photoFilter(st) } });
    const m = shapeMask(st.shape); if (m) { img.style.webkitMaskImage = m; img.style.maskImage = m; img.style.webkitMaskSize = '100% 100%'; img.style.maskSize = '100% 100%'; img.style.backgroundSize = 'cover'; }
    const cell = h('div', { class: 'dr-item', draggable: 'true', tabindex: 0, title: 'Drag onto a page, or click to add' },
      h('div', { class: 'dr-fx', style: { filter: fxFilter(st) } }, img),
      h('button', { class: 'dr-menu', 'aria-label': 'Options', html: ICON.more, onclick: ev => { ev.stopPropagation(); drawerItemMenu(it, ev.currentTarget); } }));
    cell.addEventListener('dragstart', ev => { ev.dataTransfer.setData('application/x-dd-drawer', it.id); ev.dataTransfer.effectAllowed = 'copy'; });
    cell.addEventListener('click', () => insertFromDrawer(it.id, activePageObj()));
    cell.addEventListener('keydown', ev => { if (ev.key === 'Enter') insertFromDrawer(it.id, activePageObj()); });
    grid.append(cell);
  });
  body.append(grid);
}
function drawerItemMenu(it, anchor) {
  const sel = h('select', { class: 'input' }, S.meta.collections.map(c => h('option', { value: c, selected: c === it.collection }, c)));
  modal({ title: 'Drawer item', body: h('div', {}, row('Collection', sel)), actions: [
    { label: 'Delete', kind: 'danger', run: async () => { S.drawer = S.drawer.filter(x => x.id !== it.id); await DB.del('drawer', it.id); renderFlyout(); toast('Removed from the drawer'); } },
    { label: 'Save', kind: 'primary', run: async () => { it.collection = sel.value; await DB.put('drawer', it); renderFlyout(); } },
  ]});
}
async function newCollection() {
  const n = await promptBox('New collection', '', 'Collection name', 'Create');
  if (!n) return; if (S.meta.collections.includes(n)) { toast('That collection already exists.'); return; }
  S.meta.collections.push(n); await saveMeta(); _drawerCol = n; renderFlyout();
  return n;
}
async function renameCollection(c) {
  const n = await promptBox('Rename collection', c, 'Collection name'); if (!n || n === c) return;
  if (S.meta.collections.includes(n)) { toast('That name is taken.'); return; }
  S.meta.collections = S.meta.collections.map(x => x === c ? n : x);
  for (const it of S.drawer.filter(d => d.collection === c)) { it.collection = n; await DB.put('drawer', it); }
  await saveMeta(); _drawerCol = n; renderFlyout();
}
async function deleteCollection(c) {
  const ok = await confirmBox(`Delete “${c}”?`, 'Items in it move to Unsorted. Nothing is thrown away.', 'Delete collection');
  if (!ok) return;
  S.meta.collections = S.meta.collections.filter(x => x !== c);
  for (const it of S.drawer.filter(d => d.collection === c)) { it.collection = 'Unsorted'; await DB.put('drawer', it); }
  await saveMeta(); _drawerCol = 'All'; renderFlyout();
}
async function addFilesToDrawer() {
  const inp = h('input', { type: 'file', accept: 'image/*', multiple: true });
  inp.onchange = async () => {
    const col = _drawerCol === 'All' ? 'Unsorted' : _drawerCol;
    for (const f of inp.files) {
      try {
        const n = await normalizeImage(f); const id = await putBlob(n.blob);
        const it = { id: 'i' + uid(), blobId: id, nw: n.w, nh: n.h, collection: col, created: Date.now(), style: { shadow: true } };
        S.drawer.push(it); await DB.put('drawer', it);
      } catch (e) { toast(e.message); }
    }
    renderFlyout();
  };
  inp.click();
}
const DRAWER_STYLE_KEYS = ['shape', 'crop', 'border', 'shadow', 'filter', 'adjust', 'flipX', 'flipY', 'polaroid', 'caption', 'capFont', 'w', 'h'];
async function saveToDrawer(e) {
  const sel = h('select', { class: 'input' }, S.meta.collections.map(c => h('option', { value: c }, c)), h('option', { value: '__new' }, 'New collection…'));
  if (_drawerCol !== 'All' && S.meta.collections.includes(_drawerCol)) sel.value = _drawerCol;
  modal({ title: 'Save to Ephemera Drawer', body: h('div', {}, h('p', { class: 'muted small' }, 'Saves the image with its shape, border and filter so you can reuse it on any page.'), row('Collection', sel)), actions: [
    { label: 'Cancel' },
    { label: 'Save', kind: 'primary', run: async () => {
      let col = sel.value;
      if (col === '__new') { col = await newCollection(); if (!col) return; }
      const style = {}; DRAWER_STYLE_KEYS.forEach(k => { if (e[k] !== undefined) style[k] = clone(e[k]); });
      const it = { id: 'i' + uid(), blobId: e.blobId, nw: e.nw, nh: e.nh, collection: col, created: Date.now(), style };
      S.drawer.push(it); await DB.put('drawer', it);
      toast(`Saved to “${col}”`); if (_flyout === 'drawer') renderFlyout();
    } },
  ]});
}
function insertFromDrawer(id, page, at) {
  const it = S.drawer.find(d => d.id === id); if (!it || !page) { if (!page) toast('Open the diary to a page first.'); return; }
  const st = clone(it.style || {});
  let w = st.w || Math.min(220, it.nw || 220), hh = st.h || Math.round(w * (it.nh || 1) / (it.nw || 1));
  const p = at || { x: PW / 2, y: PH / 2 };
  const el = baseEl('image', Object.assign({ shape: 'none', crop: { x: 0, y: 0, w: 1, h: 1 }, border: { width: 0, color: '#FFFFFF' }, shadow: true, filter: 'none', flipX: false, flipY: false, polaroid: false, caption: '' }, st, { blobId: it.blobId, nw: it.nw, nh: it.nh, w, h: hh, x: Math.round(p.x - w / 2), y: Math.round(p.y - hh / 2) }));
  addEl(page, el, 'Add from drawer');
}

/* ---------------- Layouts ---------------- */
function layoutPreview(tpl) {
  const page = { paper: Object.assign({ type: 'dot', color: '#FFFFFF', spacing: 24 }, tpl.paper), elements: tpl.elements };
  const box = h('div', { class: 'lay-prev' });
  const pg = h('div', { class: 'lay-page' });
  const ps = paperStyle(page.paper); pg.style.background = ps.background;
  page.elements.forEach(e => pg.append(renderEl(e, { static: true })));
  box.append(pg);
  return box;
}
function layoutsPanel(body) {
  body.append(h('p', { class: 'muted small' }, 'Apply a layout to the page you last clicked, or save your own page as a reusable layout.'));
  const page = activePageObj();
  body.append(h('button', { class: 'btn block', disabled: !page, onclick: () => saveLayoutFromPage(page) }, h('span', { html: ICON.save }), 'Save current page as a layout'));
  const mine = S.meta.templates || [];
  const group = (title, list, custom) => {
    if (!list.length) return;
    body.append(h('h3', { class: 'fly-sub' }, title));
    const g = h('div', { class: 'lay-grid' });
    list.forEach(t => {
      const card = h('div', { class: 'lay-card' }, layoutPreview(t), h('div', { class: 'lay-name' }, t.name));
      const acts = h('div', { class: 'lay-acts' },
        h('button', { class: 'btn small primary', onclick: () => applyLayout(t) }, 'Use'),
        custom ? h('button', { class: 'icon-btn sm', title: 'Rename', 'aria-label': 'Rename', html: ICON.edit, onclick: async () => { const n = await promptBox('Rename layout', t.name); if (n) { t.name = n; saveMeta(); renderFlyout(); } } }) : null,
        h('button', { class: 'icon-btn sm', title: 'Duplicate', 'aria-label': 'Duplicate', html: ICON.copy, onclick: () => { const c = clone(t); c.id = 'tpl' + uid(); c.name = t.name + ' copy'; delete c.builtin; S.meta.templates.push(c); saveMeta(); renderFlyout(); toast('Copied to your layouts'); } }),
        custom ? h('button', { class: 'icon-btn sm danger', title: 'Delete', 'aria-label': 'Delete', html: ICON.trash, onclick: async () => { if (await confirmBox('Delete this layout?', `“${t.name}” will be removed from your layouts.`)) { S.meta.templates = S.meta.templates.filter(x => x.id !== t.id); saveMeta(); renderFlyout(); } } }) : null);
      card.append(acts); g.append(card);
    });
    body.append(g);
  };
  group('Your layouts', mine, true);
  group('Starter layouts', builtinTemplates(), false);
}
async function saveLayoutFromPage(page) {
  if (!page) return;
  const n = await promptBox('Save as layout', page.title || 'My layout', 'Layout name');
  if (!n) return;
  S.meta.templates = (S.meta.templates || []).concat({ id: 'tpl' + uid(), name: n, paper: clone(page.paper), elements: clone(page.elements) });
  await saveMeta(); toast(`Saved layout “${n}”`); if (_flyout === 'layouts') renderFlyout();
}
function applyLayout(t) {
  const page = activePageObj(); if (!page) { toast('Click a page first, then choose a layout.'); return; }
  const doApply = replace => {
    const els = clone(t.elements).map(e => Object.assign(e, { id: 'e' + uid() }));
    page.paper = Object.assign({}, page.paper, clone(t.paper || {}));
    page.elements = replace ? els : page.elements.concat(els);
    S.sel = []; commit('Apply layout'); renderBook(); renderInspector();
  };
  if (!page.elements.length) return doApply(true);
  modal({ title: 'This page already has things on it', body: h('p', {}, 'Replace everything with the layout, or add the layout on top?'), actions: [
    { label: 'Cancel' }, { label: 'Add on top', run: () => doApply(false) }, { label: 'Replace', kind: 'primary', run: () => doApply(true) }] });
}

/* ---------------- Index ---------------- */
function pageText(p) { const d = document.createElement('div'); return p.elements.filter(e => e.html || e.caption).map(e => { d.innerHTML = e.html || e.caption || ''; return d.textContent; }).join(' '); }
function indexPanel(body) {
  const d = S.diary, F = _flyFilter;
  body.append(toggle('Calendar pages at the front', d.settings.showCalendar, v => {
    const cur = virtualPages()[S.spread * 2 + 1] || virtualPages()[S.spread * 2];
    d.settings.showCalendar = v; commit(v ? 'Show calendar' : 'Hide calendar');
    const i = virtualPages().findIndex(p => cur && p.id === cur.id); S.spread = Math.max(0, Math.floor(i / 2));
    renderBook(); renderFlyout();
  }));
  if (d.settings.showCalendar) body.append(h('button', { class: 'link small', onclick: () => goToPage('__cal') }, 'Go to the calendar'));
  const q = h('input', { class: 'input search', type: 'search', placeholder: 'Search words, titles, tags', value: F.q });
  q.addEventListener('input', () => { F.q = q.value; drawResults(); });
  body.append(h('div', { class: 'search-wrap' }, h('span', { html: ICON.search }), q));
  const chips = h('div', { class: 'chips' });
  [['bookmarked', 'Bookmarked'], ['photos', 'Has photos'], ['song', 'Has a song']].forEach(([k, l]) => chips.append(h('button', { class: 'chip' + (F[k] ? ' on' : ''), onclick: () => { F[k] = !F[k]; renderFlyout(); } }, l)));
  body.append(chips);
  const allTags = [...new Set(d.pages.flatMap(p => p.tags || []))].sort();
  const tagSel = h('select', { class: 'input' }, h('option', { value: '' }, 'Any tag'), allTags.map(t => h('option', { value: t, selected: F.tag === t }, '#' + t)));
  tagSel.addEventListener('change', () => { F.tag = tagSel.value; drawResults(); });
  const moodSel = h('select', { class: 'input' }, h('option', { value: '' }, 'Any mood'), MOODS.map(([e, n]) => h('option', { value: e, selected: F.mood === e }, `${e} ${n}`)));
  moodSel.addEventListener('change', () => { F.mood = moodSel.value; drawResults(); });
  const from = h('input', { class: 'input', type: 'date', value: F.from, 'aria-label': 'From date' }), to = h('input', { class: 'input', type: 'date', value: F.to, 'aria-label': 'To date' });
  from.addEventListener('change', () => { F.from = from.value; drawResults(); }); to.addEventListener('change', () => { F.to = to.value; drawResults(); });
  body.append(h('div', { class: 'filter-grid' }, tagSel, moodSel, h('label', {}, 'From', from), h('label', {}, 'To', to)));
  const res = h('div', { class: 'index-list' }); body.append(res);
  function drawResults() {
    res.innerHTML = '';
    const openIds = new Set(S.closed ? [] : visiblePages().map(p => p.id));
    const ql = F.q.trim().toLowerCase();
    const list = d.pages.map((p, i) => ({ p, i })).filter(({ p }) =>
      (!F.bookmarked || p.bookmarked) && (!F.photos || p.elements.some(e => e.type === 'image')) && (!F.song || p.music) &&
      (!F.tag || (p.tags || []).includes(F.tag)) && (!F.mood || p.mood === F.mood) &&
      (!F.from || p.date >= F.from) && (!F.to || p.date <= F.to) &&
      (!ql || (p.title + ' ' + (p.tags || []).join(' ') + ' ' + pageText(p)).toLowerCase().includes(ql)));
    const filtered = ql || F.bookmarked || F.photos || F.song || F.tag || F.mood || F.from || F.to;
    res.append(h('p', { class: 'muted small' }, filtered ? `${list.length} of ${d.pages.length} pages` : `${d.pages.length} pages, in book order`));
    let lastMonth = '';
    list.forEach(({ p, i }) => {
      const m = p.date ? new Date(p.date + 'T12:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : 'No date';
      if (m !== lastMonth) { res.append(h('h4', { class: 'index-month' }, m)); lastMonth = m; }
      res.append(h('button', { class: 'index-row' + (openIds.has(p.id) ? ' on' : ''), onclick: () => goToPage(p.id) },
        h('span', { class: 'ix-num' }, String(i + 1)),
        h('span', { class: 'ix-main' }, h('span', { class: 'ix-title' }, p.title || firstText(p) || 'Untitled page'), h('span', { class: 'ix-date' }, fmtDate(p.date) + ((p.tags || []).length ? '  ' + p.tags.map(t => '#' + t).join(' ') : ''))),
        h('span', { class: 'ix-icons' }, (p.mood || ''), p.bookmarked ? h('span', { class: 'ix-bm', html: ICON.bookmark }) : null, p.music ? h('span', { html: ICON.music }) : null)));
    });
    if (!list.length) res.append(h('div', { class: 'empty' }, h('p', {}, 'No pages match.'), h('button', { class: 'link', onclick: () => { Object.assign(F, { q: '', bookmarked: false, photos: false, song: false, mood: '', tag: '', from: '', to: '' }); renderFlyout(); } }, 'Clear filters')));
  }
  drawResults();
  requestAnimationFrame(() => { const on = res.querySelector('.index-row.on'); if (on) on.scrollIntoView({ block: 'nearest' }); });
}

/* ---------------- History ---------------- */
function historyPanel(body) {
  body.append(h('p', { class: 'muted small' }, 'Click any step to go back to it. Undo: Ctrl + Z · Redo: Ctrl + Shift + Z'));
  const list = h('div', { class: 'hist-list' });
  H.stack.map((s, i) => ({ s, i })).reverse().forEach(({ s, i }) => {
    list.append(h('button', { class: 'hist-row' + (i === H.idx ? ' on' : '') + (i > H.idx ? ' future' : ''), onclick: () => { restoreSnap(i); renderFlyout(); } },
      h('span', {}, s.label), h('span', { class: 'muted small' }, relTime(s.time))));
  });
  body.append(list);
}
function relTime(t) { const s = Math.round((Date.now() - t) / 1000); if (s < 10) return 'just now'; if (s < 60) return s + 's ago'; if (s < 3600) return Math.round(s / 60) + 'm ago'; return new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
