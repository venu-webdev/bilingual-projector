// A tiny web server for OBS Browser Sources.
//   /overlay.html          the transparent overlay page: reference card, lower third (and its /assets)
//   /overlay.html?screen   the same frames drawn full screen: an exact copy of the projector output
//   /events                server-sent events: the latest frame on connect, then every change
//   /media/<name>          pictures and backgrounds from the app's media folder
//   /remote.html           the phone remote: anyone may view; controlling needs the PIN shown in the app
//   POST /remote/cmd       { pin, action, index }: the only request that changes anything, and only
//                          while the remote is on; five wrong PINs lock that address out for a minute
//
// Two listeners share one handler:
//   - this computer only, 127.0.0.1:7357, always on (OBS on the same laptop)
//   - the network, 0.0.0.0:7358, only while the operator turns "OBS on another computer" on
// Both are read-only except POST /remote/cmd, which needs the remote switched on and its PIN.
// No dependencies: node:http. Files are served only from dist/ and the media folder, never from anywhere else.
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

// This computer's addresses on the local network, the one a phone or another laptop can reach first.
// Nothing is hidden: VPNs (Cloudflare WARP, Tailscale, ...) and private virtual networks (Hyper-V's
// Default Switch, WSL, Docker) are listed last and marked, because devices on the church Wi-Fi cannot
// reach them. A Hyper-V *external* switch carries the real network card, so it counts as the network.
const VPN = /warp|cloudflare|tailscale|zerotier|wireguard|openvpn|nordlynx|proton|mullvad|\bvpn\b|\btun\d*|\btap\b|utun/i;
const VIRTUAL = /default switch|wsl|docker|virtualbox|vmware|vmnet|vbox|host-only|loopback|br-[0-9a-f]+|virbr/i;
function lanAddresses(interfaces = os.networkInterfaces()) {
  const out = [];
  for (const [name, list] of Object.entries(interfaces)) {
    for (const a of list || []) {
      if (a.family !== 'IPv4' || a.internal || a.address.startsWith('169.254.')) continue;
      const kind = VPN.test(name) ? 'vpn' : VIRTUAL.test(name) ? 'virtual' : 'network';
      out.push({ name, ip: a.address, kind });
    }
  }
  const rankKind = { network: 0, virtual: 1, vpn: 2 };
  const rankRange = (ip) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : 3);
  return out.sort((x, y) => rankKind[x.kind] - rankKind[y.kind] || rankRange(x.ip) - rankRange(y.ip));
}

