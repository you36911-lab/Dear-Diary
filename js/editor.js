/* Dear Diary — editing interactions */
let _clip = null; // internal clipboard of elements

function pagePoint(ev, pageDiv) {
  const r = pageDiv.getBoundingClientRect();
  return { x: (ev.clientX - r.left) / r.width * PW, y: (ev.clientY - r.top) / r.height * PH };
}
const activePageObj = () => {
  const vis = visiblePages();
  return vis.find(p => p.id === S.activePage) || vis[vis.length - 1] || null;
};
function visiblePages() {
  const vp = virtualPages();
  return [vp[S.spread * 2], vp[S.spread * 2 + 1]].filter(p => p && !p.virtual);
}
function groupOf(page, id) { const e = findEl(page, id); if (!e || !e.group) return [id]; return page.elements.filter(x => x.group === e.group).map(x => x.id); }
function expandGroups(page, ids) { return [...new Set(ids.flatMap(id => groupOf(page, id)))]; }
function remapCopies(els, dx = 0, dy = 0) {
  const gm = {};
  return els.map(e => { const c = clone(e); c.id = 'e' + uid(); c.x += dx; c.y += dy; c.locked = false; if (c.group) c.group = gm[c.group] || (gm[c.group] = 'g' + uid()); return c; });
}
function selBBox(els) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  els.forEach(e => {
    const r = (e.rot || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => { const dx = a * e.w / 2, dy = b * e.h / 2, px = cx + dx * c - dy * s, py = cy + dx * s + dy * c; x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); });
  });
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
function groupSel() {
  const els = selEls(); if (els.length < 2) { toast('Select two or more things to group.'); return; }
  const g = 'g' + uid(); els.forEach(e => e.group = g);
  commit('Group'); refreshSelection(); renderInspector(); toast('Grouped — they now move together.');
}
function ungroupSel() {
  const els = selEls(); if (!els.some(e => e.group)) return;
  els.forEach(e => delete e.group); commit('Ungroup'); refreshSelection(); renderInspector(); toast('Ungrouped');
}
function selEls() { const p = findPage(S.selPage); return p ? S.sel.map(id => findEl(p, id)).filter(Boolean) : []; }

function setTool(t) {
  if (S.editing) finishEditing();
  S.tool = t;
  $$('#rail [data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  const st = $('#stage'); if (st) st.dataset.tool = t;
  if (t !== 'select') { S.sel = []; refreshSelection(); }
  renderInspector();
}
function select(ids, pageId) { S.sel = ids; S.selPage = pageId; refreshSelection(); renderInspector(); }
function clearSelection() { if (S.editing) finishEditing(); if (!S.sel.length) return; S.sel = []; refreshSelection(); renderInspector(); }
function setActivePage(id) {
  if (S.activePage === id) return;
  S.activePage = id;
  $$('#book .page[data-page-id]').forEach(p => p.classList.toggle('active', p.dataset.pageId === id));
  if (!S.sel.length) renderInspector();
  updateNav();
}

/* ---------------- Pointer handling ---------------- */
function initEditor() {
  const host = $('#bookHost');
  host.addEventListener('pointerdown', onPointerDown);
  host.addEventListener('dblclick', onDblClick);
  $('#stage').addEventListener('pointerdown', e => { if (e.target.id === 'stage' || e.target.id === 'stageInner') clearSelection(); });
  document.addEventListener('keydown', onKey);
  document.addEventListener('paste', onPaste);
  const st = $('#stage');
  st.addEventListener('dragover', e => { if (S.closed) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; st.classList.add('drop-hover'); });
  st.addEventListener('dragleave', e => { if (e.target === st) st.classList.remove('drop-hover'); });
  st.addEventListener('drop', onDrop);
  // while the window is being resized (or leaves full screen), switch off panel slide animations
  // so panels jump straight to their new place instead of sweeping across the screen
  let _rzT = null;
  window.addEventListener('resize', () => {
    document.documentElement.classList.add('resizing');
    clearTimeout(_rzT); _rzT = setTimeout(() => document.documentElement.classList.remove('resizing'), 250);
    if (S.view === 'book') { fitStage(); refreshSelection(); }
  });
}

function onPointerDown(ev) {
  if (S.closed || _flipping || ev.button > 0) return;
  const pageDiv = ev.target.closest('.page[data-page-id]');
  if (!pageDiv) return;
  const page = findPage(pageDiv.dataset.pageId);
  setActivePage(page.id);
  if (S.editing) {
    if (ev.target.closest(`.el[data-id="${S.editing}"] .txt`)) return;
    finishEditing();
  }
  const p = pagePoint(ev, pageDiv);
  if (S.tool === 'pen') return startStroke(ev, pageDiv, page, p);
  if (S.tool === 'eraser') return startErase(ev, pageDiv, page);
  if (S.tool === 'washi') return startWashi(ev, pageDiv, page, p);
  if (S.tool === 'text') { ev.preventDefault(); setTool('select'); addText(page, p); return; }
  if (S.tool === 'note') { ev.preventDefault(); setTool('select'); addNote(page, p); return; }

  const handle = ev.target.closest('.handle');
  if (handle && handle.dataset.handle === 'grot') { ev.preventDefault(); return startGroupRotate(ev, pageDiv, page); }
  if (handle) { ev.preventDefault(); return handle.dataset.handle.startsWith('g') ? startGroupScale(ev, pageDiv, page, handle.dataset.handle.slice(1)) : startTransform(ev, pageDiv, page, handle.dataset.handle); }
  const elDiv = ev.target.closest('.el');
  if (elDiv) {
    ev.preventDefault();
    const id = elDiv.dataset.id;
    if (S.selPage !== page.id) { S.sel = []; S.selPage = page.id; }
    const grp = groupOf(page, id);
    if (ev.shiftKey) {
      S.sel = S.sel.includes(id) ? S.sel.filter(x => !grp.includes(x)) : [...new Set(S.sel.concat(grp))];
      refreshSelection(); renderInspector(); return;
    }
    if (!S.sel.includes(id)) S.sel = grp;
    let dup = false;
    if ((ev.ctrlKey || ev.metaKey || ev.altKey) && selEls().some(e => !e.locked)) {
      const copies = remapCopies(selEls().filter(e => !e.locked));
      page.elements.push(...copies); S.sel = copies.map(c => c.id); dup = true;
      rerenderPageDOM(page.id);
    }
    refreshSelection(); renderInspector();
    return startMove(ev, pageDiv, page, p, dup);
  }
  // empty paper
  ev.preventDefault();
  if (!ev.shiftKey) { S.sel = []; S.selPage = page.id; refreshSelection(); renderInspector(); }
  startMarquee(ev, pageDiv, page, p);
}

function dragLoop(onMove, onUp) {
  _dragging = true;
  const mv = e => onMove(e);
  const up = e => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); _dragging = false; onUp(e); };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
}

