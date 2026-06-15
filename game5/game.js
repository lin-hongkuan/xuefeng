/* 张雪峰 · 弹射名师 — original slingshot-ricochet arena
   Pull back & fling 张雪峰; ricochet off walls; plow through 迷茫学生 (each hit = speed boost,
   so one launch can chain through a crowd). Avoid drifting 天坑炸弹. Vanilla canvas.
   BGM/death audio reused from the original site. */
(function () {
  "use strict";

  var stage = document.getElementById("stage");
  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");

  var hud = document.getElementById("hud");
  var scoreEl = document.getElementById("score");
  var bestEl = document.getElementById("best");
  var livesEl = document.getElementById("lives");
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
    var mg = Math.round(W * 0.035);
    var top = Math.round(H * 0.135);
    M.arena = { x: mg, y: top, w: W - mg * 2, h: H - top - mg };
    var base = Math.min(M.arena.w, M.arena.h);
    M.pr = clamp(base * 0.06, 18, 36);
    M.sr = clamp(base * 0.052, 16, 32);
    M.br = clamp(base * 0.05, 16, 30);
    M.kr = clamp(base * 0.05, 16, 30);
    M.maxPull = Math.min(W, H) * 0.38;
    M.launchK = (Math.min(W, H) * 4.2) / M.maxPull; // maxPull -> ~min*4.2 px/s
    M.maxSpeed = Math.min(W, H) * 4.8;
    M.stopSpeed = Math.min(W, H) * 0.12;
  }

  // ---------- assets ----------
  var IMG = {};
  var imgList = [
    ["zhang", "assets/paper-zhang.png"], ["student", "assets/paper-student.png"],
    ["sprite", "assets/paper-sprite.png"], ["ice", "assets/paper-ice.png"], ["bomb", "assets/paper-bomb.png"]
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
  function initAudioCtx() { if (actx) return; try { var AC = window.AudioContext || window.webkitAudioContext; actx = new AC(); masterGain = actx.createGain(); masterGain.gain.value = 0.6; masterGain.connect(actx.destination); } catch (e) { actx = null; } }
  function resumeAudio() { if (actx && actx.state === "suspended") actx.resume(); }
  function blip(freq, dur, type, vol, slideTo) {
    if (!actx || muted) return;
    var t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(masterGain); o.start(t); o.stop(t + dur + 0.02);
  }
  function noiseBurst(dur, vol, freq) {
    if (!actx || muted) return;
    var t = actx.currentTime, n = Math.floor(actx.sampleRate * dur), buf = actx.createBuffer(1, n, actx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = actx.createBufferSource(); src.buffer = buf;
    var bp = actx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = freq || 900; bp.Q.value = 0.7;
    var g = actx.createGain(); g.gain.value = vol || 0.3; src.connect(bp); bp.connect(g); g.connect(masterGain); src.start();
  }
  var sfx = {
    launch: function () { blip(180, 0.16, "sawtooth", 0.22, 520); },
    wall: function () { blip(160, 0.05, "square", 0.12, 110); },
    hit: function (n) { blip(440 + Math.min(n, 18) * 48, 0.08, "triangle", 0.2, 760 + Math.min(n, 18) * 70); },
    sprite: function () { blip(700, 0.1, "sine", 0.22, 1180); },
    ice: function () { [600, 900, 1200].forEach(function (f, i) { setTimeout(function () { blip(f, 0.12, "sine", 0.18, f * 1.3); }, i * 55); }); },
    bomb: function () { noiseBurst(0.34, 0.45, 240); blip(120, 0.4, "sawtooth", 0.35, 40); },
    over: function () { blip(300, 0.5, "sawtooth", 0.3, 70); }
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
  try { best = Number(localStorage.getItem("zxf-fling-best") || 0) || 0; } catch (e) {}
  try { muted = localStorage.getItem("zxf-muted") === "1"; } catch (e) {}

  var game = null;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  function newGame() {
    var a = M.arena;
    return {
      px: a.x + a.w / 2, py: a.y + a.h * 0.7, vx: 0, vy: 0, spin: 0,
      flying: false, nova: 0, novaActive: false,
      lives: 3, score: 0, displayScore: 0, time: 0,
      combo: 0, maxCombo: 0,
      students: [], bombs: [], pickups: [], parts: [], pops: [],
      studentTimer: 0, bombTimer: 3, pickupTimer: 6,
      invuln: 0, shake: 0, flash: 0, flashColor: "232,83,122", timeScale: 1, slowEnd: 0,
      over: false
    };
  }

  function startGame() {
    initAudioCtx(); resumeAudio();
    game = newGame();
    // seed a few students
    for (var i = 0; i < 5; i++) spawnStudent();
    spawnBomb();
    updateLives(); updateHud();
    comboChip.classList.add("hidden");
    STATE = "playing";
    hide(titleScreen); hide(overScreen); hide(pauseScreen); show(hud);
    if (tapHint) tapHint.style.display = "";
    playBgm();
    showBanner("弹 起 来!");
  }

  // ---------- spawning ----------
  function freeSpot(r, awayFromPlayer) {
    var a = M.arena;
    for (var tries = 0; tries < 30; tries++) {
      var x = rand(a.x + r + 4, a.x + a.w - r - 4), y = rand(a.y + r + 4, a.y + a.h - r - 4);
      if (awayFromPlayer && game && Math.hypot(x - game.px, y - game.py) < (M.arena.h * 0.22)) continue;
      return { x: x, y: y };
    }
    return { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  }
  function spawnStudent() {
    var s = freeSpot(M.sr, true);
    game.students.push({ x: s.x, y: s.y, r: M.sr, born: 0, phase: rand(0, 6.28) });
  }
  function spawnBomb() {
    var s = freeSpot(M.br, true);
    var ang = rand(0, 6.28), sp = M.arena.h * rand(0.04, 0.09);
    game.bombs.push({ x: s.x, y: s.y, r: M.br, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, born: 0 });
  }
  function spawnPickup() {
    var s = freeSpot(M.kr, true);
    game.pickups.push({ x: s.x, y: s.y, r: M.kr, kind: Math.random() < 0.5 ? "sprite" : "ice", life: 11, born: 0, phase: rand(0, 6.28) });
  }

  // ---------- launch ----------
  function launch(dirx, diry, power) {
    if (game.flying) return;
    var sp = clamp(power, 0, M.maxPull) * M.launchK;
    if (sp < M.stopSpeed * 1.5) return;
    var len = Math.hypot(dirx, diry) || 1;
    game.vx = dirx / len * sp; game.vy = diry / len * sp;
    game.flying = true; game.combo = 0;
    game.novaActive = game.nova > 0; if (game.nova > 0) game.nova--;
    if (tapHint) tapHint.style.display = "none";
    sfx.launch();
    comboChip.classList.add("hidden");
  }

  // ---------- update ----------
  function update(dt) {
    game.time += dt;
    if (game.slowEnd && game.time > game.slowEnd) game.timeScale = 1;
    var sdt = dt * game.timeScale;

    if (game.invuln > 0) game.invuln -= dt;
    if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 2);
    if (game.flash > 0) game.flash = Math.max(0, game.flash - dt * 2.4);

    // spawns
    var lvl = game.time;
    var targetStudents = clamp(5 + Math.floor(lvl / 9), 5, 15);
    game.studentTimer -= dt;
    if (game.students.length < targetStudents && game.studentTimer <= 0) { spawnStudent(); game.studentTimer = 0.6; }
    var targetBombs = clamp(1 + Math.floor(lvl / 13), 1, 8);
    game.bombTimer -= dt;
    if (game.bombs.length < targetBombs && game.bombTimer <= 0) { spawnBomb(); game.bombTimer = 2.5; }
    game.pickupTimer -= dt;
    if (game.pickups.length < 1 && game.pickupTimer <= 0) { spawnPickup(); game.pickupTimer = rand(6, 9); }

    // entity anim/born
    for (var i = 0; i < game.students.length; i++) game.students[i].born += dt;
    // bombs drift + slight homing + wall bounce
    var a = M.arena;
    for (var b = 0; b < game.bombs.length; b++) {
      var bo = game.bombs[b]; bo.born += dt;
      // gentle homing toward player to punish camping
      var hx = game.px - bo.x, hy = game.py - bo.y, hl = Math.hypot(hx, hy) || 1;
      bo.vx += (hx / hl) * (a.h * 0.04) * dt; bo.vy += (hy / hl) * (a.h * 0.04) * dt;
      var bs = Math.hypot(bo.vx, bo.vy), bmax = a.h * 0.16;
      if (bs > bmax) { bo.vx *= bmax / bs; bo.vy *= bmax / bs; }
      bo.x += bo.vx * sdt; bo.y += bo.vy * sdt;
      if (bo.x - bo.r < a.x) { bo.x = a.x + bo.r; bo.vx = Math.abs(bo.vx); }
      if (bo.x + bo.r > a.x + a.w) { bo.x = a.x + a.w - bo.r; bo.vx = -Math.abs(bo.vx); }
      if (bo.y - bo.r < a.y) { bo.y = a.y + bo.r; bo.vy = Math.abs(bo.vy); }
      if (bo.y + bo.r > a.y + a.h) { bo.y = a.y + a.h - bo.r; bo.vy = -Math.abs(bo.vy); }
    }
    for (var k = game.pickups.length - 1; k >= 0; k--) { var pk = game.pickups[k]; pk.born += dt; pk.life -= dt; if (pk.life <= 0) game.pickups.splice(k, 1); }

    // player physics (substepped)
    if (game.flying) {
      var speed = Math.hypot(game.vx, game.vy);
      game.spin += (game.vx >= 0 ? 1 : -1) * speed * 0.0006 * sdt * 60;
      var steps = clamp(Math.ceil(speed * sdt / (M.pr * 0.7)), 1, 6);
      var st = sdt / steps;
      for (var s = 0; s < steps; s++) {
        game.px += game.vx * st; game.py += game.vy * st;
        // walls
        if (game.px - M.pr < a.x) { game.px = a.x + M.pr; game.vx = Math.abs(game.vx); wallFx(); }
        if (game.px + M.pr > a.x + a.w) { game.px = a.x + a.w - M.pr; game.vx = -Math.abs(game.vx); wallFx(); }
        if (game.py - M.pr < a.y) { game.py = a.y + M.pr; game.vy = Math.abs(game.vy); wallFx(); }
        if (game.py + M.pr > a.y + a.h) { game.py = a.y + a.h - M.pr; game.vy = -Math.abs(game.vy); wallFx(); }
        collideStuff();
      }
      // friction
      var f = Math.pow(0.34, sdt);
      game.vx *= f; game.vy *= f;
      if (Math.hypot(game.vx, game.vy) < M.stopSpeed) {
        game.vx = 0; game.vy = 0; game.flying = false; game.novaActive = false;
        if (game.combo >= 2) { /* keep banner shown elsewhere */ }
        game.combo = 0; comboChip.classList.add("hidden");
      }
    } else {
      // idle: check bombs touching player
      collideStuff();
    }

    // particles / pops
    for (var p = game.parts.length - 1; p >= 0; p--) { var pa = game.parts[p]; pa.vy += 300 * dt; pa.x += pa.vx * dt; pa.y += pa.vy * dt; pa.rot += pa.vr * dt; pa.life -= dt; if (pa.life <= 0) game.parts.splice(p, 1); }
    for (var q = game.pops.length - 1; q >= 0; q--) { var po = game.pops[q]; po.y += po.vy * dt; po.vy *= 0.92; po.life -= dt; if (po.life <= 0) game.pops.splice(q, 1); }

    game.displayScore += (game.score - game.displayScore) * Math.min(1, dt * 12);
    if (Math.abs(game.score - game.displayScore) < 0.6) game.displayScore = game.score;
  }

  function wallFx() { sfx.wall(); game.shake = Math.max(game.shake, 0.12); }

  function collideStuff() {
    var hitR = M.pr + (game.novaActive ? M.pr * 1.4 : 0);
    // students
    for (var i = game.students.length - 1; i >= 0; i--) {
      var s = game.students[i];
      if (Math.hypot(s.x - game.px, s.y - game.py) <= hitR + s.r) {
        game.students.splice(i, 1);
        game.combo++;
        game.maxCombo = Math.max(game.maxCombo, game.combo);
        var gained = 10 + (game.combo - 1) * 3;
        game.score += gained;
        addPop(s.x, s.y, "+" + gained, "#ff7a66");
        confetti(s.x, s.y);
        sfx.hit(game.combo);
        // speed boost so chains extend the launch
        if (game.flying) {
          var sp = Math.hypot(game.vx, game.vy);
          var boost = Math.min(M.maxSpeed, sp * 1.14 + M.arena.h * 0.25);
          if (sp > 1) { game.vx = game.vx / sp * boost; game.vy = game.vy / sp * boost; }
        }
        if (game.combo >= 2) { comboNum.textContent = game.combo; comboChip.classList.remove("hidden"); comboChip.classList.remove("pop"); void comboChip.offsetWidth; comboChip.classList.add("pop"); }
        if (game.combo === 5 || game.combo === 9 || game.combo === 14) { showBanner("连撞 " + game.combo + "!"); slowmo(); }
      }
    }
    // pickups
    for (var k = game.pickups.length - 1; k >= 0; k--) {
      var pk = game.pickups[k];
      if (Math.hypot(pk.x - game.px, pk.y - game.py) <= M.pr + pk.r) {
        game.pickups.splice(k, 1);
        if (pk.kind === "sprite") { game.score += 30; addPop(pk.x, pk.y, "+30", "#3fb6a8"); game.flash = 0.35; game.flashColor = "63,182,168"; sfx.sprite(); confetti(pk.x, pk.y, "63,182,168"); }
        else { game.nova += 1; game.flash = 0.35; game.flashColor = "246,183,51"; sfx.ice(); showBanner("巧乐兹·金句开路!"); confetti(pk.x, pk.y, "246,183,51"); }
      }
    }
    // bombs
    if (game.invuln <= 0) {
      for (var b = 0; b < game.bombs.length; b++) {
        var bo = game.bombs[b];
        if (Math.hypot(bo.x - game.px, bo.y - game.py) <= M.pr + bo.r - 3) {
          hitBomb(bo); break;
        }
      }
    }
  }

  function hitBomb(bo) {
    game.lives--;
    updateLives();
    game.combo = 0; comboChip.classList.add("hidden");
    game.shake = 0.7; game.flash = 0.7; game.flashColor = "232,83,122";
    game.invuln = 1.3;
    sfx.bomb();
    if (!muted) { try { deathSfx.currentTime = 0; deathSfx.play().catch(function () {}); } catch (e) {} }
    burst(game.px, game.py, "232,83,122", 22);
    // knock player away from bomb and stop the run
    var dx = game.px - bo.x, dy = game.py - bo.y, dl = Math.hypot(dx, dy) || 1;
    game.vx = dx / dl * M.arena.h * 0.6; game.vy = dy / dl * M.arena.h * 0.6;
    // push bomb away too
    bo.vx = -dx / dl * M.arena.h * 0.1; bo.vy = -dy / dl * M.arena.h * 0.1;
    if (game.lives <= 0) gameOver(); else showBanner("撞到天坑!");
  }

  function slowmo() { game.timeScale = 0.4; game.slowEnd = game.time + 0.6; }

  function gameOver() {
    if (game.over) return;
    game.over = true; STATE = "gameover";
    best = Math.max(best, game.score);
    try { localStorage.setItem("zxf-fling-best", String(best)); } catch (e) {}
    sfx.over();
    finalScore.textContent = game.score; finalBest.textContent = best; finalCombo.textContent = game.maxCombo;
    quoteEl.textContent = QUOTES[(Math.random() * QUOTES.length) | 0];
    game.shake = 0.6;
    setTimeout(function () { hide(hud); show(overScreen); }, 550);
    try { bgm.pause(); } catch (e) {}
  }
  var QUOTES = ["“这一杆，漂亮！再来一发？”", "“弹得准，比啥都强！”", "“差一点全清场，不服再来！”", "“瞄准了再松手，稳！”", "“连撞这么多，可以的！”"];

  // ---------- particles ----------
  function confetti(x, y, rgb) {
    var cols = ["255,122,102", "63,182,168", "246,183,51", "232,83,122", "95,176,224"];
    for (var i = 0; i < 12; i++) { var a = rand(0, Math.PI * 2), s = rand(60, 240); game.parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, w: rand(4, 9), h: rand(4, 9), rot: rand(0, 6.28), vr: rand(-8, 8), life: rand(0.4, 0.8), maxlife: 0.8, rgb: rgb || cols[(Math.random() * cols.length) | 0] }); }
  }
  function burst(x, y, rgb, n) { for (var i = 0; i < n; i++) { var a = rand(0, Math.PI * 2), s = rand(60, 260); game.parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, w: rand(4, 8), h: rand(4, 8), rot: rand(0, 6.28), vr: rand(-8, 8), life: rand(0.3, 0.7), maxlife: 0.7, rgb: rgb }); } }
  function addPop(x, y, t, c) { game.pops.push({ x: x, y: y, t: t, c: c, life: 0.8, vy: -55 }); }

  // ---------- render ----------
  function drawBackground() {
    var g = ctx.createRadialGradient(W / 2, H * 0.25, 20, W / 2, H * 0.5, Math.max(W, H) * 0.8);
    g.addColorStop(0, "#f7eed8"); g.addColorStop(0.6, "#ecdcbb"); g.addColorStop(1, "#dcc59a");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // paper grain dots
    ctx.fillStyle = "rgba(150,110,60,0.05)";
    for (var i = 0; i < 40; i++) { var x = (i * 97 % W), y = ((i * 53 + 17) % H); ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill(); }
    // arena board (cut-paper)
    var a = M.arena;
    ctx.save();
    ctx.shadowColor = "rgba(120,80,40,0.35)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
    roundRect(a.x, a.y, a.w, a.h, 18); ctx.fillStyle = "#fcefd4"; ctx.fill();
    ctx.restore();
    ctx.lineWidth = 3; ctx.setLineDash([9, 8]); ctx.strokeStyle = "rgba(180,140,90,0.55)";
    roundRect(a.x + 8, a.y + 8, a.w - 16, a.h - 16, 13); ctx.stroke(); ctx.setLineDash([]);
  }
  function roundRect(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function drawImgC(im, x, y, r, rot, alpha) {
    if (!im || !im.naturalWidth) { ctx.fillStyle = "#ccc"; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); return; }
    var ar = im.naturalWidth / im.naturalHeight, w, h;
    var d = r * 2.3; if (ar >= 1) { w = d; h = d / ar; } else { h = d; w = d * ar; }
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); if (alpha != null) ctx.globalAlpha = alpha;
    ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore();
  }

  function drawAim() {
    if (!aiming || game.flying) return;
    var pull = { x: aimStart.x - aimCur.x, y: aimStart.y - aimCur.y };
    var dist = Math.hypot(pull.x, pull.y);
    if (dist < 6) return;
    var power = Math.min(dist, M.maxPull);
    var dir = { x: pull.x / dist, y: pull.y / dist };
    // simulate trajectory with bounces
    var a = M.arena, sx = game.px, sy = game.py, vx = dir.x, vy = dir.y;
    var stepLen = M.pr * 1.1, steps = Math.round(18 + power / M.maxPull * 22);
    ctx.save();
    for (var i = 0; i < steps; i++) {
      sx += vx * stepLen; sy += vy * stepLen;
      if (sx - M.pr < a.x || sx + M.pr > a.x + a.w) { vx = -vx; sx = clamp(sx, a.x + M.pr, a.x + a.w - M.pr); }
      if (sy - M.pr < a.y || sy + M.pr > a.y + a.h) { vy = -vy; sy = clamp(sy, a.y + M.pr, a.y + a.h - M.pr); }
      var t = i / steps;
      ctx.globalAlpha = (1 - t) * 0.7;
      ctx.fillStyle = "#ff7a66";
      ctx.beginPath(); ctx.arc(sx, sy, Math.max(2, 5 * (1 - t)), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // pull indicator
    var pw = power / M.maxPull;
    ctx.strokeStyle = "rgba(255,122,102," + (0.4 + pw * 0.5) + ")"; ctx.lineWidth = 4; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(game.px, game.py); ctx.lineTo(game.px - dir.x * power, game.py - dir.y * power); ctx.stroke(); ctx.setLineDash([]);
  }

  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (game && game.shake > 0) { var m = game.shake * 12; ctx.translate(rand(-m, m), rand(-m, m)); }
    drawBackground();
    if (game) {
      // students
      for (var i = 0; i < game.students.length; i++) { var s = game.students[i]; var pop = Math.min(1, s.born / 0.25); var bob = Math.sin(game.time * 2 + s.phase) * 3; drawImgC(IMG.student, s.x, s.y + bob, s.r * (0.4 + 0.6 * pop), Math.sin(game.time + s.phase) * 0.08, pop); }
      // pickups
      for (var k = 0; k < game.pickups.length; k++) { var pk = game.pickups[k]; var fade = pk.life < 2 ? (Math.sin(game.time * 12) * 0.3 + 0.7) : 1; var bob2 = Math.sin(game.time * 3 + pk.phase) * 4; drawImgC(IMG[pk.kind], pk.x, pk.y + bob2, pk.r, 0, fade); }
      // bombs
      for (var b = 0; b < game.bombs.length; b++) { var bo = game.bombs[b]; drawImgC(IMG.bomb, bo.x, bo.y, bo.r, Math.sin(game.time * 4 + b) * 0.12, 1); }
      // player (张雪峰) — nova glow + invuln blink
      var blink = game.invuln > 0 ? (Math.sin(game.time * 30) * 0.4 + 0.6) : 1;
      if (game.novaActive) { ctx.save(); ctx.globalAlpha = 0.5 + Math.sin(game.time * 14) * 0.2; ctx.fillStyle = "rgba(246,183,51,0.5)"; ctx.beginPath(); ctx.arc(game.px, game.py, M.pr * 2.4, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      drawImgC(IMG.zhang, game.px, game.py, M.pr, game.spin, blink);
      // aim
      drawAim();
      // particles (paper confetti = little rotated rects)
      for (var p = 0; p < game.parts.length; p++) { var pa = game.parts[p], al = clamp(pa.life / pa.maxlife, 0, 1); ctx.save(); ctx.globalAlpha = al; ctx.translate(pa.x, pa.y); ctx.rotate(pa.rot); ctx.fillStyle = "rgb(" + pa.rgb + ")"; ctx.fillRect(-pa.w / 2, -pa.h / 2, pa.w, pa.h); ctx.restore(); }
      ctx.globalAlpha = 1;
      // pops
      ctx.textAlign = "center";
      for (var q = 0; q < game.pops.length; q++) { var po = game.pops[q], aa = clamp(po.life / 0.8, 0, 1); ctx.globalAlpha = aa; ctx.font = "900 " + Math.round(M.sr * 0.9) + "px system-ui, sans-serif"; ctx.fillStyle = po.c; ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 3; ctx.strokeText(po.t, po.x, po.y); ctx.fillText(po.t, po.x, po.y); }
      ctx.globalAlpha = 1;
      if (game.flash > 0) { ctx.fillStyle = "rgba(" + game.flashColor + "," + (game.flash * 0.4) + ")"; ctx.fillRect(-40, -40, W + 80, H + 80); }
    }
  }

  // ---------- HUD ----------
  function updateLives() { var h = ""; for (var i = 0; i < 3; i++) h += '<span class="heart' + (i < (game ? game.lives : 3) ? "" : " lost") + '">📣</span>'; livesEl.innerHTML = h; }
  function updateHud() { scoreEl.textContent = Math.round(game.displayScore); bestEl.textContent = "最高 " + best; }
  function showBanner(text) { bannerEl.textContent = text; bannerEl.classList.remove("show"); void bannerEl.offsetWidth; bannerEl.classList.add("show"); }

  // ---------- loop ----------
  var lastT = 0;
  function loop(tms) {
    requestAnimationFrame(loop);
    var t = tms / 1000, dt = Math.min(t - lastT, 0.033); lastT = t;
    if (STATE === "playing") { update(dt); updateHud(); }
    render();
  }

  // ---------- transitions ----------
  function show(el) { el.classList.remove("hidden"); }
  function hide(el) { el.classList.add("hidden"); }
  function goTitle() { STATE = "title"; hide(hud); show(titleScreen); hide(pauseScreen); hide(overScreen); titleBest.textContent = "最高 " + best; game = null; }
  function pauseGame() { if (STATE !== "playing") return; STATE = "paused"; show(pauseScreen); try { bgm.pause(); } catch (e) {} }
  function resumeGame() { if (STATE !== "paused") return; STATE = "playing"; hide(pauseScreen); lastT = performance.now() / 1000; playBgm(); }

  // ---------- input ----------
  var aiming = false, aimStart = { x: 0, y: 0 }, aimCur = { x: 0, y: 0 };
  function relPos(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  canvas.addEventListener("pointerdown", function (e) {
    e.preventDefault(); if (STATE !== "playing" || game.flying) return;
    aiming = true; aimStart = relPos(e); aimCur = aimStart;
  }, { passive: false });
  canvas.addEventListener("pointermove", function (e) { if (!aiming) return; e.preventDefault(); aimCur = relPos(e); }, { passive: false });
  function endAim(e) {
    if (!aiming) return; aiming = false;
    var pull = { x: aimStart.x - aimCur.x, y: aimStart.y - aimCur.y };
    var dist = Math.hypot(pull.x, pull.y);
    if (dist >= 10) launch(pull.x, pull.y, dist);
  }
  canvas.addEventListener("pointerup", function (e) { e.preventDefault(); endAim(e); }, { passive: false });
  canvas.addEventListener("pointercancel", function () { aiming = false; });
  window.addEventListener("keydown", function (e) {
    if (e.code === "Space" && (STATE === "title" || STATE === "gameover")) startGame();
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
        info: function () { return game ? { score: game.score, lives: game.lives, students: game.students.length, bombs: game.bombs.length, combo: game.combo, maxCombo: game.maxCombo, flying: game.flying, over: game.over } : null; },
        fling: function (dx, dy, p) { launch(dx, dy, p || M.maxPull); },
        drain: function () { if (game) { game.lives = 1; var b = game.bombs[0] || { x: game.px, y: game.py }; hitBomb(b); } }
      };
    }
    preload(function (pct) { var p = Math.round(pct * 100); loaderFill.style.width = p + "%"; loaderText.textContent = "素材加载中… " + p + "%"; })
      .then(function () { loaderText.textContent = "准备就绪！"; setTimeout(function () { hide(loadingScreen); goTitle(); }, 350); });
  }
  boot();
})();
