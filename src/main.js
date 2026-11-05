const { app } = require("electron");
const initGame = require("./gameWindow.js");

app.on("ready", () => {
    initGame();
})