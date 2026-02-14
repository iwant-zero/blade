(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    // ====== DEBUG ======
    const debugEl = document.getElementById("debug");
    function showDebug(msg) {
      if (!debugEl) return;
      debugEl.style.display = "block";
      debugEl.textContent = msg;
    }
    window.addEventListener("error", (e) => {
      showDebug(`JS ERROR: ${e.message}\n${e.filename}:${e.lineno}:${e.colno}`);
    });
    window.addEventListener("unhandledrejection", (e) => {
      const reason = (e && e.reason)
        ? (e.reason.stack || e.reason.message || String(e.reason))
        : "unknown";
      showDebug(`PROMISE ERROR:\n${reason}`);
    });

    // ====== DOM ======
    const canvas = document.getElementById("gameCanvas");
    if (!canvas) {
      showDebug("Canvas not found: #gameCanvas");
      return;
    }
    const ctx = canvas.getContext("2d", { alpha: false });

    const hpFill = document.getElementById("hp-fill");
    const expFill = document.getElementById("exp-fill");
    const itemMsg = document.getElementById("item-msg");
    const awkTimerUI = document.getElementById("awk-timer");
    const statsEl = document.getElementById("stats");
    const scoreEl = document.getElementById("score");
    const overlayEl = document.getElementById("overlay");
    const pauseEl = document.getElementById("pause-menu");
    const finalResultEl = document.getElementById("final-result");

    // buttons
    const btnResume = document.getElementById("btn-resume");
    const btnRestart = document.getElementById("btn-restart");
    const btnRetry = document.getElementById("btn-retry");

    // ====== CANVAS RESIZE (HiDPI) ======
    let W = 0, H = 0, DPR = 1;
    let floorY = 0;

    const player = {
      x: 200, y: 200, w: 80, h: 110,
      vx: 0, vy: 0, grounded: false, dir: 1,
      hp: 100, maxHp: 100, baseAtk: 45
    };

    function resize() {
      DPR = Math.max(1, window.devicePixelRatio || 1);
      W = Math.max(320, window.innerWidth);
      H = Math.max(240, window.innerHeight);

      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      canvas.width = Math.floor(W * DPR);
      canvas.height = Math.floor(H * DPR);

      // 좌표계를 CSS 픽셀로 고정
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

      floorY = H - 100;

      // 플레이어 위치 보정
      player.x = Math.min(Math.max(0, player.x), W - player.w);
      player.y = Math.min(player.y, floorY - player.h);
    }
    window.addEventListener("resize", resize);
    resize();
    player.x = W * 0.5 - player.w * 0.5;
    player.y = floorY - player.h;

    // ====== ASSETS ======
    const img = {
      p: new Image(), e: new Image(), b: new Image(), bg: new Image(),
      ln: new Image(),
      it_core: new Image(), it_thunder: new Image(), it_heal: new Image()
    };
    img.p.src = "assets/player.png";
    img.e.src = "assets/enemy.png";
    img.b.src = "assets/boss.png";
    img.bg.src = "assets/background.png";
    img.ln.src = "assets/lightning.png";
    img.it_core.src = "assets/item_core.png";
    img.it_thunder.src = "assets/item_thunder.png";
    img.it_heal.src = "assets/item_heal.png";

    // Audio (file:// 환경에서 막힐 수 있어 try/catch)
    let bgm = null;
    try {
      bgm = new Audio("assets/bgm.mp3");
      bgm.loop = true;
      bgm.volume = 0.4;
    } catch (e) { bgm = null; }

    // ====== STATE ======
    let isGameOver = false;
    let isPaused = false;
    let score = 0;
    let level = 1;
    let exp = 0;
    let coreStack = 0;
    let awakeningTimeLeft = 0;
    let coreColor = "#0ff";

    let enemies = [];
    let items = [];
    let lightnings = [];
    let afterimages = [];

    const keys = {};

    // ====== HELPERS ======
    function showItemNotice(text) {
      if (!itemMsg) return;
      itemMsg.innerText = text;
      itemMsg.style.display = "block";
      itemMsg.style.color = "#1a1a1a";
      setTimeout(() => { itemMsg.style.display = "none"; }, 2000);
    }

    function centerX(o) { return o.x + o.w * 0.5; }
    function centerY(o) { return o.y + o.h * 0.5; }
    function distCenter(a, b) {
      return Math.hypot(centerX(a) - centerX(b), centerY(a) - centerY(b));
    }
    function aabbOverlap(a, b) {
      return (a.x < b.x + b.w &&
              a.x + a.w > b.x &&
              a.y < b.y + b.h &&
              a.y + a.h > b.y);
    }
    function clamp01(v) { return Math.max(0, Math.min(1, v)); }

    // ====== UI UPDATE ======
    function syncUI() {
      if (statsEl) statsEl.innerText = `LV.${level} 에테르 기사`;
      if (scoreEl) scoreEl.innerText = `SCORE: ${score}`;

      const hpRatio = clamp01(player.hp / player.maxHp);
      if (hpFill) hpFill.style.width = (hpRatio * 100).toFixed(1) + "%";

      const expRatio = clamp01(exp / 100);
      if (expFill) expFill.style.width = (expRatio * 100).toFixed(1) + "%";
    }

    // ====== PAUSE / RESTART ======
    function togglePause() {
      if (isGameOver) return;
      isPaused = !isPaused;
      if (pauseEl) pauseEl.style.display = isPaused ? "flex" : "none";
      if (bgm) {
        if (isPaused) bgm.pause();
        else if (bgm.currentTime > 0) bgm.play().catch(() => {});
      }
    }

    if (btnResume) btnResume.addEventListener("click", togglePause);
    if (btnRestart) btnRestart.addEventListener("click", () => location.reload());
    if (btnRetry) btnRetry.addEventListener("click", () => location.reload());

    // ====== INPUT ======
    window.addEventListener("keydown", (e) => {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
      if (e.code === "KeyP") togglePause();
      keys[e.code] = true;
      if (!isPaused && bgm && bgm.paused) bgm.play().catch(() => {});
    }, { passive: false });

    window.addEventListener("keyup", (e) => { keys[e.code] = false; });

    // ====== SPAWN ======
    function spawnLightnings() {
      if (isGameOver || isPaused) return;
      for (let i = 0; i < 10; i++) {
        lightnings.push({
          x: Math.random() * W,
          y: -200,
          w: 60,
          h: H + 200,
          life: 75
        });
      }
    }

    function spawnEnemy() {
      if (isGameOver || isPaused) return;

      // ✅ 레벨 10/20/30/40...에 보스 1마리만
      const isBoss = (level % 10 === 0 && enemies.filter(e => e.isBoss).length === 0);

      if (isBoss) {
        const bs = 1 + (level / 100);
        const bossHp = 2500 * Math.pow(1.7, level / 10);

        enemies.push({
          x: W + 200,
          y: floorY - (230 * bs),
          w: 180 * bs,
          h: 230 * bs,
          hp: bossHp,
          maxHp: bossHp,
          speed: 1.2 + (level / 70),
          isBoss: true,
          dead: false
        });

        showItemNotice(`BOSS ALERT: LV.${level}`);
      } else {
        enemies.push({
          x: Math.random() > 0.5 ? -150 : W + 150,
          y: floorY - 95,
          w: 75,
          h: 95,
          hp: 100 + (level * 30),
          maxHp: 100 + (level * 30),
          speed: 2.8 + (level * 0.25),
          isBoss: false,
          dead: false
        });
      }
    }

    function tryDropItem(x, y) {
      if (Math.random() > 0.2) return;
      const r = Math.random();
      const type = (r < 0.2) ? "CORE" : (r < 0.5) ? "THUNDER" : "HEAL";
      items.push({ x, y: floorY - 60, w: 55, h: 55, type });
    }

    setInterval(spawnLightnings, 5000);
    setInterval(spawnEnemy, 2000);

    // ====== GAME ======
    function endGame() {
      isGameOver = true;
      if (overlayEl) overlayEl.style.display = "flex";
      if (bgm) bgm.pause();
      if (finalResultEl) finalResultEl.innerText = `SCORE: ${score} | LEVEL: ${level}`;
    }

    function update(dt) {
      if (isGameOver || isPaused) return;

      // 오버드라이브
      if (awakeningTimeLeft > 0) {
        awakeningTimeLeft -= dt;
        if (awkTimerUI) {
          awkTimerUI.style.display = "block";
          awkTimerUI.innerText = `OVERDRIVE: ${Math.max(0, awakeningTimeLeft).toFixed(1)}s (x${coreStack})`;
        }
        if (awakeningTimeLeft <= 0) {
          coreStack = 0;
          coreColor = "#0ff";
          if (awkTimerUI) awkTimerUI.style.display = "none";
        }
      }

      // 이동
      if (keys["KeyA"]) { player.vx = -9; player.dir = -1; }
      else if (keys["KeyD"]) { player.vx = 9; player.dir = 1; }
      else player.vx *= 0.85;

      if (keys["Space"] && player.grounded) {
        player.vy = -19;
        player.grounded = false;
      }

      // 물리(간단)
      player.vy += 0.9;
      player.x += player.vx;
      player.y += player.vy;

      if (player.x < 0) player.x = 0;
      if (player.x > W - player.w) player.x = W - player.w;

      if (player.y > floorY - player.h) {
        player.y = floorY - player.h;
        player.vy = 0;
        player.grounded = true;
      }

      // 자동 공격(잔상)
      const currentAtk = player.baseAtk * (1 + coreStack * 0.6);
      const rotationSpeed = 0.2 + (coreStack * 0.06);
      const orbitCount = 1 + coreStack;

      for (let i = 0; i < orbitCount; i++) {
        const angle = (Date.now() / 1000 * (rotationSpeed * 10)) + (i * Math.PI * 2 / orbitCount);
        afterimages.push({
          x: player.x + Math.cos(angle) * 110,
          y: player.y + Math.sin(angle) * 110,
          opacity: 0.8,
          life: 12,
          color: coreColor
        });
      }

      // ✅ 핵심: 보스 피 안 닳는 문제 해결(센터 기준 거리)
      const hitRangeBase = 190 + (coreStack * 10);

      enemies.forEach(en => {
        // 추적(센터 기준)
        if (centerX(en) < centerX(player)) en.x += en.speed;
        else en.x -= en.speed;

        // 접촉 데미지(AABB)
        if (aabbOverlap(player, en)) {
          player.hp -= en.isBoss ? 0.8 : 0.3;
        }

        // 공격(센터 거리)
        const d = distCenter(player, en);
        const bossBonus = en.isBoss ? (en.w * 0.15) : 0;
        const hitRange = hitRangeBase + bossBonus;

        if (d < hitRange) {
          en.hp -= currentAtk * 0.17;
          if (en.hp <= 0) en.dead = true;
        }
      });

      // 처치 정리
      enemies = enemies.filter(en => {
        if (en.dead) {
          tryDropItem(en.x, en.y);
          score += en.isBoss ? 8000 : 150;
          exp += en.isBoss ? 150 : 30;
          return false;
        }
        return true;
      });

      // 레벨업
      if (exp >= 100) {
        level++;
        exp = 0;
        player.baseAtk += 15;
      }

      // 번개
      lightnings.forEach(ln => {
        ln.life--;
        if (ln.life < 15 && ln.life > 0) {
          if (player.x < ln.x + ln.w && player.x + player.w > ln.x) player.hp -= 3;
        }
      });
      lightnings = lightnings.filter(ln => ln.life > 0);

      // 아이템 습득
      items = items.filter(it => {
        if (Math.abs(player.x - it.x) < 65 && Math.abs(player.y - it.y) < 100) {
          if (it.type === "CORE") {
            coreStack++;
            awakeningTimeLeft = 10;
            coreColor = "#f0f";
            showItemNotice("CORE AWAKENED!");
          } else if (it.type === "THUNDER") {
            enemies.forEach(e => e.hp -= 4000);
            showItemNotice("ETHER THUNDER!");
          } else if (it.type === "HEAL") {
            player.hp = Math.min(player.maxHp, player.hp + 60);
            showItemNotice("RECOVERED!");
          }
          return false;
        }
        return true;
      });

      // 잔상 소멸
      afterimages.forEach(a => { a.opacity -= 0.07; a.life--; });
      afterimages = afterimages.filter(a => a.life > 0);

      // 사망
      if (player.hp <= 0) endGame();

      syncUI();
    }

    function draw() {
      // 배경
      if (img.bg.complete && img.bg.width > 0) ctx.drawImage(img.bg, 0, 0, W, H);
      else {
        ctx.fillStyle = "#010108";
        ctx.fillRect(0, 0, W, H);
      }

      // 번개
      lightnings.forEach(ln => {
        if (img.ln.complete && img.ln.width > 0) {
          ctx.globalAlpha = ln.life > 15 ? 0.2 : 1.0;
          ctx.drawImage(img.ln, ln.x, ln.y, ln.w, ln.h);
          ctx.globalAlpha = 1.0;
        } else {
          ctx.fillStyle = ln.life > 15 ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.9)";
          ctx.fillRect(ln.x, 0, ln.w, H);
        }
      });

      // 바닥선
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, floorY);
      ctx.lineTo(W, floorY);
      ctx.stroke();

      // 아이템
      items.forEach(it => {
        let itemImg = img.it_heal;
        if (it.type === "CORE") itemImg = img.it_core;
        else if (it.type === "THUNDER") itemImg = img.it_thunder;

        if (itemImg.complete && itemImg.width > 0) ctx.drawImage(itemImg, it.x, it.y, it.w, it.h);
        else {
          ctx.fillStyle = it.type === "CORE" ? "#f0f" : (it.type === "THUNDER" ? "#ff0" : "#0f0");
          ctx.fillRect(it.x, it.y, it.w, it.h);
        }
      });

      // 잔상
      afterimages.forEach(a => {
        ctx.globalAlpha = a.opacity;
        ctx.fillStyle = a.color || "#0ff";
        ctx.fillRect(a.x, a.y, 22, 22);
      });
      ctx.globalAlpha = 1;

      // 적/보스
      enemies.forEach(en => {
        const image = en.isBoss ? img.b : img.e;

        if (image.complete && image.width > 0) ctx.drawImage(image, en.x, en.y, en.w, en.h);
        else {
          ctx.fillStyle = en.isBoss ? "#f00" : "#f05";
          ctx.fillRect(en.x, en.y, en.w, en.h);
        }

        // 보스 체력바
        if (en.isBoss) {
          const ratio = clamp01(en.hp / en.maxHp);
          ctx.fillStyle = "#1a1a1a";
          ctx.fillRect(en.x, en.y - 30, en.w, 15);
          ctx.fillStyle = "#cc0000";
          ctx.fillRect(en.x, en.y - 30, en.w * ratio, 15);
        }
      });

      // 플레이어(이미지 없으면 fallback)
      ctx.save();
      if (player.dir === -1) {
        ctx.translate(player.x + player.w, player.y);
        ctx.scale(-1, 1);
        if (img.p.complete && img.p.width > 0) ctx.drawImage(img.p, 0, 0, player.w, player.h);
        else { ctx.fillStyle = "#00e5ff"; ctx.fillRect(0, 0, player.w, player.h); }
      } else {
        if (img.p.complete && img.p.width > 0) ctx.drawImage(img.p, player.x, player.y, player.w, player.h);
        else { ctx.fillStyle = "#00e5ff"; ctx.fillRect(player.x, player.y, player.w, player.h); }
      }
      ctx.restore();
    }

    // ====== SAFE LOOP ======
    let last = performance.now();
    let started = false;

    function loop(now) {
      try {
        const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
        last = now;

        update(dt);
        draw();

        started = true;
        requestAnimationFrame(loop);
      } catch (e) {
        showDebug(`RUNTIME ERROR:\n${e.stack || e.message || String(e)}`);
      }
    }

    // 초기 “Loading…” 한 번 그려서 완전 검정 방지
    ctx.fillStyle = "#010108";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#ffffff";
    ctx.font = "18px Arial Black";
    ctx.fillText("Loading...", 20, H - 30);

    // 첫 UI 동기화
    syncUI();

    // 2초 내에 시작 안되면 경고
    setTimeout(() => {
      if (!started && debugEl && debugEl.style.display !== "block") {
        showDebug("계속 검정이면: JS/CSS 경로 또는 파일명이 다르거나, game.js가 로드되지 않은 경우가 많습니다.\n(지금은 에러가 안 잡혔습니다.)");
      }
    }, 2000);

    // 시작
    requestAnimationFrame(loop);
  });
})();
