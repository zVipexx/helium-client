const handleTabChange = (tab) => {
  switch (tab) {
    case "Chat":
      document.querySelectorAll(".chat-sidebar .chat-messages-cont, .chat-sidebar .input-wrapper").forEach((el) => el.style.display = "flex");
      document.querySelector("#room-presets").style.display = "none";
      break;

    case "Presets":
      document.querySelectorAll(".chat-sidebar .chat-messages-cont, .chat-sidebar .input-wrapper").forEach((el) => el.style.display = "none");
      document.querySelector("#room-presets").style.display = "flex";
      break;
  }
}

const getCurrentSettings = () => {
  const data = { selects: [], inputs: [], ranges: [], checkboxes: [] };

  document.querySelectorAll(".general-content .select").forEach((el) => {
    const label = el.closest(".element").querySelector(".label").childNodes[0].textContent.trim();
    data.selects.push({ key: label, value: el.querySelector(".selected").textContent.trim() });
  });

  document.querySelectorAll(".general-content .keybind-input").forEach((el) => {
    const label = el.closest(".element").querySelector(".label").childNodes[0].textContent.trim();
    data.inputs.push({ key: label, value: el.querySelector("input").value });
  });

  document.querySelectorAll(".general-content input[type=range]").forEach((el) => {
    const label = el.closest(".element").querySelector(".label").childNodes[0].textContent.trim();
    data.ranges.push({ key: label, value: el.value });
  });

  document.querySelectorAll(".general-content input[type=checkbox]").forEach((el) => {
    const label = el.closest(".custom-checkbox").querySelector("span").textContent.trim();
    data.checkboxes.push({ key: label, value: el.checked });
  });

  return data;
}

const loadSettings = (data) => {
  document.querySelectorAll(".general-content .items").forEach((el) => {
    const label = el.closest(".element").querySelector(".label").childNodes[0].textContent.trim();
    const entry = data.selects.find(e => e.key === label);
    if (!entry) return;

    [...el.children].find(child => child.textContent.trim() === entry.value).dispatchEvent(new Event("mousedown"));
  });

  document.querySelectorAll(".general-content .keybind-input").forEach((el) => {
    const label = el.closest(".element").querySelector(".label").childNodes[0].textContent.trim();
    const input = el.querySelector("input");
    const entry = data.inputs.find(e => e.key === label);

    const mode = data.inputs.find(e => e.key === "Custom mode")?.value;
    const map = data.inputs.find(e => e.key === "Custom map")?.value;

    if (label === "Custom map/mode" && data.inputs.find(e => e.key === "Custom mode")) {
      input.value = mode;
      input.dispatchEvent(new Event("input"));
      return;
    } else if (label === "Custom map/mode" && data.inputs.find(e => e.key === "Custom map")) {
      input.value = map;
      input.dispatchEvent(new Event("input"));
      return;
    } else if (label === "Custom map" && data.inputs.find(e => e.key === "Custom mode") && !Array.from(document.querySelectorAll(".general-content .element")).some(el => el.querySelector(".label")?.childNodes[0]?.textContent.trim() === "Custom mode")) {
      input.value = mode;
      input.dispatchEvent(new Event("input"));
      return;
    } else if (label === "Custom mode" && data.inputs.find(e => e.key === "Custom map") && !data.inputs.find(e => e.key === "Custom mode")) {
      input.value = map;
      input.dispatchEvent(new Event("input"));
      return;
    }

    if (!entry || input.value === entry.value) return;

    input.value = entry.value;
    input.dispatchEvent(new Event("input"));
  })

  document.querySelectorAll(".general-content input[type=range]").forEach((el) => {
    const label = el.closest(".element").querySelector(".label").childNodes[0].textContent.trim();
    const entry = data.ranges.find(e => e.key === label);
    if (!entry) return;

    el.value = entry.value;
    el.dispatchEvent(new Event("input"));
  })

  document.querySelectorAll(".general-content input[type=checkbox]").forEach((el) => {
    const label = el.closest(".custom-checkbox").querySelector("span").textContent.trim();
    const entry = data.checkboxes.find(e => e.key === label);
    if (!entry) return;

    if (entry.value && !el.checked) el.click();
    else if (!entry.value && el.checked) el.click();
  });
}

