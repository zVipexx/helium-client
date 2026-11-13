const { ipcRenderer } = require("electron");
const { handleSettings } = require("../handlers/settings.js");

const handleIngame = () => {
  const mode = document.querySelector(".loading-scene .mode").textContent;

  // prevent competitive advantage through kirka debug mode

  document.addEventListener("keyup", (e) => {
    if (e.key === "8") {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  document.querySelector(".svg-icon--__skull__")?.closest(".ui-cell").parentElement.classList.add("kill-death");

  // assists counter

  let assistsCount = 0;
  const createAssists = () => {
    if (document.querySelector(".ui-cell.assists")) return;
    const kills = document.querySelector(".svg-icon--__skull__").closest(".ui-cell");
    const assists = kills?.cloneNode(true);
    assistsCount = 0;

    if (!assists) return;
    assists.classList.add("assists");
    assists.classList.remove("kill");

    assists.querySelector("svg").style.fill = "yellow";

    kills.parentElement.insertBefore(assists, kills.parentElement.children[3]);
  };
  createAssists();

  const renderAssists = () => {
    const assists = document.querySelector(".kill-death .assists .cell-value");
    if (assists) assists.lastChild.textContent = assistsCount;
  };

  //headshot % counter

  let headshotsCount = 0;
  const createHeadshots = () => {
    if (document.querySelector(".ui-cell.hsp")) return;
    const kills = document.querySelector(".svg-icon--__skull__").closest(".ui-cell");
    const hsp = kills?.cloneNode(true);
    headshotsCount = 0;

    if (!hsp) return;
    hsp.classList.add("hsp");
    hsp.classList.remove("kill");
    hsp.style.gap = "0.25rem";
    hsp.innerHTML = `<span class="hs-percentage">0</span> <span class="text-hs" style="font-size: 0.75rem;">HS%</span>`;

    kills.parentElement.insertBefore(hsp, kills.parentElement.children[4]);
  };
  createHeadshots();

  const renderHeadshots = () => {
    const hsp = document.querySelector(".ui-cell.hsp");
    const killsEl = document.querySelector(".svg-icon--__skull__").closest(".ui-cell");
    if (!hsp || !killsEl) return;

    const killCount = Number(killsEl.innerText) + 1;
    const hsPercentage = parseFloat((headshotsCount / killCount) * 100).toFixed(0) || 0;

    const nextHtml = `<span class="hs-percentage">${hsPercentage}</span> <span class="text-hs" style="font-size: 0.75rem;">HS%</span>`;
    if (hsp.innerHTML !== nextHtml) {
      hsp.innerHTML = nextHtml;
    }
  };

  // enemy point indicator

  const toggleEnemyPointIndicator = () => {
    let eop = document.querySelector(".enemy-point");
    console.log("point")

    eop = document.createElement("div");
    eop.classList.add("enemy-point");
    eop.textContent = "Enemy Point!";
    document.querySelector(".desktop-game-interface").append(eop);

    setTimeout(() => {
      eop.classList.add("fade-out");
    }, 1500);

    setTimeout(() => {
      eop.remove();
    }, 1900);
  };

  // observers

  const achCont = document.querySelector(".ach-cont");
  if (achCont) {
    let last = 0;

    new MutationObserver((mutations) => {
      for (const { target: el } of mutations) {
        if (!el.matches(".slide-fade-enter-active.slide-fade-enter-to")) continue;

        const text = el.querySelector(".text")?.textContent ?? "";
        const now = Date.now();
        if (now - last < 200) continue;

        switch (true) {
          case text.includes("ASSIST"):
            last = now;
            assistsCount++;
            renderAssists();
            break;
        }
      }
    }).observe(achCont, { subtree: true, attributes: true, attributeFilter: ["class"] });
  }

  const killBarCont = document.querySelector(".kill-bar-cont");
  if (killBarCont) {
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.classList.contains("fade-leave-active") || document.querySelector(".script-ui .ui-row:first-child .cell-value").textContent.includes("WARMUP")) return;

          const killername = node.querySelector(".killer-name")?.textContent.trim();
          if (!killername || killername !== localStorage.getItem("nickname_cache")) return;

          if (node.querySelector(".skull")) headshotsCount++;
          renderHeadshots();
        }
      }
    }).observe(killBarCont, { childList: true });
    new MutationObserver(() => {
      if (!ipcRenderer.sendSync("get-settings").colored_killfeed || document.querySelector(".script-ui .ui-row:first-child .cell-value").textContent.includes("WARMUP")) return;
      killBarCont.querySelectorAll(".kill-bar-item").forEach((kill) => {

        kill.classList.remove("blue", "red");

        const killername = kill.querySelector(".killer-name")?.textContent.trim();
        if (!killername) return;

        document.querySelectorAll(".script-tab .player-cont").forEach((player) => {
          if (player.querySelector(".nickname").textContent.trim() !== killername) return;

          if (player.closest(".player-list").classList.contains("side-red")) kill.classList.add("red");
          else if (player.closest(".player-list").classList.contains("side-blue")) kill.classList.add("blue");
        })
      })
    }).observe(killBarCont, { childList: true })
  }

  const teamScores = document.querySelectorAll(".script-ui .ui-row .ui-cell.bg-red, .script-ui .ui-row .ui-cell.bg-blue");
  if (teamScores && mode === "POINT") {
    teamScores.forEach((label) => {
      let oldScore = label.textContent;
      new MutationObserver(() => {
        const newScore = label.textContent;
        if (newScore <= oldScore) {
          oldScore = newScore;
          return;
        }

        if (!ipcRenderer.sendSync("get-settings").enemy_point_indicator) return;

        const player = document.querySelector(".script-tab .nickname.bolder");
        if (!player) return;
        const playerSide = player.closest(".player-list");
        const isLeft = playerSide.classList.contains("side-red");
        const isRight = playerSide.classList.contains("side-blue");

        if ((isLeft && label.classList.contains("bg-blue")) || (isRight && label.classList.contains("bg-red"))) {
          toggleEnemyPointIndicator();
        }
      }).observe(label, { characterData: true, subtree: true })
    })
  }

  const chat = document.querySelector("#chat .messages-cont");
  if (chat) {
    new MutationObserver(() => {
      const text = chat.querySelector(".message:last-child").querySelector(".text").textContent;
      if (text.includes("reset the match.")) {
        assistsCount = 0;
        headshotsCount = 0;

        renderAssists();
        renderHeadshots();
      }
    }).observe(chat, { childList: true, subtree: true, characterData: true })
  }

  const gameInterface = document.querySelector(".game-interface");
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        switch (true) {
          case node.matches(".esc-interface"):
            handleEscapeInterface();
            break;
        }
      });
    }
  }).observe(gameInterface, { childList: true })

  handleEscapeInterface();
}

const handleEscapeInterface = () => {


  //observers

  const escInterface = document.querySelector(".esc-interface");
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        switch (true) {
          case node.matches(".vm--container"):
            setTimeout(() => {
              if (document.querySelector("div[data-modal='settings']")) handleSettings();
            }, 0);
            break;
        }
      });
    }
  }).observe(escInterface, { childList: true })
}

module.exports = { handleIngame }