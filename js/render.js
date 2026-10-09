/* Dear Diary — rendering */
const BW = PW * 2 + BOARD * 2, BH = PH + BOARD * 2;
let _flipping = false, _renderQueued = false, _dragging = false;

function scheduleRender() {
  if (_renderQueued) return; _renderQueued = true;
  requestAnimationFrame(() => {
    _renderQueued = false;
    if (S.view === 'book' && !_flipping && !_dragging && !S.editing) renderBook();
    if (S.view === 'library') renderLibrary();
    if (typeof refreshDrawerThumbs === 'function') refreshDrawerThumbs();
  });
}

function isDark(hex) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})/i.exec(hex || '#fff'); if (!m) return false;
  const [r, g, b] = [1, 2, 3].map(i => parseInt(m[i], 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) < 110;
}

/* ---------------- Paper ---------------- */
function paperStyle(paper) {
  const c = paper.color || '#FFFFFF', dark = isDark(c), sp = paper.spacing || 24;
  const lc = paper.line || (dark ? 'rgba(255,255,255,.16)' : 'rgba(70,90,130,.17)');
  const dc = paper.line || (dark ? 'rgba(255,255,255,.28)' : 'rgba(60,70,100,.32)');
  let bg = '';
  if (paper.type === 'grid') bg = `linear-gradient(${lc} 1px, transparent 1px) 0 0/${sp}px ${sp}px, linear-gradient(90deg, ${lc} 1px, transparent 1px) 0 0/${sp}px ${sp}px,`;
  else if (paper.type === 'dot') bg = `radial-gradient(circle, ${dc} 1.25px, transparent 1.7px) ${sp / 2}px ${sp / 2}px/${sp}px ${sp}px,`;
  else if (paper.type === 'lined') { const ls = Math.round(sp * 1.25); bg = `linear-gradient(transparent ${ls - 1}px, ${lc} ${ls - 1}px) 0 ${88 % ls}px/100% ${ls}px,`; }
  return { background: `${bg} ${c}`, color: dark ? '#EEE' : '#1F1D24' };
}

