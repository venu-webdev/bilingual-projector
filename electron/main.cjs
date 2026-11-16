// Main process: two windows (the operator's control window and the output on the projector screen),
// the library store, and a media:// protocol so backgrounds load without turning off web security.
const { app, BrowserWindow, ipcMain, screen, dialog, protocol, net, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { Store } = require('./store.cjs');
const { startOverlayServer } = require('./overlay-server.cjs');
const pictures = require('./pictures.cjs');

const DEV_URL = process.env.PROJECTOR_DEV_URL; // set by scripts/dev.mjs
const DIST = path.join(__dirname, '..', 'dist');

// Linux AppImage: newer Ubuntu (24.04 on) blocks the sandbox helper an AppImage cannot install, and the
// app would not start at all. Only the AppImage turns Chromium's system sandbox off; the .deb installs the
// helper properly and keeps it. The pages stay isolated either way (contextIsolation, no Node in pages).
if (process.platform === 'linux' && process.env.APPIMAGE) app.commandLine.appendSwitch('no-sandbox');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
  { scheme: 'media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

let overlay = null;
let store, control = null, output = null, lastFrame = null, stage = null, lastStageFrame = null;
const mediaDir = () => path.join(app.getPath('userData'), 'media');

const webPreferences = { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false, backgroundThrottling: false };
const load = (win, page) => win.loadURL(DEV_URL ? `${DEV_URL}/${page}` : `app://bundle/${page}`);

function createControl() {
  control = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1100, minHeight: 680, show: false,
    backgroundColor: '#15181d', title: 'Bilingual Projector', autoHideMenuBar: true, webPreferences,
  });
  control.once('ready-to-show', () => { control.maximize(); control.show(); });
  load(control, 'control.html');
  control.on('closed', () => { control = null; if (output) output.close(); if (stage) stage.close(); });
  // Links open in the browser, never inside the app.
  control.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

function displays() {
  const primary = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d, i) => ({ id: String(d.id), label: `Screen ${i + 1}${d.id === primary ? ' (this screen)' : ''}`, width: d.size.width, height: d.size.height, primary: d.id === primary }));
}

function openOutput(displayId, mode) {
  waiting.output = null; // a deliberate start replaces any resume that was pending
  const all = screen.getAllDisplays();
  const target = all.find((d) => String(d.id) === String(displayId)) || all.find((d) => d.id !== screen.getPrimaryDisplay().id) || screen.getPrimaryDisplay();
  if (output) output.close();
  const full = mode === 'fullscreen';
  output = new BrowserWindow({
    ...target.bounds, frame: false, show: false, backgroundColor: '#000000', title: 'Projector output',
    fullscreen: full, alwaysOnTop: full, skipTaskbar: full, resizable: false, autoHideMenuBar: true, webPreferences,
  });
  // Windowed mode is a borderless window covering the screen: OBS and screen sharing can capture it.
  if (!full) output.setBounds(target.bounds);
  load(output, 'output.html');
  output.once('ready-to-show', () => output.showInactive());
  output.webContents.on('did-finish-load', () => { if (lastFrame) output.webContents.send('output:frame', lastFrame); });
  output.on('closed', () => { output = null; outputOn = null; send('output:status', status()); });
  outputOn = { displayId: String(target.id), mode };
  send('output:status', status(String(target.id)));
  return status(String(target.id));
}

// Screens come and go during a service (a loose HDMI cable). Which screen each window is on is kept here:
// when its screen is unplugged the window closes (instead of jumping onto the operator's laptop), and
// when that same screen comes back it reopens there by itself.
let outputOn = null, stageOn = null;       // { displayId, mode } while open
const waiting = { output: null, stage: null }; // closed because their screen went away

