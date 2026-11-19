const { ipcRenderer, clipboard, nativeImage } = require("electron");
const { default_settings } = require("../util/defaults.json")
const { version } = require("../../package.json")
const inspectData = require(ipcRenderer.sendSync("get-inspects-path"))[0];
const path = require("path");
const fs = require("fs");

let settings = ipcRenderer.sendSync("get-settings");
let updateInfo;

const createMenu = () => {
  const menu = document.createElement("div");
  menu.classList.add("helium-menu");
  menu.dataset.active = "false";
  menu.dataset.theme = "glass";
  menu.innerHTML = fs.readFileSync(path.join(__dirname, "../assets/html/menu.html"), "utf8");
  menu.style.setProperty("--accent", hexToRgb(settings.accent_color));

  menu.addEventListener("pointerup", (e) => { if (e.target === menu && settings.outside_closes_menu && !document.querySelector("input:focus") && !document.querySelector("textarea:focus")) toggleMenu(false); });
  menu.querySelector("#close").addEventListener("click", () => toggleMenu(false));

  const menuStyle = document.createElement("style");
  menuStyle.innerHTML = fs.readFileSync(path.join(__dirname, "../assets/css/menu.css"), "utf8");

  document.body.append(menu);
  menu.append(menuStyle);

  setupMenu();
  return menu;
}

// helpers

let visibleTimer;
const toggleMenu = (state) => {
  let menu = document.querySelector(".helium-menu");
  const isActive = menu?.dataset.active === "true";
  const open = state ?? !isActive;

  clearTimeout(visibleTimer);

  const delay = settings.menu_animation ? settings.menu_animation_duration * 1000 : 0;

  if (open) {
    document.exitPointerLock();
    if (!menu) {
      menu = createMenu();
      void menu.offsetWidth;
    }
    menu.dataset.active = "true";
  } else if (menu) {
    menu.dataset.active = "false";
    document.activeElement.blur();
    visibleTimer = setTimeout(() => menu.remove(), delay);
  }

  localStorage.setItem("helium-menu", open);
};

const createModal = (callback) => {
  if (document.querySelector(".helium-modal")) return;

  const backdrop = document.createElement("div");
  backdrop.classList.add("helium-modal-backdrop");
  backdrop.style.animation = `fade-in ${settings.menu_animation_duration}s`
  backdrop.addEventListener("click", () => {
    backdrop.remove();
    modal.remove();
  })

  const modal = document.createElement("div");
  modal.classList.add("helium-modal");
  modal.style.animation = `helium-modal-in ${settings.menu_animation_duration}s`
  modal.addEventListener("click", (e) => {
    if (e.target.closest(".helium-modal-backdrop, #close-modal")) {
      backdrop.remove();
      modal.remove();
    }
  });

  document.querySelector(".helium-menu").append(modal);
  document.querySelector(".helium-menu").append(backdrop);
  callback?.(modal);
  return modal;
}

const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
};

const soundCache = {};
const lastPlayed = {};
const playSound = (sound, requires) => {
  if (!settings.ui_sounds || !settings[requires]) return;

  const now = performance.now();
  if (now - (lastPlayed[sound] ?? 0) < 25) return;
  lastPlayed[sound] = now;

  soundCache[sound] ??= ipcRenderer.sendSync("get-sound", sound);
  if (!soundCache[sound]) return
  const audio = new Audio(soundCache[sound]);
  audio.volume = Math.min(1, Math.max(0, settings.ui_sounds_volume / 100));
  audio.play()
};

const clearFade = (el) => {
  clearTimeout(el.fadeTimeout);
  el.classList.remove("fade-in", "fade-out");
};

const startFade = (el, cls) => {
  clearFade(el);
  void el.offsetWidth;
  el.classList.add(cls);
  if (settings.tab_animation) el.fadeTimeout = setTimeout(() => el.classList.remove(cls), settings.tab_animation_duration * 1000);
  else el.classList.remove(cls);
};

const restartInitial = JSON.parse(sessionStorage.getItem("restartInitial") || "{}");
const updateRestartButton = () => {
  sessionStorage.setItem("restartInitial", JSON.stringify(restartInitial));
  const pending = Object.keys(restartInitial).some((k) => settings[k] !== restartInitial[k]);
  document.querySelector(".restart-now").style.display = pending ? "flex" : "none";
};

// handlers

const handleUpdateAvailable = (updateInfo) => {
  const update = document.querySelector(".menu .update");
  update.classList.add("available");
  update.dataset.title = "Update available!";
  update.addEventListener("click", () => {
    createModal((modal) => {
      modal.id = "update-modal";
      modal.innerHTML = `
        <div class="wrapper spaced header">
          <span>Update Helium</span>
          <svg width="20px" height="20px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" id="close-modal">
            <path d="M17 7L7 17M7 7L17 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <div class="wrapper content">
          <div class="changelog">
            <div class="wrapper spaced">
              <span>Helium v${version} -> v${updateInfo?.version}</span>
              <span id="date">Released on: ${new Date(updateInfo?.releaseDate).toLocaleDateString()}</span>
            </div>
            <div class="details">${(Array.isArray(updateInfo?.releaseNotes) ? updateInfo?.releaseNotes : String(updateInfo?.releaseNotes ?? "").split("\n")).map(l => l.trim().replace(/^[-*]\s+/, "")).filter(Boolean).map(l => `<div class="change">${l}</div>`).join("")}</div>
          </div>
        </div>
        <div class="wrapper spaced footer">
          <span>Currently expected to only work on Windows</span>
          <div class="wrapper" id="btns">
            <div class="wrapper button" id="close-modal">
              Cancel
            </div>
            <div class="wrapper button filled confirm" id="install">
              Install v${updateInfo?.version}
            </div>
          </div>
        </div>
      `

      handleConfirmation(modal.querySelector("#install"));
      playSound("button", "click_sounds");

      modal.querySelector("#install").addEventListener("click", () => {
        modal.remove();
        document.querySelector(".helium-modal-backdrop").remove();
        playSound("button", "click_sounds");
        createModal((modal2) => {
          document.querySelector(".helium-modal-backdrop").style.animation = "";
          const style = document.createElement("style");
          style.id = "do-not-close";
          style.innerHTML = "* { pointer-events: none !important }"
          document.body.append(style);

          window.addEventListener("keydown", (e) => {
            if (!document.querySelector("#do-not-close")) return;
            e.stopImmediatePropagation();
            e.preventDefault();
          }, true)

          modal2.id = "update-installing-modal";
          modal2.innerHTML = `
            <div class="wrapper column header">
              <span>Update Installing</span>
            </div>
            <div class="progress"></div>
            <span id="info">The Client will automatically restart once the download is complete</span>
          `

          ipcRenderer.send("download-update");
        })
      })
    });
  })
}

