const { handleCreate } = require("./create.js");
const { handleSettings } = require("../handlers/settings.js");
const { ipcRenderer } = require("electron");

const settings = ipcRenderer.sendSync("get-settings");

const handleLobby = () => {
  const menuAvatar = document.querySelector(".menu .footer .avatar");
  const menuNickname = document.querySelector(".menu .footer .nickname");

  const updateMenuAvatar = () => {
    const source = document.querySelector(".auth-user .avatar");
    const current = source && source.style.backgroundImage;
    if (!current) return;
    menuAvatar.style.backgroundImage = current;
    localStorage.setItem("avatar_cache", current);
  };
  updateMenuAvatar();

  const updateMenuNickname = () => {
    const nick = document.querySelector(".team-section .nickname");
    const current = nick && nick.textContent;
    if (!current) return;
    menuNickname.textContent = current;
    localStorage.setItem("nickname_cache", current);
  }
  updateMenuNickname();

  localStorage.setItem("user_id", document.querySelector(".auth-user .username").textContent);

  new MutationObserver((updateMenuAvatar)).observe(document.querySelector(".auth-user .avatar"), { attributes: true, attributeFilter: ["style"] });
  new MutationObserver((updateMenuNickname)).observe(document.querySelector(".team-section .nickname"), { characterData: true });

  // format money

  document.querySelectorAll(".money").forEach((money) => {
    money.lastChild.textContent = Number(money.lastChild.textContent).toLocaleString();
  })

  // helium customizations

  const applyUserCustomizations = () => {
    const customizations = JSON.parse(localStorage.getItem("customizations"));
    const userEl = document.querySelector(".team-section .heads .nickname");
    const shortId = localStorage.getItem("user_id").replace("#", "");

    const customs = customizations?.find((c) => c.shortId === shortId);
    if (!customs) return;

    if (customs.gradient) {
      userEl.classList.add("helium-gradient");
      userEl.style.background = `linear-gradient(${customs.gradient.rot}, ${customs.gradient.stops.join(", ")})`;
      userEl.style.textShadow = customs.gradient.shadow || "0 0 0 transparent";
    } else userEl.classList.remove("helium-gradient");

    if (customs.badges) {
      const badgesEl = document.createElement("div");
      badgesEl.classList.add("helium-badges");
      userEl.append(badgesEl)

      customs.badges.forEach((badge) => {
        const img = document.createElement("img");
        img.style.height = "32px";
        img.src = badge;
        badgesEl.append(img);
      })
    } else userEl.querySelector(".helium-badges")?.remove();
  }
  applyUserCustomizations();

  const applyClanCustomizations = () => {
    const clans = JSON.parse(localStorage.getItem("clancustomizations"));
    const clanEl = document.querySelector(".team-section .heads .clan-tag");
    if (!clanEl) return;
    const userClan = clanEl.firstChild.textContent.trim();

    const customs = clans?.find((c) => c.clan === userClan);
    if (!customs) return;

    if (customs.gradient) {
      clanEl.classList.add("helium-gradient");
      clanEl.style.background = `linear-gradient(${customs.gradient.rot}, ${customs.gradient.stops.join(", ")})`;
      clanEl.style.textShadow = customs.gradient.shadow || "0 0 0 transparent";
    } else clanEl.classList.remove("helium-gradient");
  }
  applyClanCustomizations();

  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        switch (true) {
          case node.matches(".vm--container"):
            setTimeout(() => {
              if (document.querySelector("div[data-modal='create-modal']")) handleCreate();
              else if (document.querySelector("div[data-modal='settings']")) handleSettings();
            }, 0);
            break;
        }
      });
    }
  }).observe(document.querySelector(".interface"), { childList: true });

  // ktiers and discord buttons
  const addSocialButtons = () => {
    const redditBtn = document.querySelector(".card-cont.soc-group");

    const ktiersBtn = redditBtn.cloneNode(true);
    ktiersBtn.className = "card-cont soc-group transfer-list-top-enter transfer-list-top-enter-active";
    ktiersBtn.id = "ktiers-btn";
    ktiersBtn.addEventListener("click", () => window.open("https://ktiers.com", "_blank"));

    const discord = ktiersBtn.querySelector(".svg-icon");
    const img = document.createElement("img");
    img.style = "height: 48px; width: 48px;";
    img.src = "https://i.imgur.com/kkykpLk.png";

    discord.replaceWith(img);

    const clientBtn = document.querySelector(".svg-icon--__gamepad__").closest(".card-cont");

    const discordBtn = clientBtn.cloneNode(true);
    discordBtn.className = "card-cont soc-group transfer-list-top-enter transfer-list-top-enter-active";
    discordBtn.id = "helium-discord-btn";
    discordBtn.addEventListener("click", () => window.open("https://discord.gg/VsMEQ3HWs2", "_blank"));

    const text = discordBtn.querySelector(".text-soc");
    text.firstChild.textContent = "HELIUM";
    text.lastChild.textContent = "DISCORD";

    const gamepad = discordBtn.querySelector(".svg-icon");
    const svg = document.createElement("div");
    svg.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" class="bi bi-discord" viewBox="0 0 16 16">
      <path d="M13.545 2.907a13.2 13.2 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.2 12.2 0 0 0-3.658 0 8 8 0 0 0-.412-.833.05.05 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.04.04 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032q.003.022.021.037a13.3 13.3 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019q.463-.63.818-1.329a.05.05 0 0 0-.01-.059l-.018-.011a9 9 0 0 1-1.248-.595.05.05 0 0 1-.02-.066l.015-.019q.127-.095.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.05.05 0 0 1 .053.007q.121.1.248.195a.05.05 0 0 1-.004.085 8 8 0 0 1-1.249.594.05.05 0 0 0-.03.03.05.05 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.2 13.2 0 0 0 4.001-2.02.05.05 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.03.03 0 0 0-.02-.019m-8.198 7.307c-.789 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612m5.316 0c-.788 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612"/>
    </svg>
    `;

    gamepad.replaceWith(svg);

    redditBtn.replaceWith(ktiersBtn);
    clientBtn.replaceWith(discordBtn);

    setInterval(() => {
      ktiersBtn.className = "card-cont soc-group";
      discordBtn.className = "card-cont soc-group";
    }, 0);
  }
  addSocialButtons();

  // keybind reminder

  const reminder = document.createElement("span");
  reminder.id = "helium-keybind-reminder"
  reminder.textContent = `Press ${settings.menu_keybind} to open the client menu.`
  document.querySelector("#app #left-icons").appendChild(reminder);

  // drag and drop game links to join

  const interface = document.querySelector(".interface");
  interface.addEventListener("dragover", (e) => {
    if (!e.dataTransfer.types.includes("text/plain")) return;
    e.preventDefault();
    interface.classList.add("dragover");
  });

  interface.addEventListener("dragleave", () => {
    interface.classList.remove("dragover");
  })

  interface.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    interface.classList.remove("dragover");
    const text = e.dataTransfer.getData("text/plain");
    document.dispatchEvent(new CustomEvent("quickjoin", { detail: text }))
  });
};

module.exports = { handleLobby };