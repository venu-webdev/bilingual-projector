// The only bridge between the pages and the main process: a short, explicit list of calls.
const { contextBridge, ipcRenderer } = require('electron');

const on = (channel) => (fn) => {
  const h = (_e, v) => fn(v);
  ipcRenderer.on(channel, h);
  return () => ipcRenderer.removeListener(channel, h);
};

contextBridge.exposeInMainWorld('projector', {
  library: {
    get: () => ipcRenderer.invoke('lib:get'),
    patch: (part) => ipcRenderer.invoke('lib:patch', part),
    exportFile: () => ipcRenderer.invoke('lib:export'),
    importFile: () => ipcRenderer.invoke('lib:import'),
  },
  pickMedia: (kind) => ipcRenderer.invoke('media:pick', kind),
  pictures: {
    save: (name, bytes, mime) => ipcRenderer.invoke('pictures:save', { name, bytes, mime }),
    choose: () => ipcRenderer.invoke('pictures:choose'),
    search: (q) => ipcRenderer.invoke('pictures:search', q),
    download: (item) => ipcRenderer.invoke('pictures:download', item),
  },
  displays: { list: () => ipcRenderer.invoke('displays:list'), onChange: on('displays:changed'), onEvent: on('displays:event') },
  output: {
    open: (displayId, mode) => ipcRenderer.invoke('output:open', { displayId, mode }),
    close: () => ipcRenderer.invoke('output:close'),
    status: () => ipcRenderer.invoke('output:status'),
    onStatus: on('output:status'),
    sendFrame: (frame) => ipcRenderer.send('output:frame', frame),
    onFrame: on('output:frame'),
    sendKey: (key) => ipcRenderer.send('output:key', key),
    onKey: on('output:key'),
  },
  overlay: {
    info: () => ipcRenderer.invoke('overlay:info'),
    setLan: (on) => ipcRenderer.invoke('overlay:lan', on),
    sendFrame: (frame) => ipcRenderer.send('overlay:frame', frame),
  },
  remote: {
    set: (on) => ipcRenderer.invoke('remote:set', on),
    info: () => ipcRenderer.invoke('remote:info'),
    sendFrame: (frame) => ipcRenderer.send('remote:frame', frame),
    onCommand: on('remote:cmd'),
  },
  stage: {
    open: (displayId) => ipcRenderer.invoke('stage:open', displayId),
    close: () => ipcRenderer.invoke('stage:close'),
    status: () => ipcRenderer.invoke('stage:status'),
    onStatus: on('stage:status'),
    sendFrame: (frame) => ipcRenderer.send('stage:frame', frame),
    onFrame: on('stage:frame'),
  },
});
