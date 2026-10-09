/* Dear Diary — library, modals, music, backup, boot */

/* ---------------- Library ---------------- */
function showView(v) {
  S.view = v;
  $('#library').hidden = v !== 'library';
  $('#editor').hidden = v !== 'book';
  if (v === 'library') { Music.stop(); renderLibrary(); }
}
function miniCover(d, cls = 'mini-cover') {
  const c = h('div', { class: cls });
  const face = renderCoverFace(d.cover);
  c.append(face);
  return c;
}
async function renderLibrary() {
  const grid = $('#shelf'); if (!grid) return;
  grid.innerHTML = '';
  const list = S.diaries.slice().sort((a, b) => b.updated - a.updated);
  list.forEach(d => {
    const tile = h('div', { class: 'shelf-item' });
    const open = h('button', { class: 'shelf-book', 'aria-label': `Open ${d.name}`, onclick: () => openDiary(d.id) }, miniCover(d));
    const menu = h('button', { class: 'icon-btn sm shelf-menu', 'aria-label': `Options for ${d.name}`, html: ICON.more, onclick: ev => diaryMenu(d, ev.currentTarget) });
    tile.append(open, h('div', { class: 'shelf-meta' }, h('div', {}, h('div', { class: 'shelf-name' }, d.name), h('div', { class: 'shelf-sub' }, `${d.pages.length} page${d.pages.length === 1 ? '' : 's'} · ${new Date(d.updated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`)), menu));
    grid.append(tile);
  });
  grid.append(h('div', { class: 'shelf-item' }, h('button', { class: 'shelf-new', onclick: createDiary }, h('span', { html: ICON.plus }), h('span', {}, 'New diary'))));
  if (navigator.storage && navigator.storage.estimate) {
    try { const e = await navigator.storage.estimate(); $('#storageInfo').textContent = `Using ${(e.usage / 1048576).toFixed(1)} MB of storage on this device`; } catch (e) {}
  }
}
function diaryMenu(d) {
  modal({ title: d.name, body: h('div', { class: 'menu-list' },
    h('button', { class: 'menu-item', onclick: () => { closeTop(); openDiary(d.id); } }, 'Open'),
    h('button', { class: 'menu-item', onclick: () => { closeTop(); coverEditor(d); } }, 'Edit cover'),
    h('button', { class: 'menu-item', onclick: () => { closeTop(); renameDiary(d); } }, 'Rename'),
    h('button', { class: 'menu-item', onclick: async () => { closeTop(); const c = clone(d); c.id = 'd' + uid(); c.name = d.name + ' (copy)'; c.updated = Date.now(); c.pages.forEach(p => { p.id = 'p' + uid(); p.elements.forEach(e => e.id = 'e' + uid()); }); S.diaries.push(c); await DB.put('diaries', c); renderLibrary(); toast('Diary duplicated'); } }, 'Duplicate'),
    h('button', { class: 'menu-item', onclick: () => { closeTop(); backupDiary(d); } }, 'Back up this diary'),
    h('button', { class: 'menu-item danger', onclick: async () => { closeTop(); if (await confirmBox(`Delete “${d.name}”?`, 'The whole diary and all its pages will be deleted from this device. This cannot be undone.', 'Delete diary')) { S.diaries = S.diaries.filter(x => x.id !== d.id); await DB.del('diaries', d.id); renderLibrary(); } } }, 'Delete…'))
  });
}
const closeTop = () => { const m = $$('#modals .modal-back').pop(); m && m.querySelector('.modal-head .icon-btn').click(); };
async function renameDiary(d) {
  const n = await promptBox('Rename diary', d.name, 'Diary name'); if (!n) return;
  const syncTitle = d.cover.title && d.cover.title.text === d.name;
  d.name = n; if (syncTitle) d.cover.title.text = n;
  if (S.diary && S.diary.id === d.id) { commit('Rename diary'); renderBook(); renderInspector(); } else { d.updated = Date.now(); await DB.put('diaries', clone(d)); renderLibrary(); }
}
function createDiary() {
  const d = newDiary('My diary');
  coverEditor(d, true);
}
async function openDiary(id) {
  const d = S.diaries.find(x => x.id === id); if (!d) return;
  await preloadBlobs(d);
  S.diary = d; S.spread = 0; S.closed = true; S.sel = []; S.selPage = null; S.activePage = null; S.zoom = 1; S.editing = null; S.calMonth = null;
  historyReset();
  showView('book');
  setTool('select');
  closeFlyout();
  renderBook(); renderInspector();
  setSaveState('saved');
}
async function backToLibrary() {
  if (S.editing) finishEditing();
  await saveNow();
  S.diary = null; closeFlyout();
  showView('library');
}