/* ---------------- Washi ---------------- */
function svgTile(w, hgt, inner, bg) {
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hgt}"><rect width="100%" height="100%" fill="${bg}"/>${inner}</svg>`)}")`;
}
function washiBg(t) {
  const a = t.c1 || '#F7B6C8', b = t.c2 || '#FFFFFF';
  switch (t.kind) {
    case 'stripes': return `repeating-linear-gradient(45deg, ${a} 0 7px, ${b} 7px 14px)`;
    case 'dots': return `radial-gradient(circle, ${b} 2.4px, transparent 2.9px) 0 0/12px 12px, ${a}`;
    case 'gingham': return `linear-gradient(90deg, color-mix(in srgb, ${b} 55%, transparent) 50%, transparent 50%) 0 0/14px 14px, linear-gradient(color-mix(in srgb, ${b} 55%, transparent) 50%, transparent 50%) 0 0/14px 14px, ${a}`;
    case 'grid': return `linear-gradient(${b} 1px, transparent 1px) 0 0/9px 9px, linear-gradient(90deg, ${b} 1px, transparent 1px) 0 0/9px 9px, ${a}`;
    case 'hearts': return svgTile(22, 22, `<path transform="translate(5 5) scale(.12)" fill="${b}" d="M50 95C20 73 0 55 0 31 0 13 13 3 27 3 38 3 45 9 50 18 55 9 62 3 73 3 87 3 100 13 100 31 100 55 80 73 50 95Z"/>`, a) + ' 0 0/22px 22px';
    case 'stars': return svgTile(24, 24, `<polygon transform="translate(5 4) scale(.14)" fill="${b}" points="${starPts(5, 52, 22)}"/><circle cx="20" cy="20" r="1.2" fill="${b}"/>`, a) + ' 0 0/24px 24px';
    case 'image': { const u = blobURL(t.blobId); return u ? `url("${u}") 0 50%/auto 100% repeat-x, ${a}` : a; }
    default: return a;
  }
}
function tornClip(id) {
  let s = 0; for (const c of id) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / 16777216; };
  const n = 7, L = [], R = [];
  for (let i = 0; i <= n; i++) {
    const y = (i / n * 100).toFixed(1);
    L.push(`${(i % 2 ? 1 + rnd() * 3 : rnd() * 1.5).toFixed(1)}px ${y}%`);
    R.push(`calc(100% - ${(i % 2 ? 1 + rnd() * 3 : rnd() * 1.5).toFixed(1)}px) ${y}%`);
  }
  return `polygon(${L.join(',')}, ${R.reverse().join(',')})`;
}

/* ---------------- Element filters ---------------- */
function outlineFilter(w, c) {
  if (!w) return '';
  const d = [[1,0],[-1,0],[0,1],[0,-1],[.7,.7],[-.7,.7],[.7,-.7],[-.7,-.7]];
  return d.map(([x, y]) => `drop-shadow(${(x * w).toFixed(1)}px ${(y * w).toFixed(1)}px 0 ${c})`).join(' ');
}
function fxFilter(e) {
  const parts = [];
  if (e.border && e.border.width) parts.push(outlineFilter(e.border.width, e.border.color || '#fff'));
  if (e.shadow) parts.push('drop-shadow(0 4px 6px rgba(30,20,40,.28))');
  return parts.join(' ') || 'none';
}
function photoFilter(e) {
  const f = [];
  if (e.filter && e.filter !== 'none') f.push(IMAGE_FILTERS[e.filter]);
  if (e.adjust) {
    if (e.adjust.b != null && e.adjust.b !== 100) f.push(`brightness(${e.adjust.b / 100})`);
    if (e.adjust.c != null && e.adjust.c !== 100) f.push(`contrast(${e.adjust.c / 100})`);
    if (e.adjust.s != null && e.adjust.s !== 100) f.push(`saturate(${e.adjust.s / 100})`);
  }
  return f.join(' ') || 'none';
}
function textEffectStyle(e) {
  const c = e.effectColor || '#FFE38A';
  switch (e.effect) {
    case 'shadow': return { textShadow: `2px 2px 0 ${c}` };
    case 'outline': return { textShadow: [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]].map(([x, y]) => `${x * 1.5}px ${y * 1.5}px 0 ${c}`).join(',') };
    case 'sticker': return { textShadow: [[1,0],[-1,0],[0,1],[0,-1],[.7,.7],[-.7,.7],[.7,-.7],[-.7,-.7]].map(([x, y]) => `${(x * 3.5).toFixed(1)}px ${(y * 3.5).toFixed(1)}px 0 ${c}`).join(',') + ', 0 4px 6px rgba(0,0,0,.2)' };
    case 'glow': return { textShadow: `0 0 6px ${c}, 0 0 14px ${c}` };
    case 'highlight': return { backgroundImage: `linear-gradient(transparent 55%, ${c} 55%, ${c} 92%, transparent 92%)` };
    default: return {};
  }
}

/* ---------------- Elements ---------------- */
function renderEl(e, opts = {}) {
  const el = h('div', { class: `el el-${e.type}${e.locked ? ' locked' : ''}${e.hidden ? ' is-hidden' : ''}`, 'data-id': e.id });
  posEl(el, e);
  if (e.type === 'image') {
    const url = blobURL(e.blobId);
    const photo = h('div', { class: 'photo' });
    const c = e.crop || { x: 0, y: 0, w: 1, h: 1 };
    Object.assign(photo.style, {
      backgroundImage: url ? `url("${url}")` : 'none',
      backgroundSize: `${100 / c.w}% ${100 / c.h}%`,
      backgroundPosition: `${c.w >= 1 ? 0 : c.x / (1 - c.w) * 100}% ${c.h >= 1 ? 0 : c.y / (1 - c.h) * 100}%`,
      filter: photoFilter(e),
      transform: `scale(${e.flipX ? -1 : 1}, ${e.flipY ? -1 : 1})`,
    });
    if (!url) photo.classList.add('loading');
    const m = shapeMask(e.shape); if (m) { photo.style.webkitMaskImage = m; photo.style.maskImage = m; photo.style.webkitMaskSize = '100% 100%'; photo.style.maskSize = '100% 100%'; }
    let inner = photo;
    if (e.polaroid) {
      inner = h('div', { class: 'polaroid' }, h('div', { class: 'polaroid-photo' }, photo), h('div', { class: 'polaroid-cap', style: { fontFamily: fontStack(e.capFont || 'Caveat') } }, e.caption || ''));
      ensureFont(e.capFont || 'Caveat');
    }
    el.append(h('div', { class: 'fx', style: { filter: fxFilter(e) } }, inner));
  } else if (e.type === 'text') {
    ensureFont(e.font);
    const t = h('div', { class: 'txt', html: e.html || '' });
    Object.assign(t.style, {
      fontFamily: fontStack(e.font), fontSize: e.size + 'px', color: e.color, textAlign: e.align || 'left',
      lineHeight: e.lineHeight || 1.3, letterSpacing: (e.letterSpacing || 0) + 'px',
      fontWeight: e.bold ? 700 : 400, fontStyle: e.italic ? 'italic' : 'normal', textDecoration: e.underline ? 'underline' : 'none',
    }, textEffectStyle(e));
    el.append(t);
  } else if (e.type === 'note') {
    ensureFont(e.font);
    const body = h('div', { class: 'note-body' + (e.shape && e.shape !== 'none' ? ' shaped' : '') });
    body.style.background = `linear-gradient(160deg, rgba(255,255,255,.35), rgba(255,255,255,0) 40%), ${e.color}`;
    const m = shapeMask(e.shape); if (m) { body.style.webkitMaskImage = m; body.style.maskImage = m; body.style.webkitMaskSize = '100% 100%'; body.style.maskSize = '100% 100%'; }
    const t = h('div', { class: 'txt', html: e.html || '' });
    Object.assign(t.style, { fontFamily: fontStack(e.font), fontSize: e.size + 'px', color: e.textColor || '#1F1D24', textAlign: e.align || 'left' });
    body.append(t);
    el.append(h('div', { class: 'fx', style: { filter: e.noShadow ? 'none' : 'drop-shadow(0 3px 4px rgba(30,20,40,.22))' } }, body));
  } else if (e.type === 'washi') {
    const tp = h('div', { class: 'tape' });
    tp.style.background = washiBg(e.tape);
    tp.style.clipPath = tornClip(e.id);
    tp.style.opacity = e.tapeOpacity ?? .86;
    el.append(tp);
  } else if (e.type === 'stroke') {
    const pt = PEN_TYPES[e.pen] || PEN_TYPES.pen;
    const fid = 'pg' + e.id;
    el.innerHTML = `<svg viewBox="0 0 ${e.vw} ${e.vh}" preserveAspectRatio="none" width="100%" height="100%" style="overflow:visible;transform:scale(${e.flipX ? -1 : 1},${e.flipY ? -1 : 1})">${pt.pencil ? `<filter id="${fid}"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="1"/><feDisplacementMap in="SourceGraphic" scale="1.6"/></filter>` : ''}<path d="${e.d}" ${e.filled ? `fill="${e.color}" stroke="none"` : 'fill="none"'} stroke="${e.filled ? 'none' : e.color}" stroke-width="${e.width}" stroke-linecap="${pt.cap}" stroke-linejoin="round" ${pt.pencil ? `filter="url(#${fid})"` : ''} style="mix-blend-mode:${pt.blend || 'normal'}" opacity="${pt.opacity}"/></svg>`;
    if (pt.blend) el.style.mixBlendMode = pt.blend;
  }
  return el;
}
function posEl(el, e) {
  Object.assign(el.style, { left: e.x + 'px', top: e.y + 'px', width: e.w + 'px', height: e.h + 'px', transform: `rotate(${e.rot || 0}deg)`, opacity: e.opacity ?? 1 });
}

/* ---------------- Pages ---------------- */
function virtualPages() {
  if (!S.diary) return [];
  const v = S.diary.settings.showCalendar ? [{ id: '__cal', virtual: 'calendar' }, { id: '__calList', virtual: 'calList' }] : [];
  return v.concat(S.diary.pages);
}
function pageNumber(p) { return S.diary.pages.indexOf(p) + 1; }

function renderPage(page, side, opts = {}) {
  const wrap = h('div', { class: `page page-${side}` + (opts.static ? ' static' : '') });
  if (!page) {
    wrap.classList.add('page-end');
    wrap.append(h('div', { class: 'page-shade' }));
    if (!opts.static) wrap.append(h('button', { class: 'btn ghost add-page-btn', onclick: () => addPage() }, h('span', { html: ICON.plus }), 'Add a page'));
    return wrap;
  }
  if (page.virtual) { wrap.classList.add('page-cal'); renderCalendarInto(wrap, page.virtual, opts); wrap.append(h('div', { class: 'page-shade' })); return wrap; }
  wrap.dataset.pageId = page.id;
  if (page.id === S.activePage && !opts.static) wrap.classList.add('active');
  const ps = paperStyle(page.paper);
  wrap.style.background = ps.background; wrap.style.color = ps.color;
  if (page.showDate !== false) wrap.append(h('div', { class: 'page-date' }, fmtDate(page.date), page.weather ? ' ' + page.weather : '', page.mood ? ' ' + page.mood : ''));
  const els = h('div', { class: 'els' });
  page.elements.forEach(e => els.append(renderEl(e, opts)));
  wrap.append(els);
  wrap.append(h('div', { class: 'page-shade' }));
  wrap.append(h('div', { class: 'page-num' }, String(pageNumber(page))));
  if (page.bookmarked) wrap.append(h('img', { class: 'ribbon-img', src: ribbonUrl(page.ribbon || S.diary.settings.ribbon), alt: '', draggable: 'false' }));
  if (page.music && page.music.id && S.diary.settings.showMusicTag !== false) wrap.append(h('div', { class: 'page-music-tag', title: 'This page has a song' , html: ICON.music }));
  if (!opts.static) wrap.append(h('div', { class: 'sel-layer' }));
  return wrap;
}

/* ---------------- Calendar pages ---------------- */
function renderCalendarInto(wrap, kind, opts) {
  const m = S.calMonth || new Date(); m.setDate(1);
  const y = m.getFullYear(), mo = m.getMonth();
  const byDate = {};
  S.diary.pages.forEach(p => { (byDate[p.date] = byDate[p.date] || []).push(p); });
  const ps = paperStyle({ type: 'blank', color: '#FFFFFF' });
  wrap.style.background = ps.background;
  if (kind === 'calendar') {
    const head = h('div', { class: 'cal-head' },
      opts.static ? h('span', { class: 'icon-btn', 'aria-hidden': 'true' }) : h('button', { class: 'icon-btn', 'aria-label': 'Previous month', html: ICON.left, onclick: () => { S.calMonth = new Date(y, mo - 1, 1); renderBook(); } }),
      h('div', { class: 'cal-title' }, h('span', { class: 'cal-month' }, m.toLocaleDateString('en-GB', { month: 'long' })), h('span', { class: 'cal-year' }, String(y))),
      opts.static ? h('span', { class: 'icon-btn', 'aria-hidden': 'true' }) : h('button', { class: 'icon-btn', 'aria-label': 'Next month', html: ICON.right, onclick: () => { S.calMonth = new Date(y, mo + 1, 1); renderBook(); } }));
    const grid = h('div', { class: 'cal-grid' });
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(d => grid.append(h('div', { class: 'cal-dow' }, d)));
    const first = (new Date(y, mo, 1).getDay() + 6) % 7, days = new Date(y, mo + 1, 0).getDate();
    for (let i = 0; i < first; i++) grid.append(h('div', { class: 'cal-cell empty' }));
    const today = todayStr();
    for (let d = 1; d <= days; d++) {
      const ds = `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const list = byDate[ds] || [];
      const cell = h('button', { class: 'cal-cell' + (list.length ? ' has' : '') + (ds === today ? ' today' : ''), disabled: !list.length || opts.static, onclick: () => list.length && goToPage(list[0].id), title: list.length ? `${list.length} page${list.length > 1 ? 's' : ''}` : '' },
        h('span', { class: 'cal-d' }, String(d)),
        list.length ? h('span', { class: 'cal-mark' }, list.find(p => p.mood)?.mood || '•') : null);
      grid.append(cell);
    }
    wrap.append(h('div', { class: 'cal-wrap' }, head, grid));
  } else {
    const ym = `${y}-${String(mo + 1).padStart(2, '0')}`;
    const list = S.diary.pages.filter(p => p.date && p.date.startsWith(ym)).sort((a, b) => a.date.localeCompare(b.date));
    const box = h('div', { class: 'cal-wrap' }, h('h3', { class: 'cal-list-title' }, 'This month'));
    if (!list.length) box.append(h('p', { class: 'cal-empty' }, 'No pages dated this month yet.'));
    const ul = h('div', { class: 'cal-list' });
    list.forEach(p => ul.append(h('button', { class: 'cal-row', disabled: opts.static, onclick: () => goToPage(p.id) },
      h('span', { class: 'cal-row-date' }, fmtShort(p.date)),
      h('span', { class: 'cal-row-title' }, p.title || firstText(p) || 'Untitled page'),
      h('span', { class: 'cal-row-meta' }, (p.mood || '') + (p.bookmarked ? ' 🔖' : '')))));
    box.append(ul);
    wrap.append(box);
  }
}
function firstText(p) {
  const t = p.elements.find(e => e.type === 'text' || e.type === 'note');
  if (!t) return '';
  const d = document.createElement('div'); d.innerHTML = t.html || ''; return d.textContent.trim().slice(0, 40);
}

