/* 张雪峰 · 神点拨 — chalkboard tap-defense (original mechanic)
   Tap drifting "迷茫" students to 点醒 them; a chalk shockwave chains to nearby students.
   Protect 张雪峰's 耐心. Vanilla canvas. BGM/death audio reused from the original site. */
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
  var patienceFill = document.getElementById("patienceFill");
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
  var finalChain = document.getElementById("finalChain");
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
    M.size = clamp(Math.min(W, H) * 0.14, 56, 116);
    M.r = M.size * 0.46;
    M.chainR = M.size * 1.75;
    M.heroH = clamp(H * 0.2, 108, 220);
    M.reachY = H - M.heroH * 0.46;
  }

  // ---------- assets ----------
  var IMG = {};
  var imgList = [
    ["zhang", "assets/chalk-zhang.png"], ["student", "assets/chalk-student.png"],
    ["sprite", "assets/chalk-sprite.png"], ["ice", "assets/chalk-ice.png"], ["bomb", "assets/chalk-bomb.png"]
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
    var bp = actx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = freq || 1000; bp.Q.value = 0.7;
    var g = actx.createGain(); g.gain.value = vol || 0.3; src.connect(bp); bp.connect(g); g.connect(masterGain); src.start();
  }
  var sfx = {
    wake: function (n) { blip(440 + Math.min(n, 16) * 55, 0.09, "triangle", 0.2, 760 + Math.min(n, 16) * 80); },
    sprite: function () { [523, 784, 1046].forEach(function (f, i) { setTimeout(function () { blip(f, 0.16, "sine", 0.2, f * 1.4); }, i * 60); }); },
    ice: function () { blip(880, 0.16, "sine", 0.22, 440); },
    bomb: function () { noiseBurst(0.32, 0.45, 260); blip(120, 0.4, "sawtooth", 0.35, 40); },
    reach: function () { blip(200, 0.14, "sawtooth", 0.16, 120); },
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
  try { best = Number(localStorage.getItem("zxf-dianbo-best") || 0) || 0; } catch (e) {}
  try { muted = localStorage.getItem("zxf-muted") === "1"; } catch (e) {}

  var game = null;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  function newGame() {
    return {
      score: 0, displayScore: 0, patience: 100, time: 0,
      combo: 0, maxChain: 0, spawnTimer: 0.7, slow: 0,
      ents: [], parts: [], pops: [], bolts: [],
      heroPop: 0, shake: 0, flash: 0, flashColor: "255,138,122", over: false,
      lastWakeT: -9
    };
  }

  function startGame() {
    initAudioCtx(); resumeAudio();
    game = newGame();
    updateHud();
    patienceFill.classList.remove("low");
    comboChip.classList.add("hidden");
    STATE = "playing";
    hide(titleScreen); hide(overScreen); hide(pauseScreen); show(hud);
    if (tapHint) tapHint.style.display = "";
    playBgm();
    showBanner("上 课!");
  }

  // ---------- spawning ----------
  function spawnOne() {
    var lvl = Math.min(game.time / 16, 7);
    var bombCh = clamp(0.08 + lvl * 0.028, 0.08, 0.32);
    var spriteCh = 0.05, iceCh = 0.05;
    var roll = Math.random(), type;
    if (roll < bombCh) type = "bomb";
    else if (roll < bombCh + spriteCh) type = "sprite";
    else if (roll < bombCh + spriteCh + iceCh) type = "ice";
    else type = "student";

    var im = IMG[type];
    var size = M.size * (type === "student" ? 1 : 0.92);
    var ar = im && im.naturalWidth ? im.naturalWidth / im.naturalHeight : 0.8;
    var w, h; if (ar >= 1) { w = size; h = size / ar; } else { h = size; w = size * ar; }
    var margin = W * 0.13;
    var x = rand(margin, W - margin);
    var vy = (H * (0.105 + lvl * 0.012));
    game.ents.push({
      type: type, img: im, x: x, y: -size, w: w, h: h, r: M.r,
      vy: vy, baseX: x, wobA: rand(8, 26), wobF: rand(1.2, 2.4), phase: rand(0, 6.28),
      rot: rand(-0.18, 0.18), state: "live", wakeT: 0
    });
    var gap = clamp(1.15 - lvl * 0.085, 0.42, 1.15);
    game.spawnTimer = gap + rand(-0.1, 0.15);
    if (lvl > 3 && Math.random() < 0.3) game.spawnTimer *= 0.6; // occasional bursts
  }

  // ---------- tap ----------
  function tapAt(px, py) {
    if (STATE !== "playing") return;
    // find nearest live entity within hit radius
    var best = null, bestD = 1e9;
    for (var i = 0; i < game.ents.length; i++) {
      var e = game.ents[i]; if (e.state !== "live") continue;
      var d = Math.hypot(e.x - px, e.y - py);
      if (d <= e.r * 1.15 && d < bestD) { bestD = d; best = e; }
    }
    if (!best) return;
    if (tapHint) tapHint.style.display = "none";

    if (best.type === "bomb") { tapBomb(best); return; }
    if (best.type === "sprite") { useSprite(best); return; }
    if (best.type === "ice") { useIce(best); return; }
    // student -> wake + chain
    var mult = game.slow > 0 ? 2 : 1;
    var t = game.time;
    if (t - game.lastWakeT < 1.0) game.combo++; else game.combo = 1;
    game.lastWakeT = t;

    var chain = chainWake(best, mult);
    game.maxChain = Math.max(game.maxChain, chain);
    game.heroPop = 1;
    if (chain >= 2) { showBanner("连锁 " + chain + " 醒!"); }
    if (game.combo >= 2) { comboNum.textContent = game.combo; comboChip.classList.remove("hidden"); comboChip.classList.remove("pop"); void comboChip.offsetWidth; comboChip.classList.add("pop"); }
  }

  function chainWake(start, mult) {
    var queue = [start], chained = 0;
    start._q = true;
    while (queue.length) {
      var e = queue.shift();
      wakeStudent(e, chained, mult);
      chained++;
      for (var i = 0; i < game.ents.length; i++) {
        var o = game.ents[i];
        if (o.state !== "live" || o.type !== "student" || o._q) continue;
        if (Math.hypot(o.x - e.x, o.y - e.y) <= M.chainR) {
          o._q = true; queue.push(o);
          game.bolts.push({ x1: e.x, y1: e.y, x2: o.x, y2: o.y, life: 0.22 });
        }
      }
      if (chained >= 40) break; // safety
    }
    // clear marks
    for (var k = 0; k < game.ents.length; k++) game.ents[k]._q = false;
    return chained;
  }

  function wakeStudent(e, chainIdx, mult) {
    e.state = "woken"; e.wakeT = 0;
    var base = 10 + chainIdx * 4;
    var gained = base * mult;
    game.score += gained;
    game.patience = Math.min(100, game.patience + 1.5);
    sfx.wake(chainIdx + game.combo);
    burst(e.x, e.y, "244,241,232", 10);
    addPop(e.x, e.y, "+" + gained, "#ffe27a");
  }

  function tapBomb(e) {
    e.state = "dead";
    game.patience = Math.max(0, game.patience - 22);
    game.combo = 0; comboChip.classList.add("hidden");
    game.shake = 0.7; game.flash = 0.7; game.flashColor = "255,90,80";
    sfx.bomb();
    if (!muted) { try { deathSfx.currentTime = 0; deathSfx.play().catch(function () {}); } catch (er) {} }
    burst(e.x, e.y, "255,120,90", 22);
    showBanner("点到天坑!");
    removeEnt(e);
    checkOver();
  }

  function useSprite(e) {
    e.state = "dead"; removeEnt(e);
    game.flash = 0.6; game.flashColor = "150,230,160";
    game.patience = Math.min(100, game.patience + 10);
    sfx.sprite();
    var woke = 0;
    for (var i = 0; i < game.ents.length; i++) { var o = game.ents[i]; if (o.state === "live" && o.type === "student") { wakeStudent(o, woke, game.slow > 0 ? 2 : 1); woke++; } }
    game.maxChain = Math.max(game.maxChain, woke);
    showBanner("雪碧·全场清醒!");
  }
  function useIce(e) {
    e.state = "dead"; removeEnt(e);
    game.slow = 5; game.flash = 0.5; game.flashColor = "150,215,255";
    sfx.ice();
    showBanner("巧乐兹·慢放双倍!");
  }

  function removeEnt(e) { var i = game.ents.indexOf(e); if (i >= 0) game.ents.splice(i, 1); }

  function checkOver() { if (game.patience <= 0 && !game.over) gameOver(); }

  function gameOver() {
    game.over = true; STATE = "gameover";
    best = Math.max(best, game.score);
    try { localStorage.setItem("zxf-dianbo-best", String(best)); } catch (e) {}
    sfx.over();
    if (!muted) { try { deathSfx.currentTime = 0; deathSfx.play().catch(function () {}); } catch (e) {} }
    finalScore.textContent = game.score; finalBest.textContent = best; finalChain.textContent = game.maxChain;
    quoteEl.textContent = QUOTES[(Math.random() * QUOTES.length) | 0];
    game.shake = 0.6;
    setTimeout(function () { hide(hud); show(overScreen); }, 550);
    try { bgm.pause(); } catch (e) {}
  }
  var QUOTES = ["“想通了没？没想通再来一节课！”", "“别迷茫，方向比努力重要！”", "“这点耐心可不够带毕业班啊！”", "“下节课，把他们都点醒！”", "“稳住，金句管够！”"];

  // ---------- particles ----------
  function burst(x, y, rgb, n) {
    for (var i = 0; i < n; i++) { var a = rand(0, Math.PI * 2), s = rand(50, 230); game.parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, r: rand(2, 5), life: rand(0.3, 0.7), maxlife: 0.7, rgb: rgb }); }
  }
  function addPop(x, y, t, c) { game.pops.push({ x: x, y: y, t: t, c: c, life: 0.8, vy: -55 }); }

  // ---------- update ----------
  function update(dt) {
    game.time += dt;
    if (game.slow > 0) game.slow -= dt;
    if (game.heroPop > 0) game.heroPop = Math.max(0, game.heroPop - dt * 3);
    if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 2);
    if (game.flash > 0) game.flash = Math.max(0, game.flash - dt * 2.4);

    var tscale = game.slow > 0 ? 0.5 : 1;

    // combo expiry
    if (game.combo >= 2 && game.time - game.lastWakeT > 1.0) { game.combo = 0; comboChip.classList.add("hidden"); }

    game.spawnTimer -= dt * tscale;
    if (game.spawnTimer <= 0) spawnOne();

    for (var i = game.ents.length - 1; i >= 0; i--) {
      var e = game.ents[i];
      if (e.state === "woken") {
        e.wakeT += dt;
        e.y -= 60 * dt; // float up happily
        if (e.wakeT > 0.5) game.ents.splice(i, 1);
        continue;
      }
      e.y += e.vy * tscale * dt;
      if (e.type === "student") e.x = e.baseX + Math.sin(game.time * e.wobF + e.phase) * e.wobA;
      // reached the teacher
      if (e.y >= M.reachY) {
        if (e.type === "student") {
          game.patience = Math.max(0, game.patience - 16);
          game.combo = 0; comboChip.classList.add("hidden");
          game.shake = Math.max(game.shake, 0.3); sfx.reach();
          burst(e.x, e.y, "255,160,120", 8);
          game.ents.splice(i, 1); checkOver();
        } else if (e.y - e.h > H) {
          game.ents.splice(i, 1); // items/bombs just fall away
        }
      }
    }

    for (var p = game.parts.length - 1; p >= 0; p--) { var pa = game.parts[p]; pa.vy += 320 * dt; pa.x += pa.vx * dt; pa.y += pa.vy * dt; pa.life -= dt; if (pa.life <= 0) game.parts.splice(p, 1); }
    for (var q = game.pops.length - 1; q >= 0; q--) { var po = game.pops[q]; po.y += po.vy * dt; po.vy *= 0.92; po.life -= dt; if (po.life <= 0) game.pops.splice(q, 1); }
    for (var b = game.bolts.length - 1; b >= 0; b--) { game.bolts[b].life -= dt; if (game.bolts[b].life <= 0) game.bolts.splice(b, 1); }

    game.displayScore += (game.score - game.displayScore) * Math.min(1, dt * 12);
    if (Math.abs(game.score - game.displayScore) < 0.6) game.displayScore = game.score;

    patienceFill.classList.toggle("low", game.patience <= 30);
  }

  // ---------- render ----------
  function drawBackground() {
    var g = ctx.createRadialGradient(W / 2, H * 0.32, 20, W / 2, H * 0.5, Math.max(W, H) * 0.8);
    g.addColorStop(0, "#33503f"); g.addColorStop(0.7, "#23392c"); g.addColorStop(1, "#1a2c22");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // faint chalk smudges / scribbles
    ctx.strokeStyle = "rgba(244,241,232,0.05)"; ctx.lineWidth = 2;
    for (var i = 0; i < 6; i++) {
      var yy = (H * (0.12 + i * 0.15) + (game ? game.time * 4 : 0) % 40);
      ctx.beginPath(); ctx.moveTo(W * 0.1, yy); ctx.bezierCurveTo(W * 0.35, yy - 14, W * 0.65, yy + 14, W * 0.9, yy); ctx.stroke();
    }
    // dotted "讲台" line near the teacher
    ctx.strokeStyle = "rgba(244,241,232,0.18)"; ctx.lineWidth = 3; ctx.setLineDash([10, 10]);
    ctx.beginPath(); ctx.moveTo(W * 0.06, M.reachY); ctx.lineTo(W * 0.94, M.reachY); ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawHero() {
    var im = IMG.zhang; if (!im || !im.naturalWidth) return;
    var pop = game.heroPop;
    var h = M.heroH * (1 + pop * 0.06), w = h * (im.naturalWidth / im.naturalHeight);
    var bob = Math.sin(game.time * 3) * 4 - pop * 8;
    ctx.save(); ctx.globalAlpha = 0.98;
    ctx.drawImage(im, W / 2 - w / 2, H - h + bob + 6, w, h);
    ctx.restore();
  }

  function drawEnts() {
    for (var i = 0; i < game.ents.length; i++) {
      var e = game.ents[i];
      ctx.save();
      ctx.translate(e.x, e.y);
      if (e.state === "woken") {
        var k = clamp(e.wakeT / 0.5, 0, 1);
        ctx.globalAlpha = 1 - k; var s = 1 + k * 0.6; ctx.scale(s, s);
        // happy ring
        ctx.strokeStyle = "rgba(255,226,122," + (1 - k) + ")"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, e.r * (0.8 + k), 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.rotate(e.rot + Math.sin(game.time * 1.5 + e.phase) * 0.05);
      }
      if (e.img && e.img.naturalWidth) ctx.drawImage(e.img, -e.w / 2, -e.h / 2, e.w, e.h);
      ctx.restore();
    }
  }

  function drawBolts() {
    for (var i = 0; i < game.bolts.length; i++) {
      var b = game.bolts[i], a = clamp(b.life / 0.22, 0, 1);
      ctx.strokeStyle = "rgba(255,226,122," + a + ")"; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(b.x1, b.y1);
      var midx = (b.x1 + b.x2) / 2 + rand(-10, 10), midy = (b.y1 + b.y2) / 2 + rand(-10, 10);
      ctx.lineTo(midx, midy); ctx.lineTo(b.x2, b.y2); ctx.stroke();
    }
  }

  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (game && game.shake > 0) { var m = game.shake * 12; ctx.translate(rand(-m, m), rand(-m, m)); }
    drawBackground();
    if (game) {
      drawHero();
      drawEnts();
      drawBolts();
      for (var p = 0; p < game.parts.length; p++) { var pa = game.parts[p], a = clamp(pa.life / pa.maxlife, 0, 1); ctx.globalAlpha = a; ctx.fillStyle = "rgba(" + pa.rgb + ",1)"; ctx.beginPath(); ctx.arc(pa.x, pa.y, pa.r, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
      ctx.textAlign = "center";
      for (var q = 0; q < game.pops.length; q++) { var po = game.pops[q], aa = clamp(po.life / 0.8, 0, 1); ctx.globalAlpha = aa; ctx.font = "800 " + Math.round(M.size * 0.3) + "px 'Segoe Print', system-ui, sans-serif"; ctx.fillStyle = po.c; ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 3; ctx.strokeText(po.t, po.x, po.y); ctx.fillText(po.t, po.x, po.y); }
      ctx.globalAlpha = 1;
      if (game.flash > 0) { ctx.fillStyle = "rgba(" + game.flashColor + "," + (game.flash * 0.4) + ")"; ctx.fillRect(-40, -40, W + 80, H + 80); }
    }
  }

  // ---------- HUD ----------
  function updateHud() { scoreEl.textContent = Math.round(game.displayScore); bestEl.textContent = "最高 " + best; patienceFill.style.width = game.patience + "%"; }
  function showBanner(text) {
    bannerEl.textContent = text;
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
  function relPos(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  canvas.addEventListener("pointerdown", function (e) { e.preventDefault(); var p = relPos(e); tapAt(p.x, p.y); }, { passive: false });
  window.addEventListener("keydown", function (e) {
    if (e.code === "Space") { e.preventDefault(); if (STATE === "title" || STATE === "gameover") startGame(); }
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
        info: function () { return game ? { score: game.score, patience: Math.round(game.patience), ents: game.ents.length, combo: game.combo, maxChain: game.maxChain, over: game.over } : null; },
        tap: function (x, y) { tapAt(x, y); },
        wakeAll: function () { for (var i = 0; i < game.ents.length; i++) if (game.ents[i].state === "live" && game.ents[i].type === "student") tapAt(game.ents[i].x, game.ents[i].y); },
        spawn: function () { spawnOne(); },
        drain: function () { if (game) { game.patience = 0; checkOver(); } }
      };
    }
    preload(function (pct) { var p = Math.round(pct * 100); loaderFill.style.width = p + "%"; loaderText.textContent = "素材加载中… " + p + "%"; })
      .then(function () { loaderText.textContent = "准备就绪！"; setTimeout(function () { hide(loadingScreen); goTitle(); }, 350); });
  }
  boot();
})();