/* ---------------- Cover editor ---------------- */
function coverEditor(d, isNew = false) {
  const draft = clone(d.cover); let name = d.name;
  let mat = draft.mode === 'texture' ? draft.texture.split('-')[0] : 'plushie';
  let tab = draft.mode;
  const preview = h('div', { class: 'cover-preview' });
  const controls = h('div', { class: 'cover-controls' });
  const draw = () => {
    preview.innerHTML = '';
    const book = h('div', { class: 'cp-book' }, renderCoverFace(draft), h('div', { class: 'cover-edge' }));
    preview.append(book);
    controls.innerHTML = '';
    const nameIn = h('input', { class: 'input', value: name, 'aria-label': 'Diary name' });
    nameIn.addEventListener('input', () => { const sync = draft.title.text === name; name = nameIn.value; if (sync) { draft.title.text = name; drawPreviewOnly(); } });
    controls.append(row('Name', nameIn));
    controls.append(seg([['texture', 'Material'], ['color', 'Colour'], ['image', 'My image']], tab, v => { tab = v; if (v !== 'image' || draft.imageId) draft.mode = v; draw(); }, 'tabs'));
    if (tab === 'texture') {
      controls.append(seg(MATERIALS.map(m => [m.id, m.name]), mat, v => { mat = v; draw(); }, 'wrap'));
      const g = h('div', { class: 'tex-grid' });
      TEXTURE_FILES.filter(f => f.startsWith(mat + '-')).forEach(f => g.append(h('button', { class: 'tex' + (draft.mode === 'texture' && draft.texture === f ? ' on' : ''), title: prettyColor(f.split('-').slice(1).join('-')), 'aria-label': prettyColor(f.replace('-', ' ')), onclick: () => { draft.mode = 'texture'; draft.texture = f; draw(); } }, h('img', { src: texThumb(f), alt: '', loading: 'lazy' }))));
      controls.append(g);
    } else if (tab === 'color') {
      controls.append(swatches(['#E8B4C4', '#F4D7A8', '#BFD8C2', '#B8CDE8', '#CDBEE6', '#2E3A5C', '#5A2A35', '#3B3B3F', '#F3EEE4', '#C9A27C'], draft.mode === 'color' ? draft.color : '', (c, live) => { draft.mode = 'color'; draft.color = c; live ? drawPreviewOnly() : draw(); }));
    } else {
      controls.append(h('button', { class: 'btn block', onclick: async () => { const f = await pickFile('image/*'); if (!f) return; const n = await normalizeImage(f, 2000); draft.imageId = await putBlob(n.blob); draft.mode = 'image'; draw(); } }, h('span', { html: ICON.upload }), draft.imageId ? 'Choose a different image' : 'Choose an image'));
      if (draft.imageId) {
        controls.append(row('Fit', seg([['cover', 'Fill'], ['stretch', 'Stretch'], ['pattern', 'Pattern']], draft.fit || 'cover', v => { draft.fit = v; draft.mode = 'image'; draw(); })));
        if (draft.fit === 'cover') controls.append(h('p', { class: 'muted small' }, 'Fills the cover and trims the edges if the shape differs.'));
        if (draft.fit === 'stretch') controls.append(h('p', { class: 'muted small' }, 'Stretches the whole image to the cover, nothing trimmed.'));
        if (draft.fit === 'pattern') {
          controls.append(row('Tile size', slider(draft.tile || 160, 30, 500, 5, v => { draft.tile = v; drawPreviewOnly(); }, null, 'px')));
          controls.append(row('Behind', swatches(['#FFFFFF', '#F3EEE4', '#E8B4C4', '#B8CDE8', '#2E3A5C', '#1F1D24'], draft.color, (c, live) => { draft.color = c; live ? drawPreviewOnly() : draw(); }, { label: 'Colour behind the pattern' })));
        }
      }
    }
    const t = draft.title;
    const tt = h('input', { class: 'input', value: t.text || '', 'aria-label': 'Cover title' });
    tt.addEventListener('input', () => { t.text = tt.value; drawPreviewOnly(); });
    controls.append(h('h3', { class: 'sub' }, 'Title on the cover'));
    controls.append(toggle('Show a title', t.show, v => { t.show = v; draw(); }));
    if (t.show) {
      controls.append(row('Text', tt));
      controls.append(row('Style', seg([['label', 'Label'], ['plain', 'Plain'], ['foil', 'Foil'], ['stamp', 'Stamp']], t.style || 'label', v => { t.style = v; draw(); })));
      controls.append(row('Place', seg([['upper', 'Top'], ['center', 'Middle'], ['lower', 'Bottom']], t.pos || 'upper', v => { t.pos = v; draw(); })));
      controls.append(row('Font', fontSelect(t.font, f => { t.font = f; draw(); })));
      controls.append(row('Size', slider(t.size || 34, 16, 80, 1, v => { t.size = v; drawPreviewOnly(); }, null, 'px')));
      controls.append(row('Colour', swatches(INK_COLORS.concat([['White', '#FFFFFF'], ['Gold', '#B88A2B']]), t.color, (c, live) => { t.color = c; live ? drawPreviewOnly() : draw(); })));
    }
  };
  const drawPreviewOnly = () => { preview.innerHTML = ''; preview.append(h('div', { class: 'cp-book' }, renderCoverFace(draft), h('div', { class: 'cover-edge' }))); };
  draw();
  modal({ title: isNew ? 'New diary' : 'Edit cover', wide: true, body: h('div', { class: 'cover-editor' }, preview, controls), actions: [
    { label: 'Cancel' },
    { label: isNew ? 'Create diary' : 'Save cover', kind: 'primary', run: async () => {
      d.cover = draft; d.name = name.trim() || 'My diary';
      if (isNew) { S.diaries.push(d); await DB.put('diaries', clone(d)); renderLibrary(); openDiary(d.id); }
      else if (S.diary && S.diary.id === d.id) { commit('Edit cover'); renderBook(); renderInspector(); }
      else { d.updated = Date.now(); await DB.put('diaries', clone(d)); renderLibrary(); }
    } },
  ]});
}