/* ---------------- Cover ---------------- */
function applyCoverBg(el, cover) {
  const s = el.style;
  s.backgroundImage = ''; s.backgroundSize = ''; s.backgroundRepeat = ''; s.backgroundPosition = ''; s.backgroundColor = cover.color || '#E8B4C4';
  if (cover.mode === 'texture') {
    s.backgroundImage = `url("${texUrl(cover.texture)}")`; s.backgroundSize = 'cover'; s.backgroundPosition = 'center';
  } else if (cover.mode === 'image' && cover.imageId) {
    const u = blobURL(cover.imageId);
    if (u) {
      s.backgroundImage = `url("${u}")`;
      if (cover.fit === 'stretch') { s.backgroundSize = '100% 100%'; s.backgroundRepeat = 'no-repeat'; }
      else if (cover.fit === 'pattern') { s.backgroundSize = `${cover.tile || 160}px auto`; s.backgroundRepeat = 'repeat'; s.backgroundPosition = '0 0'; }
      else { s.backgroundSize = 'cover'; s.backgroundPosition = 'center'; s.backgroundRepeat = 'no-repeat'; }
    }
  } else {
    s.backgroundImage = 'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,.22), transparent 60%), repeating-linear-gradient(0deg, rgba(0,0,0,.025) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(0,0,0,.025) 0 1px, transparent 1px 3px)';
  }
}
function coverTitleEl(cover) {
  const t = cover.title || {};
  if (!t.show || !t.text) return null;
  ensureFont(t.font);
  return h('div', { class: `cover-title style-${t.style || 'label'} pos-${t.pos || 'upper'}` },
    h('span', { style: { fontFamily: fontStack(t.font), fontSize: (t.size || 34) + 'px', color: t.color || '#3E2342' } }, t.text));
}
function renderCoverFace(cover) {
  const f = h('div', { class: 'cover-face' });
  applyCoverBg(f, cover);
  const ti = coverTitleEl(cover); if (ti) f.append(ti);
  f.append(h('div', { class: 'cover-spine-shade' }));
  return f;
}

