const handleServers = () => {
  //join Buttons
  const updateStyle = (server) => {
    const joinBtn = server.querySelector(".button.join");
    const text = joinBtn.querySelector(".text");

    if (server.classList.contains("is-locked")) {
      text.innerHTML = "spec";
      joinBtn.style.filter = "grayscale(0.8)";
    } else {
      text.innerHTML = "join";
      joinBtn.style.filter = "";
    }
  }

  const updateJoinBtns = () => {
    document.querySelectorAll(".list .server").forEach((server) => {
      updateStyle(server);

      const joinBtn = server.querySelector(".button.join");
      if (joinBtn.dataset.bound) return;
      joinBtn.dataset.bound = "true";
      joinBtn.addEventListener("click", () => {
        if (!server.classList.contains("is-locked")) return;
        document.querySelector(".spectate-btn").click();
      })
    })
  }
  updateJoinBtns();

  const serverList = document.querySelector(".servers .list");
  new MutationObserver((updateJoinBtns)).observe(serverList, { childList: true, attributes: true });

  //market buttons
}

module.exports = { handleServers }