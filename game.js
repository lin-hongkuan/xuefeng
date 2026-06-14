/* 张雪峰 · 透心凉大作战  —  swipe-slice summer arcade
   Vanilla canvas. Mobile-first. BGM/death audio reused from the original site. */
(function () {
  "use strict";

  // ---------- DOM ----------
  var stage = document.getElementById("stage");
  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");

  var hud = document.getElementById("hud");
  var scoreEl = document.getElementById("score");
  var bestEl = document.getElementById("best");
  var livesEl = document.getElementById("lives");
  var comboChip = document.getElementById("comboChip");
  var comboNum = document.getElementById("comboNum");
  var coolFill = document.getElementById("coolFill");
  var bannerEl = document.getElementById("banner");

  var loadingScreen = document.getElementById("loadingScreen");
  var loaderFill = document.getElementById("loaderFill");
  var loaderText = document.getElementById("loaderText");
  var titleScreen = document.getElementById("titleScreen");
  var pauseScreen = document.getElementById("pauseScreen");
  var overScreen = document.getElementById("overScreen");

  var startBtn = document.getElementById("startBtn");
  var pauseBtn = document.getElementById("pauseBtn");
  var muteBtn = document.getElementById("muteBtn");
  var resumeBtn = document.getElementById("resumeBtn");
  var restartFromPauseBtn = document.getElementById("restartFromPauseBtn");
  var againBtn = document.getElementById("againBtn");
  var homeBtn = document.getElementById("homeBtn");
  var titleBest = document.getElementById("titleBest");
  var titleMuteBtn = document.getElementById("titleMuteBtn");
  var pauseMuteBtn = document.getElementById("pauseMuteBtn");
  var finalScore = document.getElementById("finalScore");
  var finalBest = document.getElementById("finalBest");
  var finalCombo = document.getElementById("finalCombo");
  var quoteEl = document.getElementById("quote");

  var bgm = document.getElementById("bgm");
  var deathSfx = document.getElementById("deathSfx");
  bgm.volume = 0.5;
  deathSfx.volume = 0.9;

  // ---------- World / sizing ----------
  var W = 0, H = 0, DPR = 1;
  function resize() {
    var r = stage.getBoundingClientRect();
    W = Math.max(320, r.width);
    H = Math.max(420, r.height);
    DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    computeMetrics();
  }

  var M = {};
  function computeMetrics() {
    var base = Math.min(W, H);
    M.gravity = H * 1.55;            // px/s^2
    M.objSize = clamp(base * 0.17, 64, 132);
    M.hitR = M.objSize * 0.46;
    M.mascotH = clamp(H * 0.24, 120, 240);
  }

  // ---------- Assets ----------
  var IMG = {};
  var imgList = [
    ["mc", "assets/zhang-mc.png"],
    ["hype", "assets/zhang-hype.png"],
    ["sprite", "assets/sprite-can.png"],
    ["qiaolezi", "assets/qiaolezi.png"],
    ["bomb", "assets/bomb.png"],
    ["letter", "assets/letter.png"],
    ["bg", "assets/bg.png"]
  ];

  function preload(onProgress) {
    return new Promise(function (resolve) {
      var total = imgList.length + 1; // +1 for bgm
      var done = 0;
      function tick() { done++; onProgress(done / total); if (done >= total) resolve(); }

      imgList.forEach(function (pair) {
        var im = new Image();
        im.onload = tick;
        im.onerror = tick;
        im.src = pair[1];
        IMG[pair[0]] = im;
      });

      // audio readiness (don't block forever on slow networks)
      var settled = false;
      function audioReady() { if (!settled) { settled = true; tick(); } }
      if (bgm.readyState >= 3) audioReady();
      bgm.addEventListener("canplaythrough", audioReady, { once: true });
      bgm.addEventListener("loadeddata", audioReady, { once: true });
      setTimeout(audioReady, 6000);
      try { bgm.load(); } catch (e) {}
    });
  }

  // ---------- Audio: WebAudio SFX ----------
  var actx = null, masterGain = null;
  var muted = false;
  function initAudioCtx() {
    if (actx) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      actx = new AC();
      masterGain = actx.createGain();
      masterGain.gain.value = 0.6;
      masterGain.connect(actx.destination);
    } catch (e) { actx = null; }
  }
  function resumeAudio() { if (actx && actx.state === "suspended") actx.resume(); }

  function blip(freq, dur, type, vol, slideTo) {
    if (!actx || muted) return;
    var t = actx.currentTime;
    var o = actx.createOscillator();
    var g = actx.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(masterGain);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noiseBurst(dur, vol, freq) {
    if (!actx || muted) return;
    var t = actx.currentTime;
    var n = Math.floor(actx.sampleRate * dur);
    var buf = actx.createBuffer(1, n, actx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = actx.createBufferSource(); src.buffer = buf;
    var bp = actx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = freq || 2600; bp.Q.value = 0.8;
    var g = actx.createGain(); g.gain.value = vol || 0.25;
    src.connect(bp); bp.connect(g); g.connect(masterGain);
    src.start();
  }
  var sfx = {
    slice: function () { noiseBurst(0.12, 0.22, 3000); },
    pop:   function () { blip(520 + Math.random() * 120, 0.12, "triangle", 0.22, 900); },
    sweet: function () { blip(660, 0.14, "sine", 0.22, 1180); },
    letter:function () { blip(740, 0.1, "sine", 0.25, 1240); setTimeout(function(){blip(990,0.12,"sine",0.25,1660);},70); setTimeout(function(){blip(1320,0.16,"sine",0.22,2000);},150); },
    combo: function (n) { blip(440 + n * 40, 0.12, "square", 0.18, (520 + n * 60)); },
    fever: function () { [523,659,784,1046].forEach(function(f,i){ setTimeout(function(){blip(f,0.3,"sawtooth",0.16,f*1.5);}, i*70); }); },
    bomb:  function () { noiseBurst(0.4, 0.5, 220); blip(120, 0.5, "sawtooth", 0.4, 40); }
  };

  function setMuted(m) {
    muted = m;
    bgm.muted = m;
    var label = "🔊 音乐：" + (m ? "关" : "开");
    titleMuteBtn.textContent = label;
    pauseMuteBtn.textContent = label;
    muteBtn.textContent = m ? "🔇" : "♪";
    muteBtn.classList.toggle("off", m);
    try { localStorage.setItem("zxf-muted", m ? "1" : "0"); } catch (e) {}
  }
  function playBgm() {
    if (muted) return;
    var p = bgm.play();
    if (p && p.catch) p.catch(function () {});
  }

  // ---------- Game state ----------
  var STATE = "loading";
  var best = 0;
  try { best = Number(localStorage.getItem("zxf-cool-best") || 0) || 0; } catch (e) {}
  try { muted = localStorage.getItem("zxf-muted") === "1"; } catch (e) {}

  var objects = [];     // flying items
  var halves = [];      // sliced object halves flying apart
  var particles = [];   // splash bits
  var rings = [];       // expanding burst rings
  var slashes = [];     // white slash flashes
  var pops = [];        // floating score text
  var blade = [];       // pointer trail points {x,y,t}

  var game = null;
  function newGame() {
    return {
      score: 0,
      displayScore: 0,
      lives: 3,
      combo: 0,            // consecutive good slices (time-windowed)
      maxCombo: 0,
      lastSliceT: -9,
      cool: 0,             // 0..100
      fever: 0,            // remaining fever seconds
      time: 0,             // elapsed playing seconds
      spawnTimer: 0.6,
      shake: 0,
      timeScale: 1,
      flash: 0,            // white/red screen flash 0..1
      flashColor: "255,90,82",
      mascotKick: 0,       // bob impulse
      mascotHypeT: 0,      // show hype sprite timer
      strokeKills: 0
    };
  }

  // ---------- Helpers ----------
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function now() { return performance.now() / 1000; }

  function distToSeg(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    var l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    var t = clamp(((px - x1) * dx + (py - y1) * dy) / l2, 0, 1);
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  // ---------- Spawning ----------
  var GOOD = ["sprite", "qiaolezi"];
  function spawnBurst() {
    var lvl = Math.min(game.time / 22, 6);
    var feverOn = game.fever > 0;
    var count = feverOn ? Math.round(rand(2, 4)) : Math.round(rand(1, 1 + Math.min(2 + lvl * 0.5, 4)));
    var bombChance = feverOn ? 0 : clamp(0.1 + lvl * 0.05, 0.1, 0.42);
    var letterChance = feverOn ? 0.16 : 0.05;

    for (var i = 0; i < count; i++) spawnOne(bombChance, letterChance, lvl);

    var baseGap = feverOn ? 0.5 : clamp(1.15 - lvl * 0.12, 0.55, 1.15);
    game.spawnTimer = baseGap + rand(-0.12, 0.18);
  }

  function spawnOne(bombChance, letterChance, lvl) {
    var roll = Math.random();
    var type;
    if (roll < bombChance) type = "bomb";
    else if (roll < bombChance + letterChance) type = "letter";
    else type = GOOD[(Math.random() * GOOD.length) | 0];

    var im = IMG[type];
    var size = M.objSize * (type === "letter" ? 0.95 : type === "bomb" ? 0.96 : 1);
    var ar = im.naturalWidth && im.naturalHeight ? im.naturalWidth / im.naturalHeight : 1;
    var w, h;
    if (ar >= 1) { w = size; h = size / ar; } else { h = size; w = size * ar; }

    var margin = W * 0.12;
    var x = rand(margin, W - margin);
    // aim apex near the upper portion of the screen
    var apex = rand(H * 0.12, H * 0.42);
    var vy = -Math.sqrt(2 * M.gravity * (H - apex));
    var spd = 1 + Math.min(lvl * 0.04, 0.3);
    var vx = (x < W / 2 ? rand(10, 120) : rand(-120, -10)) * spd;

    objects.push({
      type: type, img: im,
      x: x, y: H + size * 0.7,
      vx: vx, vy: vy * spd,
      w: w, h: h, r: Math.max(w, h) * 0.46,
      rot: rand(0, Math.PI * 2), vrot: rand(-3.2, 3.2),
      sliced: false, t: 0, born: game.time
    });
  }

  // ---------- Slicing ----------
  function trySlice(x1, y1, x2, y2) {
    if (STATE !== "playing") return;
    var ang = Math.atan2(y2 - y1, x2 - x1);
    for (var i = 0; i < objects.length; i++) {
      var o = objects[i];
      if (o.sliced) continue;
      if (distToSeg(o.x, o.y, x1, y1, x2, y2) <= o.r) {
        sliceObject(o, ang);
      }
    }
  }

  function sliceObject(o, ang) {
    o.sliced = true;
    sfx.slice();
    addSlash(o.x, o.y, ang);
    makeHalves(o, ang);

    if (o.type === "bomb") {
      hitBomb(o);
      return;
    }

    // good slice
    game.strokeKills++;
    var t = game.time;
    if (t - game.lastSliceT < 0.72) game.combo++; else game.combo = 1;
    game.lastSliceT = t;
    game.maxCombo = Math.max(game.maxCombo, game.combo);

    var mult = game.fever > 0 ? 2 : 1;
    var base, rgb;
    if (o.type === "sprite") { base = 40; rgb = "56,224,200"; game.cool = Math.min(100, game.cool + 14); splash(o, rgb); sfx.pop(); }
    else if (o.type === "qiaolezi") { base = 50; rgb = "150,96,54"; game.cool = Math.min(100, game.cool + 8); splash(o, rgb); sfx.sweet(); }
    else { base = 300; rgb = "255,207,74"; game.cool = Math.min(100, game.cool + 20); splash(o, rgb, true); sfx.letter(); slowmo(0.45, 0.55); }
    addRing(o.x, o.y, rgb);

    var comboBonus = Math.max(0, game.combo - 1) * 8;
    var gained = (base + comboBonus) * mult;
    game.score += gained;

    addPop(o.x, o.y, "+" + gained, o.type === "letter" ? "#ffcf4a" : "#eafff9");

    if (game.combo >= 2) {
      comboNum.textContent = game.combo;
      comboChip.classList.remove("hidden");
      comboChip.classList.remove("pop"); void comboChip.offsetWidth; comboChip.classList.add("pop");
      if (game.combo % 5 === 0) { sfx.combo(game.combo / 5); showBanner(game.combo + " 连击!", "linear-gradient(180deg,#fff,#7fe6d2)"); }
    }

    game.mascotKick = 1;

    // cool meter full -> fever
    if (game.cool >= 100 && game.fever <= 0) startFever();
  }

  function hitBomb(o) {
    game.lives--;
    game.combo = 0;
    comboChip.classList.add("hidden");
    game.shake = 1;
    game.flash = 1; game.flashColor = "255,70,60";
    slowmo(0.3, 0.7);
    smoke(o);
    sfx.bomb();
    if (!muted) { try { deathSfx.currentTime = 0; deathSfx.play().catch(function(){}); } catch (e) {} }
    updateLives();
    if (game.lives <= 0) { gameOver(); }
    else { showBanner("扣 命!", "linear-gradient(180deg,#ffb4b0,#ff5a52)"); }
  }

  function startFever() {
    game.fever = 8;
    game.cool = 100;
    game.mascotHypeT = 8;
    game.flash = 0.7; game.flashColor = "120,240,255";
    game.shake = 0.6;
    coolFill.classList.add("full");
    sfx.fever();
    showBanner("透心凉 FEVER!", "linear-gradient(180deg,#d6fff7,#36b6ff)");
  }

  function slowmo(scale, dur) { game.timeScale = scale; game._slowmoEnd = game.time + dur; }

  // ---------- Particles ----------
  function makeHalves(o, ang) {
    var perp = ang + Math.PI / 2;
    for (var s = -1; s <= 1; s += 2) {
      var push = rand(70, 150);
      halves.push({
        img: o.img, x: o.x, y: o.y, w: o.w, h: o.h,
        rot: o.rot, vrot: o.vrot + s * rand(2, 5),
        cut: ang, side: s,
        vx: o.vx * 0.35 + Math.cos(perp) * s * push,
        vy: o.vy * 0.35 + Math.sin(perp) * s * push - 30,
        life: 1
      });
    }
  }
  function addSlash(x, y, ang) {
    slashes.push({ x: x, y: y, ang: ang, life: 0.16, max: 0.16 });
  }
  function addRing(x, y, rgb) {
    rings.push({ x: x, y: y, r: M.objSize * 0.28, rgb: rgb, life: 0.34, max: 0.34 });
  }
  function splash(o, rgb, sparkle) {
    var n = sparkle ? 30 : 20;
    for (var i = 0; i < n; i++) {
      var a = rand(0, Math.PI * 2), sp = rand(80, 420);
      particles.push({
        x: o.x, y: o.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80,
        r: rand(2, 7), life: rand(0.4, 1.0), maxlife: 1.0,
        rgb: rgb, g: 1100, spark: !!sparkle
      });
    }
  }
  function smoke(o) {
    for (var i = 0; i < 18; i++) {
      var a = rand(0, Math.PI * 2), sp = rand(40, 260);
      particles.push({
        x: o.x, y: o.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        r: rand(4, 12), life: rand(0.4, 0.8), maxlife: 0.8,
        rgb: i % 3 === 0 ? "255,150,40" : "60,60,66", g: -120, smoke: true
      });
    }
  }
  function addPop(x, y, text, color) {
    pops.push({ x: x, y: y, text: text, color: color, life: 0.9, vy: -70 });
  }

  // ---------- Banner ----------
  function showBanner(text, gradient) {
    bannerEl.textContent = text;
    bannerEl.style.backgroundImage = gradient;
    bannerEl.style.webkitBackgroundClip = "text";
    bannerEl.style.backgroundClip = "text";
    bannerEl.style.color = "transparent";
    bannerEl.classList.remove("show"); void bannerEl.offsetWidth; bannerEl.classList.add("show");
  }

  // ---------- HUD ----------
  function updateLives() {
    var html = "";
    for (var i = 0; i < 3; i++) html += '<span class="heart' + (i < game.lives ? "" : " lost") + '">❄️</span>';
    livesEl.innerHTML = html;
  }
  function updateHud() {
    scoreEl.textContent = Math.round(game.displayScore);
    bestEl.textContent = "最高 " + best;
    coolFill.style.width = game.cool + "%";
  }

  // ---------- Update ----------
  function update(dt) {
    game.time += dt;

    // slow-mo recovery
    if (game._slowmoEnd && game.time > game._slowmoEnd) game.timeScale = 1;
    var sdt = dt * game.timeScale;

    // fever timer
    if (game.fever > 0) {
      game.fever -= dt;
      game.cool = Math.max(0, (game.fever / 8) * 100);
      if (game.fever <= 0) { game.cool = 0; coolFill.classList.remove("full"); game.mascotHypeT = Math.min(game.mascotHypeT, 0.4); }
    }
    if (game.mascotHypeT > 0) game.mascotHypeT -= dt;
    if (game.mascotKick > 0) game.mascotKick = Math.max(0, game.mascotKick - dt * 3);

    // combo expiry
    if (game.combo >= 2 && game.time - game.lastSliceT > 0.72) {
      game.combo = 0; comboChip.classList.add("hidden");
    }

    // spawning
    game.spawnTimer -= sdt;
    if (game.spawnTimer <= 0) spawnBurst();

    // objects physics
    for (var i = objects.length - 1; i >= 0; i--) {
      var o = objects[i];
      if (o.sliced) { objects.splice(i, 1); continue; } // halves take over
      o.vy += M.gravity * sdt;
      o.x += o.vx * sdt;
      o.y += o.vy * sdt;
      o.rot += o.vrot * sdt;

      // remove off-screen; missed a good object -> break combo
      if (o.y - o.r > H + 40) {
        if (o.type !== "bomb") { game.combo = 0; comboChip.classList.add("hidden"); }
        objects.splice(i, 1);
      }
    }

    // halves
    for (var hi = halves.length - 1; hi >= 0; hi--) {
      var hf = halves[hi];
      hf.vy += M.gravity * sdt;
      hf.x += hf.vx * sdt; hf.y += hf.vy * sdt; hf.rot += hf.vrot * sdt;
      hf.life -= dt * 1.05;
      if (hf.life <= 0 || hf.y - hf.h > H + 60) halves.splice(hi, 1);
    }

    // rings + slashes
    for (var ri = rings.length - 1; ri >= 0; ri--) {
      var rg = rings[ri];
      rg.r += M.objSize * 4.5 * dt; rg.life -= dt;
      if (rg.life <= 0) rings.splice(ri, 1);
    }
    for (var si = slashes.length - 1; si >= 0; si--) {
      slashes[si].life -= dt;
      if (slashes[si].life <= 0) slashes.splice(si, 1);
    }

    // particles
    for (var p = particles.length - 1; p >= 0; p--) {
      var pa = particles[p];
      pa.vy += pa.g * sdt;
      pa.x += pa.vx * sdt; pa.y += pa.vy * sdt;
      pa.life -= dt;
      if (pa.life <= 0) particles.splice(p, 1);
    }

    // score pops
    for (var q = pops.length - 1; q >= 0; q--) {
      var po = pops[q];
      po.y += po.vy * dt; po.vy *= 0.92; po.life -= dt;
      if (po.life <= 0) pops.splice(q, 1);
    }

    // animated display score
    game.displayScore += (game.score - game.displayScore) * Math.min(1, dt * 12);
    if (Math.abs(game.score - game.displayScore) < 0.6) game.displayScore = game.score;

    // shake / flash decay
    if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 2.2);
    if (game.flash > 0) game.flash = Math.max(0, game.flash - dt * 2.4);

    // trim blade trail by age
    var tnow = now();
    while (blade.length && tnow - blade[0].t > 0.12) blade.shift();
  }

  // ---------- Render ----------
  function drawBackground() {
    var im = IMG.bg;
    if (im && im.naturalWidth) {
      // cover
      var ar = im.naturalWidth / im.naturalHeight;
      var car = W / H, dw, dh, dx, dy;
      if (car > ar) { dw = W; dh = W / ar; dx = 0; dy = (H - dh) / 2; }
      else { dh = H; dw = H * ar; dy = 0; dx = (W - dw) / 2; }
      ctx.drawImage(im, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = "#15455d"; ctx.fillRect(0, 0, W, H);
    }
    // fever tint
    if (game && game.fever > 0) {
      ctx.fillStyle = "rgba(60,200,255," + (0.12 + 0.06 * Math.sin(game.time * 12)) + ")";
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = "rgba(4,20,30,0.18)";
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawMascot() {
    var hype = game.mascotHypeT > 0;
    var im = hype ? IMG.hype : IMG.mc;
    if (!im || !im.naturalWidth) return;
    var h = M.mascotH * (hype ? 1.06 : 1);
    var w = h * (im.naturalWidth / im.naturalHeight);
    var bob = Math.sin(game.time * 3) * 4 + game.mascotKick * -14;
    var x = -w * 0.14;
    var y = H - h + bob + 6;
    ctx.save();
    ctx.globalAlpha = 0.98;
    if (hype) {
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate(Math.sin(game.time * 18) * 0.04);
      ctx.drawImage(im, -w / 2, -h / 2, w, h);
    } else {
      ctx.drawImage(im, x, y, w, h);
    }
    ctx.restore();
  }

  function drawObjects() {
    for (var i = 0; i < objects.length; i++) {
      var o = objects[i];
      if (o.sliced) continue;
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(o.rot);
      ctx.drawImage(o.img, -o.w / 2, -o.h / 2, o.w, o.h);
      ctx.restore();
    }
  }

  function drawHalves() {
    for (var i = 0; i < halves.length; i++) {
      var h = halves[i];
      var big = h.w + h.h;
      ctx.save();
      ctx.globalAlpha = clamp(h.life, 0, 1);
      ctx.translate(h.x, h.y);
      ctx.rotate(h.cut);
      ctx.beginPath();
      if (h.side < 0) ctx.rect(-big, -big, big * 2, big);
      else ctx.rect(-big, 0, big * 2, big);
      ctx.clip();
      ctx.rotate(h.rot - h.cut);
      ctx.drawImage(h.img, -h.w / 2, -h.h / 2, h.w, h.h);
      ctx.restore();
    }
  }

  function drawRings() {
    for (var i = 0; i < rings.length; i++) {
      var r = rings[i];
      var a = clamp(r.life / r.max, 0, 1);
      ctx.globalAlpha = a * 0.8;
      ctx.strokeStyle = "rgba(" + r.rgb + ",1)";
      ctx.lineWidth = M.objSize * 0.1 * a + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawSlashes() {
    ctx.lineCap = "round";
    for (var i = 0; i < slashes.length; i++) {
      var s = slashes[i];
      var a = clamp(s.life / s.max, 0, 1);
      var len = M.objSize * (1.1 + (1 - a) * 0.9);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.ang);
      ctx.globalAlpha = a;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = M.objSize * 0.14 * a + 2;
      ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.lineTo(len / 2, 0); ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var a = clamp(p.life / p.maxlife, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(" + p.rgb + "," + (p.smoke ? a * 0.6 : 1) + ")";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (p.smoke ? (1 + (1 - a) * 1.4) : 1), 0, Math.PI * 2);
      ctx.fill();
      if (p.spark) {
        ctx.fillStyle = "rgba(255,255,255," + a + ")";
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.4, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawPops() {
    ctx.textAlign = "center";
    for (var i = 0; i < pops.length; i++) {
      var p = pops[i];
      var a = clamp(p.life / 0.9, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = "900 " + Math.round(M.objSize * 0.32) + "px system-ui, sans-serif";
      ctx.fillStyle = p.color;
      ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 3;
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawBlade() {
    if (blade.length < 2) return;
    var fever = game && game.fever > 0;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    // glow
    for (var pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      for (var i = 0; i < blade.length; i++) {
        var pt = blade[i];
        if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
      }
      if (pass === 0) {
        ctx.strokeStyle = fever ? "rgba(255,220,120,0.5)" : "rgba(90,230,255,0.45)";
        ctx.lineWidth = M.objSize * 0.34;
      } else {
        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.lineWidth = M.objSize * 0.12;
      }
      ctx.stroke();
    }
  }

  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var sx = 0, sy = 0;
    if (game && game.shake > 0) {
      var m = game.shake * 14;
      sx = rand(-m, m); sy = rand(-m, m);
      ctx.translate(sx, sy);
    }
    drawBackground();
    if (game) {
      drawMascot();
      drawRings();
      drawObjects();
      drawHalves();
      drawParticles();
      drawSlashes();
      drawPops();
      drawBlade();
    }

    if (game && game.flash > 0) {
      ctx.fillStyle = "rgba(" + game.flashColor + "," + (game.flash * 0.5) + ")";
      ctx.fillRect(-40, -40, W + 80, H + 80);
    }
  }

  // ---------- Loop ----------
  var lastT = 0, raf = null;
  function loop(tms) {
    raf = requestAnimationFrame(loop);
    var t = tms / 1000;
    var dt = Math.min(t - lastT, 0.033);
    lastT = t;
    if (STATE === "playing") {
      update(dt);
      updateHud();
    }
    render();
  }

  // ---------- State transitions ----------
  function show(el) { el.classList.remove("hidden"); }
  function hide(el) { el.classList.add("hidden"); }

  function goTitle() {
    STATE = "title";
    hide(hud); show(titleScreen); hide(pauseScreen); hide(overScreen);
    titleBest.textContent = "最高分 " + best;
    objects = []; halves = []; particles = []; rings = []; slashes = []; pops = []; blade = [];
  }

  function startGame() {
    initAudioCtx(); resumeAudio();
    game = newGame();
    objects = []; halves = []; particles = []; rings = []; slashes = []; pops = []; blade = [];
    updateLives(); updateHud();
    coolFill.classList.remove("full");
    comboChip.classList.add("hidden");
    STATE = "playing";
    hide(titleScreen); hide(overScreen); hide(pauseScreen); show(hud);
    playBgm();
    showBanner("开 始!", "linear-gradient(180deg,#fff,#7fe6d2)");
  }

  function pauseGame() {
    if (STATE !== "playing") return;
    STATE = "paused";
    show(pauseScreen);
    try { bgm.pause(); } catch (e) {}
  }
  function resumeGame() {
    if (STATE !== "paused") return;
    STATE = "playing";
    hide(pauseScreen);
    lastT = performance.now() / 1000;
    playBgm();
  }

  var QUOTES = [
    "“你切得过我你信吗！”",
    "“这个专业，闭着眼睛冲！”",
    "“天坑专业，离它远点儿！”",
    "“透心凉，心飞扬！”",
    "“手别抖，下一把稳了！”"
  ];
  function gameOver() {
    STATE = "gameover";
    best = Math.max(best, game.score);
    try { localStorage.setItem("zxf-cool-best", String(best)); } catch (e) {}
    finalScore.textContent = game.score;
    finalBest.textContent = best;
    finalCombo.textContent = game.maxCombo;
    quoteEl.textContent = QUOTES[(Math.random() * QUOTES.length) | 0];
    hide(hud); show(overScreen);
    try { bgm.pause(); bgm.currentTime = 0; } catch (e) {}
  }

  // ---------- Input ----------
  var pointerActive = false, lastPX = 0, lastPY = 0;
  function relPos(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function pointerDown(e) {
    if (STATE !== "playing") return;
    pointerActive = true;
    game.strokeKills = 0;
    var p = relPos(e);
    lastPX = p.x; lastPY = p.y;
    blade.length = 0;
    blade.push({ x: p.x, y: p.y, t: now() });
  }
  function pointerMove(e) {
    if (!pointerActive || STATE !== "playing") return;
    var p = relPos(e);
    blade.push({ x: p.x, y: p.y, t: now() });
    if (blade.length > 24) blade.shift();
    trySlice(lastPX, lastPY, p.x, p.y);
    lastPX = p.x; lastPY = p.y;
  }
  function pointerUp() {
    if (pointerActive && game && game.strokeKills >= 3) {
      showBanner("连斩 " + game.strokeKills + "!", "linear-gradient(180deg,#fff,#ffcf4a)");
      game.score += game.strokeKills * 30;
    }
    pointerActive = false;
  }

  canvas.addEventListener("pointerdown", function (e) { e.preventDefault(); pointerDown(e); }, { passive: false });
  canvas.addEventListener("pointermove", function (e) { e.preventDefault(); pointerMove(e); }, { passive: false });
  window.addEventListener("pointerup", pointerUp);
  window.addEventListener("pointercancel", pointerUp);

  // buttons
  startBtn.addEventListener("click", startGame);
  againBtn.addEventListener("click", startGame);
  homeBtn.addEventListener("click", goTitle);
  pauseBtn.addEventListener("click", pauseGame);
  resumeBtn.addEventListener("click", resumeGame);
  restartFromPauseBtn.addEventListener("click", startGame);
  function toggleMute() { setMuted(!muted); if (!muted && (STATE === "playing")) playBgm(); }
  muteBtn.addEventListener("click", toggleMute);
  titleMuteBtn.addEventListener("click", toggleMute);
  pauseMuteBtn.addEventListener("click", toggleMute);

  document.addEventListener("visibilitychange", function () {
    if (document.hidden && STATE === "playing") pauseGame();
  });
  window.addEventListener("keydown", function (e) {
    if (e.code === "Escape" || e.code === "KeyP") { if (STATE === "playing") pauseGame(); else if (STATE === "paused") resumeGame(); }
    if (e.code === "Space" && (STATE === "title" || STATE === "gameover")) startGame();
  });

  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", function () { setTimeout(resize, 200); });

  // ---------- Boot ----------
  function boot() {
    resize();
    setMuted(muted);
    raf = requestAnimationFrame(loop);

    // dev-only test hooks (gated; no effect in normal play)
    if (/[?&]dev=1/.test(location.search)) {
      window.__zxfDev = {
        state: function () { return STATE; },
        info: function () { return game ? { score: game.score, lives: game.lives, cool: game.cool, fever: game.fever, combo: game.combo, objs: objects.length } : null; },
        forceOver: function () { if (game) { game.lives = 1; if (STATE === "playing") { hitBomb({ x: W / 2, y: H / 2 }); } } },
        forceFever: function () { if (game && STATE === "playing") { game.cool = 100; startFever(); } }
      };
    }
    preload(function (pct) {
      var p = Math.round(pct * 100);
      loaderFill.style.width = p + "%";
      loaderText.textContent = "素材加载中… " + p + "%";
    }).then(function () {
      loaderText.textContent = "准备就绪！";
      setTimeout(function () { hide(loadingScreen); goTitle(); }, 350);
    });
  }
  boot();
})();
