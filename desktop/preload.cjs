// 렌더러에 아주 작은 API 만 연다 (contextIsolation 유지 · nodeIntegration 없음)
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  toggleFullscreen: () => ipcRenderer.invoke('win:toggleFullscreen'),
  setFullscreen: on => ipcRenderer.invoke('win:setFullscreen', !!on),
  isFullscreen: () => ipcRenderer.invoke('win:isFullscreen'),
  quit: () => ipcRenderer.invoke('app:quit'),
  setAiEndpoint: url => ipcRenderer.invoke('ai:setEndpoint', String(url || '')),   // 민아와 자유 대화 (AI): 사용자가 넣은 서버 주소만 허용
  steam: {
    achievements: () => ipcRenderer.invoke('steam:achievements'),
    unlock: apiName => ipcRenderer.invoke('steam:unlock', String(apiName)),
    status: () => ipcRenderer.invoke('steam:status'),
  },
});
