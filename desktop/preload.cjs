// 렌더러에 아주 작은 API 만 연다 (contextIsolation 유지 · nodeIntegration 없음)
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  toggleFullscreen: () => ipcRenderer.invoke('win:toggleFullscreen'),
  setFullscreen: on => ipcRenderer.invoke('win:setFullscreen', !!on),
  isFullscreen: () => ipcRenderer.invoke('win:isFullscreen'),
  quit: () => ipcRenderer.invoke('app:quit'),
  steam: {
    achievements: () => ipcRenderer.invoke('steam:achievements'),
    unlock: apiName => ipcRenderer.invoke('steam:unlock', String(apiName)),
    status: () => ipcRenderer.invoke('steam:status'),
  },
});
