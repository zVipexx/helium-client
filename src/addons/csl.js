// partly ai generated cuz complicated

const initCSL = (settings) => {
  if (!window.csl_state) {
    window.csl_state = {
      settings: {},
      gl: null,
      tex: null,
      texReady: false,
      enabled: false,
      hookedContexts: new WeakSet(),
      sceneObjects: new Map(),
      objectSeq: 0,
      seen: new Set(),
      lastFrame: -1,
      lastFp: null,
      pendingDraws: 0,
      currentEntry: null,
      savedUnit: null,
      savedBind: null,
      stickyEntry: null,
      stickyLoc: null,
      stickyProg: null,
    };
  }

  const state = window.csl_state;
  state.settings = settings;
  state.enabled = !!settings.csl_enabled;

  const target_sig = "0.40,0.40,0.40";
  const target_mask = 17664;

  const hexToRgb = (hex) => {
    if (!hex) return { r: 255, g: 255, b: 255 };
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
  };

  const generateSolidImage = (headHex, bodyHex, callback) => {
    const headColor = hexToRgb(headHex);
    const bodyColor = hexToRgb(bodyHex);
    const pData = window.pixelData;

    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext("2d");
    const newImageData = ctx.createImageData(64, 64);

    if (pData && pData.length > 0) {
      for (let i = 0; i < pData.length; i++) {
        const pixel = pData[i];
        if (pixel.x >= 64 || pixel.y >= 64) continue;
        const index = (pixel.y * 64 + pixel.x) * 4;

        if (pixel.g === 255) {
          newImageData.data[index] = bodyColor.r;
          newImageData.data[index + 1] = bodyColor.g;
          newImageData.data[index + 2] = bodyColor.b;
        } else {
          newImageData.data[index] = headColor.r;
          newImageData.data[index + 1] = headColor.g;
          newImageData.data[index + 2] = headColor.b;
        }
        newImageData.data[index + 3] = pixel.a !== undefined ? pixel.a : 255;
      }
    } else {
      for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 64; x++) {
          const index = (y * 64 + x) * 4;
          if (y < 32) {
            newImageData.data[index] = headColor.r;
            newImageData.data[index + 1] = headColor.g;
            newImageData.data[index + 2] = headColor.b;
          } else {
            newImageData.data[index] = bodyColor.r;
            newImageData.data[index + 1] = bodyColor.g;
            newImageData.data[index + 2] = bodyColor.b;
          }
          newImageData.data[index + 3] = 255;
        }
      }
    }

    ctx.putImageData(newImageData, 0, 0);

    callback(c);
  };

  const uploadTexture = (source) => {
    const gl = state.gl;
    if (!gl) return;
    const initU = gl.getParameter(gl.ACTIVE_TEXTURE);
    const initB = gl.getParameter(gl.TEXTURE_BINDING_2D);
    const fY = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
    const pm = gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, state.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, fY);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, pm);
    gl.activeTexture(initU);
    gl.bindTexture(gl.TEXTURE_2D, initB);

    state.texReady = true;
  };

  const updateTexture = () => {
    state.texReady = false;
    if (!state.enabled || !state.gl || !state.tex) return;

    const swapType = (settings.csl_swap_type || "").toLowerCase();
    if (swapType === "solid") {
      generateSolidImage(settings.csl_head_color, settings.csl_body_color, uploadTexture);
    } else if (swapType === "url" && settings.csl_link) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        c.getContext("2d").drawImage(img, 0, 0);
        uploadTexture(c);
      };
      img.src = settings.csl_link;
    }
  };

  if (state.gl) {
    updateTexture();
  } else if (!window.csl_hooked) {
    window.csl_hooked = true;

    const hookContext = (gl) => {
      if (!gl || state.hookedContexts.has(gl)) return gl;
      state.hookedContexts.add(gl);
      state.gl = gl;

      const bind = (name) => gl[name]?.bind(gl);
      const uM4 = bind("uniformMatrix4fv"), dA = bind("drawArrays"), dE = bind("drawElements"),
        dAI = bind("drawArraysInstanced"), dEI = bind("drawElementsInstanced"),
        bT = bind("bindTexture"), aT = bind("activeTexture"), gP = bind("getParameter"),
        clr = bind("clear");

      let lastMask = 0;
      gl.clear = (m) => { lastMask = m; return clr(m); };

      state.tex = gl.createTexture();
      const initU = gP(gl.ACTIVE_TEXTURE), initB = gP(gl.TEXTURE_BINDING_2D);
      aT(gl.TEXTURE0); bT(gl.TEXTURE_2D, state.tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      aT(initU); bT(gl.TEXTURE_2D, initB);

      updateTexture();

      gl.uniformMatrix4fv = (loc, tr, d, off, len) => {
        const now = performance.now();
        if (now !== state.lastFrame) {
          if (state.lastFp && state.sceneObjects.has(state.lastFp)) state.sceneObjects.get(state.lastFp).drawCalls += state.pendingDraws;
          state.seen.clear(); state.lastFrame = now; state.lastFp = null; state.currentEntry = null; state.pendingDraws = 0;
        }

        if (loc === state.stickyLoc) state.stickyEntry = null;

        if (state.enabled && d && d.length >= 16) {
          const o = off ?? 0;
          const s = o === 0 && d.length === 16 ? d : (d.subarray ? d.subarray(o, o + 16) : d.slice(o, o + 16));

          if (Math.abs(s[3]) < 0.001 && Math.abs(s[7]) < 0.001 && Math.abs(s[11]) < 0.001 && Math.abs(s[15] - 1) < 0.001) {
            const sx = Math.sqrt(s[0] * s[0] + s[1] * s[1] + s[2] * s[2]),
              sy = Math.sqrt(s[4] * s[4] + s[5] * s[5] + s[6] * s[6]),
              sz = Math.sqrt(s[8] * s[8] + s[9] * s[9] + s[10] * s[10]);

            if (`${sx.toFixed(2)},${sy.toFixed(2)},${sz.toFixed(2)}` === target_sig && lastMask === target_mask) {
              const fp = `${s[0].toFixed(3)},${s[5].toFixed(3)},${s[10].toFixed(3)},${s[12].toFixed(4)},${s[13].toFixed(4)},${s[14].toFixed(4)}`;

              if (!state.seen.has(fp)) {
                state.seen.add(fp);
                if (state.lastFp && state.sceneObjects.has(state.lastFp)) state.sceneObjects.get(state.lastFp).drawCalls += state.pendingDraws;
                state.pendingDraws = 0;

                let e = state.sceneObjects.get(fp);
                if (!e) {
                  e = { id: ++state.objectSeq, signature: target_sig, position: [s[12], s[13], s[14]], scale: [sx, sy, sz], drawCalls: 0 };
                  state.sceneObjects.set(fp, e);
                } else {
                  e.position = [s[12], s[13], s[14]]; e.scale = [sx, sy, sz];
                }
                state.lastFp = fp; state.currentEntry = e;
              } else {
                state.pendingDraws++;
              }

              state.stickyEntry = state.sceneObjects.get(fp);
              state.stickyLoc = loc;
              state.stickyProg = gP(gl.CURRENT_PROGRAM);
            }
          }
        }
        return uM4(loc, tr, d, off, len);
      };

      const wrapDraw = (origFn) => {
        if (!origFn) return null;
        return (...args) => {
          state.pendingDraws++;
          let swapped = false;
          let blendWasOn = false, sRGB, dRGB, sA, dA;
          const active = state.currentEntry || (state.stickyEntry && lastMask === target_mask && gP(gl.CURRENT_PROGRAM) === state.stickyProg ? state.stickyEntry : null);
          if (active && state.enabled && state.texReady) {
            state.savedUnit = gP(gl.ACTIVE_TEXTURE); state.savedBind = gP(gl.TEXTURE_BINDING_2D);
            if (state.savedBind !== state.tex) {
              aT(state.savedUnit); bT(gl.TEXTURE_2D, state.tex);
              swapped = true;

              blendWasOn = gl.isEnabled(gl.BLEND);
              sRGB = gP(gl.BLEND_SRC_RGB); dRGB = gP(gl.BLEND_DST_RGB);
              sA = gP(gl.BLEND_SRC_ALPHA); dA = gP(gl.BLEND_DST_ALPHA);
              gl.enable(gl.BLEND);
              gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            }
          }
          const res = origFn(...args);
          if (swapped) {
            aT(state.savedUnit); if (state.savedBind !== null) bT(gl.TEXTURE_2D, state.savedBind);
            gl.blendFuncSeparate(sRGB, dRGB, sA, dA);
            if (!blendWasOn) gl.disable(gl.BLEND);
          }
          state.currentEntry = null;
          return res;
        };
      };

      gl.drawArrays = wrapDraw(dA);
      gl.drawElements = wrapDraw(dE);
      if (dAI) gl.drawArraysInstanced = wrapDraw(dAI);
      if (dEI) gl.drawElementsInstanced = wrapDraw(dEI);

      return gl;
    };

    const origGetCtx = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, attrs) {
      const ctx = origGetCtx.call(this, type, attrs);
      if (ctx && type === "webgl" && this.id === "game") hookContext(ctx);
      return ctx;
    };

    const canvas = document.getElementById("game");
    if (canvas) {
      const existing = canvas.getContext("webgl");
      if (existing) hookContext(existing);
    }
  }

  window.listSceneObjects = () => [...state.sceneObjects.values()].sort((a, b) => a.id - b.id);
  return { sceneObjects: state.sceneObjects, updateTexture };
};

module.exports = { initCSL };