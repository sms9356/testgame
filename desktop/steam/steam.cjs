// Steamworks 연동 스텁 — steamworks.js(MIT, npm i steamworks.js)가 없거나 Steam 이 꺼져 있으면 모든 훅이 아무것도 안 한다.
// App ID: 환경 변수 STEAM_APP_ID 또는 실행 폴더의 steam_appid.txt (개발용). 출시판은 Steam 클라이언트가 넘겨 준다.
const fs = require('fs');
const path = require('path');

let client = null, reason = 'not initialised';
const unlocked = new Set();

function readAppId() {
  if (process.env.STEAM_APP_ID) return Number(process.env.STEAM_APP_ID);
  for (const dir of [path.dirname(process.execPath), process.cwd(), __dirname]) {
    try { const v = Number(fs.readFileSync(path.join(dir, 'steam_appid.txt'), 'utf8').trim()); if (v) return v; } catch (e) { /* none */ }
  }
  return 0;
}

function init() {
  const appId = readAppId();
  if (!appId) { reason = 'no app id (STEAM_APP_ID / steam_appid.txt)'; return false; }
  let sw;
  try { sw = require('steamworks.js'); } catch (e) { reason = 'steamworks.js not installed'; return false; }
  try { client = sw.init(appId); sw.electronEnableSteamOverlay && sw.electronEnableSteamOverlay(); reason = 'ok'; return true; }
  catch (e) { client = null; reason = 'Steam not running: ' + e.message; return false; }
}

const achievementsMap = JSON.parse(fs.readFileSync(path.join(__dirname, 'achievements.json'), 'utf8')).achievements;
const known = new Set(achievementsMap.map(a => a.apiName));

function unlock(apiName) {
  if (!known.has(apiName) || unlocked.has(apiName)) return false;
  unlocked.add(apiName);
  if (!client) return false;
  try { return !!client.achievement.activate(apiName); } catch (e) { return false; }
}

function status() { return { active: !!client, reason, unlocked: [...unlocked] }; }

module.exports = { init, unlock, status, achievementsMap };
