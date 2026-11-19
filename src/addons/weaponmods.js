// made with the help of ai
const { ipcRenderer } = require("electron");
const inspectData = require(ipcRenderer.sendSync("get-inspects-path"))[0];

const ignoredSigs = new Set(["1.40,1.40,1.40", "1.99,1.68,2.11", "1.88,1.40,1.88", "1.11,1.11,1.77", "1.50,1.40,1.76", "1.13,0.85,1.77", "0.81,1.08,1.38", "1.52,1.15,1.61", "1.16,1.48,0.94", "1.08,1.10,1.77", "1.54,0.92,2.24"]);
const collidingSig = "1.54,0.92,2.24";

const WEAPON_AXIS_MAP = {
  vita: { rx: "x", ry: "y", rz: "z" },
  scar: { rx: "x", ry: "y", rz: "z" },
  revolver: { rx: "x", ry: "z", rz: "y" },
  ar9: { rx: "x", ry: "z", rz: "y" },
  mac10: { rx: "x", ry: "y", rz: "z" },
  m60: { rx: "x", ry: "y", rz: "z" },
  weatie: { rx: "x", ry: "y", rz: "z" },
  lar: { rx: "x", ry: "y", rz: "z" },
  shark: { rx: "y", ry: "x", rz: "z" },
  bayonet: { rx: "y", ry: "x", rz: "z" },
  tomahawk: { rx: "y", ry: "x", rz: "z" },
};

const easings = {
  linear: (x) => x,
  easeIn: (x) => x * x * x,
  easeOut: (x) => 1 - Math.pow(1 - x, 3),
  easeOutIn: (x) => easings.easeOut(easings.easeIn(x)),
  easeOutPow: (x) => easings.easeOut(Math.pow(x, 1.2)),
};

const toNumber = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const hsvToRgb = (hue) => {
  hue = ((hue % 360) + 360) % 360;
  const sector = Math.floor(hue / 60);
  const f = hue / 60 - sector;
  const q = Math.round((1 - f) * 255);
  const t = Math.round(f * 255);
  switch (sector) {
    case 0:
      return [255, t, 0];
    case 1:
      return [q, 255, 0];
    case 2:
      return [0, 255, t];
    case 3:
      return [0, q, 255];
    case 4:
      return [t, 0, 255];
    default:
      return [255, 0, q];
  }
};

const hexToRgb = (value) => {
  const hex = String(value || "#FFFFFF").replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return [Number.isNaN(r) ? 255 : r, Number.isNaN(g) ? 255 : g, Number.isNaN(b) ? 255 : b];
};

const resolveVariation = (weaponId, key) => {
  const variations = inspectData[weaponId];
  if (!variations) return null;
  return variations[key] ?? variations[Object.keys(variations)[0]] ?? null;
};

const buildConfig = (settings) => {
  const weapons = {};
  const toRad = Math.PI / 180;

  for (const weaponId of Object.keys(WEAPON_AXIS_MAP)) {
    const rx = toNumber(settings[`${weaponId}_rotate_x`], 0) * toRad;
    const ry = toNumber(settings[`${weaponId}_rotate_y`], 0) * toRad;
    const rz = toNumber(settings[`${weaponId}_rotate_z`], 0) * toRad;

    weapons[weaponId] = {
      scale: toNumber(settings[`${weaponId}_weapon_scale`], 1),
      ox: toNumber(settings[`${weaponId}_offset_x`], 0),
      oy: toNumber(settings[`${weaponId}_offset_y`], 0),
      oz: toNumber(settings[`${weaponId}_offset_z`], 0),
      rx,
      ry,
      rz,
      hasRotation: rx !== 0 || ry !== 0 || rz !== 0,
      duration: toNumber(settings[`${weaponId}_inspect_duration`], 0),
      variation: resolveVariation(weaponId, settings[`${weaponId}_inspect_variation`]),
    };
  }

  return {
    weapons,
    keybind: settings.custom_inspect_keybind,
    wireframe: !!settings.wireframe_weapon,
    customColor: !!settings.custom_weapon_color,
    chroma: !!settings.weapon_chroma,
    color: hexToRgb(settings.weapon_color),
  };
};

let config = null;
let installed = false;
let inspectStart = null;
let inspectingWeaponId = null;
let domWeaponId = null;
let globalFrameId = 0;