function onDisplayRemoved(_e, gone) {
  const id = String(gone.id);
  if (outputOn && outputOn.displayId === id && output) { waiting.output = { ...outputOn }; output.close(); send('displays:event', { kind: 'lost', what: 'projector' }); }
  if (stageOn && stageOn.displayId === id && stage) { waiting.stage = { ...stageOn }; stage.close(); send('displays:event', { kind: 'lost', what: 'stage' }); }
  send('displays:changed', displays());
}
function onDisplayAdded(_e, added) {
  const id = String(added.id);
  const d = displays().find((x) => x.id === id);
  send('displays:changed', displays());
  // give Windows a moment to settle the new screen's position before placing a window on it
  setTimeout(() => {
    let resumed = false;
    if (waiting.output && waiting.output.displayId === id) { openOutput(id, waiting.output.mode); waiting.output = null; resumed = true; send('displays:event', { kind: 'back', what: 'projector', label: d && d.label }); }
    if (waiting.stage && waiting.stage.displayId === id) { openStage(id); waiting.stage = null; resumed = true; send('displays:event', { kind: 'back', what: 'stage', label: d && d.label }); }
    if (!resumed) send('displays:event', { kind: 'added', label: d ? `${d.label} ${d.width} × ${d.height}` : 'A screen' });
  }, 1200);
}
function onDisplayChanged(_e, changed) {
  const id = String(changed.id);
  // a new resolution or position: keep the windows covering their screen exactly
  if (outputOn && outputOn.displayId === id && output && outputOn.mode !== 'fullscreen') output.setBounds(changed.bounds);
  if (stageOn && stageOn.displayId === id && stage) stage.setBounds(changed.bounds);
  send('displays:changed', displays());
}

// The stage screen: the pastor's view on a monitor at the front, never seen by the room.
function openStage(displayId) {
  waiting.stage = null;
  const all = screen.getAllDisplays();
  const target = all.find((d) => String(d.id) === String(displayId)) || all.find((d) => d.id !== screen.getPrimaryDisplay().id) || screen.getPrimaryDisplay();
  if (stage) stage.close();
  stage = new BrowserWindow({ ...target.bounds, frame: false, show: false, backgroundColor: '#000000', title: 'Stage view', resizable: false, autoHideMenuBar: true, webPreferences });
  stage.setBounds(target.bounds);
  load(stage, 'stage.html');
  stage.once('ready-to-show', () => stage.showInactive());
  stage.webContents.on('did-finish-load', () => { if (lastStageFrame) stage.webContents.send('stage:frame', lastStageFrame); });
  stage.on('closed', () => { stage = null; stageOn = null; send('stage:status', { open: false, displayId: null }); });
  stageOn = { displayId: String(target.id) };
  const st = { open: true, displayId: String(target.id) };
  send('stage:status', st);
  return st;
}

const status = (displayId) => ({ open: !!output && !output.isDestroyed(), displayId: displayId || (store && store.get().settings.output.displayId) });
const send = (ch, payload) => { if (control && !control.isDestroyed()) control.webContents.send(ch, payload); };

