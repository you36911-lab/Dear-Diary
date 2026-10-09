/* Dear Diary — export pages as PNG or PDF */
const _scripts = {};
function loadScript(src) {
  if (_scripts[src]) return _scripts[src];
  _scripts[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { delete _scripts[src]; rej(new Error('load')); }; document.head.append(s); });
  return _scripts[src];
}
async function ensureExportLibs(pdf) {
  await loadScript('https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js');
  if (pdf) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
}
const nextFrame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
function sideOf(page) { const i = virtualPages().findIndex(p => p.id === page.id); return i % 2 ? 'right' : 'left'; }
async function snapshotNode(node, w, hgt, type = 'png', ratio = 2) {
  const host = h('div', { class: 'export-host' }, node);
  document.body.append(host);
  try {
    await preloadBlobs(S.diary);
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    await nextFrame();
    const opts = { width: w, height: hgt, pixelRatio: ratio, quality: .92, cacheBust: false, backgroundColor: '#ffffff' };
    return type === 'jpeg' ? await htmlToImage.toJpeg(node, opts) : await htmlToImage.toPng(node, opts);
  } finally { host.remove(); }
}
const pageNode = page => renderPage(page, sideOf(page), { static: true });
const safeName = s => (s || 'diary').replace(/[^\w가-힣\- ]+/g, '').trim().replace(/\s+/g, '-') || 'diary';

function exportModal() {
  if (!S.diary) return;
  if (S.closed) { toast('Open the diary first.'); return; }
  const status = h('p', { class: 'muted small', 'aria-live': 'polite' }, '');
  const total = S.diary.pages.length;
  const from = h('input', { class: 'input', type: 'number', min: 1, max: total, value: 1, 'aria-label': 'From page' });
  const to = h('input', { class: 'input', type: 'number', min: 1, max: total, value: total, 'aria-label': 'To page' });
  let busy = false;
  const run = async (fn, btn) => {
    if (busy) return; busy = true; btn.disabled = true;
    try { await fn(); status.textContent = 'Saved to your downloads.'; }
    catch (e) { console.error(e); status.textContent = "Couldn't export. The first export needs an internet connection to download the export tool."; }
    busy = false; btn.disabled = false;
  };
  const opt = (icon, title, sub, fn) => { const b = h('button', { class: 'export-opt', html: ICON[icon] }, h('div', {}, h('b', {}, title), h('span', {}, sub))); b.addEventListener('click', () => run(fn, b)); return b; };
  const body = h('div', { class: 'export-opts' },
    opt('image', 'This page', 'PNG image of the page you last clicked', async () => {
      const p = activePageObj(); if (!p) throw new Error('no page');
      status.textContent = 'Preparing image…'; await ensureExportLibs(false);
      const url = await snapshotNode(pageNode(p), PW, PH);
      download(`${safeName(S.diary.name)}-page-${pageNumber(p)}.png`, await dataURLToBlob(url));
    }),
    opt('book', 'These two pages', 'PNG image of the open spread', async () => {
      const ps = visiblePages(); if (!ps.length) throw new Error('no page');
      status.textContent = 'Preparing image…'; await ensureExportLibs(false);
      const vp = virtualPages(), l = vp[S.spread * 2], r = vp[S.spread * 2 + 1];
      const node = h('div', { class: 'export-spread' }, renderPage(l, 'left', { static: true }), renderPage(r, 'right', { static: true }));
      const url = await snapshotNode(node, PW * 2, PH);
      download(`${safeName(S.diary.name)}-pages-${ps.map(pageNumber).join('-')}.png`, await dataURLToBlob(url));
    }),
    opt('download', 'Pages as a PDF', 'Choose the range below. Every page becomes one PDF page', async () => {
      const a = clamp(+from.value || 1, 1, total), b = clamp(+to.value || total, a, total);
      status.textContent = 'Loading the PDF tool…'; await ensureExportLibs(true);
      const { jsPDF } = window.jspdf, W = PW * .75, Hh = PH * .75;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [W, Hh] });
      for (let i = a; i <= b; i++) {
        status.textContent = `Rendering page ${i} of ${b}…`;
        const url = await snapshotNode(pageNode(S.diary.pages[i - 1]), PW, PH, 'jpeg', 2);
        if (i > a) doc.addPage([W, Hh], 'portrait');
        doc.addImage(url, 'JPEG', 0, 0, W, Hh);
      }
      status.textContent = 'Saving PDF…';
      doc.save(`${safeName(S.diary.name)}${a === 1 && b === total ? '' : `-p${a}-${b}`}.pdf`);
    }),
    h('div', { class: 'export-range' }, 'Pages', from, 'to', to, h('span', { class: 'muted' }, `of ${total}`)),
    status);
  modal({ title: 'Save pages', body, actions: [{ label: 'Done', kind: 'primary' }] });
}