const handleHotkeys = () => {
  document.addEventListener("keydown", (e) => {
    const menu = document.querySelector(".helium-menu");
    if (!menu || menu.dataset.active !== "true" || e.code === settings.menu_keybind || !settings.instant_search || document.querySelector("input:focus") || document.querySelector("textarea:focus")) return;
    menu.querySelector(".search").focus();
  })

  document.addEventListener("keydown", async (e) => {
    if (document.querySelector(".menu .keybind.active")) return;
    switch (e.code) {
      case settings.menu_keybind:
        toggleMenu();
        break;

      case settings.screenshot_keybind:
        const dataURL = await ipcRenderer.invoke("screenshot");
        clipboard.writeImage(nativeImage.createFromDataURL(dataURL));
        document.dispatchEvent(new CustomEvent("custom-notification", {
          detail: {
            message: "Screenshot copied to clipboard!",
            icon: dataURL
          }
        }));
        break;

      case settings.reload_keybind:
        if (document.querySelector(".desktop-game-interface")) break;
        ipcRenderer.send("reload");
        break;

      case settings.restart_keybind:
        ipcRenderer.send("restart");
        break;

      case settings.fullscreen_keybind:
        ipcRenderer.send("toggle-fullscreen");
        break;

      case settings.devtools_keybind:
        ipcRenderer.send("toggle-devtools");
        break;

      case "AltLeft":
        document.addEventListener("keydown", (e) => {
          if (e.code === "F4") ipcRenderer.send("quit");
        }, { once: true })
        break;

      case "Escape":
        document.activeElement.blur();
        break;
    }
  });
}

const handleKeybinds = () => {
  document.querySelectorAll(".menu .keybind").forEach((keybind) => {
    const setting = keybind.dataset.setting
    keybind.textContent = settings[setting];
    keybind.addEventListener("click", () => {
      if (document.querySelector(".keybind.active")) return;
      keybind.classList.add("active");
      keybind.textContent = "Press a key..."

      const keyHandler = (e) => {
        e.preventDefault();
        finish(e.code);
      };

      const mouseHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        finish(`Mouse${e.button}`);
      };

      const finish = (newKey) => {
        document.removeEventListener("keydown", keyHandler);
        document.removeEventListener("mousedown", mouseHandler, true);
        keybind.textContent = newKey;
        ipcRenderer.send("update-setting", setting, newKey)
        settings = ipcRenderer.sendSync("get-settings");
        keybind.classList.remove("active");
        document.dispatchEvent(new CustomEvent("helium-settings-changed", { detail: { setting, newKey } }));
      };

      document.addEventListener("keydown", keyHandler);
      if (setting === "custom_inspect_keybind") document.addEventListener("mousedown", mouseHandler, true);
    })
  })
}

const handleMenuWeaponInputChange = (input) => {
  const active = document.querySelector(".weapon.active").dataset.weapon;
  const setting = `${active}_${input.dataset.weaponSetting}`;
  const type = input.type;

  const value = type === "checkbox" ? input.checked
    : type === "range" || type === "number" ? Number(input.value)
      : input.value;

  settings[setting] = value;

  if (type === "range") {
    const update = () => {
      const min = Number(input.min);
      const max = Number(input.max);
      const val = Number(input.value);
      const pct = ((val - min) / (max - min)) * 100;
      input.style.setProperty("--v", pct);
    };
    update()
  }

  playSound("button", "click_sounds");
  ipcRenderer.send("update-setting", setting, value);
  document.dispatchEvent(new CustomEvent("helium-settings-changed", { detail: { setting, value } }));
}

const handleMenuInputChange = (input, commit = true) => {
  const setting = input.dataset.setting;
  const type = input.type;

  const value = type === "checkbox" ? input.checked
    : type === "range" || type === "number" ? Number(input.value)
      : input.value;

  if (input.classList.contains("requires-restart") && !(setting in restartInitial)) {
    restartInitial[setting] = settings[setting];
  }

  settings[setting] = value;

  if (input.classList.contains("requires-restart")) updateRestartButton();

  playSound("button", "click_sounds");
  if (commit) ipcRenderer.send("update-setting", setting, value);
  document.dispatchEvent(new CustomEvent("helium-settings-changed", { detail: { setting, value } }));
};

