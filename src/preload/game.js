const { initMenu } = require("./menu.js")
const { handleFriends } = require("../handlers/friends.js");
const { handleIngame } = require("../handlers/ingame.js");
const { handleInspect } = require("../handlers/inspect.js");
const { handleLobby } = require("../handlers/lobby.js");
const { handleProfile } = require("../handlers/profile.js");
const { handleServers } = require("../handlers/servers.js");
const { initCSL } = require("../addons/csl.js");
const { ipcRenderer } = require("electron");
const fs = require("fs");
const path = require("path");

let settings = ipcRenderer.sendSync("get-settings");

// helpers

window.waitForElement = (selector, callback) => {
  const tryApply = () => {
    const el = document.querySelector(selector);
    if (el) {
      callback(el);
    } else {
      setTimeout(tryApply, 0);
    }
  };
  setTimeout(tryApply, 0);
};

// load user scripts

const scriptsPath = ipcRenderer.sendSync("get-scripts-path");
const scripts = fs.readdirSync(scriptsPath);

scripts.forEach((script) => {
  if (!script.endsWith(".js")) return;
  const scriptPath = path.join(scriptsPath, script);
  try {
    require(scriptPath);
    //prevent users from hiding scripts
    console.log(`${script} loaded`)
  } catch (error) {
    console.error(`${script} could't load:`, error);
  }
})

// preserve console

const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  info: console.info.bind(console),
  trace: console.trace.bind(console),
};

//auto updater

ipcRenderer.on("download-progress", (_, progress) => {
  document.querySelector("#update-installing-modal .progress").style.background = `linear-gradient(90deg, rgb(var(--accent)) ${progress}%, transparent ${progress}%)`
})

ipcRenderer.on("download-error", (_, error) => {
  document.querySelector("#update-installing-modal #info").textContent = `An Error occurred: \n ${error}`
  document.querySelector("#do-not-close").remove();
  document.querySelector("#update-installing-modal").dataset.installing = "";
})

// main stuff