/* ---------------- Book ---------------- */
function renderBook() {
  const host = $('#bookHost'); if (!host || !S.diary) return;
  const d = S.diary, vp = virtualPages();
  const maxSpread = Math.max(0, Math.ceil(vp.length / 2) - 1);
  S.spread = clamp(S.spread, 0, maxSpread);
  host.innerHTML = '';
  const book = h('div', { id: 'book', class: S.closed ? 'closed' : 'open', style: { width: BW + 'px', height: BH + 'px' } });
  const inner = h('div', { class: 'book-inner' });
  const bl = h('div', { class: 'board board-left' }), br = h('div', { class: 'board board-right' });
  applyCoverBg(bl, d.cover); applyCoverBg(br, d.cover);
  inner.append(bl, br, h('div', { class: 'page-stack page-stack-left' }), h('div', { class: 'page-stack page-stack-right' }));
  const spread = h('div', { class: 'spread' });
  spread.append(renderPage(vp[S.spread * 2], 'left'), renderPage(vp[S.spread * 2 + 1], 'right'));
  inner.append(spread);
  inner.append(h('div', { class: 'gutter' }));
  const cover = h('div', { class: 'cover', role: 'button', tabindex: S.closed ? 0 : -1, 'aria-label': 'Open diary' },
    h('div', { class: 'cover-front' }, renderCoverFace(d.cover), h('div', { class: 'cover-edge' })),
    h('div', { class: 'cover-back' }, h('div', { class: 'cover-lining' })));
  applyCoverBg(cover.querySelector('.cover-lining'), d.cover);
  // the inside of the turning cover shows the real left page, so it lands seamlessly
  const firstLeft = vp[S.spread * 2];
  if (firstLeft) { const lin = cover.querySelector('.cover-lining'); lin.classList.add('has-page'); lin.append(renderPage(firstLeft, 'left', { static: true })); }
  cover.addEventListener('click', () => { if (S.closed) openBook(); });
  cover.addEventListener('keydown', e => { if (S.closed && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openBook(); } });
  inner.append(cover);
  book.append(inner);
  host.append(book);
  fitStage();
  $$('.page[data-page-id]').forEach(p => renderSelection(p));
  if (typeof visiblePages === 'function') { const vis = visiblePages(); if (vis.length && !vis.some(p => p.id === S.activePage)) S.activePage = vis[vis.length - 1].id; }
  updateNav();
  if (typeof _flyout !== 'undefined' && _flyout === 'index') renderFlyout();
  if (typeof onSpreadShown === 'function') onSpreadShown();
}

