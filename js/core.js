/* Dear Diary — storage, state, history, utilities */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clone = o => JSON.parse(JSON.stringify(o));
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fmtDate = s => { if (!s) return ''; const d = new Date(s + 'T12:00'); return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); };
const fmtShort = s => { if (!s) return ''; const d = new Date(s + 'T12:00'); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) e.style.setProperty(sk, sv); else e.style[sk] = sv; } }
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
};

/* ---------------- IndexedDB ---------------- */
const DB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('dear-days', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore('diaries', { keyPath: 'id' });
        d.createObjectStore('blobs', { keyPath: 'id' });
        d.createObjectStore('drawer', { keyPath: 'id' });
        d.createObjectStore('meta', { keyPath: 'key' });
      };
      r.onsuccess = () => { this.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  tx(store, mode, fn) {
    return new Promise((res, rej) => {
      const t = this.db.transaction(store, mode), s = t.objectStore(store);
      let out; const r = fn(s);
      if (r) r.onsuccess = () => { out = r.result; };
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  },
  all(store) { return this.tx(store, 'readonly', s => s.getAll()); },
  get(store, key) { return this.tx(store, 'readonly', s => s.get(key)); },
  put(store, val) { return this.tx(store, 'readwrite', s => s.put(val)); },
  del(store, key) { return this.tx(store, 'readwrite', s => s.delete(key)); },
  clear(store) { return this.tx(store, 'readwrite', s => s.clear()); },
};

/* ---------------- Blobs (images) ---------------- */
const BlobCache = new Map(); // id -> objectURL
const _blobLoading = new Map();
async function putBlob(blob) {
  const id = 'b' + uid();
  try { await DB.put('blobs', { id, blob, type: blob.type }); }
  catch (e) { const err = new Error(e && e.name === 'QuotaExceededError' ? 'quota' : (e && e.message) || 'storage error'); err.name = e && e.name; throw err; }
  BlobCache.set(id, URL.createObjectURL(blob));
  return id;
}
function loadBlob(id) {
  if (!id) return Promise.resolve('');
  if (BlobCache.has(id)) return Promise.resolve(BlobCache.get(id));
  if (_blobLoading.has(id)) return _blobLoading.get(id);
  const p = DB.get('blobs', id).then(r => { const u = r ? URL.createObjectURL(r.blob) : ''; BlobCache.set(id, u); _blobLoading.delete(id); return u; });
  _blobLoading.set(id, p); return p;
}
function blobURL(id) {
  if (!id) return '';
  if (BlobCache.has(id)) return BlobCache.get(id);
  loadBlob(id).then(() => { if (typeof scheduleRender === 'function') scheduleRender(); });
  return '';
}
async function getBlob(id) { const r = await DB.get('blobs', id); return r && r.blob; }
function collectBlobIds(obj, out = new Set()) {
  if (!obj || typeof obj !== 'object') return out;
  if (Array.isArray(obj)) { obj.forEach(o => collectBlobIds(o, out)); return out; }
  for (const [k, v] of Object.entries(obj)) {
    if ((k === 'blobId' || k === 'imageId' || k === 'origBlobId') && typeof v === 'string') out.add(v);
    else if (typeof v === 'object') collectBlobIds(v, out);
  }
  return out;
}
async function preloadBlobs(obj) { await Promise.all([...collectBlobIds(obj)].map(loadBlob)); }

/* ---------------- State ---------------- */
const S = {
  view: 'library',
  diaries: [],
  drawer: [],
  meta: { collections: ['Unsorted'], templates: [], desk: { kind: 'preset', value: 'dream' }, washiCustom: [], localFonts: [], musicOn: false, recentColors: [] },
  diary: null,
  spread: 0,
  closed: true,
  tool: 'select',
  sel: [],
  selPage: null,
  activePage: null,
  zoom: 1,
  calMonth: null,
  editing: null,
  toolOpts: {
    pen: { type: 'pen', color: '#1F1D24', width: 3 },
    eraser: { size: 16 },
    washi: { tape: Object.assign({}, WASHI_PRESETS[0]), width: 32 },
    text: { font: 'Caveat', size: 30, color: '#1F1D24' },
    note: { color: '#FFF3A6', shape: 'none' },
  },
};

function newPage(extra = {}) {
  return Object.assign({
    id: 'p' + uid(), date: todayStr(), title: '', tags: [], mood: '', weather: '', bookmarked: false, showDate: !(S.diary && S.diary.settings.showDates === false),
    paper: Object.assign({ type: 'dot', color: '#FFFFFF', line: '', spacing: 24 }, (S.diary && S.diary.settings.defaultPaper) || {}),
    music: null, elements: [],
  }, extra);
}
function newDiary(name = 'My diary') {
  const d = {
    id: 'd' + uid(), name, created: Date.now(), updated: Date.now(),
    cover: { mode: 'texture', texture: 'plushie-babypink', color: '#E8B4C4', imageId: null, fit: 'cover', tile: 160,
             title: { show: true, text: name, font: 'Bagel Fat One', color: '#B23E6C', size: 36, style: 'label', pos: 'upper' } },
    settings: { showCalendar: true, defaultPaper: { type: 'dot', color: '#FFFFFF', spacing: 24 } },
    pages: [],
  };
  d.pages.push(Object.assign(newPageFor(d), {}), newPageFor(d));
  return d;
}
function newPageFor(d) {
  const prev = S.diary; S.diary = d; const p = newPage(); S.diary = prev; return p;
}

const findPage = id => S.diary && S.diary.pages.find(p => p.id === id);
const findEl = (page, id) => page && page.elements.find(e => e.id === id);

/* ---------------- Saving ---------------- */
let _saveTimer = null;
function scheduleSave() {
  if (!S.diary) return;
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(saveNow, 350);
  setSaveState('saving');
}
async function saveNow() {
  clearTimeout(_saveTimer);
  if (!S.diary) return;
  S.diary.updated = Date.now();
  try { await DB.put('diaries', clone(S.diary)); setSaveState('saved'); }
  catch (e) { console.error(e); setSaveState('error'); toast('Could not save. Your browser storage may be full.'); }
}
async function saveMeta() { await DB.put('meta', { key: 'meta', value: clone(S.meta) }); }
function setSaveState(s) {
  const el = $('#saveState'); if (!el) return;
  el.textContent = s === 'saving' ? 'Saving…' : s === 'saved' ? 'Saved' : 'Not saved';
  el.dataset.state = s;
}

/* ---------------- History (undo / redo) ---------------- */
const H = { stack: [], idx: -1, max: 80 };
function snapshot() { const d = S.diary; return JSON.stringify({ name: d.name, cover: d.cover, settings: d.settings, pages: d.pages }); }
function historyReset() { H.stack = [{ label: 'Opened diary', time: Date.now(), snap: snapshot() }]; H.idx = 0; updateUndoUI(); }
function commit(label) {
  if (!S.diary) return;
  const snap = snapshot();
  if (H.stack[H.idx] && H.stack[H.idx].snap === snap) return;
  H.stack = H.stack.slice(0, H.idx + 1);
  H.stack.push({ label, time: Date.now(), snap });
  if (H.stack.length > H.max) H.stack.shift();
  H.idx = H.stack.length - 1;
  scheduleSave(); updateUndoUI();
}
function restoreSnap(i) {
  const s = JSON.parse(H.stack[i].snap);
  Object.assign(S.diary, s);
  H.idx = i;
  S.sel = S.sel.filter(id => S.diary.pages.some(p => p.elements.some(e => e.id === id)));
  if (S.editing) S.editing = null;
  const max = Math.max(0, Math.ceil(virtualPages().length / 2) - 1);
  S.spread = clamp(S.spread, 0, max);
  scheduleSave(); updateUndoUI(); renderBook(); renderInspector();
}
function undo() { if (H.idx > 0) { const l = H.stack[H.idx].label; restoreSnap(H.idx - 1); toast('Undid: ' + l); } }
function redo() { if (H.idx < H.stack.length - 1) { restoreSnap(H.idx + 1); toast('Redid: ' + H.stack[H.idx].label); } }
function updateUndoUI() {
  const u = $('#btnUndo'), r = $('#btnRedo'); if (!u) return;
  u.disabled = H.idx <= 0; r.disabled = H.idx >= H.stack.length - 1;
  if (typeof _flyout !== 'undefined' && (_flyout === 'history' || _flyout === 'index')) renderFlyout();
}

/* ---------------- Toast / dialogs ---------------- */
function toast(msg, ms = 2600) {
  const t = h('div', { class: 'toast' }, msg);
  $('#toasts').append(t);
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 400);
}
function modal({ title, body, actions = [], wide = false, onClose }) {
  const back = h('div', { class: 'modal-back' });
  const box = h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey, true); onClose && onClose(); };
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  box.append(h('div', { class: 'modal-head' }, h('h2', {}, title), h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: close, html: ICON.x })));
  const b = h('div', { class: 'modal-body' }); if (typeof body === 'string') b.innerHTML = body; else if (body) b.append(body);
  box.append(b);
  if (actions.length) box.append(h('div', { class: 'modal-foot' }, actions.map(a => h('button', { class: 'btn ' + (a.kind || ''), onclick: () => { if (a.run && a.run(close) === false) return; if (!a.keep) close(); } }, a.label))));
  back.append(box);
  back.addEventListener('pointerdown', e => { if (e.target === back) close(); });
  $('#modals').append(back);
  setTimeout(() => { const f = box.querySelector('input,select,textarea,button.primary'); f && f.focus(); }, 30);
  return { close, box, body: b };
}
function confirmBox(title, text, okLabel = 'Delete', kind = 'danger') {
  return new Promise(res => {
    let done = false;
    modal({ title, body: h('p', {}, text), onClose: () => { if (!done) res(false); }, actions: [
      { label: 'Cancel', run: () => { done = true; res(false); } },
      { label: okLabel, kind: 'primary ' + kind, run: () => { done = true; res(true); } },
    ]});
  });
}
function promptBox(title, value = '', label = 'Name', okLabel = 'Save') {
  return new Promise(res => {
    let done = false;
    const inp = h('input', { class: 'input', value, 'aria-label': label });
    const m = modal({ title, body: h('label', { class: 'field' }, h('span', {}, label), inp), onClose: () => { if (!done) res(null); }, actions: [
      { label: 'Cancel', run: () => { done = true; res(null); } },
      { label: okLabel, kind: 'primary', run: () => { done = true; res(inp.value.trim()); } },
    ]});
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { done = true; res(inp.value.trim()); m.close(); } });
    setTimeout(() => { inp.focus(); inp.select(); }, 40);
  });
}