function startOverlayServer(dist, { port = 7357, lanPort = 7358, tries = 10, media = null, onRemote = null } = {}) {
  const clients = new Set();
  let last = null;
  let lastRemote = null;

  // ---- the phone remote ----
  const ACTIONS = new Set(['check', 'next', 'prev', 'black', 'hide', 'back', 'go', 'stream']);
  const misses = new Map(); // address -> { n, until }
  const samePin = (a, b) => typeof a === 'string' && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  const json = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
  function remoteCommand(req, res) {
    if (!api.remote.on) return json(res, 403, { error: 'The remote is switched off in the app.' });
    const who = req.socket.remoteAddress || '?';
    const now = Date.now();
    const m = misses.get(who);
    if (m && m.until > now) return json(res, 429, { error: 'Too many wrong PINs. Wait a minute.' });
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 2048) req.destroy(); });
    req.on('end', () => {
      let cmd;
      try { cmd = JSON.parse(body); } catch { return json(res, 400, { error: 'Bad request' }); }
      if (!samePin(String(cmd.pin || ''), api.remote.pin)) {
        // Count wrong PINs per address within ten minutes; the fifth locks that address for a minute.
        // A lock that has run out starts the count again.
        const fresh = !m || (m.until && m.until <= now) || now - m.first > 600000;
        const n = fresh ? 1 : m.n + 1;
        misses.set(who, { n, first: fresh ? now : m.first, until: n >= 5 ? now + 60000 : 0 });
        return json(res, n >= 5 ? 429 : 403, { error: n >= 5 ? 'Too many wrong PINs. Wait a minute.' : 'Wrong PIN' });
      }
      misses.delete(who);
      if (!ACTIONS.has(cmd.action)) return json(res, 400, { error: 'Unknown action' });
      const index = Number.isInteger(cmd.index) && cmd.index >= 0 && cmd.index < 5000 ? cmd.index : null;
      if (cmd.action !== 'check' && onRemote) onRemote({ action: cmd.action, index });
      json(res, 200, { ok: true });
    });
  }

  const handler = (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'POST' && url.pathname === '/remote/cmd') return remoteCommand(req, res);
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
    if (url.pathname === '/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write('retry: 1000\n\n');
      if (last) res.write(`event: frame\ndata: ${last}\n\n`);
      if (lastRemote) res.write(`event: remote\ndata: ${lastRemote}\n\n`);
      clients.add(res);
      const ping = setInterval(() => res.write(': ping\n\n'), 20000);
      req.on('close', () => { clearInterval(ping); clients.delete(res); });
      return;
    }
    // /media/<name>: the pictures and backgrounds the operator added (flat folder, name only)
    const isMedia = media && url.pathname.startsWith('/media/');
    const rel = isMedia ? path.basename(decodeURIComponent(url.pathname.slice(7))) : decodeURIComponent(url.pathname === '/' ? '/overlay.html' : url.pathname).replace(/^\/+/, '');
    const root = isMedia ? media : dist;
    const file = path.resolve(root, rel);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  };

  const api = {
    url: null,
    lan: { on: false, port: null, error: null },
    send(frame) {
      // the app's media:// addresses become this server's /media/ addresses, which OBS can load
      last = JSON.stringify(frame).replaceAll('media://file/', '/media/');
      for (const c of clients) c.write(`event: frame\ndata: ${last}\n\n`);
    },
    clients: () => clients.size,
    remote: { on: false, pin: '' },
    // Switching the remote on makes a new 6-digit PIN every time.
    setRemote(on) {
      api.remote = on ? { on: true, pin: String(crypto.randomInt(0, 1000000)).padStart(6, '0') } : { on: false, pin: '' };
      misses.clear();
      return api.remote;
    },
    sendRemote(frame) {
      lastRemote = JSON.stringify(frame).replaceAll('media://file/', '/media/');
      for (const c of clients) c.write(`event: remote\ndata: ${lastRemote}\n\n`);
    },
    // Stop both listeners and end open event streams (app quit, tests).
    close() {
      for (const c of clients) c.end();
      clients.clear();
      if (lanServer) { for (const x of sockets) x.destroy(); lanServer.close(); lanServer = null; }
      local.close();
      local.closeAllConnections?.();
    },
    remoteInfo() {
      const lan = api.lanInfo();
      return { ...api.remote, local: api.url ? api.url.replace('overlay.html', 'remote.html') : '', addresses: (lan.addresses || []).map((a) => ({ name: a.name, kind: a.kind, url: a.overlay.replace('overlay.html', 'remote.html') })) };
    },
    lanInfo() {
      const ips = api.lan.on ? lanAddresses() : [];
      return { ...api.lan, addresses: ips.map(({ name, ip, kind }) => ({ name, kind, overlay: `http://${ip}:${api.lan.port}/overlay.html`, screen: `http://${ip}:${api.lan.port}/overlay.html?screen` })) };
    },
    // Turn the network listener on or off. Resolves once it is actually listening (or failed).
    setLan(on) {
      if (!on) {
        if (lanServer) { for (const s of sockets) s.destroy(); sockets.clear(); lanServer.close(); lanServer = null; }
        api.lan = { on: false, port: null, error: null };
        return Promise.resolve(api.lanInfo());
      }
      if (lanServer) return Promise.resolve(api.lanInfo());
      return new Promise((resolve) => {
        let p = lanPort;
        lanServer = http.createServer(handler);
        lanServer.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
        lanServer.on('error', (e) => {
          if (e.code === 'EADDRINUSE' && p < lanPort + tries) { p++; lanServer.listen(p, '0.0.0.0'); return; }
          lanServer = null;
          api.lan = { on: false, port: null, error: e.message };
          resolve(api.lanInfo());
        });
        lanServer.on('listening', () => { api.lan = { on: true, port: p, error: null }; resolve(api.lanInfo()); });
        lanServer.listen(p, '0.0.0.0');
      });
    },
  };
  let lanServer = null;
  const sockets = new Set();

  // This computer: the first free port from 7357 up, so a second copy of the app or another program never blocks it.
  const local = http.createServer(handler);
  let p = port;
  const listen = () => local.listen(p, '127.0.0.1');
  local.on('error', (e) => { if (e.code === 'EADDRINUSE' && p < port + tries) { p++; listen(); } });
  local.on('listening', () => { api.url = `http://127.0.0.1:${p}/overlay.html`; });
  listen();
  return api;
}

module.exports = { startOverlayServer, lanAddresses };
