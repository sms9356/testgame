// 서문고 — 잊혀진 시간 : Windows 데스크톱 실행판 (Electron)
// 게임 파일을 app://game/ 으로 내보낸다 — file:// 로 열면 ES 모듈 · fetch(텍스처 · 음성 · 모델)가 막힌다
const { app, BrowserWindow, protocol, net, session, Menu } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }]);
app.commandLine.appendSwitch('ignore-gpu-blocklist');          // 내장 그래픽에서도 WebGL 가속
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const ROOT = path.join(__dirname, 'game');

app.whenReady().then(() => {
  protocol.handle('app', req => {
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.normalize(path.join(ROOT, rel));
    if (!file.startsWith(ROOT)) return new Response('forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(['media', 'microphone', 'fullscreen', 'pointerLock'].includes(perm)));   // 마이크 감지 · 전체화면 · 마우스 고정
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({ width: 1600, height: 900, backgroundColor: '#05050c', title: '서문고 — 잊혀진 시간', icon: path.join(__dirname, 'icon.png'),
    webPreferences: { contextIsolation: true, backgroundThrottling: false } });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.type === 'keyDown' && input.key === 'F12' && input.control && input.shift) win.webContents.toggleDevTools();
  });
  win.loadURL('app://game/index.html');
});
app.on('window-all-closed', () => app.quit());