const handleMenuInputChanges = () => {
  const inputs = document.querySelectorAll(".menu input[data-setting]:not([type='text'])");
  inputs.forEach((input) => {
    input.addEventListener("input", () => handleMenuInputChange(input, input.type !== "color"));
    if (input.type === "color") {
      input.addEventListener("change", () => handleMenuInputChange(input, true));
    }
  });

  const textInputs = document.querySelectorAll(".menu input[data-setting][type='text'], .menu textarea[data-setting]");
  textInputs.forEach((el) => {
    el.addEventListener("change", () => handleMenuInputChange(el));
  });

  const weaponInputs = document.querySelectorAll(".menu input[data-weapon-setting]:not([type='text'])");
  weaponInputs.forEach((input) => {
    input.addEventListener("input", () => handleMenuWeaponInputChange(input));
  });

  const weaponTextInputs = document.querySelectorAll(".menu input[data-weapon-setting][type='text']");
  weaponTextInputs.forEach((el) => {
    el.addEventListener("change", () => handleMenuWeaponInputChange(el));
  });
};

const handleMenuWeaponSelectChange = (select) => {
  const active = document.querySelector(".weapon.active").dataset.weapon;
  const setting = `${active}_${select.dataset.weaponSetting}`;
  const value = select.value;
  settings[setting] = value;

  playSound("button", "click_sounds");
  ipcRenderer.send("update-setting", setting, value);
  document.dispatchEvent(new CustomEvent("helium-settings-changed", { detail: { setting, value } }));
}

const handleMenuSelectChange = (select) => {
  const setting = select.dataset.setting;
  const value = select.value;
  settings[setting] = value;

  playSound("button", "click_sounds");
  ipcRenderer.send("update-setting", setting, value);
  document.dispatchEvent(new CustomEvent("helium-settings-changed", { detail: { setting, value } }));
}

const handleMenuSelectChanges = () => {
  const selects = document.querySelectorAll(".menu select[data-setting]");
  selects.forEach((select) => {
    select.addEventListener("change", () => handleMenuSelectChange(select));
  });

  const weaponSelects = document.querySelectorAll(".menu select[data-weapon-setting]");
  weaponSelects.forEach((select) => {
    select.addEventListener("change", () => handleMenuWeaponSelectChange(select));
  });
}

