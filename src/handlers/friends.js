const handleFriends = () => {
  const handleSpectateBtn = (el) => {
    const online = el.querySelector(".online");
    if (!online || !el.classList.contains("is-online") || !online?.textContent.includes("in game")) {
      el.querySelector(".spectate-eye")?.remove();
      return;
    };

    if (el.querySelector(".spectate-eye")) return;

    const url = online.textContent.split(" ")[2].slice(1, -1);

    const spectateEye = document.createElement("i");
    spectateEye.className = "fas fa-eye spectate-eye";
    online.insertAdjacentElement("afterend", spectateEye);
    spectateEye.addEventListener("click", (e) => {
      e.stopPropagation();
      document.querySelector(".close")?.click();
      document.dispatchEvent(new CustomEvent("quickjoin", { detail: { url, spectate: true } }))
    })
  }

  const applyListChanges = () => {
    const customizations = JSON.parse(localStorage.getItem("customizations"));
    document.querySelectorAll(".friend").forEach((friend) => {
      handleSpectateBtn(friend);
      new MutationObserver(() => {
        handleSpectateBtn(friend);
      }).observe(document.querySelector(".friends .list"), { characterData: true, attributes: true, subtree: true, attributeFilter: ["class"] })

      const userEl = friend.querySelector(".nickname");
      const shortId = friend.querySelector(".friend-id").textContent;

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
          img.style.height = "18px";
          img.src = badge;
          badgesEl.append(img);
        })
      } else userEl.querySelector(".helium-badges")?.remove();
    })
  }
  applyListChanges();

  document.querySelectorAll(".friends .tab").forEach((tab) => tab.addEventListener("click", () => applyListChanges()));
}

module.exports = { handleFriends }