app.whenReady().then(() => {
  store = new Store(app.getPath('userData'));
  fs.mkdirSync(mediaDir(), { recursive: true });

  // app://bundle/<path> serves the built pages from dist/, and nothing outside it.
  protocol.handle('app', (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '') || 'control.html';
    const file = path.resolve(DIST, rel);
    if (!file.startsWith(DIST + path.sep)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });

  // media://file/<name> serves only files inside the app's own media folder.
  protocol.handle('media', (req) => {
    const name = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '');
    const file = path.join(mediaDir(), path.basename(name));
    return net.fetch(pathToFileURL(file).toString());
  });

  ipcMain.handle('lib:get', () => store.get());
  ipcMain.handle('lib:patch', (_e, part) => store.patch(part));

  ipcMain.handle('lib:export', async () => {
    const r = await dialog.showSaveDialog(control, { title: 'Export library', defaultPath: path.join(app.getPath('documents'), `projector-library-${new Date().toISOString().slice(0, 10)}.json`), filters: [{ name: 'Library backup', extensions: ['json'] }] });
    if (r.canceled || !r.filePath) return null;
    fs.writeFileSync(r.filePath, JSON.stringify(store.get(), null, 1));
    return r.filePath;
  });

  ipcMain.handle('lib:import', async () => {
    const r = await dialog.showOpenDialog(control, { title: 'Import a backup (this app or Bilingual Projector Pro)', properties: ['openFile'], filters: [{ name: 'Backup', extensions: ['json'] }] });
    if (r.canceled || !r.filePaths[0]) return null;
    const json = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8').replace(/^﻿/, ''));
    const counts = store.import(json);
    return { ...counts, library: store.get() };
  });

  ipcMain.handle('media:pick', async (_e, kind) => {
    const filters = kind === 'video' ? [{ name: 'Video', extensions: ['mp4', 'webm', 'mov'] }] : [{ name: 'Image', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }];
    const r = await dialog.showOpenDialog(control, { title: kind === 'video' ? 'Choose a background video' : 'Choose a background image', properties: ['openFile'], filters });
    if (r.canceled || !r.filePaths[0]) return null;
    const src = r.filePaths[0];
    const name = `${Date.now().toString(36)}-${path.basename(src).replace(/[^\w.-]+/g, '-')}`;
    fs.copyFileSync(src, path.join(mediaDir(), name));
    return `media://file/${encodeURIComponent(name)}`;
  });

  // pictures: pasted bytes, chosen files, and Wikimedia Commons search and download
  ipcMain.handle('pictures:save', (_e, { name, bytes, mime }) => pictures.saveBytes(mediaDir(), name, Buffer.from(bytes), mime));
  ipcMain.handle('pictures:choose', async () => {
    const r = await dialog.showOpenDialog(control, { title: 'Add pictures', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Pictures', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }] });
    if (r.canceled) return [];
    return r.filePaths.map((f) => pictures.copyFile(mediaDir(), f));
  });
  ipcMain.handle('pictures:search', (_e, q) => pictures.search(q));
  ipcMain.handle('pictures:download', (_e, item) => pictures.download(mediaDir(), item));

  ipcMain.handle('displays:list', () => displays());
  ipcMain.handle('output:open', (_e, { displayId, mode }) => openOutput(displayId, mode));
  ipcMain.handle('output:close', () => { waiting.output = null; if (output) output.close(); return status(); });
  ipcMain.handle('output:status', () => status());
  ipcMain.on('output:frame', (_e, frame) => { lastFrame = frame; if (output && !output.isDestroyed()) output.webContents.send('output:frame', frame); });
  // the livestream overlay for OBS
  overlay = startOverlayServer(DIST, { media: mediaDir(), onRemote: (cmd) => send('remote:cmd', cmd) });
  ipcMain.handle('overlay:info', () => ({ url: overlay.url, clients: overlay.clients(), lan: overlay.lanInfo() }));
  // OBS on another computer: a read-only listener on the network, only while the operator has it on
  ipcMain.handle('overlay:lan', (_e, on) => overlay.setLan(!!on));
  // the phone remote: on means the network listener is on too (the phone reaches it over Wi-Fi)
  ipcMain.handle('remote:set', async (_e, on) => {
    if (on) await overlay.setLan(true);
    overlay.setRemote(!!on);
    return overlay.remoteInfo();
  });
  ipcMain.handle('remote:info', () => overlay.remoteInfo());
  ipcMain.on('remote:frame', (_e, frame) => overlay.sendRemote(frame));
  if (store.get().settings.stream && store.get().settings.stream.lan) overlay.setLan(true);
  ipcMain.on('overlay:frame', (_e, frame) => overlay.send(frame));

  ipcMain.handle('stage:open', (_e, displayId) => openStage(displayId));
  ipcMain.handle('stage:close', () => { waiting.stage = null; if (stage) stage.close(); return { open: false, displayId: null }; });
  ipcMain.handle('stage:status', () => ({ open: !!stage && !stage.isDestroyed(), displayId: null }));
  ipcMain.on('stage:frame', (_e, frame) => { lastStageFrame = frame; if (stage && !stage.isDestroyed()) stage.webContents.send('stage:frame', frame); });
  // Keys pressed while the output window has focus still drive the show.
  ipcMain.on('output:key', (_e, key) => send('output:key', key));

  screen.on('display-added', onDisplayAdded);
  screen.on('display-removed', onDisplayRemoved);
  screen.on('display-metrics-changed', onDisplayChanged);

  createControl();
});

app.on('window-all-closed', () => app.quit());
