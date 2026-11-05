const handleSettings = () => {
  const applyTabChanges = () => {
    document.querySelectorAll(".settings .right .value").forEach((value) => {
      const slider = value.nextElementSibling;
      value.style.display = "none";

      const input = document.createElement("input");
      input.type = "number";
      input.step = slider.step;
      input.className = "value clickable";
      input.value = Number(value.textContent);
      value.parentElement.prepend(input);

      const s = document.createElement("span");
      s.style.fontSize = "2rem";
      document.body.append(s);
      const fit = (i) => {
        s.textContent = i.value;
        i.style.width = s.offsetWidth + 32 + "px";
      };
      input.addEventListener("input", () => fit(input));
      fit(input);

      input.addEventListener("change", () => {
        if (input.value > Number(slider.max)) slider.max = input.value;
        if (input.value < Number(slider.min)) slider.min = input.value;
        slider.value = input.value;
        slider.dispatchEvent(new Event("input", { bubbles: true }));
        slider.dispatchEvent(new Event("change", { bubbles: true }));
      })

      slider.addEventListener("input", () => {
        input.value = slider.value;
        fit(input)
      })
    })
  }
  applyTabChanges();

  document.querySelectorAll(".settings .tab").forEach((tab) => {
    tab.addEventListener("click", () => applyTabChanges());
  })
}

module.exports = { handleSettings }