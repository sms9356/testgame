# Steam release checklist — 서린고 : 잊혀진 시간

## Done in the repo

- [x] **Offline runtime.** No CDN or Google Fonts requests at runtime. Fonts (Noto Sans KR, Noto Serif KR, East Sea Dokdo, Nanum Pen Script, Nanum Gothic Coding, Nanum Myeongjo) are vendored as woff2 subsets in `vendor/fonts/` (`fonts.css`, `files/`). All of them are SIL OFL 1.1; the license texts are in `vendor/fonts/OFL.txt`. three.js is MIT (`vendor/THREE_LICENSE`). To regenerate: `npm pack @fontsource/<name>` for each font, extract each pack into its own subfolder, then run `node tools/vendor-fonts.mjs <folder>`.
- [x] **Network checked.** Headless load (`?debug&norender`) with every non-localhost request aborted: 0 page errors, 0 outside requests.
- [x] **Electron main process** (`desktop/main.cjs`):
  - [x] Serves the game from `app://game/`. Requests to any other scheme are blocked, so a leftover CDN link cannot reach the network.
  - [x] Starts fullscreen by default. F11 or Alt+Enter switches between fullscreen and windowed. The mode and window size are saved to `userData/window.json`.
  - [x] The game can also switch modes through `window.desktop.setFullscreen()` / `toggleFullscreen()` from `desktop/preload.cjs`.
  - [x] Vsync stays on (the Chromium default). `--no-vsync` is available for benchmarking only.
  - [x] GPU flags: `ignore-gpu-blocklist`, GPU rasterization, zero-copy, and high-performance GPU preference.
  - [x] Background and occluded-window throttling are disabled, as are renderer backgrounding and background timer throttling.
  - [x] DevTools are disabled in packaged builds. They are available only in `npm run desktop` (`--dev`) via Ctrl+Shift+F12.
  - [x] Other security settings: contextIsolation and sandbox are on, nodeIntegration is off, external navigation is blocked, the app runs as a single instance, and there is no menu bar.
  - [x] Save data uses `localStorage`, which Electron keeps under `app.getPath('userData')` (Windows: `%APPDATA%/서린고 - 잊혀진 시간`).
- [x] **Scripts.**
  - `npm run desktop:install` installs Electron and electron-builder in `desktop/`. This needs network access.
  - `npm run desktop` runs the game from the repo root, with DevTools allowed.
  - `npm run desktop:build` stages the game into `desktop/game/` and builds the Windows dir, portable and zip targets into `desktop/dist/`.
  - `npm run desktop:build:steam` produces an unpacked dir build, which is what you upload as a depot.
  - The CI workflow `.github/workflows/desktop-build.yml` now uses `tools/stage-desktop.mjs`. The old workflow did not copy `uiPolish.css`, `uiV3.css` or `hudV2.css`.
- [x] **Steamworks stub.**
  - `desktop/steam/steam.cjs` uses `steamworks.js` (MIT, an optional dependency). If that module, the App ID or the Steam client is missing, every hook does nothing.
  - `desktop/steam/achievements.json` maps the endings (normal, true, cover, all endings) and collectibles (documents, clues), plus first death and a sub-1h clear. Names are given in KO, EN, JA and ZH.
  - `steamBridge.js` reads the save data and unlocks achievements. It is inert in the browser and in `?test` mode, and no game code was changed for it.

## Not verified here

- Electron was not downloaded in this sandbox, so the wrapper has not been launched. Run `npm run desktop:install && npm run desktop` on a real machine, and check fullscreen toggling, audio, pointer lock and microphone permission.
- Steam overlay and achievement unlocks need a real App ID and the Steam client running.

## What you must do

1. **Steamworks partner account.** Pay the app credit and get the **App ID**. For local testing, put the App ID in `steam_appid.txt` next to the exe, or set `STEAM_APP_ID`. Do not ship `steam_appid.txt` in the depot.
2. **Achievements.** Create each `apiName` in `desktop/steam/achievements.json` under App Admin > Stats & Achievements. Add icons (64×64 achieved and unachieved JPGs), add localized names, then publish.
3. **Depots and build.**
   - Create a Windows x64 depot.
   - Run `npm run desktop:build:steam`, then upload `desktop/dist/win-unpacked/` with SteamPipe (`steamcmd` + `app_build_<appid>.vdf` / `depot_build_<depotid>.vdf`).
   - Set the launch option to `Haegyo.exe`.
   - Optional: a Linux depot (`electron-builder --linux dir`) or Steam Deck verification (controller support is in the game).
4. **Code signing (optional but recommended).** Sign the Windows exe to avoid SmartScreen warnings. Set `CSC_LINK` / `CSC_KEY_PASSWORD`.
5. **Store assets.** Each needs a Korean-text and an English-text variant if you localize them:
   - Header capsule 920×430
   - Small capsule 462×174
   - Main capsule 1232×706
   - Vertical capsule 748×896
   - Page background 1438×810
   - Library capsule 600×900, library hero 3840×1240, library logo 1280×720 PNG
   - Community icon 184×184
   - At least 5 screenshots at 1920×1080
   - A trailer (MP4)
6. **Store text in Korean, English, Japanese and Simplified Chinese.**
   - For each language, write the short description, the long description, the "About this game" text, the feature list and the system requirements.
   - Declare per-language support (interface, full audio, subtitles). Audio is Korean only unless more is dubbed.
   - In-game UI and subtitles need translations for every language you list. Check `lang/` and `i18n.js` coverage before ticking a language.
7. **Age rating and content survey.**
   - Fill in the Steam Mature Content survey: horror, violence, frightening imagery.
   - For Korea, get a **GRAC (게임물관리위원회)** rating, or use self-rating through Steam's IARC flow where eligible. A Korean store listing needs a rating number.
   - Get PEGI, ESRB and USK ratings through IARC if needed.
8. **Legal.**
   - Third-party notices: `vendor/fonts/OFL.txt` and `vendor/THREE_LICENSE` are copied into `licenses/` by electron-builder.
   - Check the licenses of every audio, voice, model and texture asset (TTS and voice-cloning terms, purchased models) before commercial release.
   - Write a privacy note: the microphone is used only locally, if that feature is enabled.
9. **Pricing, release date, Coming Soon page** (it must be live for at least 2 weeks before release), and the build review submission.
10. **Optional:** Steam Cloud. Point Auto-Cloud at `%APPDATA%/서린고 - 잊혀진 시간/Local Storage/` (Windows) to sync saves.
