const { BrowserWindow, app, protocol, session, shell, ipcMain } = require("electron");
const { default_settings } = require("./util/defaults.json");
const { applySwitches } = require("./util/switches.js")
const { autoUpdater } = require("electron-updater");
const DiscordRPC = require("./addons/rpc.js");
const path = require("path");
const Store = require("electron-store");
const fs = require("fs");

autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.autoDownload = false;

const store = new Store();
if (!store.has("settings")) store.set("settings", default_settings);

const settings = store.get("settings");

for (const key in default_settings) {
  if (!settings.hasOwnProperty(key) || typeof settings[key] !== typeof default_settings[key]) {
    settings[key] = default_settings[key];
    store.set("settings", settings);
  }
}

applySwitches(settings);

const SWAP_SCHEME = "helium-swap";
protocol.registerSchemesAsPrivileged([
  { scheme: SWAP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, bypassCSP: true } },
]);

let gameWindow = "";

const createWindow = () => {
  gameWindow = new BrowserWindow({
    icon: path.join(__dirname, "./assets/img/icon.ico"),
    title: "Helium Client",
    width: 1280,
    height: 720,
    show: false,
    backgroundColor: "#141414",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true,
      sandbox: false,
      webSecurity: false,
      preload: path.join(__dirname, "./preload/game.js"),
    },
  });

  if (settings.auto_fullscreen) {
    gameWindow.once("ready-to-show", () => gameWindow.setFullScreen(true));
  }
  gameWindow.webContents.on("new-window", (e, url) => {
    e.preventDefault();
    shell.openExternal(url);
  });
  gameWindow.on("page-title-updated", (e) => e.preventDefault());
  gameWindow.webContents.on("did-navigate-in-page", (e, url) => {
    gameWindow.webContents.send("url-change", url);
  });
  gameWindow.on("resize", () => {
    gameWindow.webContents.send("resize", gameWindow.getSize());
  })

  gameWindow.loadURL("https://kirka.io");
  gameWindow.removeMenu();
  gameWindow.show();
}

const updateCheck = autoUpdater.checkForUpdates()
  .then((r) => ({
    available: !!r?.isUpdateAvailable,
    info: r?.isUpdateAvailable ? r.updateInfo : null,
  }))
  .catch((error) => ({ available: false, info: null, error: String(error) }));

ipcMain.handle("get-update-details", () => updateCheck);
ipcMain.on("download-update", () => autoUpdater.downloadUpdate());

autoUpdater.on("download-progress", (progress) => gameWindow.webContents.send("download-progress", progress))
autoUpdater.on("error", (error) => gameWindow.webContents.send("download-error", error))
autoUpdater.on("update-downloaded", () => autoUpdater.quitAndInstall());

// folders

const scriptsPath = path.join(app.getPath("documents"), "HeliumClient", "scripts");
if (!fs.existsSync(scriptsPath)) {
  fs.mkdirSync(scriptsPath, { recursive: true });
}

const soundsPath = path.join(app.getPath("documents"), "HeliumClient", "menusounds");
const defaultSoundsPath = path.join(__dirname, "./assets/mp3");
if (!fs.existsSync(soundsPath)) {
  fs.mkdirSync(soundsPath, { recursive: true });
  fs.readdirSync(defaultSoundsPath).forEach((file) => {
    fs.copyFileSync(path.join(defaultSoundsPath, file), path.join(soundsPath, file));
  })
}

const swapperPath = path.join(app.getPath("documents"), "HeliumClient", "swapper");
if (!fs.existsSync(swapperPath)) {
  fs.mkdirSync(swapperPath, { recursive: true });
  fs.mkdirSync(path.join(swapperPath, "assets", "media"), { recursive: true });
  fs.mkdirSync(path.join(swapperPath, "assets", "img"), { recursive: true });
}

const cssPath = path.join(app.getPath("documents"), "HeliumClient", "css");
if (!fs.existsSync(cssPath)) {
  fs.mkdirSync(cssPath, { recursive: true });
}

// handlers

ipcMain.on("get-settings", (e) => {
  e.returnValue = settings;
});

ipcMain.on("update-setting", (e, key, value) => {
  settings[key] = value;
  store.set("settings", settings);
});

ipcMain.on("get-scripts-path", (e) => {
  e.returnValue = scriptsPath;
});

ipcMain.on("get-css-path", (e) => {
  e.returnValue = cssPath;
});

ipcMain.on("open", (e, url) => {
  shell.openExternal(url);
})

ipcMain.on("restart", () => {
  app.relaunch();
  app.exit(0);
});

ipcMain.handle("screenshot", async () => {
  const image = await gameWindow.webContents.capturePage();
  return image.toDataURL();
});

ipcMain.on("reload", () => gameWindow.reload());

ipcMain.on("quit", () => app.exit(0));

ipcMain.on("toggle-fullscreen", () => gameWindow.setFullScreen(!gameWindow.isFullScreen()));

ipcMain.on("toggle-devtools", () => gameWindow.webContents.toggleDevTools());

ipcMain.on("get-size", (e) => {
  e.returnValue = gameWindow.getSize();
})

const soundCache = {};
ipcMain.on("get-sound", (e, sound) => {
  if (!soundCache[sound]) {
    let p = path.join(soundsPath, `${sound}.ogg`);
    let mime = "audio/ogg";
    if (!fs.existsSync(p)) {
      p = path.join(soundsPath, `${sound}.mp3`);
      mime = "audio/mpeg";
    }
    try {
      soundCache[sound] = `data:${mime};base64,` + fs.readFileSync(p).toString("base64");
    } catch (err) {
      console.error("get-sound failed:", p, err);
    }
  }
  e.returnValue = soundCache[sound] ?? null;
});

// resource swapper

const resolveSwap = (pathname) => {
  let relative;
  try {
    relative = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const file = path.normalize(path.join(swapperPath, relative));
  if (!file.startsWith(swapperPath + path.sep)) return null;
  try {
    return fs.statSync(file).isFile() ? file : null;
  } catch {
    return null;
  }
}

const initSwapper = () => {
  protocol.registerFileProtocol(SWAP_SCHEME, (request, callback) => {
    const file = resolveSwap(new URL(request.url).pathname);
    if (file) callback({ path: file });
    else callback({ error: -6 });
  });

  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ["*://kirka.io/*"] },
    (details, callback) => {
      if (details.method !== "GET") return callback({});
      const { hostname, pathname } = new URL(details.url);
      if (pathname.startsWith("/assets/glb/")) return callback({});
      if (resolveSwap(pathname)) return callback({ redirectURL: `${SWAP_SCHEME}://${hostname}${pathname}` });
      callback({});
    }
  );
}

// game init
const initGame = () => {
  protocol.registerFileProtocol("file", (request, callback) => {
    callback(decodeURIComponent(request.url.replace("file:///", "")));
  });
  initSwapper();
  createWindow();
  if (settings.discord_rpc) gameWindow.DiscordRPC = new DiscordRPC();
}

module.exports = initGame;