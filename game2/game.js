/* 张雪峰 · 透心凉叠叠乐 — one-tap tower stacker
   Vanilla canvas. Mobile-first. BGM/death audio reused from the original site. */
(function () {
  "use strict";

  var stage = document.getElementById("stage");
  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");

  var hud = document.getElementById("hud");
  var scoreEl = document.getElementById("score");
  var bestEl = document.getElementById("best");
  var comboChip = document.getElementById("comboChip");
  var comboNum = document.getElementById("comboNum");
  var bannerEl = document.getElementById("banner");
  var tapHint = document.getElementById("tapHint");

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
  bgm.volume = 0.5; deathSfx.volume = 0.9;

  // ---------- sizing ----------
  var W = 0, H = 0, DPR = 1, M = {};
  function resize() {
    var r = stage.getBoundingClientRect();
    W = Math.max(320, r.width); H = Math.max(420, r.height);
    DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    M.slabH = clamp(H * 0.052, 26, 46);
    M.baseW = clamp(W * 0.5, 150, 320);
    M.topScreenY = H * 0.40;        // where the active slab sits on screen
    M.mascotH = clamp(H * 0.2, 110, 210);
  }

  // ---------- assets ----------
  var IMG = {};
  var imgList = [
    ["idle", "assets/zhang-idle.png"], ["cheer", "assets/zhang-cheer.png"],
    ["sprite", "assets/px-sprite.png"], ["ice", "assets/px-ice.png"]
  ];
  function preload(onProgress) {
    return new Promise(function (resolve) {
      var total = imgList.length + 1, done = 0;
      function tick() { done++; onProgress(done / total); if (done >= total) resolve(); }
      imgList.forEach(function (p) { var im = new Image(); im.onload = tick; im.onerror = tick; im.src = p[1]; IMG[p[0]] = im; });
      var settled = false; function ar() { if (!settled) { settled = true; tick(); } }
      if (bgm.readyState >= 3) ar();
      bgm.addEventListener("canplaythrough", ar, { once: true });
      bgm.addEventListener("loadeddata", ar, { once: true });
      setTimeout(ar, 6000); try { bgm.load(); } catch (e) {}
    });
  }

  // ---------- audio ----------
  var actx = null, masterGain = null, muted = false;
  function initAudioCtx() {
    if (actx) return;
    try { var AC = window.AudioContext || window.webkitAudioContext; actx = new AC(); masterGain = actx.createGain(); masterGain.gain.value = 0.6; masterGain.connect(actx.destination); } catch (e) { actx = null; }
  }
  function resumeAudio() { if (actx && actx.state === "suspended") actx.resume(); }
  function blip(freq, dur, type, vol, slideTo) {
    if (!actx || muted) return;
    var t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(masterGain); o.start(t); o.stop(t + dur + 0.02);
  }
  var sfx = {
    place: function (n) { blip(300 + Math.min(n, 24) * 18, 0.1, "triangle", 0.25, 220 + Math.min(n, 24) * 12); },
    perfect: function (n) { blip(520 + Math.min(n, 12) * 60, 0.12, "sine", 0.3, 880 + Math.min(n, 12) * 80); setTimeout(function () { blip(1040 + Math.min(n, 12) * 80, 0.12, "sine", 0.22, 1500); }, 60); },
    cut: function () { blip(180, 0.16, "sawtooth", 0.18, 60); },
    over: function () { blip(300, 0.5, "sawtooth", 0.35, 70); }
  };
  function setMuted(m) {
    muted = m; bgm.muted = m;
    var label = "🔊 音乐：" + (m ? "关" : "开");
    titleMuteBtn.textContent = label; pauseMuteBtn.textContent = label;
    muteBtn.textContent = m ? "🔇" : "♪"; muteBtn.classList.toggle("off", m);
    try { localStorage.setItem("zxf-muted", m ? "1" : "0"); } catch (e) {}
  }
  function playBgm() { if (muted) return; var p = bgm.play(); if (p && p.catch) p.catch(function () {}); }

  // ---------- state ----------
  var STATE = "loading";
  var best = 0;
  try { best = Number(localStorage.getItem("zxf-stack-best") || 0) || 0; } catch (e) {}
  try { muted = localStorage.getItem("zxf-muted") === "1"; } catch (e) {}

  var stack = [];     // placed slabs {x,w,level,kind}
  var debris = [];    // falling cut pieces
  var sparks = [];
  var game = null;

  var KINDS = [
    { name: "sprite", c1: "#7be06a", c2: "#3fae3a", edge: "#2c7a28", label: "雪碧", icon: "sprite" },
    { name: "qiaolezi", c1: "#a9703f", c2: "#6e3f1d", edge: "#4d2a12", label: "巧乐兹", icon: "ice" },
    { name: "cool", c1: "#6fe0ff", c2: "#2aa8e0", edge: "#1c7aa6", label: "透心凉", icon: null }
  ];

  function newGame() {
    return {
      level: 0, best: best, perfect: 0, maxPerfect: 0,
      camY: 0, camTarget: 0,
      moving: null, speed: 0, dir: 1,
      shake: 0, flash: 0, mascotHypeT: 0, over: false
    };
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  // world Y: level L top edge at worldY = -L*slabH ; screen = worldY - camY
  function levelWorldY(L) { return -L * M.slabH; }

  function startGame() {
    initAudioCtx(); resumeAudio();
    game = newGame();
    stack = []; debris = []; sparks = [];
    // base slab
    stack.push({ x: (W - M.baseW) / 2, w: M.baseW, level: 0, kind: 0 });
    game.level = 1;
    spawnMoving();
    // camera so base sits near bottom
    game.camY = levelWorldY(0) - (H * 0.82);
    game.camTarget = game.camY;
    STATE = "playing";
    hide(titleScreen); hide(overScreen); hide(pauseScreen); show(hud);
    updateHud(); playBgm();
    showBanner("叠起来!", "linear-gradient(180deg,#fff,#7fe6d2)");
  }

  function spawnMoving() {
    var top = stack[stack.length - 1];
    var w = top.w;
    game.speed = clamp(W * (0.55 + game.level * 0.03), W * 0.5, W * 1.5);
    game.dir = Math.random() < 0.5 ? 1 : -1;
    var startX = game.dir > 0 ? -w : W;
    game.moving = { x: startX, w: w, level: game.level, kind: game.level % KINDS.length };
    game.camTarget = levelWorldY(game.level) - M.topScreenY;
  }

  function drop() {
    if (STATE !== "playing" || !game.moving) return;
    if (tapHint) tapHint.style.display = "none";
    var mv = game.moving, top = stack[stack.length - 1];
    var mvLeft = mv.x, mvRight = mv.x + mv.w;
    var tLeft = top.x, tRight = top.x + top.w;
    var nLeft = Math.max(mvLeft, tLeft), nRight = Math.min(mvRight, tRight);
    var overlap = nRight - nLeft;

    if (overlap <= 0) { // missed entirely -> tower falls
      // whole slab becomes debris
      debris.push(makeDebris(mv.x, levelWorldY(mv.level), mv.w, mv.kind, mv.x < W / 2 ? -1 : 1));
      gameOver();
      return;
    }

    var perfectTol = Math.max(6, M.baseW * 0.035);
    var off = Math.abs(mvLeft - tLeft);
    var perfect = off <= perfectTol;

    if (perfect) {
      game.perfect++;
      game.maxPerfect = Math.max(game.maxPerfect, game.perfect);
      // snap and reward: regrow a little (forgiveness)
      var grow = Math.min(M.baseW * 0.06, (M.baseW - top.w) > 0 ? M.baseW * 0.06 : M.baseW * 0.03);
      nLeft = tLeft; nRight = tLeft + Math.min(top.w + grow, M.baseW);
      overlap = nRight - nLeft;
      sfx.perfect(game.perfect);
      game.flash = 0.5; game.mascotHypeT = 1.1;
      spawnSparks(nLeft + overlap / 2, levelWorldY(mv.level) + M.slabH / 2, KINDS[mv.kind].c1);
      if (game.perfect >= 2) {
        comboNum.textContent = game.perfect; comboChip.classList.remove("hidden");
        comboChip.classList.remove("pop"); void comboChip.offsetWidth; comboChip.classList.add("pop");
      }
      if (game.perfect % 5 === 0) showBanner(game.perfect + " 连完美!", "linear-gradient(180deg,#fff,#ffcf4a)");
    } else {
      game.perfect = 0; comboChip.classList.add("hidden");
      sfx.place(game.level);
      sfx.cut();
      // cut piece -> debris
      if (mvLeft < tLeft) debris.push(makeDebris(mvLeft, levelWorldY(mv.level), tLeft - mvLeft, mv.kind, -1));
      if (mvRight > tRight) debris.push(makeDebris(tRight, levelWorldY(mv.level), mvRight - tRight, mv.kind, 1));
    }

    stack.push({ x: nLeft, w: overlap, level: mv.level, kind: mv.kind });
    game.shake = perfect ? 0.35 : 0.18;
    game.level++;
    game.moving = null;
    updateHud();
    spawnMoving();
  }

  function makeDebris(x, worldY, w, kind, side) {
    return { x: x, worldY: worldY, w: w, h: M.slabH, kind: kind, vx: side * rand(40, 120), vy: rand(-40, 30), vr: side * rand(2, 5), rot: 0, life: 1.4 };
  }
  function spawnSparks(x, worldY, color) {
    for (var i = 0; i < 16; i++) { var a = rand(0, Math.PI * 2), sp = rand(60, 240); sparks.push({ x: x, worldY: worldY, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, r: rand(2, 5), life: rand(0.4, 0.8), color: color }); }
  }

  function gameOver() {
    if (game.over) return;
    game.over = true; STATE = "gameover";
    var score = game.level - 1;
    best = Math.max(best, score);
    try { localStorage.setItem("zxf-stack-best", String(best)); } catch (e) {}
    sfx.over();
    if (!muted) { try { deathSfx.currentTime = 0; deathSfx.play().catch(function () {}); } catch (e) {} }
    finalScore.textContent = score; finalBest.textContent = best; finalCombo.textContent = game.maxPerfect;
    quoteEl.textContent = QUOTES[(Math.random() * QUOTES.length) | 0];
    game.shake = 0.6; game.flash = 0.5;
    setTimeout(function () { hide(hud); show(overScreen); }, 650);
    try { bgm.pause(); } catch (e) {}
  }

  var QUOTES = ["“稳住，下一层我看好你！”", "“手别抖，叠塔如选专业，要稳！”", "“差一点点，再来！”", "“这高度，可以的！”", "“透心凉，越叠越上头！”"];

  // ---------- update ----------
  function update(dt) {
    if (game.mascotHypeT > 0) game.mascotHypeT -= dt;
    if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 2);
    if (game.flash > 0) game.flash = Math.max(0, game.flash - dt * 2.2);

    // camera ease
    game.camY += (game.camTarget - game.camY) * Math.min(1, dt * 6);

    if (STATE === "playing" && game.moving) {
      var mv = game.moving;
      mv.x += game.dir * game.speed * dt;
      if (mv.x + mv.w > W) { mv.x = W - mv.w; game.dir = -1; }
      else if (mv.x < 0) { mv.x = 0; game.dir = 1; }
    }

    for (var i = debris.length - 1; i >= 0; i--) {
      var d = debris[i];
      d.vy += 900 * dt; d.x += d.vx * dt; d.worldY += d.vy * dt; d.rot += d.vr * dt; d.life -= dt;
      if (d.life <= 0 || (d.worldY - game.camY) > H + 120) debris.splice(i, 1);
    }
    for (var s = sparks.length - 1; s >= 0; s--) {
      var sp = sparks[s]; sp.vy += 700 * dt; sp.x += sp.vx * dt; sp.worldY += sp.vy * dt; sp.life -= dt;
      if (sp.life <= 0) sparks.splice(s, 1);
    }
  }

  // ---------- render ----------
  function drawBackground() {
    // procedural retro sunset + pixel sun + grid (no bg image — distinct from game1)
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#5a2a8c"); g.addColorStop(0.45, "#3a1a63"); g.addColorStop(1, "#160d2e");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // big pixel sun
    var sunR = Math.min(W, H) * 0.22, sx = W / 2, sy = H * 0.30;
    var sg = ctx.createLinearGradient(0, sy - sunR, 0, sy + sunR);
    sg.addColorStop(0, "#ffd23f"); sg.addColorStop(1, "#ff4d8d");
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(sx, sy, sunR, 0, Math.PI * 2); ctx.fill();
    // sun scan-gaps
    ctx.fillStyle = "#3a1a63";
    for (var i = 0; i < 6; i++) { var yy = sy + sunR * 0.2 + i * sunR * 0.16; ctx.fillRect(sx - sunR, yy, sunR * 2, Math.max(2, sunR * 0.05)); }
    // perspective floor grid scrolling with camera
    var horizon = H * 0.62;
    ctx.strokeStyle = "rgba(41,231,255,0.35)"; ctx.lineWidth = 2;
    var off = game ? ((-game.camY * 0.5) % 40) : 0;
    for (var r = 0; r < 16; r++) {
      var yy2 = horizon + (r * r) * 2.2 + off;
      if (yy2 > H) break;
      ctx.beginPath(); ctx.moveTo(0, yy2); ctx.lineTo(W, yy2); ctx.stroke();
    }
    for (var c = -6; c <= 6; c++) {
      ctx.beginPath(); ctx.moveTo(W / 2 + c * 26, horizon); ctx.lineTo(W / 2 + c * W * 0.22, H); ctx.stroke();
    }
    ctx.fillStyle = "rgba(22,13,46,0.45)"; ctx.fillRect(0, 0, W, horizon * 0.4);
  }

  function slabScreenY(worldY) { return worldY - game.camY; }

  function drawSlab(x, worldY, w, kind, alpha, rot, cx) {
    var k = KINDS[kind];
    var y = slabScreenY(worldY);
    ctx.save();
    if (rot) { var pcx = (cx != null ? cx : x + w / 2); ctx.translate(pcx, y + M.slabH / 2); ctx.rotate(rot); ctx.translate(-pcx, -(y + M.slabH / 2)); }
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    // flat blocky pixel slab: body + hard top-light + bottom-shade + black border
    ctx.fillStyle = "#000"; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, Math.round(w) + 4, Math.round(M.slabH) + 4);
    ctx.fillStyle = k.c2; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(M.slabH));
    ctx.fillStyle = k.c1; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.max(3, Math.round(M.slabH * 0.34)));
    ctx.fillStyle = k.edge; ctx.fillRect(Math.round(x), Math.round(y + M.slabH * 0.78), Math.round(w), Math.max(2, Math.round(M.slabH * 0.22)));
    // pixel item icon on wide enough slabs
    var icon = k.icon ? IMG[k.icon] : null;
    if (icon && icon.naturalWidth && w > M.slabH * 1.6) {
      var ih = M.slabH * 0.8, iw = ih * (icon.naturalWidth / icon.naturalHeight);
      var n = Math.max(1, Math.floor(w / (iw + M.slabH * 0.6)));
      n = Math.min(n, 4);
      var gap = w / n;
      for (var i = 0; i < n; i++) ctx.drawImage(icon, Math.round(x + gap * (i + 0.5) - iw / 2), Math.round(y + (M.slabH - ih) / 2), Math.round(iw), Math.round(ih));
    } else if (w > 50) {
      ctx.globalAlpha = (alpha == null ? 1 : alpha) * 0.95;
      ctx.fillStyle = "#0c0820";
      ctx.font = "900 " + Math.round(M.slabH * 0.42) + "px 'Courier New', monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(k.label, Math.round(x + w / 2), Math.round(y + M.slabH * 0.54));
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawMascot() {
    var hype = game.mascotHypeT > 0;
    var im = hype ? IMG.cheer : IMG.idle;
    if (!im || !im.naturalWidth) return;
    var h = M.mascotH, w = h * (im.naturalWidth / im.naturalHeight);
    var bob = Math.floor(Math.sin(performance.now() / 280) * 3) * 2;
    ctx.save(); ctx.globalAlpha = 1;
    ctx.drawImage(im, W - w - 4, H - h + bob, w, h);
    ctx.restore();
  }

  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = false; // crisp pixels (distinct retro look)
    var ox = 0, oy = 0;
    if (game && game.shake > 0) { var m = game.shake * 12; ox = rand(-m, m); oy = rand(-m, m); ctx.translate(ox, oy); }
    drawBackground();
    if (game) {
      // debris behind tower
      for (var i = 0; i < debris.length; i++) { var d = debris[i]; drawSlab(d.x, d.worldY, d.w, d.kind, clamp(d.life, 0, 1), d.rot, d.x + d.w / 2); }
      // tower
      for (var s = 0; s < stack.length; s++) { var sl = stack[s]; drawSlab(sl.x, levelWorldY(sl.level), sl.w, sl.kind); }
      // moving slab
      if (STATE === "playing" && game.moving) drawSlab(game.moving.x, levelWorldY(game.moving.level), game.moving.w, game.moving.kind);
      // sparks
      for (var p = 0; p < sparks.length; p++) { var sp = sparks[p]; ctx.globalAlpha = clamp(sp.life / 0.8, 0, 1); ctx.fillStyle = sp.color; ctx.beginPath(); ctx.arc(sp.x, slabScreenY(sp.worldY), sp.r, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
      drawMascot();
      if (game.flash > 0) { ctx.fillStyle = "rgba(180,245,255," + (game.flash * 0.4) + ")"; ctx.fillRect(-40, -40, W + 80, H + 80); }
    }
  }

  function roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // ---------- HUD / banner ----------
  function updateHud() { scoreEl.textContent = game ? (game.level - 1) : 0; bestEl.textContent = "最高 " + best; }
  function showBanner(text, gradient) {
    bannerEl.textContent = text; bannerEl.style.backgroundImage = gradient;
    bannerEl.style.webkitBackgroundClip = "text"; bannerEl.style.backgroundClip = "text"; bannerEl.style.color = "transparent";
    bannerEl.classList.remove("show"); void bannerEl.offsetWidth; bannerEl.classList.add("show");
  }

  // ---------- loop ----------
  var lastT = 0;
  function loop(tms) {
    requestAnimationFrame(loop);
    var t = tms / 1000, dt = Math.min(t - lastT, 0.033); lastT = t;
    if (STATE === "playing") update(dt);
    else if (game) update(dt); // keep camera/debris easing on gameover
    render();
  }

  // ---------- transitions ----------
  function show(el) { el.classList.remove("hidden"); }
  function hide(el) { el.classList.add("hidden"); }
  function goTitle() {
    STATE = "title"; hide(hud); show(titleScreen); hide(pauseScreen); hide(overScreen);
    titleBest.textContent = "最高 " + best + " 层";
    stack = []; debris = []; sparks = []; game = null;
  }
  function pauseGame() { if (STATE !== "playing") return; STATE = "paused"; show(pauseScreen); try { bgm.pause(); } catch (e) {} }
  function resumeGame() { if (STATE !== "paused") return; STATE = "playing"; hide(pauseScreen); lastT = performance.now() / 1000; playBgm(); }

  // ---------- input ----------
  function tap() {
    if (STATE === "playing") drop();
  }
  canvas.addEventListener("pointerdown", function (e) { e.preventDefault(); tap(); }, { passive: false });
  window.addEventListener("keydown", function (e) {
    if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); if (STATE === "playing") drop(); else if (STATE === "title" || STATE === "gameover") startGame(); }
    if (e.code === "Escape" || e.code === "KeyP") { if (STATE === "playing") pauseGame(); else if (STATE === "paused") resumeGame(); }
  });

  startBtn.addEventListener("click", startGame);
  againBtn.addEventListener("click", startGame);
  homeBtn.addEventListener("click", goTitle);
  pauseBtn.addEventListener("click", pauseGame);
  resumeBtn.addEventListener("click", resumeGame);
  restartFromPauseBtn.addEventListener("click", startGame);
  function toggleMute() { setMuted(!muted); if (!muted && STATE === "playing") playBgm(); }
  muteBtn.addEventListener("click", toggleMute);
  titleMuteBtn.addEventListener("click", toggleMute);
  pauseMuteBtn.addEventListener("click", toggleMute);
  document.addEventListener("visibilitychange", function () { if (document.hidden && STATE === "playing") pauseGame(); });
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", function () { setTimeout(resize, 200); });

  // ---------- boot ----------
  function boot() {
    resize(); setMuted(muted); requestAnimationFrame(loop);
    if (/[?&]dev=1/.test(location.search)) {
      window.__zxfDev = {
        state: function () { return STATE; },
        info: function () { return game ? { level: game.level, perfect: game.perfect, over: game.over } : null; },
        drop: function () { drop(); },
        // drop aimed: move slab to perfect alignment then drop (for testing)
        perfectDrop: function () { if (game && game.moving) { game.moving.x = stack[stack.length - 1].x; drop(); } }
      };
    }
    preload(function (pct) { var p = Math.round(pct * 100); loaderFill.style.width = p + "%"; loaderText.textContent = "素材加载中… " + p + "%"; })
      .then(function () { loaderText.textContent = "准备就绪！"; setTimeout(function () { hide(loadingScreen); goTitle(); }, 350); });
  }
  boot();
})();
