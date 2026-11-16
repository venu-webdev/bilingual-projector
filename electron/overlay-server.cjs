// A tiny web server for OBS Browser Sources.
//   /overlay.html          the transparent overlay page: reference card, lower third (and its /assets)
//   /overlay.html?screen   the same frames drawn full screen: an exact copy of the projector output
//   /events                server-sent events: the latest frame on connect, then every change
//   /media/<name>          pictures and backgrounds from the app's media folder
//
// Two listeners share one handler:
//   - this computer only, 127.0.0.1:7357, always on (OBS on the same laptop)
//   - the network, 0.0.0.0:7358, only while the operator turns "OBS on another computer" on
// Both are read-only: they show what is on screen and accept nothing back.
// No dependencies: node:http. Files are served only from dist/ and the media folder, never from anywhere else.
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

// This computer's addresses on the local network (Wi-Fi, Ethernet), private ranges first.
function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family !== 'IPv4' || a.internal || a.address.startsWith('169.254.')) continue;
      if (/vEthernet|VirtualBox|VMware|Hyper-V|WSL|Loopback|vpn|tap|tun/i.test(name)) continue;
      out.push({ name, ip: a.address });
    }
  }
  const priv = (ip) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
  return out.sort((x, y) => priv(y.ip) - priv(x.ip));
}

function startOverlayServer(dist, { port = 7357, lanPort = 7358, tries = 10, media = null } = {}) {
  const clients = new Set();
  let last = null;

  const handler = (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
    if (url.pathname === '/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write('retry: 1000\n\n');
      if (last) res.write(`event: frame\ndata: ${last}\n\n`);
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
    lanInfo() {
      const ips = api.lan.on ? lanAddresses() : [];
      return { ...api.lan, addresses: ips.map(({ name, ip }) => ({ name, overlay: `http://${ip}:${api.lan.port}/overlay.html`, screen: `http://${ip}:${api.lan.port}/overlay.html?screen` })) };
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