function fitStage() {
  const stage = $('#stage'), scaler = $('#bookHost'), book = $('#book'); if (!stage || !book) return;
  const pad = window.innerWidth < 700 ? 16 : 48;
  const aw = stage.clientWidth - pad * 2, ah = stage.clientHeight - pad * 2;
  const fit = Math.max(.2, Math.min(aw / BW, ah / BH));
  const sc = fit * S.zoom;
  S.scale = sc;
  scaler.style.width = BW * sc + 'px'; scaler.style.height = BH * sc + 'px';
  if (CSS.supports('zoom', '1')) { book.style.zoom = sc; book.style.transform = ''; } else book.style.transform = `scale(${sc})`;
  const z = $('#zoomLabel'); if (z) z.textContent = Math.round(S.zoom * 100) + '%';
}

function updateNav() {
  const vp = virtualPages(), max = Math.max(0, Math.ceil(vp.length / 2) - 1);
  const prev = $('#btnPrev'), next = $('#btnNext'), lab = $('#pageLabel');
  if (!lab) return;
  $('#diaryName').textContent = S.diary.name;
  prev.disabled = S.closed;
  prev.title = S.spread <= 0 ? 'Back to the cover' : 'Previous pages';
  prev.setAttribute('aria-label', prev.title); next.disabled = !S.closed && S.spread >= max;
  next.title = S.closed ? 'Open the diary' : 'Next pages'; next.setAttribute('aria-label', next.title);
  const cv = $('#btnToCover'), bm = $('#btnBookmark'), last = Math.max(0, Math.ceil(vp.length / 2) - 1);
  cv.title = S.closed ? 'Open the diary' : 'Back to the cover'; cv.setAttribute('aria-label', cv.title);
  $('#btnFirst').disabled = !S.closed && S.spread <= 0; $('#btnLast').disabled = !S.closed && S.spread >= last;
  const ap = S.closed ? null : activePageObj();
  bm.disabled = !ap; bm.classList.toggle('on', !!(ap && ap.bookmarked));
  bm.title = ap && ap.bookmarked ? 'Remove bookmark' : 'Bookmark this page'; bm.setAttribute('aria-label', bm.title);
  if (S.closed) { lab.textContent = 'Closed'; return; }
  const l = vp[S.spread * 2], r = vp[S.spread * 2 + 1];
  if ((l && l.virtual) || (r && r.virtual)) { lab.textContent = 'Calendar'; return; }
  const nums = [l, r].filter(Boolean).map(pageNumber);
  lab.textContent = nums.length > 1 ? `Pages ${nums[0]}–${nums[1]}` : `Page ${nums[0]}`;
  $('#diaryName').textContent = S.diary.name;
}