function pageUnder(ev) {
  for (const n of document.elementsFromPoint(ev.clientX, ev.clientY)) { const pd = n.closest && n.closest('#book .spread .page[data-page-id]'); if (pd) return pd; }
  return null;
}
function startMove(ev, pageDiv, page, p0, dup) {
  const els = selEls().filter(e => !e.locked);
  if (!els.length) return;
  const start = els.map(e => ({ e, x: e.x, y: e.y }));
  let moved = false, crossed = false;
  dragLoop(e => {
    // carry the selection over the spine onto the facing page
    const over = pageUnder(e);
    if (over && over.dataset.pageId !== page.id) {
      const target = findPage(over.dataset.pageId);
      const shift = pageDiv.classList.contains('page-left') ? -PW : PW;
      const ids = new Set(els.map(x => x.id));
      page.elements = page.elements.filter(x => !ids.has(x.id));
      target.elements.push(...els);
      start.forEach(s => { s.x += shift; s.e.x += shift; });
      p0 = { x: p0.x + shift, y: p0.y };
      const from = page.id; page = target; S.selPage = target.id; S.sel = els.map(x => x.id); S.activePage = target.id;
      rerenderPageDOM(from); rerenderPageDOM(target.id);
      pageDiv = $(`#book .page[data-page-id="${target.id}"]`); crossed = true;
    }
    const p = pagePoint(e, pageDiv);
    let dx = p.x - p0.x, dy = p.y - p0.y;
    if (!moved && Math.hypot(dx, dy) < 2) return;
    moved = true;
    if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
    start.forEach(s => {
      s.e.x = Math.round(s.x + dx); s.e.y = Math.round(s.y + dy);
      const d = pageDiv.querySelector(`.el[data-id="${s.e.id}"]`); if (d) posEl(d, s.e);
    });
    renderSelection(pageDiv);
  }, () => { if (moved || dup) commit(crossed ? 'Move to other page' : dup ? 'Duplicate' : 'Move'); if (crossed) renderInspector(); });
}

function startMarquee(ev, pageDiv, page, p0) {
  const layer = pageDiv.querySelector('.sel-layer');
  const box = h('div', { class: 'marquee' }); layer.append(box);
  const base = ev.shiftKey ? S.sel.slice() : [];
  dragLoop(e => {
    const p = pagePoint(e, pageDiv);
    const x = Math.min(p.x, p0.x), y = Math.min(p.y, p0.y), w = Math.abs(p.x - p0.x), hh = Math.abs(p.y - p0.y);
    Object.assign(box.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: hh + 'px' });
    if (w < 3 && hh < 3) return;
    const hit = page.elements.filter(el => !el.locked && !el.hidden && el.x < x + w && el.x + el.w > x && el.y < y + hh && el.y + el.h > y).map(el => el.id);
    S.sel = expandGroups(page, base.concat(hit)); S.selPage = page.id;
    renderSelection(pageDiv); layer.append(box);
  }, () => { box.remove(); renderSelection(pageDiv); renderInspector(); });
}