const handleButtons = () => {
  const restartNow = document.querySelector(".helium-menu #restart");
  restartNow.addEventListener("click", () => {
    ipcRenderer.send("restart");
  })

  const clearKeybind = document.querySelectorAll(".menu .clear-keybind")
  clearKeybind.forEach((btn) => {
    const setting = btn.nextElementSibling.dataset.setting;
    btn.addEventListener("click", () => {
      settings[setting] = "None";
      ipcRenderer.send("update-setting", setting, "None");
      btn.nextElementSibling.textContent = "None";
    })
  })

  const openCSSFolder = document.querySelector(".menu #open-css-folder");
  openCSSFolder.addEventListener("click", () => {
    ipcRenderer.send("open", ipcRenderer.sendSync("get-css-path"))
  })

  const addCSSButton = document.querySelector(".menu #add-css");
  addCSSButton.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".css";
    input.style.display = "none";

    input.addEventListener("change", () => {
      const file = input.files[0];
      if (!file) return;

      const cssDir = ipcRenderer.sendSync("get-css-path");
      const destPath = path.join(cssDir, file.name);
      fs.copyFileSync(file.path, destPath);

      addCSS(file.name);
      input.remove();
    });

    document.body.append(input);
    input.click();
  });
  addCSSButton.addEventListener("dragover", (e) => {
    e.preventDefault();
    const items = Array.from(e.dataTransfer.items);
    const isCSS = items.some((item) => item.kind === "file" && item.type === "text/css");

    if (isCSS) {
      addCSSButton.classList.add("dragover");
      addCSSButton.textContent = "Drop File";
    } else {
      addCSSButton.classList.add("dragover");
      addCSSButton.textContent = "Not a .css file";
    }
  })
  addCSSButton.addEventListener("dragleave", () => {
    addCSSButton.classList.remove("dragover");
    addCSSButton.innerHTML = "Add CSS <span class='description'>Or drag and drop</span>";
  })
  addCSSButton.addEventListener("drop", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    addCSSButton.classList.remove("dragover");
    addCSSButton.innerHTML = "Add CSS <span class='description'>Or drag and drop</span>";

    const cssFolder = ipcRenderer.sendSync("get-css-path");

    for (const file of Array.from(e.dataTransfer.files)) {
      if (!file.name.toLowerCase().endsWith(".css")) continue;

      try {
        const base = file.name.slice(0, -4);
        let fileName = file.name;
        let i = 1;
        while (fs.existsSync(path.join(cssFolder, fileName))) {
          fileName = `${base} (${i++}).css`;
        }

        const contents = await file.text();
        fs.writeFileSync(path.join(cssFolder, fileName), contents, "utf-8");

        addCSS(fileName);
      } catch (err) {
        alert(`failed to add css: ${err.message}`);
      }
    }
  });

  const resetWeaponButton = document.querySelector(".menu #reset-weapon");
  resetWeaponButton.addEventListener("click", () => {
    const active = document.querySelector(".menu .weapon.active");
    const relevant_settings = [
      "offset_x",
      "offset_y",
      "offset_z",
      "rotate_x",
      "rotate_y",
      "rotate_z",
      "weapon_scale",
      "inspect_variation"
    ]
    relevant_settings.forEach((setting) => {
      const key = `${active.dataset.weapon}_${setting}`
      ipcRenderer.send("delete-setting", key);
    })
    const key = `${active.dataset.weapon}_inspect_duration`
    ipcRenderer.send("update-setting", key, default_settings[key]);
    settings = ipcRenderer.sendSync("get-settings");
    document.dispatchEvent(new CustomEvent("helium-settings-changed", { detail: {} }));
    handleWeaponChange(active);
  })

  const moreOptions = document.querySelector(".menu #more-options");
  moreOptions.addEventListener("click", (e) => {
    e.stopPropagation();
    [...moreOptions.nextElementSibling.children].reverse().forEach((c, i) => {
      setTimeout(() => c.classList.toggle("active"), i * 60)
    });

    document.addEventListener("click", (e) => {
      [...moreOptions.nextElementSibling.children].reverse().forEach((c, i) => {
        setTimeout(() => c.classList.remove("active"), i * 20)
      });
    }, { once: true })
    playSound("button", "click_sounds");
  })

  const exportSettings = document.querySelector(".menu #export-settings");
  exportSettings.addEventListener("click", () => {
    createModal((modal) => {
      modal.style.width = "600px"
      modal.innerHTML = `
        <div class="wrapper spaced header">
          <span>Export Settings</span>
          <svg width="20px" height="20px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" id="close-modal">
            <path d="M17 7L7 17M7 7L17 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <div class="wrapper">
          <textarea readonly></textarea>
        </div>
        <div class="wrapper spaced footer">
          <span></span>
          <div class="wrapper" id="btns">
            <div class="wrapper button" id="close-modal">
              Cancel
            </div>
            <div class="wrapper button filled" id="copy-settings">
              Copy
            </div>
          </div>
        </div>
      `

      modal.querySelector("textarea").value = JSON.stringify(settings, null, 1);

      const copy = modal.querySelector("#copy-settings");
      copy.addEventListener("click", () => {
        copy.textContent = "Copied!"
        copy.style.pointerEvents = "none";
        clipboard.writeText(JSON.stringify(settings))
        setTimeout(() => {
          copy.textContent = "Copy";
          copy.style.pointerEvents = "auto";
        }, 1500)
        playSound("button", "click_sounds");
      })

      playSound("button", "click_sounds");
    });
  });

  const importSettings = document.querySelector(".menu #import-settings");
  importSettings.addEventListener("click", () => {
    createModal((modal) => {
      modal.style.width = "600px"
      modal.innerHTML = `
        <div class="wrapper spaced header">
          <span>Import Settings</span>
          <svg width="20px" height="20px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" id="close-modal">
            <path d="M17 7L7 17M7 7L17 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <div class="wrapper">
          <textarea placeholder="Paste settings here"></textarea>
        </div>
        <div class="wrapper spaced footer">
          <span></span>
          <div class="wrapper" id="btns">
            <div class="wrapper button" id="close-modal">
              Cancel
            </div>
            <div class="wrapper button filled" id="import-settings">
              Import
            </div>
          </div>
        </div>
      `

      const importSettings = modal.querySelector("#import-settings");
      importSettings.addEventListener("click", () => {
        if (!modal.querySelector("textarea").value) return;

        try {
          const newSettings = JSON.parse(modal.querySelector("textarea").value);

          for (const key in newSettings) {
            settings[key] = newSettings[key];
            const value = newSettings[key];
            ipcRenderer.send("update-setting", key, value)
            document.dispatchEvent(new CustomEvent("helium-settings-changed", { detail: { setting: key, value: value } }));

            const inputs = document.querySelectorAll(`.menu input[data-setting=${key}], .menu input[data-weapon-setting=${key}]`);
            inputs.forEach((input) => {
              const type = input.type;

              if (type === "checkbox") input.checked = value;
              else input.value = value;

              const update = () => {
                const min = Number(input.min);
                const max = Number(input.max);
                const val = Number(input.value);
                const pct = ((val - min) / (max - min)) * 100;
                input.style.setProperty("--v", pct);
              };

              if (type === "range") update();
            })

            const keybind = document.querySelector(`.keybind[data-setting=${key}]`);
            if (keybind) keybind.textContent = value;

            const select = document.querySelector(`select[data-setting=${key}]`);
            if (select) select.value = value;
          }
        } catch (error) {
          alert(error);
        }

        importSettings.textContent = "Imported!"
        importSettings.style.pointerEvents = "none";
        setTimeout(() => {
          importSettings.textContent = "Import";
          importSettings.style.pointerEvents = "auto";
        }, 1500)
        playSound("button", "click_sounds");
      })

      playSound("button", "click_sounds");
    });
  });

  const resetSettings = document.querySelector(".menu #reset-settings");
  resetSettings.addEventListener("click", () => {
    createModal((modal) => {
      modal.style.width = "600px"
      modal.innerHTML = `
        <div class="wrapper spaced header">
          <span>Reset Settings</span>
          <svg width="20px" height="20px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" id="close-modal">
            <path d="M17 7L7 17M7 7L17 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <div class="wrapper spaced footer">
          <span>This action cannot be undone</span>
          <div class="wrapper" id="btns">
            <div class="wrapper button" id="close-modal">
              Cancel
            </div>
            <div class="wrapper button filled confirm" id="reset-settings">
              Reset
            </div>
          </div>
        </div>
      `

      const reset = modal.querySelector("#reset-settings");
      handleConfirmation(reset);
      reset.addEventListener("click", () => {
        settings = ipcRenderer.sendSync("reset-settings");
        for (const key in settings) {
          const value = settings[key];
          document.dispatchEvent(new CustomEvent("helium-settings-changed", { detail: { setting: key, value: value } }));

          const inputs = document.querySelectorAll(`.menu input[data-setting=${key}], .menu input[data-weapon-setting=${key}]`);
          inputs.forEach((input) => {
            const type = input.type;

            if (type === "checkbox") input.checked = value;
            else input.value = value;

            const update = () => {
              const min = Number(input.min);
              const max = Number(input.max);
              const val = Number(input.value);
              const pct = ((val - min) / (max - min)) * 100;
              input.style.setProperty("--v", pct);
            };

            if (type === "range") update();
          })

          const keybind = document.querySelector(`.keybind[data-setting=${key}]`);
          if (keybind) keybind.textContent = value;

          const select = document.querySelector(`select[data-setting=${key}]`);
          if (select) select.value = value;
        }

        reset.textContent = "Done!"
        reset.style.pointerEvents = "none";
        setTimeout(() => {
          reset.textContent = "Reset";
          reset.style.pointerEvents = "auto";
        }, 1500)
        playSound("button", "click_sounds");
      });

      playSound("button", "click_sounds");
    });
  });
}