/* ---------------- Open / close ---------------- */
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function openBook() {
  if (!S.closed || _flipping) return;
  const book = $('#book'); if (!book) return;
  _flipping = true;
  if (reducedMotion()) { S.closed = false; _flipping = false; renderBook(); renderInspector(); return; }
  book.classList.remove('closed'); book.classList.add('opening');
  setTimeout(() => { S.closed = false; _flipping = false; renderBook(); renderInspector(); }, 950);
}
function closeBook() {
  if (S.closed || _flipping) return;
  clearSelection(); closeFlyout();
  const book = $('#book'); if (!book) return;
  _flipping = true;
  if (reducedMotion()) { S.closed = true; _flipping = false; renderBook(); renderInspector(); return; }
  book.classList.remove('open'); book.classList.add('closing-pre');
  void book.offsetWidth;
  book.classList.remove('closing-pre'); book.classList.add('closing');
  setTimeout(() => { S.closed = true; _flipping = false; renderBook(); renderInspector(); }, 950);
}

/* ---------------- Page flip ---------------- */
function flipTo(target) {
  const vp = virtualPages(), max = Math.max(0, Math.ceil(vp.length / 2) - 1);
  target = clamp(target, 0, max);
  if (S.closed || _flipping || target === S.spread) return;
  if (S.editing) finishEditing();
  const dir = target > S.spread ? 1 : -1, s = S.spread;
  const oldL = vp[s * 2], oldR = vp[s * 2 + 1], newL = vp[target * 2], newR = vp[target * 2 + 1];
  S.sel = []; S.spread = target;
  if (reducedMotion()) { renderBook(); renderInspector(); return; }
  _flipping = true;
  $('#book').classList.add('flipping');
  const spreadEl = $('#book .spread');
  spreadEl.innerHTML = '';
  if (dir > 0) spreadEl.append(renderPage(oldL, 'left', { static: true }), renderPage(newR, 'right', { static: true }));
  else spreadEl.append(renderPage(newL, 'left', { static: true }), renderPage(oldR, 'right', { static: true }));
  const leaf = h('div', { class: 'leaf ' + (dir > 0 ? 'leaf-fwd' : 'leaf-back') });
  const front = h('div', { class: 'leaf-face leaf-front' }, dir > 0 ? renderPage(oldR, 'right', { static: true }) : renderPage(oldL, 'left', { static: true }), h('div', { class: 'leaf-shade' }));
  const back = h('div', { class: 'leaf-face leaf-back-face' }, dir > 0 ? renderPage(newL, 'left', { static: true }) : renderPage(newR, 'right', { static: true }), h('div', { class: 'leaf-shade' }));
  leaf.append(front, back);
  $('#book .book-inner').append(leaf);
  const anim = leaf.animate([{ transform: 'perspective(2800px) rotateY(0deg)' }, { transform: `perspective(2800px) rotateY(${dir > 0 ? -180 : 180}deg)` }], { duration: 720, easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'forwards' });
  $$('.leaf-shade', leaf).forEach((sh, i) => sh.animate([{ opacity: i ? .35 : 0 }, { opacity: .25, offset: .5 }, { opacity: i ? 0 : .35 }], { duration: 720, fill: 'forwards' }));
  const done = () => { if (!_flipping) return; _flipping = false; $('#book') && $('#book').classList.remove('flipping'); renderBook(); renderInspector(); };
  anim.finished.then(done, done); setTimeout(done, 1400);
}
const flip = dir => { if (S.closed) { if (dir > 0) openBook(); return; } if (dir < 0 && S.spread <= 0) return closeBook(); flipTo(S.spread + dir); };
function goToPage(id) {
  const vp = virtualPages(), i = vp.findIndex(p => p.id === id);
  if (i < 0) return;
  S.activePage = id;
  if (S.closed) { S.spread = Math.floor(i / 2); openBook(); return; }
  if (Math.floor(i / 2) === S.spread) { renderBook(); renderInspector(); return; }
  flipTo(Math.floor(i / 2));
}