function startTransform(ev, pageDiv, page, k) {
  const e = selEls()[0]; if (!e || e.locked) return;
  const e0 = clone(e);
  const rad = (e0.rot || 0) * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
  const c0 = { x: e0.x + e0.w / 2, y: e0.y + e0.h / 2 };
  const div = () => pageDiv.querySelector(`.el[data-id="${e.id}"]`);
  if (k === 'rot') {
    dragLoop(m => {
      const p = pagePoint(m, pageDiv);
      let a = Math.atan2(p.y - c0.y, p.x - c0.x) * 180 / Math.PI + 90;
      if (m.shiftKey) a = Math.round(a / 15) * 15;
      else for (const s of [0, 90, 180, -90, 270]) if (Math.abs(a - s) < 3) a = s;
      e.rot = Math.round(((a + 540) % 360 - 180) * 10) / 10;
      posEl(div(), e); renderSelection(pageDiv);
    }, () => { commit('Rotate'); renderInspector(); });
    return;
  }
  const hx = k.includes('e') ? 1 : k.includes('w') ? -1 : 0, hy = k.includes('s') ? 1 : k.includes('n') ? -1 : 0;
  const R = (x, y) => ({ x: x * cos - y * sin, y: x * sin + y * cos });
  const al = R(-hx * e0.w / 2, -hy * e0.h / 2);
  const anchor = { x: c0.x + al.x, y: c0.y + al.y };
  const corner = hx && hy;
  dragLoop(m => {
    const p = pagePoint(m, pageDiv);
    const dx = p.x - anchor.x, dy = p.y - anchor.y;
    const v = { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
    let w = hx ? Math.max(12, hx * v.x) : e0.w, hh = hy ? Math.max(12, hy * v.y) : e0.h;
    const keep = corner && (e.type === 'image' || e.type === 'stroke' || e.type === 'text' ? !m.shiftKey : m.shiftKey);
    if (keep) { const s = Math.max(w / e0.w, hh / e0.h); w = e0.w * s; hh = e0.h * s; }
    if (e.type === 'image' && SHAPES[e.shape] && SHAPES[e.shape].square && corner) { const s = Math.max(w, hh); w = hh = s; }
    // anchor is the opposite corner/edge-midpoint; new center = anchor + rotated half-size
    const off = R(hx ? hx * w / 2 : 0, hy ? hy * hh / 2 : 0);
    e.w = Math.round(w); e.h = Math.round(hh);
    e.x = Math.round(anchor.x + off.x - w / 2);
    e.y = Math.round(anchor.y + off.y - hh / 2);
    if (e.type === 'text' && corner) e.size = Math.max(6, Math.round(e0.size * (w / e0.w) * 10) / 10);
    const d = div();
    if (e.type === 'text' && corner) { const n = renderEl(e); d.replaceWith(n); } else posEl(d, e);
    renderSelection(pageDiv);
  }, () => { commit('Resize'); renderInspector(); });
}

function startGroupScale(ev, pageDiv, page, k) {
  const els = selEls().filter(e => !e.locked); if (!els.length) return;
  const orig = els.map(e => clone(e)), bb = selBBox(els);
  const hx = k.includes('e') ? 1 : -1, hy = k.includes('s') ? 1 : -1;
  const anchor = { x: hx > 0 ? bb.x : bb.x + bb.w, y: hy > 0 ? bb.y : bb.y + bb.h };
  const dd = bb.w * bb.w + bb.h * bb.h;
  dragLoop(m => {
    const pd = $(`#book .page[data-page-id="${page.id}"]`) || pageDiv;
    const p = pagePoint(m, pd);
    const s = Math.max(.08, ((p.x - anchor.x) * hx * bb.w + (p.y - anchor.y) * hy * bb.h) / dd);
    els.forEach((e, i) => {
      const o = orig[i], cx = anchor.x + (o.x + o.w / 2 - anchor.x) * s, cy = anchor.y + (o.y + o.h / 2 - anchor.y) * s;
      e.w = Math.round(o.w * s); e.h = Math.round(o.h * s); e.x = Math.round(cx - e.w / 2); e.y = Math.round(cy - e.h / 2);
      if (o.size) e.size = Math.max(6, Math.round(o.size * s * 10) / 10);
      if (o.border && o.border.width) e.border = Object.assign({}, o.border, { width: Math.round(o.border.width * s * 10) / 10 });
    });
    rerenderPageDOM(page.id);
  }, () => { commit('Resize'); renderInspector(); });
}

function startGroupRotate(ev, pageDiv, page) {
  const els = selEls().filter(e => !e.locked); if (!els.length) return;
  const orig = els.map(e => clone(e)), bb = selBBox(els), c = { x: bb.x + bb.w / 2, y: bb.y + bb.h / 2 };
  const p0 = pagePoint(ev, pageDiv), a0 = Math.atan2(p0.y - c.y, p0.x - c.x);
  dragLoop(m => {
    const pd = $(`#book .page[data-page-id="${page.id}"]`) || pageDiv, p = pagePoint(m, pd);
    let d = (Math.atan2(p.y - c.y, p.x - c.x) - a0) * 180 / Math.PI;
    if (m.shiftKey) d = Math.round(d / 15) * 15;
    const r = d * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r);
    els.forEach((e, i) => {
      const o = orig[i], ox = o.x + o.w / 2 - c.x, oy = o.y + o.h / 2 - c.y;
      e.x = Math.round(c.x + ox * cs - oy * sn - o.w / 2); e.y = Math.round(c.y + ox * sn + oy * cs - o.h / 2);
      e.rot = Math.round((((o.rot || 0) + d + 540) % 360 - 180) * 10) / 10;
    });
    rerenderPageDOM(page.id);
  }, () => { commit('Rotate together'); renderInspector(); });
}
function flipSel(axis) {
  const els = selEls().filter(e => !e.locked); if (!els.length) return;
  const bb = selBBox(els), cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2;
  els.forEach(e => {
    if (els.length > 1) {
      if (axis === 'h') e.x = Math.round(2 * cx - (e.x + e.w / 2) - e.w / 2); else e.y = Math.round(2 * cy - (e.y + e.h / 2) - e.h / 2);
      e.rot = -(e.rot || 0);
    }
    if (e.type === 'image' || e.type === 'stroke') { if (axis === 'h') e.flipX = !e.flipX; else e.flipY = !e.flipY; }
  });
  rerenderPageDOM(S.selPage); commit(axis === 'h' ? 'Flip' : 'Flip vertical'); renderInspector();
}
function hideSel() {
  if (S.editing) finishEditing();
  const els = selEls(); if (!els.length) return;
  els.forEach(e => e.hidden = true); S.sel = [];
  rerenderPageDOM(S.selPage); commit(els.length > 1 ? `Hide ${els.length} items` : 'Hide'); renderInspector();
  toast('Hidden. Show it again from the page panel.');
}
function showHidden(pageId, id) {
  const p = findPage(pageId); if (!p) return;
  p.elements.forEach(e => { if (!id || e.id === id) delete e.hidden; });
  rerenderPageDOM(pageId); commit('Show hidden'); renderInspector();
}

