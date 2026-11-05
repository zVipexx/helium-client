const { app } = require("electron");

const applySwitches = (settings) => {
  if (settings.uncapped_fps) {
    app.commandLine.appendSwitch("disable-frame-rate-limit");
    app.commandLine.appendSwitch("disable-gpu-vsync");
  }
}

module.exports = { applySwitches }