const handleConfirmations = () => document.querySelectorAll(".helium-menu .confirm").forEach((btn) => {
  handleConfirmation(btn);
});

const confirmationTime = 1000;
const handleConfirmation = (btn) => {
  let timer = null;

  btn.addEventListener("click", (e) => {
    if (!settings.hold_to_confirm) return;
    if (btn.classList.contains("confirmed")) {
      btn.classList.remove("confirmed");
      return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true)

  const start = () => {
    if (timer || !settings.hold_to_confirm) return;
    btn.classList.add("holding");
    timer = setTimeout(() => {
      timer = null;
      btn.classList.add("confirmed");
    }, confirmationTime);
  };

  const stop = () => {
    clearTimeout(timer);
    timer = null;
    btn.classList.remove("holding");
  };

  const reset = () => {
    stop();
    btn.classList.remove("confirmed");
  };

  btn.addEventListener("pointerdown", (e) => { if (e.button === 0) start(); });

  btn.addEventListener("pointerup", () => {
    stop();
    setTimeout(() => btn.classList.remove("confirmed"), 100);
  });

  ["pointerleave", "pointercancel"].forEach((t) => btn.addEventListener(t, reset));
}

const handleDropdowns = () => {
  const state = JSON.parse(localStorage.getItem("helium-dropdowns") || "{}");

  document.querySelectorAll(".menu .dropdown").forEach(d => {
    const top = d.querySelector(".top");

    const apply = (open, instant) => {
      d.classList.toggle("active", open);
      d.open = open;

      [...d.children].forEach((c, i) => {
        const delay = Math.max(0, (i - 1) * 40);

        if (instant) {
          if (c === top) return;
          c.classList.remove("open");
          c.style.display = open ? "flex" : "none";
          return;
        }

        if (open) {
          setTimeout(() => {
            if (d.open !== open) return;
            c.classList.remove("gone");
            if (c !== top) c.style.display = "flex";
            c.classList.add("open");
            setTimeout(() => c.classList.remove("open"), 10);
          }, delay);
        } else {
          if (c === top) return;
          setTimeout(() => {
            if (d.open !== open) return;
            c.classList.add("open");
            setTimeout(() => {
              if (d.open !== open) return;
              c.style.display = "none";
              c.classList.remove("open");
            }, 200);
          }, delay);
        }
      });
    };

    apply(state[d.id] ?? true, true);
    top.addEventListener("click", () => {
      apply(state[d.id] = !d.classList.contains("active"));
      localStorage.setItem("helium-dropdowns", JSON.stringify(state));
    });
  });
};

const handleThemes = () => document.querySelectorAll(".menu .theme:not(.disabled)").forEach((theme) => {
  theme.addEventListener("click", () => {
    if (theme.classList.contains("active")) return;
    document.querySelector(".menu .theme.active").classList.remove("active");
    theme.classList.add("active");
    playSound("interface", "click_sounds");
  })
})

const handleNavbar = () => {
  const menu = document.querySelector(".helium-menu");
  let active = document.querySelector(".menu .tab.active").textContent.trim();
  const noResults = document.querySelector(".menu .no-results");

  const title = document.querySelector(".menu .navbar .title")

  const updateNavbar = () => {
    active = document.querySelector(".menu .tab.active").textContent.trim();
    const activeTitle = document.querySelector(".menu .tab.active").parentElement.querySelector(".tab-title").textContent
    if (activeTitle === "About" || !search.value) noResults.style.display = "none";

    if (!settings.instant_search) search.placeholder = `Search ${active.toLowerCase()}...`
    else search.placeholder = "Type to search...";

    title.textContent = active;
  }

  const checkForResults = () => {
    const raw = search.value.trim();
    const query = raw.toLowerCase();
    let matches = 0;

    document.querySelectorAll(".menu .options.active .option").forEach((option) => {
      const input = option.querySelector('input:not([type="checkbox"])');
      const isMatch = option.textContent.toLowerCase().includes(query) || (input?.value.toLowerCase().includes(query) ?? false);

      option.classList.toggle("search-hidden", !isMatch);
      option.dataset.match = isMatch;
      if (isMatch) matches++;
    });

    document.querySelectorAll(".menu .options.active .option-group").forEach((group) => {
      const hasMatch = group.querySelector('.option[data-match="true"]') !== null;
      group.classList.toggle("search-hidden", !hasMatch);
    });

    noResults.textContent = `No results for "${raw}"`;
    noResults.style.display = matches ? "none" : "flex";

    updateNavbar();
  };

  const search = document.querySelector(".menu .navbar .search");
  search.addEventListener("input", () => {
    checkForResults();
  });

  menu.addEventListener("helium-tab-changed", () => {
    updateNavbar();
    checkForResults();
  });

  const backBtn = document.querySelector(".menu .navbar #back");
  const forwardBtn = document.querySelector(".menu .navbar #forward");
}

const handleTabs = () => {
  document.querySelectorAll(".menu .tab").forEach((tab) => tab.addEventListener("click", () => {
    handleTabChange(tab)
    playSound("button", "click_sounds");
  }))
}

handleTabChange = (tab, hideFade) => {
  const tabName = tab.dataset.tab;
  if (tab.classList.contains("active")) return;
  document.querySelector(".menu .tab.active").classList.remove("active");
  tab.classList.add("active");
  localStorage.setItem("helium-active-tab", tabName);

  const fadeFrom = document.querySelector(".menu .options.active");
  const fadeTo = document.querySelector(`.menu #${tabName}-options`);

  document.querySelectorAll(".menu .options").forEach(clearFade);

  fadeFrom.classList.remove("active");
  if (!hideFade) startFade(fadeFrom, "fade-out");
  fadeTo.classList.add("active");
  if (!hideFade) startFade(fadeTo, "fade-in");

  switch (tabName) {
    case "weapons":
      if (document.querySelector(".desktop-game-interface .weapon-name")) {
        handleWeaponChange(document.querySelector(`.menu .weapon#${document.querySelector(".bottom.is-selected").previousElementSibling.textContent}`));
        break;
      }
      setTimeout(() => {
        localStorage.getItem("helium-active-weapon") ? handleWeaponChange(document.querySelector(`[data-weapon="${localStorage.getItem("helium-active-weapon")}"]`), true)
          : handleWeaponChange(document.querySelector(".menu .weapon"));
      }, 0);
      break;
  }

  document.querySelector(".helium-menu").dispatchEvent(new Event("helium-tab-changed", { bubbles: true }));
}

const handleWeapons = () => {
  document.querySelectorAll(".menu .weapon").forEach((tab) => tab.addEventListener("click", () => {
    handleWeaponChange(tab)
    playSound("button", "click_sounds");
  }))
}

handleWeaponChange = (tab) => {
  const tabName = tab.dataset.weapon;
  document.querySelector(".menu .weapon.active").classList.remove("active");
  tab.classList.add("active");
  localStorage.setItem("helium-active-weapon", tabName);

  const title = document.querySelector(".menu .title");
  title.innerHTML = `Weapon Mods <span style="color:gray; font-size:0.8em;">> ${tab.id}</span>`

  const weaponName = document.querySelector(".menu .weapon-name");
  weaponName.textContent = tab.id;

  const variations = document.querySelector("#inspect_variation");
  variations.innerHTML = "";
  Object.keys(inspectData[tabName]).forEach((key) => {
    const option = document.createElement("option");
    option.textContent = key;
    option.value = key;
    variations.append(option);
  });
  variations.value = settings[`${tabName}_inspect_variation`] ?? settings.inspect_variation;

  document.querySelectorAll("input[data-weapon-setting]").forEach((input) => {
    const setting = input.dataset.weaponSetting;
    input.value = settings[`${tabName}_${setting}`] ?? settings[setting];
    input.dispatchEvent(new Event("update"));

    if (!input.type === "range") return;
    const update = () => {
      const min = Number(input.min);
      const max = Number(input.max);
      const val = Number(input.value);
      const pct = ((val - min) / (max - min)) * 100;
      input.style.setProperty("--v", pct);
    };
    update();
  })
}

const updateDependent = (option) => {
  const dependency = option.dataset.requires;
  const d = document.querySelector(`.menu [data-setting="${dependency}"]`);
  let dd = d?.closest(".option");
  const ddd = dd?.dataset.requires;
  option.classList.remove("disabled");
  if (!settings[dependency] || (ddd && !settings[ddd])) option.classList.add("disabled");

  const value = option.dataset.value;
  if (!value) return;
  option.classList.remove("disabled");
  const isBool = value === "true" || value === "false";
  const expected = isBool ? value === "true" : value;
  if (settings[dependency] !== expected || (ddd && !settings[ddd])) option.classList.add("disabled");
}

const updateDependents = () => document.querySelectorAll(".menu [data-requires]").forEach((dependent) => {
  updateDependent(dependent);
});

const handleLinkedInputs = () => {
  const groups = {};
  document.querySelectorAll(".menu input[data-setting]").forEach((input) => {
    (groups[input.dataset.setting] ??= []).push(input);
  });
  document.querySelectorAll(".menu input[data-weapon-setting]").forEach((input) => {
    (groups[input.dataset.weaponSetting] ??= []).push(input);
  });

  Object.entries(groups).forEach(([setting, inputs]) => {
    if (inputs.length < 2) return;
    inputs.forEach((input) => {
      input.addEventListener("input", () => {
        inputs.forEach((other) => {
          if (other === input) return;
          other.value = input.value;
        });
      });
    });
  });
};

const syncAllCSS = () => {
  const cssList = document.querySelector(".menu #css-list");
  const checkboxes = cssList.querySelectorAll("input[type='checkbox']");

  checkboxes.forEach(checkbox => {
    const rawCSS = checkbox.dataset.rawCss;
    const style = document.getElementById(`user-css-${rawCSS}`);
    if (!style) return;

    if (settings.enable_css && checkbox.checked) {
      const cssPath = path.join(ipcRenderer.sendSync("get-css-path"), rawCSS);
      style.textContent = fs.readFileSync(cssPath, "utf-8");
    } else {
      style.textContent = "";
    }
  });
};

const getCSSStyle = (rawCSS) => {
  let style = document.getElementById(`user-css-${rawCSS}`);
  if (style) return style;

  style = document.createElement("style");
  style.id = `user-css-${rawCSS}`
  document.head.append(style);

  const states = JSON.parse(localStorage.getItem("helium-css-states") || "{}");
  if (states[rawCSS] && settings.enable_css) {
    style.textContent = fs.readFileSync(path.join(ipcRenderer.sendSync("get-css-path"), rawCSS), "utf-8");
  }
  return style;
}

const addCSS = (rawCSS) => {
  const cssList = document.querySelector(".menu #css-list");
  const rawName = rawCSS.slice(0, -4)

  const existingInputs = cssList.querySelectorAll("input[type='text']");
  for (let input of existingInputs) {
    if (input.value.trim() === rawName) return;
  }

  const cssFolder = ipcRenderer.sendSync("get-css-path");
  let cssPath = path.join(cssFolder, rawCSS);

  const css = document.createElement("div");
  css.innerHTML = `
    <div class="option" data-requires="enable_css">
      <div class="wrapper row">
        <input type="text" value="${rawName}">
        <svg width="20px" height="20px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="open-css hover" data-title="Open CSS">
          <path d="M21 9L21 3M21 3H15M21 3L13 11M10 5H7.8C6.11984 5 5.27976 5 4.63803 5.32698C4.07354 5.6146 3.6146 6.07354 3.32698 6.63803C3 7.27976 3 8.11984 3 9.8V16.2C3 17.8802 3 18.7202 3.32698 19.362C3.6146 19.9265 4.07354 20.3854 4.63803 20.673C5.27976 21 6.11984 21 7.8 21H14.2C15.8802 21 16.7202 21 17.362 20.673C17.9265 20.3854 18.3854 19.9265 18.673 19.362C19 18.7202 19 17.8802 19 16.2V14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="wrapper row">
        <div class="checkbox">
          <input type="checkbox" id="css-${rawName}">
          <label for="css-${rawName}"></label>
        </div>
        <div class="wrapper button confirm delete-css">
          <svg width="20px" height="20px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 6V5.2C16 4.0799 16 3.51984 15.782 3.09202C15.5903 2.71569 15.2843 2.40973 14.908 2.21799C14.4802 2 13.9201 2 12.8 2H11.2C10.0799 2 9.51984 2 9.09202 2.21799C8.71569 2.40973 8.40973 2.71569 8.21799 3.09202C8 3.51984 8 4.0799 8 5.2V6M10 11.5V16.5M14 11.5V16.5M3 6H21M19 6V17.2C19 18.8802 19 19.7202 18.673 20.362C18.3854 20.9265 17.9265 21.3854 17.362 21.673C16.7202 22 15.8802 22 14.2 22H9.8C8.11984 22 7.27976 22 6.63803 21.673C6.07354 21.3854 5.6146 20.9265 5.32698 20.362C5 19.7202 5 18.8802 5 17.2V6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
    </div>
  `
  updateDependent(css.querySelector(".option"))

  // apply css

  const style = getCSSStyle(rawCSS);

  // buttons

  const openCSS = css.querySelector(".open-css");
  openCSS.addEventListener("click", () => {
    ipcRenderer.send("open", cssPath);
    playSound("button", "click_sounds");
  })

  const deleteCSS = css.querySelector(".delete-css");
  handleConfirmation(deleteCSS);
  deleteCSS.addEventListener("click", () => {
    try {
      fs.unlinkSync(cssPath);
      css.classList.add("gone");
      const states = JSON.parse(localStorage.getItem("helium-css-states") || "{}");
      delete states[rawCSS];
      localStorage.setItem("helium-css-states", JSON.stringify(states));

      setTimeout(() => {
        css.remove();
        style.remove();
      }, 200)
    } catch (err) {
      alert(`failed to delete css: ${err}`)
    }
  })

  // name change

  const name = css.querySelector("input[type='text']");
  name.addEventListener("change", () => {
    const newName = name.value.trim();
    if (!newName || newName === rawName) {
      name.value = rawName;
      return;
    }

    const newRawCss = `${newName}.css`;
    const newCssPath = path.join(ipcRenderer.sendSync("get-css-path"), newRawCss);

    if (fs.existsSync(newCssPath)) {
      alert(`${newName} is already taken`);
      name.value = rawName;
      return;
    }

    try {
      fs.renameSync(cssPath, newCssPath);

      style.id = `user-css-${newRawCss}`;

      const checkbox = css.querySelector("input[type='checkbox']");
      const label = css.querySelector("label");
      const newCheckboxId = `css-${newName}`;
      checkbox.id = newCheckboxId;
      label.htmlFor = newCheckboxId;
      checkbox.dataset.rawCss = newRawCss;

      const states = JSON.parse(localStorage.getItem("helium-css-states") || "{}");
      if (states[rawCSS]) {
        states[newRawCss] = true;
        delete states[rawCSS];
        localStorage.setItem("helium-css-states", JSON.stringify(states));
      }

      rawCSS = newRawCss;
      cssPath = path.join(cssFolder, rawCSS);
    } catch (err) {
      alert(`failed to rename css: ${err.message}`);
      name.value = rawName;
    }
  })

  // toggle

  const checkbox = css.querySelector("input[type='checkbox']");
  checkbox.dataset.rawCss = rawCSS;

  const savedStates = JSON.parse(localStorage.getItem("helium-css-states") || "{}");
  if (savedStates[rawCSS] && settings.enable_css) checkbox.checked = true;

  checkbox.addEventListener("change", () => {
    playSound("button", "click_sounds")

    const states = JSON.parse(localStorage.getItem("helium-css-states") || "{}");
    const currentRawCss = checkbox.dataset.rawCss;
    const currentCssPath = path.join(ipcRenderer.sendSync("get-css-path"), currentRawCss);
    if (checkbox.checked) {
      states[currentRawCss] = true;
      style.textContent = fs.readFileSync(currentCssPath, "utf-8");
    } else {
      delete states[currentRawCss];
      style.textContent = "";
    }
    localStorage.setItem("helium-css-states", JSON.stringify(states));
  })

  cssList.insertBefore(css, cssList.children[1])
}

const handleCSS = () => {
  const cssList = fs.readdirSync(ipcRenderer.sendSync("get-css-path"));
  cssList.forEach((css) => {
    if (!css.endsWith(".css")) return;
    getCSSStyle(css);
  });
}

const handleCSSList = () => {
  const cssList = fs.readdirSync(ipcRenderer.sendSync("get-css-path"));
  cssList.forEach((css) => {
    if (!css.endsWith(".css")) return;
    addCSS(css);
  });
}

const handleDefaults = () => {
  document.querySelectorAll(".menu input[data-setting]").forEach((input) => {
    const defaultValue = default_settings[input.dataset.setting];
    const type = input.type;
    if (type === "text" || type === "number") input.placeholder = defaultValue.toLocaleString();
  })
}

const handleTooltips = () => {
  document.querySelectorAll(".menu [data-title]").forEach((el) => {
    let timer = null;
    let tip = null;
    const delay = 500;

    const show = () => {
      tip = document.createElement("div");
      tip.className = "menu-tooltip";
      tip.textContent = el.dataset.title;
      document.body.append(tip);

      const r = el.getBoundingClientRect();
      tip.style.left = `${r.left + r.width / 2}px`;
      tip.style.top = `${r.top - 8}px`;
    };

    const hide = () => {
      clearTimeout(timer);
      if (tip) tip.remove();
      tip = null;
    };

    el.addEventListener("mouseenter", () => { timer = setTimeout(show, delay); });
    el.addEventListener("mouseleave", hide);
    el.addEventListener("mousedown", hide);
  })
};

//

const setupMenu = () => {
  handleKeybinds();
  updateRestartButton();
  handleConfirmations();
  handleTabs();
  handleWeapons();
  handleNavbar();
  handleButtons();
  handleDropdowns();
  handleThemes();
  handleMenuInputChanges();
  handleMenuSelectChanges();
  updateDependents();
  handleLinkedInputs();
  handleCSSList();
  handleDefaults();
  handleTooltips();

  document.querySelector(".menu .version").textContent = `v${version}`;
  if (localStorage.getItem("avatar_cache")) document.querySelector(".menu .avatar").style.backgroundImage = localStorage.getItem("avatar_cache");
  if (localStorage.getItem("nickname_cache")) document.querySelector(".menu .nickname").textContent = localStorage.getItem("nickname_cache");

  const inputs = document.querySelectorAll("input[data-setting]");
  const textareas = document.querySelectorAll("textarea[data-setting]");
  const selects = document.querySelectorAll("select[data-setting]");
  inputs.forEach((input) => {
    const setting = input.dataset.setting;
    const type = input.type;
    const value = settings[setting];
    if (type === "checkbox") {
      input.checked = value;
    } else {
      input.value = value;
    }

    if (!type === "range") return;
    const update = () => {
      const min = Number(input.min);
      const max = Number(input.max);
      const val = Number(input.value);
      const pct = ((val - min) / (max - min)) * 100;
      input.style.setProperty("--v", pct);
    };

    input.addEventListener("input", update);
    update();
  });

  selects.forEach((select) => {
    const setting = select.dataset.setting;
    const value = settings[setting];
    select.value = value;
  });

  textareas.forEach((textarea) => {
    const setting = textarea.dataset.setting;
    const value = settings[setting];
    textarea.value = value;
  });

  localStorage.getItem("helium-active-tab") ? handleTabChange(document.querySelector(`[data-tab="${localStorage.getItem("helium-active-tab")}"]`), true)
    : handleTabChange(document.querySelector(".menu .tab"));

  if (updateInfo) handleUpdateAvailable(updateInfo);
}

const initMenu = (updateAvailable, info) => {
  localStorage.setItem("helium-navigator-history", JSON.stringify({ entries: [], index: -1 }));
  handleHotkeys();
  handleCSS();

  if (updateAvailable && info) {
    updateInfo = info;
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent("custom-notification", { detail: { message: "An Update is available! Click here to open the Installer", onclick: () => { toggleMenu(true); document.querySelector(".helium-menu .update.available").dispatchEvent(new Event("click")) } } }))
    }, 0)
  };

  document.addEventListener("helium-settings-changed", (e) => {
    const menu = document.querySelector(".helium-menu");
    if (!menu) return;

    const { setting, value } = e.detail;
    updateDependents();
    switch (setting) {
      case "instant_search":
        const search = document.querySelector(".menu .search");
        const active = document.querySelector(".menu .tab.active").textContent.trim();

        if (value) search.placeholder = "Type to search...";
        else search.placeholder = `Search ${active.toLowerCase()}...`
        break;

      case "enable_css":
        syncAllCSS();
        break;

      case "accent_color":
        menu.style.setProperty("--accent", hexToRgb(settings.accent_color));
        break;

      case "menu_keybind":
        const reminder = document.querySelector("#helium-keybind-reminder");
        if (reminder) reminder.textContent = `Press ${settings.menu_keybind} to open the client menu.`
        break;
    }
  });

  if (localStorage.getItem("helium-menu") === "true") toggleMenu(true);
}

module.exports = { initMenu };