/* ---------------- Text / note editing ---------------- */
function onDblClick(ev) {
  if (S.closed || S.tool !== 'select') return;
  const elDiv = ev.target.closest('.el-text, .el-note'); if (!elDiv) return;
  const pageDiv = elDiv.closest('.page[data-page-id]');
  const e = findEl(findPage(pageDiv.dataset.pageId), elDiv.dataset.id);
  if (e && !e.locked) startEditing(e.id, pageDiv.dataset.pageId);
}
function startEditing(id, pageId, selectAll = false) {
  S.sel = [id]; S.selPage = pageId; S.editing = id;
  const div = $(`#book .page[data-page-id="${pageId}"] .el[data-id="${id}"] .txt`); if (!div) return;
  div.contentEditable = 'true'; div.spellcheck = false;
  div.closest('.el').classList.add('editing');
  div.focus();
  const r = document.createRange(); r.selectNodeContents(div); if (!selectAll) r.collapse(false);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  div.addEventListener('paste', plainPaste);
  div.addEventListener('input', () => { if (findEl(findPage(pageId), id)?.type === 'text') growText(div, findEl(findPage(pageId), id), pageId); });
  refreshSelection(); renderInspector();
}
function plainPaste(e) {
  e.preventDefault(); e.stopPropagation();
  const t = (e.clipboardData || window.clipboardData).getData('text/plain');
  document.execCommand('insertText', false, t);
}
function growText(div, e, pageId) {
  const need = Math.ceil(div.scrollHeight);
  if (need > e.h) { e.h = need; const el = div.closest('.el'); el.style.height = need + 'px'; const pd = $(`#book .page[data-page-id="${pageId}"]`); pd && renderSelection(pd); }
}
function finishEditing() {
  const id = S.editing; if (!id) return;
  S.editing = null;
  const page = findPage(S.selPage), e = findEl(page, id);
  const div = $(`#book .el[data-id="${id}"] .txt`);
  if (e && div) {
    div.contentEditable = 'false';
    let html = div.innerHTML.replace(/<div>/g, '<br>').replace(/<\/div>/g, '').replace(/^<br>/, '');
    e.html = html;
    if (e.type === 'text' && !div.textContent.trim()) { page.elements = page.elements.filter(x => x.id !== id); S.sel = []; }
    else if (e.type === 'text') e.h = Math.max(e.h, Math.ceil(div.scrollHeight));
  }
  commit('Edit text');
  rerenderPageDOM(S.selPage); renderInspector();
}

/* ---------------- Creating elements ---------------- */
function baseEl(type, o) { return Object.assign({ id: 'e' + uid(), type, x: 0, y: 0, w: 100, h: 100, rot: 0, opacity: 1, locked: false }, o); }
function addEl(page, el, label, edit = false) {
  page.elements.push(el);
  S.sel = [el.id]; S.selPage = page.id; S.activePage = page.id;
  rerenderPageDOM(page.id);
  commit(label);
  if (edit) startEditing(el.id, page.id, true); else renderInspector();
  return el;
}
function addText(page, p) {
  const o = S.toolOpts.text;
  const el = baseEl('text', { x: Math.round(p.x - 10), y: Math.round(p.y - o.size * .7), w: 260, h: Math.round(o.size * 1.4), html: 'Write something', font: o.font, size: o.size, color: o.color, align: 'left', lineHeight: 1.3, letterSpacing: 0, bold: false, italic: false, underline: false, effect: 'none', effectColor: '#FFE38A' });
  addEl(page, el, 'Add text', true);
}
function addNote(page, p) {
  const o = S.toolOpts.note;
  const el = baseEl('note', { x: Math.round(p.x - 80), y: Math.round(p.y - 80), w: 170, h: 170, rot: Math.round((Math.random() * 6 - 3) * 10) / 10, color: o.color, shape: o.shape, html: '', font: 'Patrick Hand', size: 20, textColor: '#1F1D24', align: 'left' });
  addEl(page, el, 'Add sticky note', true);
}

