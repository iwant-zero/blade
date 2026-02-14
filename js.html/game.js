(() => {
  "use strict";

  // ✅ index.html에서 실행 여부 체크
  window.__BLADE_BOOTED = true;

  document.addEventListener("DOMContentLoaded", () => {
    // ===== DEBUG =====
    const debugEl = document.getElementById("debug");
    const showDebug = (msg) => {
      if (!debugEl) return;
      debugEl.style.display = "block";
      debugEl.textContent = msg;
    };
    // index.html에서 만든 함수가 있으면 같이 사용
    if (typeof window.__blade_show_debug === "function") {
      // 동기화(둘 중 어느 쪽으로 호출해도 보이게)
      window.__blade_show_debug = showDebug;
    }

    // ===== DOM =====
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

    const pauseMenu = document.getElementById("pause-menu");
    const overlay = document.getElementById("overlay");
    const finalResult = document.getElementById("final-result");

    const btnResume = document.getElementById("btn-resume");
    const btnRestart = document.getElementById("btn-restart");
    const btnRetry = document.getElementById("btn-retry");

    // 강제 초기 숨김(혹시 CSS 미적용이어도)
    if (pauseMenu) pauseMenu.style.display = "none";
    if (overlay) overlay.style.display = "none";

    // ===== CANVAS SIZE (HiDPI) =====
    let W = 0, H = 0, DPR = 1;
    let floorY = 0;

    function resize() {
      DPR = Math.max(1, window.devicePixelRatio || 1);
      W = Math.max(320, window.innerWidth);
      H = Math.max(240, window.innerHeight);

      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      canvas.width = Math.floor(W * DPR);
      canvas.height = Math.floor(H * DPR);

      // 좌표계를 CSS픽셀로
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

      floorY = H - 100;

      // 플레이어/오브젝트가 바닥 밖으로 나가면 보정
      player.x = clamp(player.x, 0, W - player.w);
      player.y = Math.min(player.y, floorY - player.h);
    }

    // ===== ASSETS =====
    const img = {
      p: new Image(), e: new Image(), b: new Image(), bg: new Image(),
      ln: new Image(),
      it_core: new Image(), it_thunder: new Image(), it_heal: new Image()
    };

    // ✅ index.html 기준 상대경로: ./assets/...
    img.p.src = "assets/player.png";
    img.e.src = "assets/enemy.png";
    img.b.src = "assets/boss.png";
    img.bg.src = "assets/background.png";
    img.ln.src = "assets/lightning.png";
    img.it_core.src = "assets/item_core.png";
    img.it_thunder.src = "assets/item_thunder.png";
    img.it_heal.src = "assets/item_heal.png";

    let bgm = null;
    try {
      bgm = new Audio("assets/bgm.mp3");
      bgm.loop = true;
      bgm.volume = 0.4;
    } catch (_) {
      bgm = null;
    }

    // ===== GAME STATE =====
    let isGameOver = false;
    let isPaused = false;

    let score = 0;
    let level = 1;
    let exp = 0; // 0~100

    let coreStack = 0;
    let awakeningTimeLeft = 0;
    let coreColor = "#0ff";

    const player = {
      x: 0, y: 0, w: 80, h: 110,
      vx: 0, vy: 0, grounded: false, dir: 1,
      hp: 100, maxHp: 100,
      baseAtk: 45
    };

    let enemies = [];
    let items = [];
    let lightnings = [];
    let afterimages = [];

    const keys = {};

    // ===== HELPERS =====
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function clamp01(v) { return Math.max(0, Math.min(1, v)); }

    function centerX(o) { return o.x + o.w * 0.5; }
    function centerY(o) { return o.y + o.h * 0.5; }
    function distCenter(a, b) { return Math.hypot(centerX(a) - centerX(b), centerY(a) - centerY(b)); }

    function aabbOverlap(a, b) {
      return (a.x < b.x + b.w &&
              a.x + a.w > b.x &&
              a.y < b.y + b.h &&
              a.y + a.h > b.y);
    }

    function showItemNotice(text) {
      if (!itemMsg) return;
      itemMsg.innerText = text;
      itemMsg.style.display = "block";
      itemMsg.style.color = "#1a1a1a";
      setTimeout(() => { itemMsg.style.display = "none"; }, 1600);
    }

    function syncUI() {
      if (statsEl) statsEl.innerText = `LV.${level} 에테르 기사`;
      if (scoreEl) scoreEl.innerText = `SCORE: ${score}`;

      if (hpFill) hpFill.style.width = (clamp01(player.hp / player.maxHp) * 100).toFixed(1) + "%";
      if (expFill) expFill.style.width = clamp(exp, 0, 100).toFixed(1) + "%";
    }

    function endGame() {
      isGameOver = true;
      if (overlay) overlay.style.display = "flex";
      if (bgm) bgm.pause();
      if (finalResult) finalResult.innerText = `SCORE: ${score} | LEVEL: ${level}`;
    }

    function togglePause() {
      if (isGameOver) return;
      isPaused = !isPaused;
      if (pauseMenu) pauseMenu.style.display = isPaused ? "flex" : "none";

      if (bgm) {
        if (isPaused) bgm.pause();
        else if (bgm.currentTime > 0) bgm.play().catch(() => {});
      }
    }

    // ===== BUTTONS =====
    if (btnResume) btnResume.addEventListener("click", togglePause);
    if (btnRestart) btnRestart.addEventListener("click", () => location.reload());
    if (btnRetry) btnRetry.addEventListener("click", () => location.reload());

    // ===== INPUT =====
    window.addEventListener("keydown", (e) => {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
      if (e.code === "KeyP") togglePause();

      keys[e.code] = true;

      // 첫 입력에 BGM 시도
      if (!isPaused && bgm && bgm.paused) bgm.play().catch(() => {});
    }, { passive: false });

    window.addEventListener("keyup", (e) => {
      keys[e.code] = false;
    });

    // ===== SPAWN =====
    function spawnBoss() {
      const bs = 1 + (level / 100);
      const bossHp = 2500 * Math.pow(1.7, level / 10);
      enemies.push({
        x: W + 240,
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
    }

    function spawnMob() {
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

    function spawnEnemy() {
      if (isGameOver || isPaused) return;

      const bossAlready = enemies.some(e => e.isBoss);
      const isBossTurn = (level % 10 === 0);

      if (isBossTurn && !bossAlready) spawnBoss();
      else spawnMob();
    }

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

    function tryDropItem(x, y) {
      if (Math.random() > 0.2) return;
      const r = Math.random();
      const type = (r < 0.2) ? "CORE" : (r < 0.5) ? "THUNDER" : "HEAL";
      items.push({
        x: clamp(x, 20, W - 80),
        y: floorY - 60,
        w: 55,
        h: 55,
        type
      });
    }

    // 스폰 타이머
    setInterval(spawnEnemy, 2000);
    setInterval(spawnLightnings, 5000);

    // ===== INIT =====
    window.addEventListener("resize", resize);
    resize();
    player.x = W * 0.5 - player.w * 0.5;
    player.y = floorY - player.h;
    syncUI();

    // ===== UPDATE =====
    function update(dt) {
      if (isGameOver || isPaused) return;

      // Overdrive
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

      // Move
      if (keys["KeyA"]) { player.vx = -9; player.dir = -1; }
      else if (keys["KeyD"]) { player.vx = 9; player.dir = 1; }
      else player.vx *= 0.85;

      if (keys["Space"] && player.grounded) {
        player.vy = -19;
        player.grounded = false;
      }

      player.vy += 0.9; // gravity
      player.x += player.vx;
      player.y += player.vy;

      player.x = clamp(player.x, 0, W - player.w);

      if (player.y > floorY - player.h) {
        player.y = floorY - player.h;
        player.vy = 0;
        player.grounded = true;
      }

      // orbit visuals
      const currentAtk = player.baseAtk * (1 + coreStack * 0.6);
      const rotationSpeed = 0.2 + (coreStack * 0.06);
      const orbitCount = 1 + coreStack;

      for (let i = 0; i < orbitCount; i++) {
        const angle = (Date.now() / 1000 * (rotationSpeed * 10)) + (i * Math.PI * 2 / orbitCount);
        afterimages.push({
          x: centerX(player) + Math.cos(angle) * 110 - 11,
          y: centerY(player) + Math.sin(angle) * 110 - 11,
          opacity: 0.8,
          life: 12,
          color: coreColor
        });
      }

      // ✅ 공격 판정: “센터 거리” 기반 (보스도 정상으로 피가 닳음)
      const hitRangeBase = 190 + (coreStack * 10);

      enemies.forEach(en => {
        // chase
        if (centerX(en) < centerX(player)) en.x += en.speed;
        else en.x -= en.speed;

        // touch damage
        if (aabbOverlap(player, en)) {
          player.hp -= en.isBoss ? 0.8 : 0.3;
        }

        // hit check
        const d = distCenter(player, en);
        const bossBonus = en.isBoss ? (en.w * 0.15) : 0;
        const hitRange = hitRangeBase + bossBonus;

        if (d < hitRange) {
          en.hp -= currentAtk * 0.17;
          if (en.hp <= 0) en.dead = true;
        }
      });

      // remove dead
      enemies = enemies.filter(en => {
        if (en.dead) {
          tryDropItem(en.x, en.y);
          score += en.isBoss ? 8000 : 150;
          exp += en.isBoss ? 150 : 30;
          return false;
        }
        return true;
      });

      // level up
      if (exp >= 100) {
        level++;
        exp = 0;
        player.baseAtk += 15;
      }

      // lightning damage
      lightnings.forEach(ln => {
        ln.life--;
        if (ln.life < 15 && ln.life > 0) {
          if (player.x < ln.x + ln.w && player.x + player.w > ln.x) {
            player.hp -= 3;
          }
        }
      });
      lightnings = lightnings.filter(ln => ln.life > 0);

      // pickup
      items = items.filter(it => {
        if (Math.abs(centerX(player) - (it.x + it.w / 2)) < 65 &&
            Math.abs(centerY(player) - (it.y + it.h / 2)) < 100) {

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

      // afterimages fade
      afterimages.forEach(a => { a.opacity -= 0.07; a.life--; });
      afterimages = afterimages.filter(a => a.life > 0);

      // death
      if (player.hp <= 0) endGame();

      syncUI();
    }

    // ===== DRAW =====
    function draw() {
      // bg
      if (img.bg.complete && img.bg.width > 0) {
        ctx.drawImage(img.bg, 0, 0, W, H);
      } else {
        ctx.fillStyle = "#010108";
        ctx.fillRect(0, 0, W, H);
      }

      // lightning
      lightnings.forEach(ln => {
        if (img.ln.complete && img.ln.width > 0) {
          ctx.globalAlpha = ln.life > 15 ? 0.2 : 1.0;
          ctx.drawImage(img.ln, ln.x, ln.y, ln.w, ln.h);
          ctx.globalAlpha = 1.0;
        } else {
          ctx.fillStyle = ln.life > 15 ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.9)";
          ctx.fillRect(ln.x, 0, ln.w, H);
        }
      });

      // floor line
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, floorY);
      ctx.lineTo(W, floorY);
      ctx.stroke();

      // items
      items.forEach(it => {
        let itemImg = img.it_heal;
        if (it.type === "CORE") itemImg = img.it_core;
        else if (it.type === "THUNDER") itemImg = img.it_thunder;

        if (itemImg.complete && itemImg.width > 0) {
          ctx.drawImage(itemImg, it.x, it.y, it.w, it.h);
        } else {
          ctx.fillStyle = (it.type === "CORE") ? "#f0f" : (it.type === "THUNDER") ? "#ff0" : "#0f0";
          ctx.fillRect(it.x, it.y, it.w, it.h);
        }
      });

      // afterimages
      afterimages.forEach(a => {
        ctx.globalAlpha = a.opacity;
        ctx.fillStyle = a.color || "#0ff";
        ctx.fillRect(a.x, a.y, 22, 22);
      });
      ctx.globalAlpha = 1;

      // enemies (+ boss hp bar)
      enemies.forEach(en => {
        const image = en.isBoss ? img.b : img.e;
        if (image.complete && image.width > 0) {
          ctx.drawImage(image, en.x, en.y, en.w, en.h);
        } else {
          ctx.fillStyle = en.isBoss ? "#ff0033" : "#ff55aa";
          ctx.fillRect(en.x, en.y, en.w, en.h);
        }

        if (en.isBoss) {
          const ratio = clamp01(en.hp / en.maxHp);
          ctx.fillStyle = "#1a1a1a";
          ctx.fillRect(en.x, en.y - 30, en.w, 15);
          ctx.fillStyle = "#cc0000";
          ctx.fillRect(en.x, en.y - 30, en.w * ratio, 15);
        }
      });

      // player
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

    // ===== LOOP =====
    let last = performance.now();
    function loop(now) {
      try {
        const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
        last = now;

        update(dt);
        draw();

        requestAnimationFrame(loop);
      } catch (e) {
        showDebug(`RUNTIME ERROR:\n${e.stack || e.message || String(e)}`);
      }
    }

    // 첫 프레임 안내
    ctx.fillStyle = "#010108";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#ffffff";
    ctx.font = "18px Arial Black";
    ctx.fillText("Loading...", 20, H - 30);

    requestAnimationFrame(loop);
  });
})();