/* ---------------- Fonts ---------------- */
const _loadedFonts = new Set();
function ensureFont(f) {
  if (!f || _loadedFonts.has(f) || !GOOGLE_FONTS.has(f)) return;
  _loadedFonts.add(f);
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f).replace(/%20/g, '+')}&display=swap`;
  document.head.append(l);
}
function preloadAllFonts() {
  const todo = [...GOOGLE_FONTS].filter(f => !_loadedFonts.has(f));
  if (!todo.length) return;
  todo.forEach(f => _loadedFonts.add(f));
  const l = document.createElement('link'); l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?' + todo.map(f => 'family=' + encodeURIComponent(f).replace(/%20/g, '+')).join('&') + '&display=swap';
  document.head.append(l);
}
const fontStack = f => `"${f}", "Gaegu", "Caveat", system-ui, sans-serif`;

/* ---------------- Misc ---------------- */
function download(name, blobOrText, type = 'application/json') {
  const b = blobOrText instanceof Blob ? blobOrText : new Blob([blobOrText], { type });
  const a = h('a', { href: URL.createObjectURL(b), download: name });
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
const blobToDataURL = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
const dataURLToBlob = async u => (await fetch(u)).blob();
function loadImage(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
function ytId(url) {
  if (!url) return null;
  const m = String(url).match(/(?:youtu\.be\/|v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/);
  if (m) return m[1];
  return /^[\w-]{11}$/.test(url.trim()) ? url.trim() : null;
}