const handleCreate = () => {
  const chat = document.querySelector(".chat-sidebar");

  const presets = document.createElement("div");
  presets.id = "room-presets";

  const toggleMultiRow = document.querySelector(".toggle-multi-row");
  const enableMultiRow = document.createElement("span");
  enableMultiRow.classList.add("enable-multi-row");
  enableMultiRow.textContent = "Please enable Multiple Selection";
  enableMultiRow.style.display = toggleMultiRow?.querySelector(".text")?.textContent.trim().includes("Enable") ? "flex" : "none";
  document.querySelector(".create-modal").addEventListener("click", (e) => {
    const btn = e.target.closest(".toggle-multi-row");
    if (!btn) return;
    enableMultiRow.style.display = btn.querySelector(".text").textContent.trim().includes("Enable") ? "flex" : "none";
  })

  const list = document.createElement("div");
  list.classList.add("presets-list");

  const savedPresets = JSON.parse(localStorage.getItem("helium-room-presets") || "[]");
  if (!savedPresets.length) list.textContent = "No presets yet. Press Save Current to create one"

  const createPreset = (name, save = true) => {
    const preset = document.createElement("div");
    preset.classList.add("preset");
    preset.innerHTML = `
      <input type="text" value="${name}">
      <div class="btns">
        <svg width="18px" height="18px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" id="load-preset">
          <title>Load</title>
          <path d="M5 4.98951C5 4.01835 5 3.53277 5.20249 3.2651C5.37889 3.03191 5.64852 2.88761 5.9404 2.87018C6.27544 2.85017 6.67946 3.11953 7.48752 3.65823L18.0031 10.6686C18.6708 11.1137 19.0046 11.3363 19.1209 11.6168C19.2227 11.8621 19.2227 12.1377 19.1209 12.383C19.0046 12.6635 18.6708 12.886 18.0031 13.3312L7.48752 20.3415C6.67946 20.8802 6.27544 21.1496 5.9404 21.1296C5.64852 21.1122 5.37889 20.9679 5.20249 20.7347C5 20.467 5 19.9814 5 19.0103V4.98951Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <svg width="18px" height="18px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" id="override-preset">
          <title>Override</title>
          <path d="M20.453 12.893C20.1752 15.5029 18.6964 17.9487 16.2494 19.3614C12.1839 21.7086 6.98539 20.3157 4.63818 16.2502L4.38818 15.8172M3.54613 11.107C3.82393 8.49711 5.30272 6.05138 7.74971 4.63862C11.8152 2.29141 17.0137 3.68434 19.3609 7.74983L19.6109 8.18285M3.49316 18.0661L4.22521 15.334L6.95727 16.0661M17.0424 7.93401L19.7744 8.66606L20.5065 5.93401" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <svg width="18px" height="18px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" id="delete-preset">
          <title>Remove</title>
          <path d="M16 6V5.2C16 4.0799 16 3.51984 15.782 3.09202C15.5903 2.71569 15.2843 2.40973 14.908 2.21799C14.4802 2 13.9201 2 12.8 2H11.2C10.0799 2 9.51984 2 9.09202 2.21799C8.71569 2.40973 8.40973 2.71569 8.21799 3.09202C8 3.51984 8 4.0799 8 5.2V6M10 11.5V16.5M14 11.5V16.5M3 6H21M19 6V17.2C19 18.8802 19 19.7202 18.673 20.362C18.3854 20.9265 17.9265 21.3854 17.362 21.673C16.7202 22 15.8802 22 14.2 22H9.8C8.11984 22 7.27976 22 6.63803 21.673C6.07354 21.3854 5.6146 20.9265 5.32698 20.362C5 19.7202 5 18.8802 5 17.2V6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    `

    if (save) {
      const presets = JSON.parse(localStorage.getItem("helium-room-presets") || "[]").filter(e => e.id !== name);
      presets.push({ id: name, data: getCurrentSettings() });
      localStorage.setItem("helium-room-presets", JSON.stringify(presets));
    }

    const input = preset.querySelector("input");
    let oldName = name;
    input.addEventListener("change", () => {
      const newName = input.value.trim();

      const existing = JSON.parse(localStorage.getItem("helium-room-presets")).find(e => e.id === newName);
      if (existing) {
        input.value = oldName;
        return;
      };

      const presets = JSON.parse(localStorage.getItem("helium-room-presets") || "[]");
      const target = presets.find(e => e.id === oldName);
      if (target) {
        target.id = newName;
        localStorage.setItem("helium-room-presets", JSON.stringify(presets));
      }

      oldName = newName;
    });
    input.addEventListener("wheel", (e) => {
      e.preventDefault();
      presets.scrollBy({ top: e.deltaY, behavior: "smooth" });
    });

    const loadPreset = preset.querySelector("#load-preset");
    loadPreset.addEventListener("click", () => {
      if (preset.querySelector("#load-preset.loading")) return;
      loadSettings(JSON.parse(localStorage.getItem("helium-room-presets")).find(e => e.id === oldName).data);
      const presets = JSON.parse(localStorage.getItem("helium-room-presets") || "[]");
      const target = presets.find(e => e.id === oldName);

      loadPreset.classList.add("loading");
      const interval = setInterval(() => {
        loadSettings(JSON.parse(localStorage.getItem("helium-room-presets")).find(e => e.id === oldName).data);
        if (JSON.stringify(getCurrentSettings()) === JSON.stringify(target.data)) {
          loadPreset.classList.remove("loading");
          clearInterval(interval);
        };
      }, 100)

      loadPreset.innerHTML = `<path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`
      loadPreset.style.fill = "none";
      loadPreset.style.pointerEvents = "none";
      setTimeout(() => {
        loadPreset.innerHTML = `
          <title>Load</title>
          <path d="M5 4.98951C5 4.01835 5 3.53277 5.20249 3.2651C5.37889 3.03191 5.64852 2.88761 5.9404 2.87018C6.27544 2.85017 6.67946 3.11953 7.48752 3.65823L18.0031 10.6686C18.6708 11.1137 19.0046 11.3363 19.1209 11.6168C19.2227 11.8621 19.2227 12.1377 19.1209 12.383C19.0046 12.6635 18.6708 12.886 18.0031 13.3312L7.48752 20.3415C6.67946 20.8802 6.27544 21.1496 5.9404 21.1296C5.64852 21.1122 5.37889 20.9679 5.20249 20.7347C5 20.467 5 19.9814 5 19.0103V4.98951Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        `
        loadPreset.style.fill = "currentColor";
        loadPreset.style.pointerEvents = "auto";
      }, 750)
    })

    const overridePreset = preset.querySelector("#override-preset");
    overridePreset.addEventListener("click", () => {
      const presets = JSON.parse(localStorage.getItem("helium-room-presets") || "[]");
      const target = presets.find(e => e.id === oldName);
      if (target) {
        target.data = getCurrentSettings();
        localStorage.setItem("helium-room-presets", JSON.stringify(presets));
      }

      overridePreset.innerHTML = `<path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
      overridePreset.style.pointerEvents = "none";

      setTimeout(() => {
        overridePreset.innerHTML = `
          <title>Load</title>
          <path d="M20.453 12.893C20.1752 15.5029 18.6964 17.9487 16.2494 19.3614C12.1839 21.7086 6.98539 20.3157 4.63818 16.2502L4.38818 15.8172M3.54613 11.107C3.82393 8.49711 5.30272 6.05138 7.74971 4.63862C11.8152 2.29141 17.0137 3.68434 19.3609 7.74983L19.6109 8.18285M3.49316 18.0661L4.22521 15.334L6.95727 16.0661M17.0424 7.93401L19.7744 8.66606L20.5065 5.93401" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        `;
        overridePreset.style.pointerEvents = "auto";
      }, 1000);
    })

    const deletePreset = preset.querySelector("#delete-preset");
    deletePreset.addEventListener("click", () => {
      preset.remove();
      const presets = JSON.parse(localStorage.getItem("helium-room-presets") || "[]").filter(e => e.id !== oldName);
      localStorage.setItem("helium-room-presets", JSON.stringify(presets));
      if (!list.querySelectorAll(".preset").length) list.textContent = "No presets yet. Press Save Current to create one";
    });

    list.append(preset);
  };

  savedPresets.forEach((preset) => createPreset(preset.id, false))

  const save = document.querySelector(".switch-team-btn").cloneNode(true);
  save.classList.remove("switch-team-btn");
  save.classList.add("save-preset");
  save.style.flexShrink = "0";
  save.querySelector(".text").textContent = "Save Current";
  save.addEventListener("click", () => {
    if (list.textContent.includes("No presets yet.")) list.textContent = "";
    createPreset(`Preset ${list.querySelectorAll(".preset").length + 1}`);
  })

  presets.append(enableMultiRow);
  presets.append(list);
  presets.append(save);
  chat.append(presets);

  const chatTab = chat.querySelector(".party-header");
  chatTab.innerHTML = `
    <span>Chat</span>
    <span>Presets</span>
  `
  chatTab.querySelectorAll("span").forEach((tab) => {
    const tabName = tab.textContent;

    tab.addEventListener("click", () => {
      chatTab.querySelector(".active").classList.remove("active");
      tab.classList.add("active");
      localStorage.setItem("create-active-tab", tabName)
      handleTabChange(tabName);
    })

    const savedTab = localStorage.getItem("create-active-tab") || "Chat";
    if (savedTab === tabName) {
      tab.classList.add("active");
      handleTabChange(tabName);
    }
  })
}

module.exports = { handleCreate }