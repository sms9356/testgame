// 서린고 — 잊혀진 시간 : 데스크톱(Steam) 실행판 (Electron)
// 게임 파일을 app://game/ 으로 내보낸다 — file:// 로 열면 ES 모듈 · fetch(텍스처 · 음성 · 모델)가 막힌다
// 세이브: localStorage → Electron 이 app.getPath('userData') 아래(Windows: %APPDATA%/<productName>)에 보관한다
const { app, BrowserWindow, protocol, net, session, Menu, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const steam = require('./steam/steam.cjs');

const DEV = !app.isPackaged || process.argv.includes('--dev');   // 개발 실행(npm run desktop)에서만 개발자 도구 허용
// 게임 폴더: 패키지판은 desktop/game (tools/stage-desktop.mjs 가 복사), 개발판은 저장소 루트를 그대로 쓴다
const ROOT = fs.existsSync(path.join(__dirname, 'game', 'index.html')) ? path.join(__dirname, 'game') : path.resolve(__dirname, '..');

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }]);
// GPU: 블록리스트에 걸린 내장 그래픽에서도 WebGL/WebGPU 가속 · 래스터화 GPU · vsync 는 Chromium 기본값(켜짐)을 유지한다
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('force_high_performance_gpu');                 // 노트북: 외장 GPU 우선
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// 창이 가려지거나 최소화돼도 오디오 · 타이머가 멈추지 않게
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
if (process.argv.includes('--no-vsync')) { app.commandLine.appendSwitch('disable-gpu-vsync'); app.commandLine.appendSwitch('disable-frame-rate-limit'); }   // 벤치마크용

// 창 설정(전체화면 여부 · 크기) — userData/window.json
const WIN_FILE = () => path.join(app.getPath('userData'), 'window.json');
function readWin() { try { return JSON.parse(fs.readFileSync(WIN_FILE(), 'utf8')); } catch (e) { return { fullscreen: true, width: 1600, height: 900 }; } }
function writeWin(w) { try { fs.writeFileSync(WIN_FILE(), JSON.stringify({ fullscreen: w.isFullScreen(), ...(w.isFullScreen() ? {} : w.getNormalBounds()) })); } catch (e) { /* ignore */ } }

if (!app.requestSingleInstanceLock()) app.quit();

app.whenReady().then(() => {
  steam.init();
  protocol.handle('app', req => {
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.normalize(path.join(ROOT, rel));
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return new Response('forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  // 오프라인 보장: app:// · data: · blob: 외의 요청은 막는다 (실수로 남은 CDN 링크가 있어도 밖으로 나가지 않음)
  session.defaultSession.webRequest.onBeforeRequest((d, cb) => cb({ cancel: !/^(app|data|blob|devtools|chrome-extension):/.test(d.url) }));
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(['media', 'microphone', 'fullscreen', 'pointerLock'].includes(perm)));   // 마이크 감지 · 전체화면 · 마우스 고정
  Menu.setApplicationMenu(null);

  const st = readWin();
  const win = new BrowserWindow({ width: st.width || 1600, height: st.height || 900, x: st.x, y: st.y, minWidth: 960, minHeight: 540,
    fullscreen: st.fullscreen !== false, backgroundColor: '#05050c', title: '서린고 — 잊혀진 시간', icon: path.join(__dirname, 'icon.png'), show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false,
      backgroundThrottling: false, devTools: DEV, spellcheck: false } });
  win.once('ready-to-show', () => win.show());
  const toggle = () => win.setFullScreen(!win.isFullScreen());
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.key === 'Enter' && input.alt)) { toggle(); e.preventDefault(); }   // 전체화면 ↔ 창모드
    if (DEV && input.key === 'F12' && input.control && input.shift) win.webContents.toggleDevTools();
  });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://game/')) e.preventDefault(); });
  win.on('close', () => writeWin(win));

  ipcMain.handle('win:toggleFullscreen', () => { toggle(); return win.isFullScreen(); });
  ipcMain.handle('win:setFullscreen', (e, on) => { win.setFullScreen(!!on); return win.isFullScreen(); });
  ipcMain.handle('win:isFullscreen', () => win.isFullScreen());
  ipcMain.handle('app:quit', () => app.quit());
  ipcMain.handle('steam:achievements', () => steam.achievementsMap);
  ipcMain.handle('steam:unlock', (e, name) => steam.unlock(name));
  ipcMain.handle('steam:status', () => steam.status());

  win.loadURL('app://game/index.html');
});
app.on('window-all-closed', () => app.quit());