/* ---------------- Selection overlay ---------------- */
function renderSelection(pageDiv) {
  const layer = pageDiv.querySelector('.sel-layer'); if (!layer) return;
  layer.innerHTML = '';
  const page = findPage(pageDiv.dataset.pageId); if (!page || S.selPage !== page.id) return;
  const sel = S.sel.map(id => findEl(page, id)).filter(Boolean);
  const single = sel.length === 1;
  const inv = 1 / (S.scale || 1);
  sel.forEach(e => {
    const box = h('div', { class: 'sel-box' + (e.locked ? ' is-locked' : '') + (single ? ' single' : ''), 'data-id': e.id, style: { '--inv': inv } });
    posEl(box, e); box.style.opacity = 1;
    if (single && !e.locked && S.editing !== e.id) {
      ['nw', 'ne', 'sw', 'se'].concat(e.type === 'text' || e.type === 'note' || e.type === 'washi' ? ['e', 'w'] : []).concat(e.type === 'note' ? ['s', 'n'] : [])
        .forEach(k => box.append(h('div', { class: 'handle h-' + k, 'data-handle': k })));
      box.append(h('div', { class: 'rot-stem' }), h('div', { class: 'handle h-rot', 'data-handle': 'rot', title: 'Rotate (Shift snaps)' }));
    }
    if (e.locked) box.append(h('div', { class: 'lock-badge', html: ICON.lock }));
    layer.append(box);
  });
  if (sel.length > 1 && !sel.some(e => e.locked) && typeof selBBox === 'function') {
    const bb = selBBox(sel), gb = h('div', { class: 'group-box', style: { '--inv': inv, left: bb.x + 'px', top: bb.y + 'px', width: bb.w + 'px', height: bb.h + 'px' } });
    ['nw', 'ne', 'sw', 'se'].forEach(k => gb.append(h('div', { class: 'handle h-' + k, 'data-handle': 'g' + k })));
    gb.append(h('div', { class: 'rot-stem' }), h('div', { class: 'handle h-rot', 'data-handle': 'grot', title: 'Rotate together (Shift snaps)' }));
    layer.append(gb);
  }
}
function refreshSelection() { $$('.page[data-page-id]').forEach(renderSelection); }
function rerenderPageDOM(pageId) {
  const div = $(`#book .page[data-page-id="${pageId}"]`); if (!div) return;
  const page = findPage(pageId); const side = div.classList.contains('page-left') ? 'left' : 'right';
  const n = renderPage(page, side); div.replaceWith(n); renderSelection(n);
}
