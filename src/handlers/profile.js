const handleProfile = () => {
  const getRank = (points) => {
    if (points >= 240) return "Grandmaster";
    if (points >= 180) return "Master";
    if (points >= 130) return "Ace";
    if (points >= 90) return "Specialist";
    if (points >= 55) return "Cadet";
    if (points >= 30) return "Novice";
    return "Rookie";
  };

  const addKTiersIcon = () => {
    const profile = document.querySelector(".tab-content > .profile-cont > .profile");
    const shortId = profile.querySelector(".card-profile .copy-cont .value")?.textContent.trim().split("#")[1];
    if (!profile || !shortId) return;

    const ktiersList = localStorage.getItem("ktiers-list");
    if (!ktiersList) return;

    let ktiersData;
    try {
      ktiersData = JSON.parse(ktiersList);
    } catch (e) {
      return;
    }

    const player = ktiersData.players?.find((p) => p.shortId === shortId);
    if (!player) return;

    const rank = getRank(player.points);

    if (profile.querySelector(".ktiers-rank-icon")) return;

    const icon = document.createElement("img");
    icon.src = `https://ktiers.com/imgs/placements/${rank}.svg`;
    icon.classList.add("ktiers-rank-icon");

    const rankColors = {
      Grandmaster: "#ffb300b3",
      Master: "#fffc5bb3",
      Ace: "#ff8585b3",
      Specialist: "#e66bffb3",
      Cadet: "#8b5cf6b3",
      Novice: "#0ea5e9b3",
      Rookie: "#e8ecf4b3",
    };

    icon.style.setProperty("--rank-glow-color", rankColors[rank] || "transparent");

    document.querySelector(".profile-cont").parentElement.insertAdjacentElement("afterend", icon);
  };
  addKTiersIcon();

  const applyProfileChanges = () => {
    const applyUserCustomizations = () => {
      const customizations = JSON.parse(localStorage.getItem("customizations"));
      const userEl = document.querySelector(".profile .nickname");
      if (!userEl) return;
      const shortId = document.querySelector(".card-profile .value").textContent.replace("#", "");

      const customs = customizations?.find((c) => c.shortId === shortId);
      if (!customs) return;

      if (customs.gradient) {
        userEl.classList.add("helium-gradient");
        userEl.style.background = `linear-gradient(${customs.gradient.rot}, ${customs.gradient.stops.join(", ")})`;
        userEl.style.textShadow = customs.gradient.shadow || "0 0 0 transparent";
      } else userEl.classList.remove("helium-gradient");

      if (customs.badges && !userEl.querySelector(".helium-badges")) {
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
      const clanEl = document.querySelector(".profile .clan-tag");
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

    const applyCardChanges = () => {
      const cardEl = document.querySelector(".card.statistics");
      const kloEl = document.querySelector(".stat-value-kd");
      const progressionEl = document.querySelector(".progress-exp");
      if (!cardEl) return;

      if (kloEl) kloEl.textContent = Number(kloEl.textContent).toLocaleString();
      if (progressionEl) progressionEl.textContent = `${Number(progressionEl.textContent.split(" / ")[0]).toLocaleString()} / ${Number(progressionEl.textContent.split(" / ")[1]).toLocaleString()}`

      let kills = 0;
      let games = 0;
      cardEl.querySelectorAll(".statistic").forEach((card) => {
        const nameEl = card.querySelector(".stat-name");
        const name = nameEl.textContent;
        const valueEl = card.querySelector(".stat-value");
        const value = valueEl.textContent;

        if (name !== "created") valueEl.textContent = Number(value).toLocaleString();
        else valueEl.textContent = `${Number(value.split(" ")[0]).toLocaleString()} ${value.split(" ")[1]}`;

        switch (name) {
          case "games":
            games = value;
            break;

          case "played":
            games = value;
            break;

          case "win":
            if (games === 0 || value === "0") break;
            valueEl.innerHTML += ` <span class="wrp">${+(100 / games * value).toFixed(2)}%</span>`;
            break;

          case "won":
            if (games === 0 || value === "0") break;
            valueEl.innerHTML += ` <span class="wrp">${+(100 / games * value).toFixed(2)}%</span>`;
            break;

          case "kills":
            kills = value;
            break;

          case "headshots":
            if (kills === 0 || value === 0) break;
            valueEl.innerHTML += ` <span class="hsp">${+(100 / kills * value).toFixed(2).toLocaleString()}%</span>`;
            break;
        }
      })
    }
    applyCardChanges();
  }
  applyProfileChanges();

  document.querySelector(".tab-header").addEventListener("click", (e) => {
    if (!e.target.classList.contains("tab") || e.target.textContent.includes("trophies") || e.target.textContent.includes("skins")) return;
    waitForElement(".card.statistics", () => applyProfileChanges());
  })
}

module.exports = { handleProfile }