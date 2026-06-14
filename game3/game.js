/* 张雪峰 · 霓虹弹弹弹 — neon synthwave brick breaker
   Vanilla canvas. Mobile-first. BGM/death audio reused from the original site. */
(function () {
  "use strict";

  var stage = document.getElementById("stage");
  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");

  var hud = document.getElementById("hud");
  var scoreEl = document.getElementById("score");
  var bestEl = document.getElementById("best");
  var ballsEl = document.getElementById("balls");
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
  var finalLevel = document.getElementById("finalLevel");
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
    M.paddleW = clamp(W * 0.27, 84, 168);
    M.paddleH = clamp(H * 0.016, 11, 16);
    M.paddleY = H - clamp(H * 0.12, 74, 130);
    M.ballR = clamp(Math.min(W, H) * 0.018, 7, 11);
    M.baseSpeed = clamp(H * 0.6, 300, 600);
    M.cols = clamp(Math.round(W / 62), 5, 8);
    M.brickGap = 6;
    M.brickTop = H * 0.13;
    M.sideMargin = W * 0.045;
    M.brickW = (W - 2 * M.sideMargin - (M.cols - 1) * M.brickGap) / M.cols;
    M.brickH = clamp(H * 0.03, 18, 28);
    M.avatarH = clamp(H * 0.12, 64, 120);
    if (game && game.paddle) { game.paddle.w = M.paddleW; game.paddle.y = M.paddleY; }
  }

  // ---------- assets ----------
  var IMG = {};
  var imgList = [
    ["zhang", "assets/neon-zhang.png"], ["sprite", "assets/neon-sprite.png"],
    ["ice", "assets/neon-ice.png"], ["letter", "assets/neon-letter.png"], ["bomb", "assets/neon-bomb.png"]
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
    var bp = actx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = freq || 1200; bp.Q.value = 0.7;
    var g = actx.createGain(); g.gain.value = vol || 0.3; src.connect(bp); bp.connect(g); g.connect(masterGain); src.start();
  }
  var sfx = {
    brick: function (c) { blip(420 + Math.min(c, 30) * 22, 0.07, "square", 0.16, 700 + Math.min(c, 30) * 26); },
    paddle: function () { blip(240, 0.07, "triangle", 0.22, 360); },
    power: function () { blip(700, 0.1, "sine", 0.25, 1200); setTimeout(function () { blip(1100, 0.12, "sine", 0.2, 1500); }, 60); },
    bad: function () { blip(300, 0.16, "sawtooth", 0.22, 90); },
    boom: function () { noiseBurst(0.3, 0.45, 300); blip(110, 0.4, "sawtooth", 0.35, 40); },
    level: function () { [523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { blip(f, 0.22, "sine", 0.18, f * 1.4); }, i * 80); }); },
    lose: function () { blip(300, 0.5, "sawtooth", 0.3, 70); }
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
  try { best = Number(localStorage.getItem("zxf-neon-best") || 0) || 0; } catch (e) {}
  try { muted = localStorage.getItem("zxf-muted") === "1"; } catch (e) {}

  var game = null;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  // brick kinds
  var BK = {
    sprite: { img: "sprite", c: "#26f0ff", c2: "#1fa9c9", score: 50 },
    ice:    { img: "ice",    c: "#ff8a3d", c2: "#c95a1f", score: 50 },
    letter: { img: "letter", c: "#ffd23f", c2: "#c79a1e", score: 150, alwaysDrop: "good" },
    bomb:   { img: "bomb",   c: "#ff3b6b", c2: "#b8244a", score: 80, explode: true }
  };

  function newGame() {
    return {
      score: 0, displayScore: 0, lives: 3, level: 1,
      paddle: { x: W / 2, tx: W / 2, w: M.paddleW, y: M.paddleY, wide: 0, shrink: 0 },
      balls: [], bricks: [], drops: [], particles: [], pops: [], trail: [],
      combo: 0, maxCombo: 0, speedScale: 1, slow: 0,
      shake: 0, flash: 0, flashColor: "38,240,255", launched: false, over: false
    };
  }

  function buildLevel() {
    game.bricks = [];
    var rows = Math.min(4 + Math.floor((game.level - 1) / 2), 8);
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < M.cols; c++) {
        var roll = Math.random();
        var kind;
        if (roll < 0.06) kind = "bomb";
        else if (roll < 0.14) kind = "letter";
        else kind = (c % 2 === 0) ? "sprite" : "ice";
        var x = M.sideMargin + c * (M.brickW + M.brickGap);
        var y = M.brickTop + r * (M.brickH + M.brickGap);
        game.bricks.push({ x: x, y: y, w: M.brickW, h: M.brickH, kind: kind, alive: true, hitT: 0 });
      }
    }
  }

  function resetBall() {
    game.balls = [{ x: game.paddle.x, y: game.paddle.y - M.ballR - 2, vx: 0, vy: 0, r: M.ballR, stuck: true }];
    game.launched = false;
    game.trail = [];
    if (tapHint) tapHint.style.display = "";
  }

  function startGame() {
    initAudioCtx(); resumeAudio();
    game = newGame();
    buildLevel(); resetBall();
    updateLives(); updateHud();
    comboChip.classList.add("hidden");
    STATE = "playing";
    hide(titleScreen); hide(overScreen); hide(pauseScreen); show(hud);
    playBgm();
    showBanner("第 1 关", "linear-gradient(180deg,#fff,#26f0ff)");
  }

  function launch() {
    if (!game.launched) {
      var any = false;
      for (var i = 0; i < game.balls.length; i++) {
        var b = game.balls[i];
        if (b.stuck) { b.stuck = false; var ang = rand(-0.5, 0.5); b.vx = Math.sin(ang); b.vy = -Math.cos(ang); var sp = ballSpeed(); b.vx *= sp; b.vy *= sp; any = true; }
      }
      if (any) { game.launched = true; if (tapHint) tapHint.style.display = "none"; sfx.paddle(); }
    }
  }
  function ballSpeed() { return (M.baseSpeed + (game.level - 1) * 22) * (game.slow > 0 ? 0.6 : 1); }

  // ---------- powerups ----------
  function maybeDrop(brick) {
    var bk = BK[brick.kind];
    var make = null;
    if (bk.alwaysDrop === "good") make = Math.random() < 0.5 ? "multi" : "cool";
    else if (brick.kind === "bomb") { if (Math.random() < 0.5) make = "bad"; }
    else if (Math.random() < 0.16) { var r = Math.random(); make = r < 0.45 ? "cool" : (r < 0.78 ? "multi" : "bad"); }
    if (make) game.drops.push({ x: brick.x + brick.w / 2, y: brick.y + brick.h / 2, vy: H * 0.28, kind: make, r: M.brickH * 0.5 });
  }
  function applyPower(kind) {
    if (kind === "cool") { game.slow = 4.5; game.paddle.wide = 5; game.flash = 0.4; game.flashColor = "125,255,90"; sfx.power(); showBanner("透心凉·慢放!", "linear-gradient(180deg,#fff,#7dff5a)"); }
    else if (kind === "multi") { multiball(); game.flash = 0.4; game.flashColor = "255,210,63"; sfx.power(); showBanner("录取通知·多球!", "linear-gradient(180deg,#fff,#ffd23f)"); }
    else if (kind === "bad") { game.paddle.shrink = 5; game.shake = 0.5; game.flash = 0.4; game.flashColor = "255,59,107"; sfx.bad(); showBanner("天坑·挡板缩小!", "linear-gradient(180deg,#ffb4c6,#ff3b6b)"); }
  }
  function multiball() {
    var add = [];
    for (var i = 0; i < game.balls.length; i++) {
      var b = game.balls[i]; if (b.stuck) continue;
      for (var k = 0; k < 2; k++) {
        var ang = rand(-0.7, 0.7), sp = ballSpeed();
        add.push({ x: b.x, y: b.y, vx: Math.sin(ang) * sp, vy: -Math.abs(Math.cos(ang)) * sp, r: b.r, stuck: false });
      }
    }
    for (var j = 0; j < add.length && game.balls.length < 9; j++) game.balls.push(add[j]);
  }

  // ---------- collisions ----------
  function hitBrick(brick) {
    brick.alive = false; brick.hitT = 0;
    game.combo++;
    game.maxCombo = Math.max(game.maxCombo, game.combo);
    var bk = BK[brick.kind];
    var gained = bk.score + game.combo * 5;
    game.score += gained;
    addPop(brick.x + brick.w / 2, brick.y + brick.h / 2, "+" + gained, bk.c);
    burst(brick.x + brick.w / 2, brick.y + brick.h / 2, bk.c);
    sfx.brick(game.combo);
    if (game.combo >= 2) { comboNum.textContent = game.combo; comboChip.classList.remove("hidden"); comboChip.classList.remove("pop"); void comboChip.offsetWidth; comboChip.classList.add("pop"); }
    maybeDrop(brick);
    if (bk.explode) explode(brick);
    if (aliveBricks() === 0) nextLevel();
  }
  function explode(brick) {
    game.shake = 0.6; game.flash = 0.5; game.flashColor = "255,59,107";
    sfx.boom();
    var cx = brick.x + brick.w / 2, cy = brick.y + brick.h / 2, R = M.brickW * 2.1;
    for (var i = 0; i < game.bricks.length; i++) {
      var o = game.bricks[i];
      if (!o.alive) continue;
      var dx = (o.x + o.w / 2) - cx, dy = (o.y + o.h / 2) - cy;
      if (dx * dx + dy * dy <= R * R) {
        o.alive = false;
        game.score += BK[o.kind].score;
        burst(o.x + o.w / 2, o.y + o.h / 2, BK[o.kind].c);
      }
    }
    for (var p = 0; p < 26; p++) { var a = rand(0, Math.PI * 2), s = rand(80, 360); game.particles.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: rand(2, 6), life: rand(0.4, 0.8), maxlife: 0.8, c: p % 2 ? "255,160,60" : "255,59,107" }); }
    if (aliveBricks() === 0) nextLevel();
  }
  function aliveBricks() { var n = 0; for (var i = 0; i < game.bricks.length; i++) if (game.bricks[i].alive) n++; return n; }

  function nextLevel() {
    game.level++;
    sfx.level();
    showBanner("第 " + game.level + " 关", "linear-gradient(180deg,#fff,#26f0ff)");
    game.drops = [];
    buildLevel();
    resetBall();
    game.combo = 0; comboChip.classList.add("hidden");
  }

  function loseLife() {
    game.lives--;
    updateLives();
    game.combo = 0; comboChip.classList.add("hidden");
    game.shake = 0.5; game.flash = 0.4; game.flashColor = "255,59,107";
    if (game.lives <= 0) { gameOver(); return; }
    sfx.lose();
    resetBall();
  }

  function gameOver() {
    if (game.over) return;
    game.over = true; STATE = "gameover";
    best = Math.max(best, game.score);
    try { localStorage.setItem("zxf-neon-best", String(best)); } catch (e) {}
    sfx.lose();
    if (!muted) { try { deathSfx.currentTime = 0; deathSfx.play().catch(function () {}); } catch (e) {} }
    finalScore.textContent = game.score; finalBest.textContent = best; finalLevel.textContent = game.level;
    quoteEl.textContent = QUOTES[(Math.random() * QUOTES.length) | 0];
    setTimeout(function () { hide(hud); show(overScreen); }, 500);
    try { bgm.pause(); } catch (e) {}
  }
  var QUOTES = ["“反弹人生，稳准狠！”", "“这球，我接得住！”", "“别慌，下一关稳了！”", "“霓虹一闪，全清场！”", "“手感来了，谁也挡不住！”"];

  // ---------- particles ----------
  function burst(x, y, c) {
    for (var i = 0; i < 12; i++) { var a = rand(0, Math.PI * 2), s = rand(60, 260); game.particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: rand(2, 5), life: rand(0.3, 0.6), maxlife: 0.6, c: c.replace("#", "") && hexToRgb(c) }); }
  }
  function hexToRgb(h) { h = h.replace("#", ""); var n = parseInt(h, 16); return ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255); }
  function addPop(x, y, t, c) { game.pops.push({ x: x, y: y, t: t, c: c, life: 0.9, vy: -60 }); }

  // ---------- update ----------
  function update(dt) {
    var p = game.paddle;
    // paddle width modifiers
    var baseW = M.paddleW;
    if (p.wide > 0) { p.wide -= dt; baseW *= 1.55; }
    if (p.shrink > 0) { p.shrink -= dt; baseW *= 0.62; }
    p.w += (baseW - p.w) * Math.min(1, dt * 10);
    p.x += (p.tx - p.x) * Math.min(1, dt * 18);
    p.x = clamp(p.x, p.w / 2, W - p.w / 2);
    if (game.slow > 0) game.slow -= dt;

    if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 2);
    if (game.flash > 0) game.flash = Math.max(0, game.flash - dt * 2.4);

    // brick hit anim
    for (var bi = 0; bi < game.bricks.length; bi++) if (!game.bricks[bi].alive) game.bricks[bi].hitT += dt;

    // balls
    for (var i = game.balls.length - 1; i >= 0; i--) {
      var b = game.balls[i];
      if (b.stuck) { b.x = p.x; b.y = p.y - b.r - 2; continue; }
      // normalize speed to target
      var target = ballSpeed();
      var cur = Math.hypot(b.vx, b.vy) || 1;
      var f = target / cur; b.vx *= f; b.vy *= f;

      var steps = Math.max(1, Math.ceil((cur * dt) / (M.ballR)));
      steps = Math.min(steps, 4);
      var sdt = dt / steps;
      var dead = false;
      for (var st = 0; st < steps; st++) {
        b.x += b.vx * sdt; b.y += b.vy * sdt;
        // walls
        if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx); }
        if (b.x + b.r > W) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
        if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy); }
        // paddle
        if (b.vy > 0 && b.y + b.r >= p.y && b.y - b.r <= p.y + M.paddleH && b.x >= p.x - p.w / 2 - b.r && b.x <= p.x + p.w / 2 + b.r) {
          b.y = p.y - b.r;
          var off = clamp((b.x - p.x) / (p.w / 2), -1, 1);
          var ang = off * 1.05; // up to ~60deg
          var sp = ballSpeed();
          b.vx = Math.sin(ang) * sp; b.vy = -Math.cos(ang) * sp;
          game.combo = 0; comboChip.classList.add("hidden");
          sfx.paddle();
        }
        // bricks
        for (var k = 0; k < game.bricks.length; k++) {
          var br = game.bricks[k];
          if (!br.alive) continue;
          if (b.x + b.r > br.x && b.x - b.r < br.x + br.w && b.y + b.r > br.y && b.y - b.r < br.y + br.h) {
            // reflect by smaller penetration axis
            var penX = Math.min(b.x + b.r - br.x, br.x + br.w - (b.x - b.r));
            var penY = Math.min(b.y + b.r - br.y, br.y + br.h - (b.y - b.r));
            if (penX < penY) { b.vx = -b.vx; b.x += (b.vx > 0 ? penX : -penX); }
            else { b.vy = -b.vy; b.y += (b.vy > 0 ? penY : -penY); }
            hitBrick(br);
            break;
          }
        }
        if (b.y - b.r > H + 6) { dead = true; break; }
      }
      if (dead) { game.balls.splice(i, 1); }
    }
    // trail of first ball
    if (game.balls.length) { var fb = game.balls[0]; if (!fb.stuck) { game.trail.push({ x: fb.x, y: fb.y }); if (game.trail.length > 12) game.trail.shift(); } }
    // out of balls -> lose life
    if (game.launched && game.balls.length === 0 && !game.over) loseLife();

    // drops
    for (var d = game.drops.length - 1; d >= 0; d--) {
      var dr = game.drops[d];
      dr.y += dr.vy * dt;
      // catch
      if (dr.y + dr.r >= p.y && dr.y - dr.r <= p.y + M.paddleH && dr.x >= p.x - p.w / 2 && dr.x <= p.x + p.w / 2) {
        applyPower(dr.kind); game.drops.splice(d, 1); continue;
      }
      if (dr.y - dr.r > H + 20) game.drops.splice(d, 1);
    }

    // particles / pops
    for (var q = game.particles.length - 1; q >= 0; q--) { var pa = game.particles[q]; pa.vy += 500 * dt; pa.x += pa.vx * dt; pa.y += pa.vy * dt; pa.life -= dt; if (pa.life <= 0) game.particles.splice(q, 1); }
    for (var w = game.pops.length - 1; w >= 0; w--) { var po = game.pops[w]; po.y += po.vy * dt; po.vy *= 0.92; po.life -= dt; if (po.life <= 0) game.pops.splice(w, 1); }

    game.displayScore += (game.score - game.displayScore) * Math.min(1, dt * 12);
    if (Math.abs(game.score - game.displayScore) < 0.6) game.displayScore = game.score;
  }

  // ---------- render ----------
  function drawBackground() {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#1a0a3a"); g.addColorStop(0.5, "#0a0420"); g.addColorStop(1, "#05020f");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // sun glow
    var t = performance.now() / 1000;
    var sg = ctx.createRadialGradient(W / 2, H * 0.2, 10, W / 2, H * 0.2, Math.min(W, H) * 0.5);
    sg.addColorStop(0, "rgba(255,43,214,0.18)"); sg.addColorStop(1, "rgba(255,43,214,0)");
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    // floor grid
    ctx.strokeStyle = "rgba(155,92,255,0.22)"; ctx.lineWidth = 1.5;
    var horizon = H * 0.66;
    for (var r = 0; r < 14; r++) { var yy = horizon + r * r * 2.4; if (yy > H) break; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke(); }
    for (var c = -7; c <= 7; c++) { ctx.beginPath(); ctx.moveTo(W / 2 + c * 22, horizon); ctx.lineTo(W / 2 + c * W * 0.18, H); ctx.stroke(); }
    // avatar bottom-left, faint
    var im = IMG.zhang;
    if (im && im.naturalWidth) {
      var h = M.avatarH, w = h * (im.naturalWidth / im.naturalHeight);
      ctx.globalAlpha = 0.85;
      ctx.drawImage(im, 6, H - h - 4 + Math.sin(t * 2) * 3, w, h);
      ctx.globalAlpha = 1;
    }
  }

  function roundRect(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function drawBricks() {
    for (var i = 0; i < game.bricks.length; i++) {
      var br = game.bricks[i];
      if (!br.alive) continue;
      var bk = BK[br.kind];
      ctx.save();
      ctx.shadowColor = bk.c; ctx.shadowBlur = 14;
      var grad = ctx.createLinearGradient(0, br.y, 0, br.y + br.h);
      grad.addColorStop(0, "rgba(10,6,30,0.65)"); grad.addColorStop(1, "rgba(10,6,30,0.35)");
      roundRect(br.x, br.y, br.w, br.h, 6); ctx.fillStyle = grad; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = bk.c; ctx.stroke();
      ctx.shadowBlur = 0;
      // icon
      var im = IMG[bk.img];
      if (im && im.naturalWidth) {
        var ih = br.h * 0.96, iw = ih * (im.naturalWidth / im.naturalHeight);
        if (iw > br.w * 0.92) { iw = br.w * 0.92; ih = iw * (im.naturalHeight / im.naturalWidth); }
        ctx.globalAlpha = 0.95;
        ctx.drawImage(im, br.x + br.w / 2 - iw / 2, br.y + br.h / 2 - ih / 2, iw, ih);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
  }

  function drawPaddle() {
    var p = game.paddle;
    ctx.save();
    ctx.shadowColor = "#26f0ff"; ctx.shadowBlur = 18;
    var grad = ctx.createLinearGradient(0, p.y, 0, p.y + M.paddleH);
    grad.addColorStop(0, "#9bf6ff"); grad.addColorStop(1, "#26a8ff");
    roundRect(p.x - p.w / 2, p.y, p.w, M.paddleH, M.paddleH / 2); ctx.fillStyle = grad; ctx.fill();
    ctx.restore();
  }

  function drawBalls() {
    // trail
    for (var t = 0; t < game.trail.length; t++) {
      var pt = game.trail[t], a = t / game.trail.length;
      ctx.globalAlpha = a * 0.4;
      ctx.fillStyle = "#9bf6ff";
      ctx.beginPath(); ctx.arc(pt.x, pt.y, M.ballR * a, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (var i = 0; i < game.balls.length; i++) {
      var b = game.balls[i];
      ctx.save(); ctx.shadowColor = "#26f0ff"; ctx.shadowBlur = 16;
      ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  function drawDrops() {
    for (var i = 0; i < game.drops.length; i++) {
      var dr = game.drops[i];
      var key = dr.kind === "cool" ? "sprite" : dr.kind === "multi" ? "letter" : "bomb";
      var im = IMG[key];
      var s = dr.r * 2.2;
      ctx.save(); ctx.shadowColor = dr.kind === "bad" ? "#ff3b6b" : "#7dff5a"; ctx.shadowBlur = 14;
      if (im && im.naturalWidth) ctx.drawImage(im, dr.x - s / 2, dr.y - s / 2, s, s * (im.naturalHeight / im.naturalWidth));
      ctx.restore();
    }
  }

  function drawParticles() {
    for (var i = 0; i < game.particles.length; i++) {
      var p = game.particles[i], a = clamp(p.life / p.maxlife, 0, 1);
      ctx.globalAlpha = a; ctx.fillStyle = "rgba(" + (p.c || "255,255,255") + ",1)";
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function drawPops() {
    ctx.textAlign = "center";
    for (var i = 0; i < game.pops.length; i++) {
      var po = game.pops[i], a = clamp(po.life / 0.9, 0, 1);
      ctx.globalAlpha = a; ctx.font = "900 " + Math.round(M.brickH * 0.7) + "px system-ui, sans-serif";
      ctx.fillStyle = po.c; ctx.shadowColor = po.c; ctx.shadowBlur = 8;
      ctx.fillText(po.t, po.x, po.y); ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }

  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (game && game.shake > 0) { var m = game.shake * 12; ctx.translate(rand(-m, m), rand(-m, m)); }
    drawBackground();
    if (game) {
      drawBricks(); drawDrops(); drawPaddle(); drawBalls(); drawParticles(); drawPops();
      if (game.flash > 0) { ctx.fillStyle = "rgba(" + game.flashColor + "," + (game.flash * 0.4) + ")"; ctx.fillRect(-40, -40, W + 80, H + 80); }
    }
  }

  // ---------- HUD ----------
  function updateLives() {
    var html = ""; for (var i = 0; i < 3; i++) html += '<span class="ball-dot' + (i < (game ? game.lives : 3) ? "" : " lost") + '"></span>';
    ballsEl.innerHTML = html;
  }
  function updateHud() { scoreEl.textContent = Math.round(game.displayScore); bestEl.textContent = "最高 " + best + " · 第" + game.level + "关"; }
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
  function relX(e) { var r = canvas.getBoundingClientRect(); return e.clientX - r.left; }
  function pointerDown(e) { if (STATE !== "playing") return; game.paddle.tx = clamp(relX(e), game.paddle.w / 2, W - game.paddle.w / 2); launch(); }
  function pointerMove(e) { if (STATE !== "playing" || !game) return; game.paddle.tx = clamp(relX(e), game.paddle.w / 2, W - game.paddle.w / 2); }
  canvas.addEventListener("pointerdown", function (e) { e.preventDefault(); pointerDown(e); }, { passive: false });
  canvas.addEventListener("pointermove", function (e) { e.preventDefault(); pointerMove(e); }, { passive: false });
  window.addEventListener("keydown", function (e) {
    if (e.code === "Space") { e.preventDefault(); if (STATE === "playing") launch(); else if (STATE === "title" || STATE === "gameover") startGame(); }
    if (e.code === "ArrowLeft" && game && STATE === "playing") game.paddle.tx = clamp(game.paddle.x - W * 0.12, game.paddle.w / 2, W - game.paddle.w / 2);
    if (e.code === "ArrowRight" && game && STATE === "playing") game.paddle.tx = clamp(game.paddle.x + W * 0.12, game.paddle.w / 2, W - game.paddle.w / 2);
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
        info: function () { return game ? { score: game.score, lives: game.lives, level: game.level, balls: game.balls.length, bricks: aliveBricks(), drops: game.drops.length } : null; },
        launch: function () { launch(); },
        clearLevel: function () { if (game) { for (var i = 0; i < game.bricks.length; i++) game.bricks[i].alive = false; nextLevel(); } },
        killBall: function () { if (game) game.balls = []; },
        power: function (k) { applyPower(k); }
      };
    }
    preload(function (pct) { var p = Math.round(pct * 100); loaderFill.style.width = p + "%"; loaderText.textContent = "素材加载中… " + p + "%"; })
      .then(function () { loaderText.textContent = "准备就绪！"; setTimeout(function () { hide(loadingScreen); goTitle(); }, 350); });
  }
  boot();
})();