window.addEventListener("DOMContentLoaded", async () => {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  console.info = originalConsole.info;
  console.trace = originalConsole.trace;

  initCSL(settings)

  const { available, info } = await ipcRenderer.invoke("get-update-details");
  initMenu(available, info);

  const fetchAll = async () => {
    const [customizations, clancustomizations, ktiers] = await Promise.all([
      fetch("https://raw.githubusercontent.com/zVipexx/helium-client/refs/heads/main/src/assets/json/badges.json").then((r) => r.json()),
      fetch("https://raw.githubusercontent.com/zVipexx/helium-client/refs/heads/main/src/assets/json/clans.json").then((r) => r.json()),
      fetch("https://ktiers-production.up.railway.app/api/players").then((r) => r.json())
    ]);

    localStorage.setItem("customizations", JSON.stringify(customizations));
    localStorage.setItem("clancustomizations", JSON.stringify(clancustomizations));
    localStorage.setItem("ktiers-list", JSON.stringify(ktiers));
  };
  fetchAll();

  const applyStyles = () => {
    const quickCSS = document.createElement("style");
    quickCSS.id = "helium-quick-css";
    document.head.append(quickCSS);

    const updateCSS = () => {
      if (settings.enable_quick_css && settings.quick_css) quickCSS.innerHTML = settings.quick_css;
      else quickCSS.innerHTML = "";
    }
    updateCSS();

    const configurableStyles = document.createElement("style");
    configurableStyles.id = "helium-configurable-styles";
    document.head.append(configurableStyles);

    const updateStyles = () => {
      const styles = []

      if (settings.menu_animation)
        styles.push(`.helium-menu .menu { transition: transform ${settings.menu_animation_duration}s ease-out, opacity ${settings.menu_animation_duration}s ease-in-out; }
                     .helium-menu { transition: transform ${settings.menu_animation_duration}s, opacity ${settings.menu_animation_duration}s }
                     .helium-menu .restart-now { transition: ${settings.menu_animation_duration}s }
                     .helium-menu .helium-modal { transition: ${settings.menu_animation_duration}s }`);
      if (settings.tab_animation)
        styles.push(`.helium-menu[data-active="true"] .options.fade-in { animation: ${settings.tab_animation_duration}s tab-in ease; }
                     .helium-menu[data-active="true"] .options.fade-out { animation: ${settings.tab_animation_duration}s tab-out ease forwards; }`);
      if (settings.menu_blur)
        styles.push(`.helium-menu[data-active="true"] { backdrop-filter: blur(${settings.menu_blur_strength}px) }`);
      if (settings.menu_opacity)
        styles.push(`.helium-menu .sidebar { background: rgba(19, 26, 34, ${settings.menu_opacity / 100}); }
                     .helium-menu .main { background: rgba(15, 21, 27, ${settings.menu_opacity / 100}); }`)
      if (settings.hide_chat)
        styles.push(".desktop-game-interface > #bottom-left > .chat { display: none !important; }")
      if (settings.skip_loading_scene)
        styles.push(".loading-scene { display: none !important; }")
      if (settings.skip_transitions)
        styles.push(".select-regions-cont, .view, .vm--modal { transition: 0s !important; }")
      if (!settings.assists_indicator)
        styles.push(".kill-death .assists { display: none; }")
      if (!settings.hsp_indicator)
        styles.push(".kill-death .hsp { display: none; }")
      if (settings.assists_indicator || settings.obj_indicator || settings.hsp_indicator)
        styles.push(".teammates-widget { margin-top: 1.1rem; }")
      if (settings.colored_killfeed) styles.push(`.desktop-game-interface .kill-bar-item { --red-kill: #FF4D42aa; --blue-kill: #0D6DC6aa }`);
      if (!settings.lobby_keybind_reminder) styles.push(`#helium-keybind-reminder { display: none }`);

      configurableStyles.innerHTML = styles.join("");
    }
    updateStyles();

    document.addEventListener("helium-settings-changed", (e) => {
      const relevantSettings = [
        "menu_animation",
        "menu_animation_duration",
        "tab_animation",
        "tab_animation_duration",
        "menu_blur",
        "menu_blur_strength",
        "menu_opacity",
        "hide_chat",
        "skip_loading_scene",
        "skip_transitions",
        "lobby_keybind_reminder",
        "assists_indicator",
        "hsp_indicator",
        "colored_killfeed",
      ];
      if (relevantSettings.includes(e.detail.setting)) updateStyles();
      else if (e.detail.setting === "quick_css" || e.detail.setting === "enable_quick_css") updateCSS();
    });
  }

  const quickJoin = (text, spectate) => {
    const regions = ["EU~", "NA~", "ASIA~", "SA~", "OCEANIA~", "INDIA~"];

    const isValidLink = (text) => {
      text = (text || "").trim();
      return text.startsWith("https://kirka.io/") || regions.some((r) => text.startsWith(r));
    };

    if (!isValidLink(text)) {
      document.dispatchEvent(new CustomEvent("custom-notification", { detail: { message: "Not a valid lobby or game link" } }))
      return;
    }

    const joinBtn = document.querySelector("#join-btn");
    if (!joinBtn) return;

    joinBtn.click();
    waitForElement("#join-modal-modal .input", (input) => {
      input.value = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      if (!spectate) document.querySelector(".btn")?.click();
      else document.querySelector(".btn:last-child")?.click()
    })
  }
  document.addEventListener("quickjoin", ({ detail: d }) => {
    quickJoin(d?.url ?? d, d?.spectate ?? false);
  });

  const customNotification = (data) => {
    const notifElement = document.createElement("div");
    notifElement.classList.add("vue-notification-wrapper");
    notifElement.innerHTML = `
    <div class="alert-default">
      ${data.icon ? `<img src="${data.icon}" style="min-width: 2rem; height: 2rem; margin-right: .9rem;" />` : ""}
      <span style="font-size: 1rem; font-weight: 600; text-align: left;" class="text"></span>
    </div>
    `;
    notifElement.querySelector(".text").textContent = data.message;

    if (typeof data.onclick === "function") notifElement.style.cursor = "pointer";

    const timeout = setTimeout(() => notifElement.remove(), 5000);

    notifElement.addEventListener("click", () => {
      clearTimeout(timeout);
      if (typeof data.onclick === "function") data.onclick();
      notifElement.style.transition = "0.3s ease";
      notifElement.style.opacity = "0";
      setTimeout(() => notifElement.remove(), 300);
    });

    const group = document.getElementsByClassName("vue-notification-group")[0];
    group?.children[0]?.appendChild(notifElement);
  };

  document.addEventListener("custom-notification", (e) => customNotification(e.detail));

  document.addEventListener("helium-settings-changed", () => {
    settings = ipcRenderer.sendSync("get-settings");
    initCSL(settings);
  })

  // site navigation that cant be filtered by url

  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        switch (true) {
          case node.matches(".loading-scene"):
            waitForElement(".desktop-game-interface", () => handleIngame());
            break;
          case node.matches(".vm--container"):
            setTimeout(() => {
              if (document.querySelector("div[data-modal='inspect']")) handleInspect();
              else if (document.querySelector("div[data-modal='profile-modal']")) waitForElement(".card.statistics", () => handleProfile());
            }, 0);
            break;
          case node.matches(".interface"):
            waitForElement(".auth-user .avatar", () => handleLobby());
            break;
        }
      });
    }
  }).observe(document.querySelector("#app"), { childList: true });

  // initial load

  waitForElement(".auth-user .avatar", () => handleLobby());

  const handleResize = (_, size) => {
    const zoom = Math.min(size[0] / 1920, size[1] / 1080);
    document.querySelector(".helium-menu").style.zoom = Math.abs(zoom - 1) <= 0.01 ? "" : zoom;
  };
  handleResize(null, ipcRenderer.sendSync("get-size"));
  ipcRenderer.on("resize", handleResize);

  applyStyles();
})

// url changes

const base_url = "https://kirka.io/";
const handleUrlChange = (_, url) => {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  console.info = originalConsole.info;
  console.trace = originalConsole.trace;

  if (url.startsWith(`${base_url}servers/`)) waitForElement(".servers .list", () => handleServers());
  if (url === `${base_url}friends`) handleFriends();
}
handleUrlChange(null, window.location.href)
ipcRenderer.on("url-change", handleUrlChange);