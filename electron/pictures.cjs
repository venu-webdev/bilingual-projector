// Pictures: saving pasted or chosen images into the app's media folder, and finding openly licensed
// photographs on Wikimedia Commons (free, no key). Every network call happens here in the main
// process, so the pages never talk to the internet themselves.
const fs = require('node:fs');
const path = require('node:path');
const { net } = require('electron');

const UA = 'BilingualProjector/0.1 (church projection app; https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia)';
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const MAX = 40 * 1024 * 1024;

const safeName = (s) => String(s || 'picture').replace(/\.[a-z0-9]+$/i, '').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'picture';

function saveBytes(dir, name, bytes, mime) {
  const ext = EXT[mime] || path.extname(name || '').toLowerCase() || '.png';
  if (!['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) throw new Error('Only JPEG, PNG, WebP and GIF pictures can be used');
  if (bytes.length > MAX) throw new Error('That picture is over 40 MB');
  const file = `${Date.now().toString(36)}-${safeName(name)}${ext}`;
  fs.writeFileSync(path.join(dir, file), bytes);
  return { url: `media://file/${encodeURIComponent(file)}`, name: safeName(name).replace(/-/g, ' ') };
}

function copyFile(dir, src) {
  const bytes = fs.readFileSync(src);
  return saveBytes(dir, path.basename(src), bytes, null);
}

const strip = (html) => String(html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

// Commons search: photographs only (bitmaps), with a thumbnail for the grid and a 1920px copy for the screen.
async function search(query) {
  const q = String(query || '').trim();
  if (!q) return [];
  const u = new URL('https://commons.wikimedia.org/w/api.php');
  Object.entries({
    action: 'query', format: 'json', formatversion: '2', origin: '*',
    generator: 'search', gsrsearch: `${q} filetype:bitmap -poster -card -map -diagram -logo -flag -stamp -cover -coat -scan -page -text -chart -seal`, gsrnamespace: '6', gsrlimit: '30',
    prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '1920', iiextmetadatafilter: 'Artist|LicenseShortName|ImageDescription',
  }).forEach(([k, v]) => u.searchParams.set(k, v));
  const res = await net.fetch(u.toString(), { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Wikimedia Commons answered ${res.status}`);
  const data = await res.json();
  const pages = (data.query && data.query.pages) || [];
  return pages
    .sort((a, b) => (a.index || 0) - (b.index || 0))
    .map((p) => ({ p, i: p.imageinfo && p.imageinfo[0] }))
    .filter(({ i }) => i && /image\/(jpeg|png|webp)/.test(i.mime) && i.width >= 800)
    .map(({ p, i }) => {
      const meta = i.extmetadata || {};
      const author = strip(meta.Artist && meta.Artist.value) || 'Unknown';
      const license = strip(meta.LicenseShortName && meta.LicenseShortName.value) || 'see source';
      return {
        title: p.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, ''),
        // Wikimedia serves resized copies only at standard widths (330, 500, 960, ...); 330 suits the grid
        thumb: i.thumburl ? i.thumburl.replace(/\/\d+px-/, '/330px-') : i.url,
        full: i.thumburl || i.url,
        page: i.descriptionurl,
        w: i.width, h: i.height,
        credit: `${author}, ${license}, Wikimedia Commons`,
      };
    });
}

// Only Wikimedia's own image servers (originals and resized copies), so a crafted result can never make the app fetch anything else.
async function download(dir, { url, title }) {
  const u = new URL(url);
  if (u.protocol !== 'https:' || !['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(u.hostname)) throw new Error('Pictures can only be downloaded from Wikimedia Commons');
  const res = await net.fetch(u.toString(), { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const mime = (res.headers.get('content-type') || '').split(';')[0];
  if (!EXT[mime]) throw new Error('That file is not a picture');
  return saveBytes(dir, title, Buffer.from(await res.arrayBuffer()), mime);
}

module.exports = { saveBytes, copyFile, search, download };