const initWeaponMods = (settings) => {
  config = buildConfig(settings);

  if (installed) return;
  installed = true;

  const sampleTrack = (track, t, fallback) => {
    if (!Array.isArray(track) || track.length === 0) return fallback;
    if (t <= track[0].t) return track[0].v;
    for (let i = 1; i < track.length; i++) {
      const next = track[i];
      if (t <= next.t) {
        const prev = track[i - 1];
        const span = next.t - prev.t;
        const u = span > 0 ? (t - prev.t) / span : 1;
        const ease = easings[next.ease] ?? easings.linear;
        return prev.v + (next.v - prev.v) * ease(u);
      }
    }
    return track[track.length - 1].v;
  };

  const sampleVariation = (variation, t) => ({
    offsetX: sampleTrack(variation.offsetX, t, 0),
    offsetY: sampleTrack(variation.offsetY, t, 0),
    offsetZ: sampleTrack(variation.offsetZ, t, 0),
    scale: sampleTrack(variation.scale, t, 1),
    spinX: sampleTrack(variation.spinX, t, 0),
    spinY: sampleTrack(variation.spinY, t, 0),
    spinZ: sampleTrack(variation.spinZ, t, 0),
  });

  const readSelectedWeaponFromDom = () => {
    const selected = document.querySelector(".weapon-cont .bottom.is-selected");
    if (!selected) return null;
    const nameEl = selected.parentElement?.querySelector(".weapon-name");
    const id = nameEl?.textContent.trim().toLowerCase().replace("-", "");
    return WEAPON_AXIS_MAP[id] ? id : null;
  };

  const updateDomWeaponId = () => {
    const id = readSelectedWeaponFromDom();
    if (id) {
      domWeaponId = id;
      window.currentWeaponId = id;
    }
  };

  updateDomWeaponId();

  const weaponMutationObserver = new MutationObserver((mutations) => {
    if (!document.querySelector(".list-weapons")) return;
    for (const m of mutations) {
      if (m.type === "attributes" && m.attributeName === "class") {
        if (m.target instanceof HTMLElement && m.target.classList.contains("bottom")) {
          updateDomWeaponId();
          return;
        }
      } else if (m.type === "childList") {
        for (const node of m.addedNodes) {
          if (node instanceof HTMLElement && (node.classList?.contains("weapon-cont") || node.querySelector?.(".weapon-cont"))) {
            updateDomWeaponId();
            return;
          }
        }
      }
    }
  });

  weaponMutationObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["class"],
    childList: true,
    subtree: true,
  });

  const bumpGlobalFrame = () => {
    globalFrameId++;
    requestAnimationFrame(bumpGlobalFrame);
  };
  requestAnimationFrame(bumpGlobalFrame);

  const applyZSpin = (mat, angle) => {
    const cos = Math.cos(angle),
      sin = Math.sin(angle);
    const sx = Math.sqrt(mat[0] * mat[0] + mat[1] * mat[1] + mat[2] * mat[2]);
    const sy = Math.sqrt(mat[4] * mat[4] + mat[5] * mat[5] + mat[6] * mat[6]);
    const x0 = mat[0] / sx,
      x1 = mat[1] / sx,
      x2 = mat[2] / sx;
    const y0 = mat[4] / sy,
      y1 = mat[5] / sy,
      y2 = mat[6] / sy;
    mat[0] = (x0 * cos - y0 * sin) * sx;
    mat[1] = (x1 * cos - y1 * sin) * sx;
    mat[2] = (x2 * cos - y2 * sin) * sx;
    mat[4] = (x0 * sin + y0 * cos) * sy;
    mat[5] = (x1 * sin + y1 * cos) * sy;
    mat[6] = (x2 * sin + y2 * cos) * sy;
  };

  const applyXSpin = (mat, angle) => {
    const cos = Math.cos(angle),
      sin = Math.sin(angle);
    const sy = Math.sqrt(mat[4] * mat[4] + mat[5] * mat[5] + mat[6] * mat[6]);
    const sz = Math.sqrt(mat[8] * mat[8] + mat[9] * mat[9] + mat[10] * mat[10]);
    const y0 = mat[4] / sy,
      y1 = mat[5] / sy,
      y2 = mat[6] / sy;
    const z0 = mat[8] / sz,
      z1 = mat[9] / sz,
      z2 = mat[10] / sz;
    mat[4] = (y0 * cos - z0 * sin) * sy;
    mat[5] = (y1 * cos - z1 * sin) * sy;
    mat[6] = (y2 * cos - z2 * sin) * sy;
    mat[8] = (y0 * sin + z0 * cos) * sz;
    mat[9] = (y1 * sin + z1 * cos) * sz;
    mat[10] = (y2 * sin + z2 * cos) * sz;
  };

  const applyYSpin = (mat, angle) => {
    const cos = Math.cos(angle),
      sin = Math.sin(angle);
    const sx = Math.sqrt(mat[0] * mat[0] + mat[1] * mat[1] + mat[2] * mat[2]);
    const sz = Math.sqrt(mat[8] * mat[8] + mat[9] * mat[9] + mat[10] * mat[10]);
    const x0 = mat[0] / sx,
      x1 = mat[1] / sx,
      x2 = mat[2] / sx;
    const z0 = mat[8] / sz,
      z1 = mat[9] / sz,
      z2 = mat[10] / sz;
    mat[0] = (x0 * cos + z0 * sin) * sx;
    mat[1] = (x1 * cos + z1 * sin) * sx;
    mat[2] = (x2 * cos + z2 * sin) * sx;
    mat[8] = (-x0 * sin + z0 * cos) * sz;
    mat[9] = (-x1 * sin + z1 * cos) * sz;
    mat[10] = (-x2 * sin + z2 * cos) * sz;
  };

  const spinFuncs = { x: applyXSpin, y: applyYSpin, z: applyZSpin };

  const applyMappedRotation = (mat, weaponId, radX, radY, radZ) => {
    const map = WEAPON_AXIS_MAP[weaponId];
    spinFuncs[map.rx](mat, radX);
    spinFuncs[map.ry](mat, radY);
    spinFuncs[map.rz](mat, radZ);
  };

  const inspectKeybindHandler = (e) => {
    let inputName;
    if (e.type === "mousedown") {
      switch (e.button) {
        case 4:
          inputName = "Mouse4";
          break;
        case 5:
          inputName = "Mouse5";
          break;
        default:
          inputName = `Mouse${e.button}`;
      }
    } else if (e.type === "keydown") {
      inputName = e.code;
    }
    if (inputName === config.keybind) {
      if (document.querySelector("input:focus") || document.querySelector("textarea:focus")) return;
      inspectStart = performance.now();
      inspectingWeaponId = domWeaponId || null;
      e.preventDefault();
    }
  };

  document.addEventListener("mousedown", inspectKeybindHandler, true);
  document.addEventListener("keydown", inspectKeybindHandler, true);

  const colMag = (m, i) => Math.sqrt(m[i] * m[i] + m[i + 1] * m[i + 1] + m[i + 2] * m[i + 2]);

  const hookedContexts = new WeakSet();
  const originalGetCtx = HTMLCanvasElement.prototype.getContext;

  HTMLCanvasElement.prototype.getContext = function (type, attrs) {
    const ctx = originalGetCtx.call(this, type, attrs);
    if (!ctx || (type !== "webgl" && type !== "webgl2")) return ctx;
    if (hookedContexts.has(ctx) || this.id !== "game") return ctx;
    hookedContexts.add(ctx);

    const gl = ctx;
    const matBuf = new Float32Array(16);
    const rgbPixel = new Uint8Array([255, 255, 255, 255]);

    const rgbTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, rgbTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgbPixel);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);

    const origUniformMatrix4fv = gl.uniformMatrix4fv.bind(gl);
    const origDrawArrays = gl.drawArrays.bind(gl);
    const origDrawElements = gl.drawElements.bind(gl);
    const origBindTexture = gl.bindTexture.bind(gl);
    const origClear = gl.clear.bind(gl);

    let wireframeThisDraw = false;
    let seenMatricesThisFrame = new Set();
    let lastFrameTime = -1;
    let collidingSigCount = 0;
    let lastCollidingFrameId = -1;
    let lastClearMask = 0;
    let pendingRestoreTex = undefined;
    let uploadedColorKey = "";

    gl.clear = (mask) => {
      lastClearMask = mask;
      return origClear(mask);
    };

    gl.uniformMatrix4fv = (location, transpose, data, srcOffset, srcLength) => {
      wireframeThisDraw = false;

      const now = performance.now();
      if (now !== lastFrameTime) {
        seenMatricesThisFrame.clear();
        lastFrameTime = now;
      }

      if (globalFrameId !== lastCollidingFrameId) {
        collidingSigCount = 0;
        lastCollidingFrameId = globalFrameId;
      }

      if (!data || data.length < 16) {
        return origUniformMatrix4fv(location, transpose, data, srcOffset, srcLength);
      }

      const offset = srcOffset ?? 0;
      const slice = offset === 0 && data.length === 16 ? data : data.subarray ? data.subarray(offset, offset + 16) : data.slice(offset, offset + 16);

      if (Math.abs(slice[3]) > 0.001 || Math.abs(slice[7]) > 0.001 || Math.abs(slice[11]) > 0.001 || Math.abs(slice[15] - 1.0) > 0.001) {
        return origUniformMatrix4fv(location, transpose, data, srcOffset, srcLength);
      }

      const sig = `${colMag(slice, 0).toFixed(2)},${colMag(slice, 4).toFixed(2)},${colMag(slice, 8).toFixed(2)}`;

      let isIgnored;
      if (sig === collidingSig) {
        collidingSigCount++;
        isIgnored = collidingSigCount > 1;
      } else {
        isIgnored = ignoredSigs.has(sig);
      }

      if (isIgnored || lastClearMask !== 256 || !domWeaponId) {
        return origUniformMatrix4fv(location, transpose, data, srcOffset, srcLength);
      }

      const fp = `${slice[0].toFixed(3)},${slice[5].toFixed(3)},${slice[10].toFixed(3)},${slice[12].toFixed(4)},${slice[13].toFixed(4)},${slice[14].toFixed(4)}`;
      if (seenMatricesThisFrame.has(fp)) {
        return origUniformMatrix4fv(location, transpose, data, srcOffset, srcLength);
      }
      seenMatricesThisFrame.add(fp);

      const cfg = config;
      const weaponId = domWeaponId;
      const weapon = cfg.weapons[weaponId];
      window.currentWeaponId = weaponId;

      if (inspectStart !== null && inspectingWeaponId !== null && inspectingWeaponId !== weaponId) {
        inspectStart = null;
        inspectingWeaponId = null;
      }

      if (inspectStart !== null && inspectingWeaponId === null) {
        inspectingWeaponId = weaponId;
      }

      let scale = weapon.scale;
      let ox = weapon.ox;
      let oy = weapon.oy;
      let oz = weapon.oz;
      let spinX = 0;
      let spinY = 0;
      let spinZ = 0;

      if (inspectStart !== null && inspectingWeaponId === weaponId) {
        if (weapon.variation && weapon.duration > 0) {
          const t = Math.min((now - inspectStart) / weapon.duration, 1.0);
          const kf = sampleVariation(weapon.variation, t);
          scale = weapon.scale * kf.scale;
          ox += kf.offsetX * scale;
          oy += kf.offsetY * scale;
          oz += kf.offsetZ * scale;
          spinX = kf.spinX;
          spinY = kf.spinY;
          spinZ = kf.spinZ;
          if (t >= 1.0) {
            inspectStart = null;
            inspectingWeaponId = null;
          }
        } else {
          inspectStart = null;
          inspectingWeaponId = null;
        }
      }

      matBuf.set(slice);
      matBuf[0] *= scale;
      matBuf[1] *= scale;
      matBuf[2] *= scale;
      matBuf[4] *= scale;
      matBuf[5] *= scale;
      matBuf[6] *= scale;
      matBuf[8] *= scale;
      matBuf[9] *= scale;
      matBuf[10] *= scale;
      matBuf[12] += ox;
      matBuf[13] += oy;
      matBuf[14] += oz;

      if (weapon.hasRotation) applyMappedRotation(matBuf, weaponId, weapon.rx, weapon.ry, weapon.rz);

      if (spinZ !== 0) applyZSpin(matBuf, spinZ);
      if (spinX !== 0) applyXSpin(matBuf, spinX);
      if (spinY !== 0) applyYSpin(matBuf, spinY);

      if (cfg.customColor) {
        if (pendingRestoreTex === undefined) {
          pendingRestoreTex = gl.getParameter(gl.TEXTURE_BINDING_2D);
        }

        origBindTexture(gl.TEXTURE_2D, rgbTexture);

        if (cfg.chroma) {
          const [r, g, b] = hsvToRgb((now / 3000) * 360);
          rgbPixel[0] = r;
          rgbPixel[1] = g;
          rgbPixel[2] = b;
          rgbPixel[3] = 255;
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgbPixel);
          uploadedColorKey = "";
        } else {
          const key = `${cfg.color[0]},${cfg.color[1]},${cfg.color[2]}`;
          if (key !== uploadedColorKey) {
            rgbPixel[0] = cfg.color[0];
            rgbPixel[1] = cfg.color[1];
            rgbPixel[2] = cfg.color[2];
            rgbPixel[3] = 255;
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgbPixel);
            uploadedColorKey = key;
          }
        }
      }

      if (cfg.wireframe) wireframeThisDraw = true;

      return origUniformMatrix4fv(location, transpose, matBuf, 0, 16);
    };

    const toWireframe = (mode) => (mode === gl.TRIANGLES || mode === gl.TRIANGLE_FAN || mode === gl.TRIANGLE_STRIP ? gl.LINES : mode);

    const restoreTexture = () => {
      if (pendingRestoreTex !== undefined) {
        if (pendingRestoreTex !== null) origBindTexture(gl.TEXTURE_2D, pendingRestoreTex);
        pendingRestoreTex = undefined;
      }
    };

    gl.drawArrays = (mode, first, count) => {
      if (wireframeThisDraw) mode = toWireframe(mode);
      wireframeThisDraw = false;
      seenMatricesThisFrame.clear();
      const r = origDrawArrays(mode, first, count);
      restoreTexture();
      return r;
    };

    gl.drawElements = (mode, count, type, offset) => {
      if (wireframeThisDraw) mode = toWireframe(mode);
      wireframeThisDraw = false;
      seenMatricesThisFrame.clear();
      const r = origDrawElements(mode, count, type, offset);
      restoreTexture();
      return r;
    };

    return ctx;
  };
};

module.exports = { initWeaponMods }