/* ---------------- Crop ---------------- */
async function cropModal(e) {
  const url = blobURL(e.blobId) || await loadBlob(e.blobId);
  const img = await loadImage(url);
  const nw = img.naturalWidth, nh = img.naturalHeight;
  const maxW = Math.min(560, window.innerWidth - 80), maxH = Math.min(440, window.innerHeight - 260);
  const s = Math.min(maxW / nw, maxH / nh), W = Math.round(nw * s), Hh = Math.round(nh * s);
  let c = Object.assign({ x: 0, y: 0, w: 1, h: 1 }, e.crop), aspect = 0;
  const area = h('div', { class: 'crop-area', style: { width: W + 'px', height: Hh + 'px', backgroundImage: `url("${url}"), repeating-conic-gradient(#EEE 0 25%, #FFF 0 50%)` } });
  const box = h('div', { class: 'crop-box' }, ...['nw', 'ne', 'sw', 'se'].map(k => h('div', { class: 'crop-h ch-' + k, 'data-h': k })));
  area.append(box);
  const place = () => Object.assign(box.style, { left: c.x * W + 'px', top: c.y * Hh + 'px', width: c.w * W + 'px', height: c.h * Hh + 'px' });
  place();
  const applyAspect = () => {
    if (!aspect) return;
    const pxW = c.w * nw, pxH = c.h * nh;
    let nwpx = pxW, nhpx = pxW / aspect;
    if (nhpx > nh) { nhpx = nh; nwpx = nh * aspect; }
    c.w = nwpx / nw; c.h = nhpx / nh; c.x = clamp(c.x, 0, 1 - c.w); c.y = clamp(c.y, 0, 1 - c.h); place();
    void pxH;
  };
  area.addEventListener('pointerdown', ev => {
    ev.preventDefault();
    const r = area.getBoundingClientRect(), k = ev.target.dataset.h;
    const p0 = { x: (ev.clientX - r.left) / W, y: (ev.clientY - r.top) / Hh }, c0 = Object.assign({}, c);
    const move = ev2 => {
      const p = { x: clamp((ev2.clientX - r.left) / W, 0, 1), y: clamp((ev2.clientY - r.top) / Hh, 0, 1) };
      if (!k) { c.x = clamp(c0.x + p.x - p0.x, 0, 1 - c.w); c.y = clamp(c0.y + p.y - p0.y, 0, 1 - c.h); }
      else {
        let x1 = c0.x, y1 = c0.y, x2 = c0.x + c0.w, y2 = c0.y + c0.h;
        if (k.includes('w')) x1 = Math.min(p.x, x2 - .03); if (k.includes('e')) x2 = Math.max(p.x, x1 + .03);
        if (k.includes('n')) y1 = Math.min(p.y, y2 - .03); if (k.includes('s')) y2 = Math.max(p.y, y1 + .03);
        if (aspect) { const wpx = (x2 - x1) * nw; const hpx = wpx / aspect; if (k.includes('n')) y1 = Math.max(0, y2 - hpx / nh); else y2 = Math.min(1, y1 + hpx / nh); }
        c = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
      }
      place();
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  });
  const asp = seg([[0, 'Free'], [1, '1:1'], [4 / 3, '4:3'], [3 / 4, '3:4'], [16 / 9, '16:9']], 0, v => { aspect = v; $$('button', asp).forEach((b, i) => b.classList.toggle('on', [0, 1, 4 / 3, 3 / 4, 16 / 9][i] === v)); applyAspect(); }, 'wrap');
  modal({ title: 'Crop', wide: true, body: h('div', { class: 'crop-wrap' }, area, asp), actions: [
    { label: 'Reset', run: () => { c = { x: 0, y: 0, w: 1, h: 1 }; place(); return false; }, keep: true },
    { label: 'Cancel' },
    { label: 'Apply crop', kind: 'primary', run: () => {
      updateSel(x => { const area0 = x.w * x.h; x.crop = clone(c); const ratio = (c.w * nw) / (c.h * nh); x.w = Math.round(Math.sqrt(area0 * ratio)); x.h = Math.round(x.w / ratio); if (x.polaroid) x.h = Math.round(x.h * 1.18); }, 'Crop');
      renderInspector();
    } },
  ]});
}

/* ---------------- Background removal ---------------- */
async function cutoutModal(e) {
  const src = e.origBlobId || e.blobId;
  const url = await loadBlob(src);
  const img = await loadImage(url);
  const maxSide = 1600, sc = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const W = Math.round(img.naturalWidth * sc), Hh = Math.round(img.naturalHeight * sc);
  const base = document.createElement('canvas'); base.width = W; base.height = Hh;
  base.getContext('2d').drawImage(img, 0, 0, W, Hh);
  const out = document.createElement('canvas'); out.width = W; out.height = Hh; out.className = 'cut-canvas';
  let tol = 38, result = null;
  const run = () => { result = floodCutout(base, tol); out.getContext('2d').clearRect(0, 0, W, Hh); out.getContext('2d').putImageData(result, 0, 0); };
  run();
  const status = h('p', { class: 'muted small' }, '');
  const m = modal({ title: 'Cut out', wide: true, body: h('div', { class: 'cut-wrap' },
    h('div', { class: 'cut-preview checker' }, out),
    h('div', { class: 'cut-side' },
      h('h3', { class: 'sub' }, 'Plain background'),
      h('p', { class: 'muted small' }, 'Best for images on white or a single colour. Works offline.'),
      row('Strength', slider(tol, 5, 120, 1, v => { tol = v; clearTimeout(run._t); run._t = setTimeout(run, 60); })),
      h('h3', { class: 'sub' }, 'Smart cut-out'),
      h('p', { class: 'muted small' }, 'Finds the subject in any photo. The first time, it downloads a model (about 40 MB), so it needs internet and a little patience.'),
      h('button', { class: 'btn block', onclick: async ev => {
        const b = ev.currentTarget; b.disabled = true; status.textContent = 'Loading the cut-out model…';
        try {
          const mod = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1/+esm');
          const fn = mod.removeBackground || mod.default;
          const blob = await new Promise(r => base.toBlob(r, 'image/png'));
          const res = await fn(blob, { progress: (k, cur, tot) => { if (tot) status.textContent = `Downloading model… ${Math.round(cur / tot * 100)}%`; } });
          status.textContent = 'Done. Press Apply to use it.';
          const im = await loadImage(URL.createObjectURL(res));
          const cx = out.getContext('2d'); cx.clearRect(0, 0, W, Hh); cx.drawImage(im, 0, 0, W, Hh);
          result = cx.getImageData(0, 0, W, Hh);
        } catch (err) { console.error(err); status.textContent = "Smart cut-out couldn't load. Check your internet connection, or use the plain background option."; }
        b.disabled = false;
      } }, h('span', { html: ICON.wand }), 'Try smart cut-out'),
      status)),
    actions: [
      { label: 'Cancel' },
      { label: 'Apply', kind: 'primary', run: async () => {
        const c = document.createElement('canvas'); c.width = W; c.height = Hh; c.getContext('2d').putImageData(result, 0, 0);
        const blob = await new Promise(r => c.toBlob(r, 'image/png'));
        const id = await putBlob(blob);
        updateSel(x => { if (!x.origBlobId) x.origBlobId = x.blobId; x.blobId = id; x.shadow = true; }, 'Cut out background');
        renderInspector(); toast('Cut out. Try a white border for a sticker look.');
      } }] });
  void m;
}
function floodCutout(canvas, tol) {
  const W = canvas.width, Hh = canvas.height, ctx = canvas.getContext('2d');
  const src = ctx.getImageData(0, 0, W, Hh), d = src.data;
  const out = new ImageData(new Uint8ClampedArray(d), W, Hh), o = out.data;
  const seen = new Uint8Array(W * Hh), stack = [];
  const refs = [[0, 0], [W - 1, 0], [0, Hh - 1], [W - 1, Hh - 1], [W >> 1, 0], [W >> 1, Hh - 1], [0, Hh >> 1], [W - 1, Hh >> 1]].map(([x, y]) => { const i = (y * W + x) * 4; return [d[i], d[i + 1], d[i + 2]]; });
  const t2 = tol * tol;
  const near = i => { for (const r of refs) { const dr = d[i] - r[0], dg = d[i + 1] - r[1], db = d[i + 2] - r[2]; if (dr * dr + dg * dg + db * db < t2) return true; } return d[i + 3] < 20; };
  for (let x = 0; x < W; x++) { stack.push(x, (Hh - 1) * W + x); }
  for (let y = 0; y < Hh; y++) { stack.push(y * W, y * W + W - 1); }
  while (stack.length) {
    const p = stack.pop(); if (seen[p]) continue; seen[p] = 1;
    if (!near(p * 4)) continue;
    o[p * 4 + 3] = 0;
    const x = p % W, y = (p / W) | 0;
    if (x > 0) stack.push(p - 1); if (x < W - 1) stack.push(p + 1); if (y > 0) stack.push(p - W); if (y < Hh - 1) stack.push(p + W);
  }
  // soften the edge by one pixel
  for (let y = 1; y < Hh - 1; y++) for (let x = 1; x < W - 1; x++) {
    const p = y * W + x; if (o[p * 4 + 3] === 0) continue;
    const n = (o[(p - 1) * 4 + 3] === 0) + (o[(p + 1) * 4 + 3] === 0) + (o[(p - W) * 4 + 3] === 0) + (o[(p + W) * 4 + 3] === 0);
    if (n) o[p * 4 + 3] = Math.min(o[p * 4 + 3], 255 - n * 50);
  }
  return out;
}

/* ---------------- Music (YouTube IFrame API) ---------------- */
const Music = {
  player: null, ready: false, current: null, loading: null,
  init() {
    $('#musicToggle').addEventListener('click', () => this.setOn(!S.meta.musicOn));
    $('#musicPlay').addEventListener('click', () => this.togglePlay());
    this.updateUI();
  },
  loadAPI() {
    if (this.loading) return this.loading;
    this.loading = new Promise((res, rej) => {
      window.onYouTubeIframeAPIReady = () => res();
      const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.onerror = () => rej(new Error('offline'));
      document.head.append(s);
    }).then(() => new Promise(res => {
      // build the iframe ourselves so YouTube always receives the page's address (missing it causes error 153)
      const old = document.getElementById('ytPlayer');
      const ifr = document.createElement('iframe');
      ifr.id = 'ytPlayer'; ifr.width = 160; ifr.height = 90; ifr.title = 'Page music';
      ifr.allow = 'autoplay; encrypted-media; picture-in-picture';
      ifr.referrerPolicy = 'strict-origin-when-cross-origin';
      ifr.src = `https://www.youtube.com/embed/${this.firstId || ''}?enablejsapi=1&playsinline=1&rel=0&autoplay=1&origin=${encodeURIComponent(location.origin)}`;
      old.replaceWith(ifr);
      if (this.firstId) this.current = this.firstId;
      this.player = new YT.Player(ifr, { events: {
        onReady: () => { this.ready = true; res(); },
        onStateChange: () => this.updateUI(),
        onError: ev => {
          const c = ev.data;
          toast(c === 101 || c === 150 ? "This video's owner doesn't allow it to play inside other sites. Try a different upload of the song." : c === 153 ? "YouTube couldn't verify this site. Open the diary from its web address, not a saved file." : c === 100 ? 'That video was removed or is private.' : "YouTube couldn't play that link.", 4200);
        },
      } });
    }));
    return this.loading;
  },
  setOn(on) {
    S.meta.musicOn = on; saveMeta();
    if (!on) { this.stop(); this.updateUI(); return; }
    this.pageChanged(true); this.updateUI();
  },
  songForSpread() { return visiblePages().map(p => p.music).find(m => m && m.id) || null; },
  async pageChanged(force) {
    if (!S.meta.musicOn || S.view !== 'book' || S.closed) { this.updateUI(); return; }
    const song = this.songForSpread();
    if (!song) { this.updateUI(); return; }
    if (song.id === this.current && !force) return;
    if (location.protocol === 'file:') { toast('Page music only works when the diary is opened from its web address (for example GitHub Pages).', 4200); return; }
    if (!this.player) this.firstId = song.id;
    try { await this.loadAPI(); } catch (e) { toast('Page music needs an internet connection.'); return; }
    if (song.id !== this.current) { this.player.loadVideoById(song.id); this.current = song.id; }
    else this.player.playVideo();
    setTimeout(() => {
      const t = this.player.getVideoData && this.player.getVideoData().title;
      if (t) { S.diary.pages.forEach(p => { if (p.music && p.music.id === song.id && p.music.title !== t) p.music.title = t; }); scheduleSave(); }
      this.updateUI();
    }, 1500);
    this.updateUI();
  },
  togglePlay() {
    if (!this.ready || !this.current) { this.pageChanged(true); return; }
    const st = this.player.getPlayerState();
    st === 1 ? this.player.pauseVideo() : this.player.playVideo();
  },
  stop() { if (this.ready) { try { this.player.pauseVideo(); } catch (e) {} } },
  updateUI() {
    const dock = $('#musicDock'); if (!dock) return;
    const on = !!S.meta.musicOn;
    dock.classList.toggle('on', on);
    $('#musicToggle').innerHTML = on ? ICON.sound : ICON.mute;
    $('#musicToggle').title = on ? 'Page music is on' : 'Page music is off';
    const playing = this.ready && this.player.getPlayerState && this.player.getPlayerState() === 1;
    $('#musicPlay').innerHTML = playing ? ICON.pause : ICON.play;
    $('#musicPlay').hidden = !on || !this.current;
    const song = S.diary && !S.closed ? this.songForSpread() : null;
    const t = this.ready && this.current && this.player.getVideoData ? this.player.getVideoData().title : '';
    $('#musicTitle').textContent = !on ? 'Page music off' : t ? t : song ? 'Loading song…' : 'No song on these pages';
  },
};
function onSpreadShown() { Music.pageChanged(false); }

/* ---------------- Backup / restore ---------------- */
async function buildBackup(diaries) {
  const ids = new Set();
  diaries.forEach(d => collectBlobIds(d, ids));
  const drawer = diaries.length === S.diaries.length ? S.drawer : [];
  drawer.forEach(it => ids.add(it.blobId));
  (S.meta.templates || []).forEach(t => collectBlobIds(t, ids));
  (S.meta.washiCustom || []).forEach(t => t.blobId && ids.add(t.blobId));
  (S.meta.customFonts || []).forEach(f => ids.add(f.blobId));
  if (S.meta.theme && S.meta.theme.deskImage) ids.add(S.meta.theme.deskImage);
  const blobs = {};
  for (const id of ids) { const b = await getBlob(id); if (b) blobs[id] = await blobToDataURL(b); }
  return JSON.stringify({ app: 'dear-days', version: 1, exported: new Date().toISOString(), diaries, drawer, meta: S.meta, blobs });
}
async function backupAll() {
  if (S.diary) await saveNow();
  toast('Preparing backup…');
  const json = await buildBackup(S.diaries);
  download(`dear-diary-backup-${todayStr()}.json`, json);
}
async function backupDiary(d) {
  toast('Preparing backup…');
  const json = await buildBackup([d]);
  download(`dear-diary-${d.name.replace(/[^\w가-힣-]+/g, '_')}-${todayStr()}.json`, json);
}
async function restoreBackup() {
  const f = await pickFile('application/json,.json'); if (!f) return;
  let data;
  try { data = JSON.parse(await f.text()); if (data.app !== 'dear-days') throw 0; }
  catch (e) { toast("That file isn't a Dear Diary backup."); return; }
  const n = data.diaries.length, hasLook = !!(data.meta && (data.meta.theme || data.meta.titleFont));
  let withLook = hasLook;
  const ok = await new Promise(res => {
    let done = false;
    const body = h('div', { class: 'restore-body' },
      h('p', {}, `This adds ${n} diar${n === 1 ? 'y' : 'ies'} from ${new Date(data.exported).toLocaleDateString('en-GB')}. A diary that already exists here is replaced by the backup's version.`),
      hasLook ? toggle('Also restore the colour theme, title font and desk photo', true, v => { withLook = v; }) : null);
    modal({ title: 'Restore backup?', body, onClose: () => { if (!done) res(false); }, actions: [
      { label: 'Cancel', run: () => { done = true; res(false); } },
      { label: 'Restore', kind: 'primary', run: () => { done = true; res(true); } }] });
  });
  if (!ok) return;
  for (const [id, url] of Object.entries(data.blobs || {})) { const b = await dataURLToBlob(url); await storeBlobRecord(id, b); }
  for (const d of data.diaries) await DB.put('diaries', d);
  for (const it of data.drawer || []) await DB.put('drawer', it);
  if (data.meta) {
    const m = S.meta;
    m.collections = [...new Set(m.collections.concat(data.meta.collections || []))];
    const tIds = new Set((m.templates || []).map(t => t.id)); m.templates = (m.templates || []).concat((data.meta.templates || []).filter(t => !tIds.has(t.id)));
    const fNames = new Set((m.customFonts || []).map(f => f.name)); m.customFonts = (m.customFonts || []).concat((data.meta.customFonts || []).filter(f => !fNames.has(f.name)));
    m.washiCustom = (m.washiCustom || []).concat((data.meta.washiCustom || []).filter(t => !(m.washiCustom || []).some(x => JSON.stringify(x) === JSON.stringify(t))));
    if (withLook) {
      if (data.meta.theme) m.theme = data.meta.theme;
      if (data.meta.titleFont) m.titleFont = data.meta.titleFont;
      if (data.meta.musicOn != null) m.musicOn = data.meta.musicOn;
      if (data.meta.recentColors) m.recentColors = data.meta.recentColors;
    }
    await saveMeta();
  }
  await loadAll(); await loadCustomFonts();
  if (S.meta.theme && S.meta.theme.deskImage) await loadBlob(S.meta.theme.deskImage);
  applyTheme(); applyTitleFont(); renderLibrary(); toast(withLook ? 'Backup restored, including your theme' : 'Backup restored');
}

/* ---------------- Desk ---------------- */
function applyDesk() {
  const d = S.meta.desk || { kind: 'preset', value: 'dream' }, b = document.body;
  b.style.backgroundSize = ''; b.style.backgroundImage = '';
  if (d.kind === 'color') { b.style.background = d.value; }
  else if (d.kind === 'image' && d.blobId) { const u = blobURL(d.blobId); b.style.background = u ? `url("${u}") center/cover fixed` : '#FFE9F1'; }
  else b.style.background = (DESKS.find(x => x.id === d.value) || DESKS[0]).css;
  b.classList.toggle('desk-dark', d.kind === 'preset' ? ['walnut', 'night'].includes(d.value) : d.kind === 'color' ? isDark(d.value) : !!d.dark);
}
function deskPicker() {
  const g = h('div', { class: 'desk-grid' });
  const cur = S.meta.desk || {};
  DESKS.forEach(dk => g.append(h('button', { class: 'desk-sw' + (cur.kind === 'preset' && cur.value === dk.id ? ' on' : ''), style: { background: dk.css }, onclick: () => { S.meta.desk = { kind: 'preset', value: dk.id }; saveMeta(); applyDesk(); closeTop(); deskPicker(); } }, h('span', {}, dk.name))));
  modal({ title: 'Desk', body: h('div', {},
    h('p', { class: 'muted small' }, 'The surface your diaries rest on.'), g,
    row('Own colour', swatches([], cur.kind === 'color' ? cur.value : '#AEB6C1', (c, live) => { S.meta.desk = { kind: 'color', value: c }; applyDesk(); if (!live) saveMeta(); })),
    h('button', { class: 'btn block', onclick: async () => { const f = await pickFile('image/*'); if (!f) return; const n = await normalizeImage(f, 2400); const id = await putBlob(n.blob); S.meta.desk = { kind: 'image', blobId: id, dark: false }; saveMeta(); applyDesk(); } }, h('span', { html: ICON.image }), 'Use my own photo')),
    actions: [{ label: 'Done', kind: 'primary' }] });
}

/* ---------------- Shortcuts ---------------- */
function showShortcuts() {
  const list = [['V T N W P E', 'Select · Text · Note · Washi · Pen · Eraser'], ['I', 'Add an image'], ['Double-click / Enter', 'Edit text or note'], ['Shift + click / drag box', 'Select several'], ['Ctrl + drag', 'Copy while dragging'], ['Ctrl + C / V', 'Copy / paste items (or paste an image)'], ['Ctrl + D', 'Duplicate'], ['Ctrl + G', 'Group'], ['Ctrl + Shift + G', 'Ungroup'], ['Ctrl + E', 'Save as image or PDF'], ['Ctrl + Z', 'Undo'], ['Ctrl + Shift + Z', 'Redo'], ['Ctrl + A', 'Select everything on the page'], ['Delete', 'Delete selection'], ['Arrow keys', 'Nudge (Shift = 10px), or turn pages'], ['[ / ]', 'Send backward / bring forward'], ['L', 'Lock or unlock'], ['Esc', 'Back to select tool']];
  modal({ title: 'Keyboard shortcuts', body: h('dl', { class: 'keys' }, list.flatMap(([k, v]) => [h('dt', {}, k.split(' / ').map((x, i) => [i ? ' / ' : '', h('kbd', {}, x)])), h('dd', {}, v)])), actions: [{ label: 'Close', kind: 'primary' }] });
}

/* ---------------- Boot ---------------- */
async function loadAll() {
  S.diaries = (await DB.all('diaries')) || [];
  S.drawer = (await DB.all('drawer')) || [];
  const m = await DB.get('meta', 'meta');
  if (m) S.meta = Object.assign(S.meta, m.value);
  if (!S.meta.collections.includes('Unsorted')) S.meta.collections.unshift('Unsorted');
  if (S.meta.desk && S.meta.desk.blobId) await loadBlob(S.meta.desk.blobId);
}
let _installPrompt = null;
function runSplash() {
  try { const v = JSON.parse(localStorage.getItem('dd-theme-vars') || 'null'); if (v) Object.entries(v).forEach(([k, x]) => document.documentElement.style.setProperty(k, x)); } catch (e) {}
  try { applyTitleFont(localStorage.getItem('dd-title-font')); } catch (e) {}
  const sp = $('#splash'); if (!sp) return;
  const end = () => { sp.classList.add('done'); setTimeout(() => sp.remove(), 800); };
  let seen = false; try { seen = sessionStorage.getItem('dd-splash') === '1'; sessionStorage.setItem('dd-splash', '1'); } catch (e) {}
  if (seen) { sp.remove(); return; }
  sp.addEventListener('click', end);
  if (reducedMotion()) { sp.querySelectorAll('.sp-word,.sp-sub').forEach(e => e.style.opacity = 1); setTimeout(end, 700); return; }
  sp.classList.add('play');
  setTimeout(end, 4000);
}
async function boot() {
  runSplash();
  document.title = APP_NAME;
  $$('.app-name').forEach(e => e.textContent = APP_NAME);
  try { await DB.open(); } catch (e) { document.body.innerHTML = '<p style="padding:40px;font-family:system-ui">This browser blocked storage, so the diary can’t save. Try a normal (not private) window.</p>'; return; }
  await loadAll();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if (!S.diaries.length) {
    const d = newDiary('Dear Diary');
    d.cover.texture = 'plushie-babypink';
    S.diaries.push(d); await DB.put('diaries', clone(d));
  }
  if (!S.meta.theme && S.meta.desk && S.meta.desk.kind === 'image' && S.meta.desk.blobId) S.meta.theme = Object.assign({}, DEFAULT_THEME, { deskImage: S.meta.desk.blobId });
  if (S.meta.theme && S.meta.theme.deskImage) await loadBlob(S.meta.theme.deskImage);
  applyTheme(); applyTitleFont(); loadCustomFonts();
  // toolbar wiring
  $$('#rail [data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
  $$('#rail [data-panel]').forEach(b => b.addEventListener('click', () => { if (S.closed) openBook(); openFlyout(b.dataset.panel); }));
  $('#btnImage').addEventListener('click', () => { if (S.closed) openBook(); pickImages(); });
  $('#btnUndo').addEventListener('click', undo); $('#btnRedo').addEventListener('click', redo);
  $('#btnHistory').addEventListener('click', () => openFlyout('history'));
  $('#btnPrev').addEventListener('click', () => flip(-1)); $('#btnNext').addEventListener('click', () => flip(1));
  $('#btnIndexBar').addEventListener('click', () => { if (S.closed) openBook(); openFlyout('index'); });
  $('#btnAddPage').addEventListener('click', () => { if (S.closed) return openBook(); addPage(); });
  $('#btnZoomIn').addEventListener('click', () => { S.zoom = Math.min(3, Math.round((S.zoom + .25) * 4) / 4); fitStage(); refreshSelection(); });
  $('#btnZoomOut').addEventListener('click', () => { S.zoom = Math.max(.5, Math.round((S.zoom - .25) * 4) / 4); fitStage(); refreshSelection(); });
  $('#btnFit').addEventListener('click', () => { S.zoom = 1; fitStage(); refreshSelection(); });
  $('#btnCover').addEventListener('click', () => coverEditor(S.diary));
  $('#btnExport').addEventListener('click', exportModal);
  $('#btnToCover').addEventListener('click', () => S.closed ? openBook() : closeBook());
  $('#btnFirst').addEventListener('click', () => S.closed ? openBook() : flipTo(0));
  $('#btnLast').addEventListener('click', () => { const t = Math.max(0, Math.ceil(virtualPages().length / 2) - 1); if (S.closed) { S.spread = t; openBook(); } else flipTo(t); });
  $('#btnBookmark').addEventListener('click', () => { const p = activePageObj(); if (!p) { toast('Click a page first, then bookmark it.'); return; } p.bookmarked = !p.bookmarked; commit(p.bookmarked ? 'Bookmark' : 'Remove bookmark'); rerenderPageDOM(p.id); renderInspector(); updateNav(); toast(p.bookmarked ? `Page ${pageNumber(p)} bookmarked` : 'Bookmark removed'); });
  $('#btnLibrary').addEventListener('click', backToLibrary);
  $('#diaryName').addEventListener('click', () => renameDiary(S.diary));
  $('#btnHelp').addEventListener('click', showShortcuts);
  $('#btnPanel').addEventListener('click', () => document.body.classList.toggle('insp-open'));
  $('#btnNewDiary').addEventListener('click', createDiary);
  $('#btnBackup').addEventListener('click', backupAll);
  $('#btnRestore').addEventListener('click', restoreBackup);
  $('#btnDesk').addEventListener('click', themePicker);
  $('#btnInstall').addEventListener('click', async () => { if (!_installPrompt) return; _installPrompt.prompt(); await _installPrompt.userChoice; _installPrompt = null; $('#btnInstall').hidden = true; });
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); _installPrompt = e; $('#btnInstall').hidden = false; });
  $$('[data-icon]').forEach(e => e.insertAdjacentHTML('afterbegin', ICON[e.dataset.icon]));
  window.addEventListener('beforeunload', () => { if (S.diary) saveNow(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && S.diary) saveNow(); });
  initEditor();
  Music.init();
  showView('library');
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
}
document.addEventListener('DOMContentLoaded', boot);