/* Pen */
function smoothPath(pts) {
  if (pts.length < 2) { const p = pts[0]; return `M${p.x.toFixed(1)} ${p.y.toFixed(1)} l0.1 0`; }
  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  const l = pts[pts.length - 1]; d += ` L${l.x.toFixed(1)} ${l.y.toFixed(1)}`;
  return d;
}
function outlinePath(pts, width) {
  const n = pts.length, pr = pts.map((p, i) => { let s = 0, c = 0; for (let j = Math.max(0, i - 2); j <= Math.min(n - 1, i + 2); j++) { s += pts[j].p; c++; } return s / c; });
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b.x - a.x, ty = b.y - a.y; const len = Math.hypot(tx, ty) || 1; tx /= len; ty /= len;
    const taper = Math.min(1, (i + 1) / 4, (n - i) / 4);
    const w = Math.max(.35, width * (.25 + 1.25 * pr[i]) / 2 * (.55 + .45 * taper));
    L.push({ x: pts[i].x - ty * w, y: pts[i].y + tx * w }); R.push({ x: pts[i].x + ty * w, y: pts[i].y - tx * w });
  }
  const poly = L.concat(R.reverse());
  let d = `M${poly[0].x.toFixed(1)} ${poly[0].y.toFixed(1)}`;
  for (let i = 1; i < poly.length; i++) { const c = poly[i], nx = poly[(i + 1) % poly.length]; d += ` Q${c.x.toFixed(1)} ${c.y.toFixed(1)} ${((c.x + nx.x) / 2).toFixed(1)} ${((c.y + nx.y) / 2).toFixed(1)}`; }
  return d + 'Z';
}
function startStroke(ev, pageDiv, page, p0) {
  ev.preventDefault();
  const o = S.toolOpts.pen, pt = PEN_TYPES[o.type];
  const usePressure = ev.pointerType === 'pen' && o.pressure !== false && o.type !== 'highlighter';
  p0.p = ev.pressure || .5;
  const pts = [p0];
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'live-stroke'); svg.setAttribute('viewBox', `0 0 ${PW} ${PH}`);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  Object.entries({ fill: 'none', stroke: o.color, 'stroke-width': o.width, 'stroke-linecap': pt.cap, 'stroke-linejoin': 'round', opacity: pt.opacity }).forEach(([k, v]) => path.setAttribute(k, v));
  svg.append(path); pageDiv.querySelector('.els').append(svg);
  if (pt.blend) svg.style.mixBlendMode = pt.blend;
  dragLoop(e => {
    const co = e.getCoalescedEvents ? e.getCoalescedEvents() : [], evs = co.length ? co : [e];
    for (const ce of evs) { const p = pagePoint(ce, pageDiv); p.p = ce.pressure || .5; const l = pts[pts.length - 1]; if (Math.hypot(p.x - l.x, p.y - l.y) > 1.2) pts.push(p); }
    if (usePressure && pts.length > 2) { path.setAttribute('d', outlinePath(pts, o.width)); path.setAttribute('fill', o.color); path.setAttribute('stroke', 'none'); }
    else path.setAttribute('d', smoothPath(pts));
  }, () => {
    svg.remove();
    const filled = usePressure && pts.length > 2;
    const pad = o.width * (filled ? 1.6 : 1);
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad, x1 = Math.max(...xs) + pad, y1 = Math.max(...ys) + pad;
    const vw = Math.max(1, x1 - x0), vh = Math.max(1, y1 - y0);
    const rel = pts.map(p => ({ x: p.x - x0, y: p.y - y0, p: p.p }));
    const d = filled ? outlinePath(rel, o.width) : smoothPath(rel);
    const el = baseEl('stroke', { x: Math.round(x0 * 10) / 10, y: Math.round(y0 * 10) / 10, w: Math.round(vw * 10) / 10, h: Math.round(vh * 10) / 10, vw, vh, d, color: o.color, width: o.width, pen: o.type, filled });
    page.elements.push(el);
    rerenderPageDOM(page.id);
    commit('Draw');
  });
}
function startErase(ev, pageDiv, page) {
  ev.preventDefault();
  let changed = false;
  const r = S.toolOpts.eraser.size / 2;
  const hitAt = e => {
    const sc = S.scale || 1, rr = r * sc, pts = [[0, 0], [rr, 0], [-rr, 0], [0, rr], [0, -rr]];
    for (const [dx, dy] of pts) for (const n of document.elementsFromPoint(e.clientX + dx, e.clientY + dy)) {
      if (n.tagName === 'path') {
        const elDiv = n.closest('.el-stroke');
        if (elDiv && pageDiv.contains(elDiv)) {
          const id = elDiv.dataset.id, el = findEl(page, id);
          if (el && !el.locked) { page.elements = page.elements.filter(x => x.id !== id); elDiv.remove(); changed = true; }
        }
      }
    }
  };
  hitAt(ev);
  dragLoop(hitAt, () => { if (changed) { commit('Erase'); rerenderPageDOM(page.id); } });
}
function startWashi(ev, pageDiv, page, p0) {
  ev.preventDefault();
  const o = S.toolOpts.washi;
  const tmp = baseEl('washi', { id: 'tmpwashi', tape: clone(o.tape), h: o.width });
  let div = null, made = false;
  const place = p => {
    const L = Math.hypot(p.x - p0.x, p.y - p0.y), a = Math.atan2(p.y - p0.y, p.x - p0.x) * 180 / Math.PI;
    tmp.w = Math.max(10, L); tmp.rot = Math.round(a * 10) / 10;
    tmp.x = (p0.x + p.x) / 2 - tmp.w / 2; tmp.y = (p0.y + p.y) / 2 - tmp.h / 2;
  };
  dragLoop(e => {
    let p = pagePoint(e, pageDiv);
    if (e.shiftKey) { const a = Math.round(Math.atan2(p.y - p0.y, p.x - p0.x) / (Math.PI / 12)) * Math.PI / 12, L = Math.hypot(p.x - p0.x, p.y - p0.y); p = { x: p0.x + L * Math.cos(a), y: p0.y + L * Math.sin(a) }; }
    place(p); made = tmp.w > 14;
    const n = renderEl(tmp); if (div) div.replaceWith(n); else pageDiv.querySelector('.els').append(n); div = n;
  }, () => {
    div && div.remove();
    if (!made) { toast('Drag across the page to lay down tape.'); return; }
    const el = Object.assign(clone(tmp), { id: 'e' + uid(), x: Math.round(tmp.x), y: Math.round(tmp.y), w: Math.round(tmp.w) });
    page.elements.push(el); S.selPage = page.id;
    rerenderPageDOM(page.id); commit('Add washi tape');
  });
}

