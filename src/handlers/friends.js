const handleFriends = () => {
  const handleSpectateBtn = (el) => {
    const online = el.querySelector(".online");
    if (!online || !el.classList.contains("is-online") || !online?.textContent.includes("in game")) {
      el.querySelector(".spectate-eye")?.remove();
      return;
    };

    if (el.querySelector(".spectate-eye")) return;

    const url = online.textContent.split(" ")[2].slice(1, -1);

    console.log(el);

    const spectateEye = document.createElement("div");
    spectateEye.className = "spectate-eye";
    spectateEye.innerHTML = `
    <svg width="20px" height="20px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2.42012 12.7132C2.28394 12.4975 2.21584 12.3897 2.17772 12.2234C2.14909 12.0985 2.14909 11.9015 2.17772 11.7766C2.21584 11.6103 2.28394 11.5025 2.42012 11.2868C3.54553 9.50484 6.8954 5 12.0004 5C17.1054 5 20.4553 9.50484 21.5807 11.2868C21.7169 11.5025 21.785 11.6103 21.8231 11.7766C21.8517 11.9015 21.8517 12.0985 21.8231 12.2234C21.785 12.3897 21.7169 12.4975 21.5807 12.7132C20.4553 14.4952 17.1054 19 12.0004 19C6.8954 19 3.54553 14.4952 2.42012 12.7132Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12.0004 15C13.6573 15 15.0004 13.6569 15.0004 12C15.0004 10.3431 13.6573 9 12.0004 9C10.3435 9 9.0004 10.3431 9.0004 12C9.0004 13.6569 10.3435 15 12.0004 15Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    `
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