/* Images */
async function normalizeImage(blob, max = 2200) {
  try {
    const url = URL.createObjectURL(blob); const img = await loadImage(url); URL.revokeObjectURL(url);
    const big = Math.max(img.naturalWidth, img.naturalHeight);
    if (big <= max && blob.size < 1.5e6 && blob.type !== 'image/heic') return { blob, w: img.naturalWidth, h: img.naturalHeight };
    const s = Math.min(1, max / big), c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const out = await new Promise(r => c.toBlob(r, 'image/webp', .9));
    return { blob: out || blob, w: c.width, h: c.height };
  } catch (e) { throw new Error('This file is not an image the browser can read.'); }
}
async function insertImageBlob(blob, page, at, style = {}) {
  if (!page) { toast('Open the diary to a page first.'); return; }
  let step = 'reading the image';
  const watch = setTimeout(() => toast(`Adding the photo is taking long (stuck at: ${step}). Try reloading the page.`, 7000), 8000);
  try {
    const n = await normalizeImage(blob);
    step = 'saving the image';
    const id = await putBlob(n.blob);
    step = 'placing it on the page';
    return placeImage(n, id, page, at, style);
  } finally { clearTimeout(watch); }
}
function placeImage(n, id, page, at, style) {
  const maxW = style.w || 240, w = Math.min(maxW, n.w), hh = Math.round(w * n.h / n.w);
  const p = at || { x: PW / 2, y: PH / 2 };
  const el = baseEl('image', Object.assign({ blobId: id, nw: n.w, nh: n.h, x: Math.round(p.x - w / 2), y: Math.round(p.y - hh / 2), w, h: hh, shape: 'none', crop: { x: 0, y: 0, w: 1, h: 1 }, border: { width: 0, color: '#FFFFFF' }, shadow: true, filter: 'none', flipX: false, flipY: false, polaroid: false, caption: '' }, style, { w, h: style.h ? Math.round(w * style.h / style.w) : hh }));
  addEl(page, el, 'Add image');
  if (!$(`#book .spread .el[data-id="${el.id}"]`)) {
    const n2 = pageNumber(page);
    toast(n2 > 0 ? `The photo was added to page ${n2}.` : 'The photo was added.', 4000);
  }
  return el;
}
function imageErrorText(e, f) {
  if (e && (e.name === 'QuotaExceededError' || /quota/i.test(e.message || ''))) return 'Your browser storage is full. Back up, then delete unused diaries or drawer items to make room.';
  if (f && /hei[cf]/i.test(f.type + f.name)) return 'HEIC photos (iPhone) can\'t be read by this browser. Export the photo as JPG first.';
  return (e && e.message) ? `Couldn't add the image: ${e.message}` : "Couldn't add the image.";
}
async function insertImageFiles(files, page, at) {
  let i = 0;
  for (const f of files) {
    if (!(f.type || '').startsWith('image/') && !/\.(jpe?g|png|gif|webp|avif|bmp|svg)$/i.test(f.name || '')) { toast(`“${f.name}” isn't an image file.`); continue; }
    try { await insertImageBlob(f, page, at && { x: at.x + i * 24, y: at.y + i * 24 }); i++; }
    catch (e) { console.error(e); ErrLog.push('insert: ' + (e && e.message)); toast(imageErrorText(e, f), 6000); }
  }
}
function pickImages() {
  const inp = h('input', { type: 'file', accept: 'image/*', multiple: true, style: { position: 'fixed', left: '-9999px' } });
  document.body.append(inp);
  inp.onchange = () => { const files = [...inp.files]; inp.remove(); if (!files.length) return; const page = activePageObj(); if (!page) { toast('Open the diary to a page first.'); return; } insertImageFiles(files, page); };
  inp.click();
}
async function fetchImageURL(url) {
  const r = await fetch(url, { mode: 'cors' });
  if (!r.ok) throw new Error('status ' + r.status);
  const b = await r.blob();
  if (!b.type.startsWith('image/')) throw new Error('not image');
  return b;
}
async function onDrop(ev) {
  ev.preventDefault(); $('#stage').classList.remove('drop-hover');
  if (S.closed) return;
  const pageDiv = document.elementsFromPoint(ev.clientX, ev.clientY).map(n => n.closest && n.closest('.page[data-page-id]')).find(Boolean);
  const page = pageDiv ? findPage(pageDiv.dataset.pageId) : activePageObj();
  const at = pageDiv ? pagePoint(ev, pageDiv) : null;
  const dt = ev.dataTransfer;
  const drawerId = dt.getData('application/x-dd-drawer');
  if (drawerId) return insertFromDrawer(drawerId, page, at);
  const tapeIdx = dt.getData('application/x-dd-washi');
  if (tapeIdx) return;
  if (dt.files && dt.files.length) return insertImageFiles([...dt.files], page, at);
  let url = '';
  const html = dt.getData('text/html');
  if (html) { const m = html.match(/<img[^>]+src="([^"]+)"/i); if (m) url = m[1].replace(/&amp;/g, '&'); }
  if (!url) url = (dt.getData('text/uri-list') || dt.getData('text/plain') || '').split('\n')[0].trim();
  if (!url) return;
  if (url.startsWith('data:image')) return insertImageBlob(await dataURLToBlob(url), page, at);
  if (!/^https?:/.test(url)) return;
  // Pinterest serves thumbnails; try the larger original first
  const tries = [url.replace(/\/(236x|474x|564x|736x)\//, '/originals/'), url.replace(/\/(236x|474x)\//, '/736x/'), url].filter((u, i, a) => a.indexOf(u) === i);
  for (const u of tries) {
    try { const b = await fetchImageURL(u); return insertImageBlob(b, page, at); } catch (e) { /* try next */ }
  }
  modal({ title: "That site didn't let the image through", body: h('div', { class: 'prose' },
    h('p', {}, 'Some websites block other pages from reading their images directly.'),
    h('p', {}, 'Try this instead: right-click the image → Copy image, then click your page and press Ctrl + V (⌘ + V on Mac). Saving the image and dragging the file in works too.')),
    actions: [{ label: 'Got it', kind: 'primary' }] });
}
async function onPaste(ev) {
  if (S.view !== 'book' || S.closed) return;
  const t = ev.target;
  if (S.editing || (t && (t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName)))) return;
  const items = [...(ev.clipboardData?.items || [])];
  const imgs = items.filter(i => i.type.startsWith('image/')).map(i => i.getAsFile()).filter(Boolean);
  if (imgs.length) { ev.preventDefault(); return insertImageFiles(imgs, activePageObj()); }
  const text = ev.clipboardData?.getData('text/plain') || '';
  if (_clip && (!text || text === _clip.marker)) { ev.preventDefault(); return pasteEls(); }
  if (/^https?:\/\/\S+\.(png|jpe?g|gif|webp)(\?\S*)?$/i.test(text.trim())) {
    ev.preventDefault();
    try { return insertImageBlob(await fetchImageURL(text.trim()), activePageObj()); } catch (e) { toast("Couldn't load that image link."); }
    return;
  }
  if (text.trim()) { ev.preventDefault(); const page = activePageObj(); if (!page) return; const el = baseEl('text', { x: 60, y: 120, w: 300, h: 60, html: esc(text).replace(/\n/g, '<br>'), font: S.toolOpts.text.font, size: S.toolOpts.text.size, color: S.toolOpts.text.color, align: 'left', lineHeight: 1.3, letterSpacing: 0, effect: 'none', effectColor: '#FFE38A' }); addEl(page, el, 'Paste text'); }
}

/* ---------------- Element operations ---------------- */
function deleteSel() {
  if (S.editing) finishEditing();
  const page = findPage(S.selPage); if (!page) return;
  const del = new Set(selEls().filter(e => !e.locked).map(e => e.id));
  if (!del.size) { if (S.sel.length) toast('Unlock it first to delete.'); return; }
  page.elements = page.elements.filter(e => !del.has(e.id));
  S.sel = S.sel.filter(id => !del.has(id));
  rerenderPageDOM(page.id); commit(del.size > 1 ? `Delete ${del.size} items` : 'Delete'); renderInspector();
}
function duplicateSel() {
  const page = findPage(S.selPage); if (!page) return;
  const copies = remapCopies(selEls(), 18, 18);
  if (!copies.length) return;
  page.elements.push(...copies); S.sel = copies.map(c => c.id);
  rerenderPageDOM(page.id); commit('Duplicate'); renderInspector();
}
function copySel() { const els = selEls(); if (!els.length) return; _clip = { els: clone(els), marker: 'dear-diary-elements' }; try { navigator.clipboard.writeText(_clip.marker); } catch (e) {} toast(els.length > 1 ? `Copied ${els.length} items` : 'Copied'); }
function pasteEls() {
  const page = activePageObj(); if (!page || !_clip) return;
  const copies = remapCopies(_clip.els, 20, 20);
  _clip.els = copies.map(clone);
  page.elements.push(...copies); S.sel = copies.map(c => c.id); S.selPage = page.id;
  rerenderPageDOM(page.id); commit('Paste'); renderInspector();
}
function layerSel(where) {
  const page = findPage(S.selPage); if (!page) return;
  const ids = new Set(S.sel); if (!ids.size) return;
  const arr = page.elements, picked = arr.filter(e => ids.has(e.id)), rest = arr.filter(e => !ids.has(e.id));
  if (where === 'top') page.elements = rest.concat(picked);
  else if (where === 'bottom') page.elements = picked.concat(rest);
  else {
    const a = arr.slice();
    const idxs = a.map((e, i) => ids.has(e.id) ? i : -1).filter(i => i >= 0);
    if (where === 'up') for (const i of idxs.reverse()) { if (i < a.length - 1 && !ids.has(a[i + 1].id)) [a[i], a[i + 1]] = [a[i + 1], a[i]]; }
    else for (const i of idxs) { if (i > 0 && !ids.has(a[i - 1].id)) [a[i], a[i - 1]] = [a[i - 1], a[i]]; }
    page.elements = a;
  }
  rerenderPageDOM(page.id); commit({ top: 'Bring to front', bottom: 'Send to back', up: 'Bring forward', down: 'Send backward' }[where]);
}
function toggleLock() {
  const els = selEls(); if (!els.length) return;
  const to = !els.every(e => e.locked); els.forEach(e => e.locked = to);
  rerenderPageDOM(S.selPage); commit(to ? 'Lock' : 'Unlock'); renderInspector();
  toast(to ? 'Locked — it stays put until you unlock it.' : 'Unlocked');
}
function nudge(dx, dy) {
  const els = selEls().filter(e => !e.locked); if (!els.length) return;
  els.forEach(e => { e.x += dx; e.y += dy; });
  rerenderPageDOM(S.selPage);
  clearTimeout(nudge._t); nudge._t = setTimeout(() => commit('Nudge'), 400);
}
function updateSel(fn, label, live = false) {
  if (S.editing) finishEditing(); // keep what was typed before restyling it
  const els = selEls(); if (!els.length) return;
  els.forEach(fn);
  rerenderPageDOM(S.selPage);
  if (!live) commit(label);
}

/* ---------------- Page operations ---------------- */
function addPage(afterId, extra = {}) {
  const d = S.diary;
  const ref = afterId || (visiblePages().slice(-1)[0] || {}).id;
  const i = ref ? d.pages.findIndex(p => p.id === ref) : d.pages.length - 1;
  const p = newPage(extra);
  d.pages.splice(i + 1, 0, p);
  commit('Add page');
  goToPage(p.id);
  return p;
}
function duplicatePage(id) {
  const d = S.diary, i = d.pages.findIndex(p => p.id === id); if (i < 0) return;
  const c = clone(d.pages[i]); c.id = 'p' + uid(); c.elements.forEach(e => e.id = 'e' + uid());
  d.pages.splice(i + 1, 0, c); commit('Duplicate page'); goToPage(c.id);
}
async function deletePage(id) {
  const d = S.diary; if (d.pages.length <= 1) { toast('A diary needs at least one page.'); return; }
  const p = findPage(id); if (!p) return;
  if (p.elements.length && !(await confirmBox('Delete this page?', 'Everything on it will be removed. You can still undo right after.', 'Delete page'))) return;
  d.pages = d.pages.filter(x => x.id !== id);
  S.sel = []; S.activePage = null;
  commit('Delete page'); renderBook(); renderInspector();
}
function movePage(id, dir) {
  const d = S.diary, i = d.pages.findIndex(p => p.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= d.pages.length) return;
  [d.pages[i], d.pages[j]] = [d.pages[j], d.pages[i]];
  commit(dir < 0 ? 'Move page earlier' : 'Move page later'); goToPage(id); renderBook();
}

/* ---------------- Keyboard ---------------- */
function onKey(e) {
  if (S.view !== 'book') return;
  if ($('#modals').children.length) return;
  const t = e.target, typing = t && (t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName));
  const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (typing) { if (e.key === 'Escape' && S.editing) { finishEditing(); } return; }
  if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && k === 'y') { e.preventDefault(); redo(); return; }
  if (S.closed) { if (e.key === 'Enter' || e.key === 'ArrowRight') openBook(); return; }
  if (mod && k === 'd') { e.preventDefault(); duplicateSel(); return; }
  if (mod && e.shiftKey && k === 'h') { e.preventDefault(); hideSel(); return; }
  if (mod && k === 'g') { e.preventDefault(); e.shiftKey ? ungroupSel() : groupSel(); return; }
  if (mod && k === 'e') { e.preventDefault(); exportModal(); return; }
  if (mod && k === 'c') { if (S.sel.length) { e.preventDefault(); copySel(); } return; }
  if (mod && k === 'a') { e.preventDefault(); const p = activePageObj(); if (p) select(p.elements.filter(x => !x.locked && !x.hidden).map(x => x.id), p.id); return; }
  if (mod) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSel(); return; }
  if (e.key === 'Escape') { if (S.tool !== 'select') setTool('select'); else clearSelection(); return; }
  if (e.key.startsWith('Arrow')) {
    e.preventDefault();
    const st = e.shiftKey ? 10 : 1;
    if (S.sel.length) nudge(e.key === 'ArrowLeft' ? -st : e.key === 'ArrowRight' ? st : 0, e.key === 'ArrowUp' ? -st : e.key === 'ArrowDown' ? st : 0);
    else if (e.key === 'ArrowLeft') flip(-1); else if (e.key === 'ArrowRight') flip(1);
    return;
  }
  if (e.key === 'PageDown') return flip(1);
  if (e.key === 'PageUp') return flip(-1);
  if (e.key === '[') return layerSel(e.shiftKey ? 'bottom' : 'down');
  if (e.key === ']') return layerSel(e.shiftKey ? 'top' : 'up');
  if (e.key === 'Enter' && S.sel.length === 1) { const el = selEls()[0]; if (el && (el.type === 'text' || el.type === 'note') && !el.locked) { e.preventDefault(); startEditing(el.id, S.selPage); } return; }
  const tools = { v: 'select', t: 'text', n: 'note', w: 'washi', p: 'pen', e: 'eraser' };
  if (tools[k]) { setTool(tools[k]); return; }
  if (k === 'i') return pickImages();
  if (k === 'l') return toggleLock();
  if (k === '?') return showShortcuts();
}
