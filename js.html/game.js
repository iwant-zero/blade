(() => {
  "use strict";
  window.__BLADE_BOOTED = true;

  document.addEventListener("DOMContentLoaded", () => {
    // ========= DEBUG =========
    const debugEl = document.getElementById("debug");
    const showDebug = (msg) => {
      if (!debugEl) return;
      debugEl.style.display = "block";
      debugEl.textContent = msg;
    };
    if (typeof window.__blade_show_debug === "function") window.__blade_show_debug = showDebug;

    // ========= DOM =========
    const canvas = document.getElementById("gameCanvas");
    if (!canvas) { showDebug("Canvas not found: #gameCanvas"); return; }
    const ctx = canvas.getContext("2d", { alpha: false });

    const hpFill = document.getElementById("hp-fill");
    const expFill = document.getElementById("exp-fill");
    const itemMsg = document.getElementById("item-msg");
    const awkTimerUI = document.getElementById("awk-timer");
    const statsEl = document.getElementById("stats");
    const scoreEl = document.getElementById("score");

    const pauseBtn = document.getElementById("pause-btn");

    const titleMenu = document.getElementById("title-menu");
    const saveBox = document.getElementById("save-box");
    const saveMeta = document.getElementById("save-meta");
    const btnTitleResume = document.getElementById("btn-title-resume");
    const btnTitleNew = document.getElementById("btn-title-new");
    const btnTitleClear = document.getElementById("btn-title-clear");

    const pauseMenu = document.getElementById("pause-menu");
    const btnResume = document.getElementById("btn-resume");
    const btnSave = document.getElementById("btn-save");
    const btnRestart = document.getElementById("btn-restart");
    const btnToTitle = document.getElementById("btn-to-title");

    const rewardMenu = document.getElementById("reward-menu");
    const rewardSub = document.getElementById("reward-sub");
    const rewardBtns = [document.getElementById("reward-0"), document.getElementById("reward-1"), document.getElementById("reward-2")];
    const rewardNames = [document.getElementById("reward-name-0"), document.getElementById("reward-name-1"), document.getElementById("reward-name-2")];
    const rewardDescs = [document.getElementById("reward-desc-0"), document.getElementById("reward-desc-1"), document.getElementById("reward-desc-2")];

    const gameOverOverlay = document.getElementById("overlay");
    const finalResult = document.getElementById("final-result");
    const btnRetry = document.getElementById("btn-retry");
    const btnOverTitle = document.getElementById("btn-over-title");
    const btnOverLoad = document.getElementById("btn-over-load");

    // ========= SAVE =========
    const SAVE_KEY = "blade_save_v1";

    // ========= CANVAS (HiDPI) =========
    let W = 0, H = 0, DPR = 1;
    let floorY = 0;

    // ========= HELPERS =========
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const clamp01 = (v) => Math.max(0, Math.min(1, v));
    const cx = (o) => o.x + o.w * 0.5;
    const cy = (o) => o.y + o.h * 0.5;
    const distCenter = (a, b) => Math.hypot(cx(a) - cx(b), cy(a) - cy(b));
    const aabbOverlap = (a, b) => (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y);

    function resize() {
      DPR = Math.max(1, window.devicePixelRatio || 1);
      W = Math.max(320, window.innerWidth);
      H = Math.max(240, window.innerHeight);

      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      canvas.width = Math.floor(W * DPR);
      canvas.height = Math.floor(H * DPR);

      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

      floorY = H - 100;
      player.x = clamp(player.x, 0, W - player.w);
      player.y = Math.min(player.y, floorY - player.h);
    }
    window.addEventListener("resize", resize);

    // ========= ASSETS =========
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

    let bgm = null;
    try {
      bgm = new Audio("assets/bgm.mp3");
      bgm.loop = true;
      bgm.volume = 0.4;
    } catch { bgm = null; }

    // ========= GAME STATE =========
    // "TITLE" | "PLAY" | "PAUSE" | "REWARD" | "GAMEOVER"
    let state = "TITLE";

    let score = 0;
    let level = 1;
    let exp = 0;

    let wave = 1;
    let coreStack = 0;
    let awakeningTimeLeft = 0;
    let coreColor = "#0ff";
    let invulnTime = 0;

    const player = {
      x: 0, y: 0, w: 80, h: 110,
      vx: 0, vy: 0, grounded: false, dir: 1,
      hp: 100, maxHp: 100, baseAtk: 45
    };

    let enemies = [];
    let items = [];
    let lightnings = [];
    let afterimages = [];

    const keys = {};
    let currentRewards = [];

    // ========= UI =========
    function showOverlay(el, on) {
      if (!el) return;
      el.style.display = on ? "flex" : "none";
    }

    function setState(next) {
      state = next;

      showOverlay(titleMenu, state === "TITLE");
      showOverlay(pauseMenu, state === "PAUSE");
      showOverlay(rewardMenu, state === "REWARD");
      showOverlay(gameOverOverlay, state === "GAMEOVER");

      // ✅ pause 버튼은 PLAY/PAUSE에서만 보여주기 (게임오버/보상/타이틀에선 숨김)
      if (pauseBtn) {
        const show = (state === "PLAY" || state === "PAUSE");
        pauseBtn.style.display = show ? "block" : "none";
        pauseBtn.textContent = (state === "PAUSE") ? "▶" : "⏸";
      }

      // BGM
      if (bgm) {
        if (state === "PLAY") {
          if (bgm.currentTime > 0) bgm.play().catch(()=>{});
        } else {
          bgm.pause();
        }
      }

      // 저장 버튼/로드 버튼 노출 갱신
      renderSaveInfo();
    }

    function showItemNotice(text) {
      if (!itemMsg) return;
      itemMsg.innerText = text;
      itemMsg.style.display = "block";
      itemMsg.style.color = "#1a1a1a";
      setTimeout(() => { itemMsg.style.display = "none"; }, 1600);
    }

    function syncHUD() {
      if (statsEl) statsEl.innerText = `LV.${level} 에테르 기사`;
      if (scoreEl) scoreEl.innerText = `SCORE: ${score}`;
      if (hpFill) hpFill.style.width = (clamp01(player.hp / player.maxHp) * 100).toFixed(1) + "%";
      if (expFill) expFill.style.width = clamp(exp, 0, 100).toFixed(1) + "%";
    }

    function safeNowISO() {
      try { return new Date().toISOString(); } catch { return ""; }
    }

    // ========= SAVE / LOAD =========
    function hasSave() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        return !!data && data.v === 1;
      } catch { return false; }
    }

    function readSave() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || data.v !== 1) return null;
        return data;
      } catch { return null; }
    }

    function clearSave() {
      try { localStorage.removeItem(SAVE_KEY); } catch {}
    }

    // ✅ “죽은 상태” 저장 방지: hp <= 0 이면 저장하지 않음
    function saveGame() {
      if (state === "TITLE" || state === "GAMEOVER") return;
      if (player.hp <= 0) return;

      const data = {
        v: 1,
        savedAt: safeNowISO(),
        score, level, exp, wave,
        player: {
          hp: player.hp,
          maxHp: player.maxHp,
          baseAtk: player.baseAtk
        },
        core: {
          stack: coreStack,
          time: awakeningTimeLeft,
          color: coreColor
        }
      };

      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
        showItemNotice("SAVED");
        renderSaveInfo();
      } catch {
        showItemNotice("SAVE FAILED");
      }
    }

    function applySave(data) {
      score = Number(data.score) || 0;
      level = clamp(Number(data.level) || 1, 1, 9999);
      exp = clamp(Number(data.exp) || 0, 0, 100);
      wave = clamp(Number(data.wave) || 1, 1, 9999);

      const p = data.player || {};
      player.maxHp = clamp(Number(p.maxHp) || 100, 1, 999999);
      player.hp = clamp(Number(p.hp) || player.maxHp, 1, player.maxHp);
      player.baseAtk = clamp(Number(p.baseAtk) || 45, 1, 999999);

      const c = data.core || {};
      coreStack = clamp(Number(c.stack) || 0, 0, 999);
      awakeningTimeLeft = clamp(Number(c.time) || 0, 0, 999);
      coreColor = (typeof c.color === "string" && c.color) ? c.color : "#0ff";

      enemies = [];
      items = [];
      lightnings = [];
      afterimages = [];

      player.vx = 0; player.vy = 0; player.grounded = false; player.dir = 1;
      player.x = W * 0.5 - player.w * 0.5;
      player.y = floorY - player.h;

      invulnTime = 1.2; // 로드 직후 안전
      syncHUD();
    }

    function renderTitleSaveInfo() {
      const data = readSave();
      if (!data) {
        if (saveBox) saveBox.style.display = "none";
        if (btnTitleResume) btnTitleResume.style.display = "none";
        if (btnTitleClear) btnTitleClear.style.display = "none";
        return;
      }

      if (saveBox) saveBox.style.display = "block";
      if (btnTitleResume) btnTitleResume.style.display = "inline-block";
      if (btnTitleClear) btnTitleClear.style.display = "inline-block";

      const lines = [
        `LEVEL: ${data.level}   WAVE: ${data.wave}`,
        `SCORE: ${data.score}`,
        `HP: ${Math.round(data.player?.hp ?? 0)}/${Math.round(data.player?.maxHp ?? 0)}`,
        `ATK: ${Math.round(data.player?.baseAtk ?? 0)}`,
        `SAVED: ${data.savedAt || "-"}`
      ];
      if (saveMeta) saveMeta.textContent = lines.join("\n");
    }

    function renderGameOverLoadButton() {
      const ok = hasSave();
      if (btnOverLoad) btnOverLoad.style.display = ok ? "inline-block" : "none";
    }

    function renderSaveInfo() {
      renderTitleSaveInfo();
      renderGameOverLoadButton();
    }

    // ========= FLOW =========
    function keysReset() { for (const k in keys) keys[k] = false; }

    function startNewGame() {
      // 새게임은 “세이브 삭제” 정책 유지
      clearSave();

      score = 0; level = 1; exp = 0; wave = 1;
      coreStack = 0; awakeningTimeLeft = 0; coreColor = "#0ff";
      invulnTime = 0;

      player.maxHp = 100;
      player.hp = 100;
      player.baseAtk = 45;
      player.vx = 0; player.vy = 0; player.grounded = false; player.dir = 1;

      enemies = []; items = []; lightnings = []; afterimages = [];
      player.x = W * 0.5 - player.w * 0.5;
      player.y = floorY - player.h;

      syncHUD();
      setState("PLAY");
      saveGame(); // 시작 즉시 1회 저장
    }

    function resumeFromSave() {
      const data = readSave();
      if (!data) { startNewGame(); return; }
      applySave(data);
      setState("PLAY");
    }

    function toTitle() {
      keysReset();
      setState("TITLE");
      renderSaveInfo();
    }

    function endGame() {
      // ✅ 더 이상 세이브를 삭제하지 않음 (죽어도 “마지막 저장”으로 로드 가능)
      setState("GAMEOVER");
      if (finalResult) finalResult.textContent = `SCORE: ${score} | LEVEL: ${level} | WAVE: ${wave}`;
      renderSaveInfo();
    }

    // ========= MENUS / INPUT =========
    function togglePause() {
      if (state === "PLAY") { setState("PAUSE"); saveGame(); }
      else if (state === "PAUSE") setState("PLAY");
    }

    if (pauseBtn) {
      pauseBtn.addEventListener("click", () => togglePause());
      pauseBtn.addEventListener("touchstart", (e) => { e.preventDefault(); togglePause(); }, { passive:false });
    }

    if (btnResume) btnResume.addEventListener("click", () => setState("PLAY"));
    if (btnSave) btnSave.addEventListener("click", () => saveGame());
    if (btnRestart) btnRestart.addEventListener("click", () => startNewGame());
    if (btnToTitle) btnToTitle.addEventListener("click", () => toTitle());

    if (btnRetry) btnRetry.addEventListener("click", () => startNewGame());
    if (btnOverTitle) btnOverTitle.addEventListener("click", () => toTitle());
    if (btnOverLoad) btnOverLoad.addEventListener("click", () => resumeFromSave());

    if (btnTitleNew) btnTitleNew.addEventListener("click", () => startNewGame());
    if (btnTitleResume) btnTitleResume.addEventListener("click", () => resumeFromSave());
    if (btnTitleClear) btnTitleClear.addEventListener("click", () => { clearSave(); renderSaveInfo(); showItemNotice("SAVE DELETED"); });

    window.addEventListener("keydown", (e) => {
      if (["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code)) e.preventDefault();

      // title에서는 조작 입력 무시
      if (state === "TITLE") return;

      if (e.code === "KeyP" || e.code === "Escape") {
        e.preventDefault();
        if (state === "REWARD" || state === "GAMEOVER") return;
        togglePause();
        return;
      }

      keys[e.code] = true;

      if (bgm && bgm.paused && (state === "PLAY" || state === "PAUSE")) bgm.play().catch(()=>{});
    }, { passive:false });

    window.addEventListener("keyup", (e) => { keys[e.code] = false; });

    window.addEventListener("beforeunload", () => {
      try {
        if (state === "PLAY" || state === "PAUSE" || state === "REWARD") saveGame();
      } catch {}
    });

    // ========= SPAWN (dynamic) =========
    function enemySpawnMs() {
      const ms = 2000 - (wave - 1) * 90;
      return clamp(ms, 850, 2000);
    }
    function lightningSpawnMs() {
      const ms = 5000 - (wave - 1) * 120;
      return clamp(ms, 3200, 5000);
    }

    function scheduleEnemySpawn() {
      setTimeout(() => {
        try {
          if (state === "PLAY") spawnEnemy();
        } finally {
          scheduleEnemySpawn();
        }
      }, enemySpawnMs());
    }

    function scheduleLightningSpawn() {
      setTimeout(() => {
        try {
          if (state === "PLAY") spawnLightnings();
        } finally {
          scheduleLightningSpawn();
        }
      }, lightningSpawnMs());
    }

    // ========= ITEMS / ENEMIES =========
    function tryDropItem(x, y) {
      if (Math.random() > 0.2) return;
      const r = Math.random();
      const type = (r < 0.2) ? "CORE" : (r < 0.5) ? "THUNDER" : "HEAL";
      items.push({ x: clamp(x, 20, W - 80), y: floorY - 60, w: 55, h: 55, type });
    }

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
      const bossAlive = enemies.some(e => e.isBoss);
      const isBossTurn = (level % 10 === 0);
      if (isBossTurn && !bossAlive) spawnBoss();
      else spawnMob();
    }

    function spawnLightnings() {
      for (let i = 0; i < 10; i++) {
        lightnings.push({ x: Math.random() * W, y: -200, w: 60, h: H + 200, life: 75 });
      }
    }

    // ========= REWARD =========
    const REWARD_POOL = [
      { id:"heal_full", name:"나노 리부트", desc:"HP 완전 회복 + 최대 HP +20", apply:()=>{ player.maxHp += 20; player.hp = player.maxHp; } },
      { id:"atk_up", name:"코어 튜닝", desc:"기본 공격력 +25", apply:()=>{ player.baseAtk += 25; } },
      { id:"core_stack", name:"에테르 코어 주입", desc:"CORE 스택 +1 & 오버드라이브 10초", apply:()=>{ coreStack += 1; awakeningTimeLeft = 10; coreColor="#f0f"; } },
      { id:"thunder_burst", name:"에테르 썬더", desc:"현재 화면의 적에게 대미지 6000 (보스 제외)", apply:()=>{ enemies.forEach(e => { if(!e.isBoss) e.hp -= 6000; }); } },
      { id:"shield", name:"위상 실드", desc:"3초간 무적(피격 무시)", apply:()=>{ invulnTime = Math.max(invulnTime, 3.0); } },
      { id:"maxhp_big", name:"강화 프레임", desc:"최대 HP +50 (즉시 30 회복)", apply:()=>{ player.maxHp += 50; player.hp = clamp(player.hp + 30, 1, player.maxHp); } }
    ];

    function pickRewards() {
      const pool = REWARD_POOL.slice();
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      return pool.slice(0, 3);
    }

    function openRewardMenu(nextWave) {
      currentRewards = pickRewards();
      if (rewardSub) rewardSub.textContent = `WAVE ${wave} → ${nextWave}`;
      for (let i = 0; i < 3; i++) {
        const r = currentRewards[i];
        if (rewardNames[i]) rewardNames[i].textContent = r.name;
        if (rewardDescs[i]) rewardDescs[i].textContent = r.desc;
      }
      setState("REWARD");
    }

    function onBossCleared() {
      enemies = [];
      const nextWave = wave + 1;
      openRewardMenu(nextWave);
    }

    function applyReward(index) {
      const r = currentRewards[index];
      if (!r) return;
      wave += 1;
      r.apply();
      invulnTime = Math.max(invulnTime, 1.0);
      showItemNotice(`WAVE ${wave} START`);
      setState("PLAY");
      saveGame();
    }

    rewardBtns.forEach((btn, i) => {
      if (!btn) return;
      btn.addEventListener("click", () => {
        if (state !== "REWARD") return;
        applyReward(i);
      });
    });

    // ========= AUTO SAVE =========
    setInterval(() => {
      if (state === "PLAY") {
        try { saveGame(); } catch {}
      }
    }, 8000);

    // ========= UPDATE / DRAW =========
    function update(dt) {
      if (state !== "PLAY") return;

      if (invulnTime > 0) invulnTime = Math.max(0, invulnTime - dt);

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

      // move
      if (keys["KeyA"]) { player.vx = -9; player.dir = -1; }
      else if (keys["KeyD"]) { player.vx = 9; player.dir = 1; }
      else player.vx *= 0.85;

      if (keys["Space"] && player.grounded) {
        player.vy = -19;
        player.grounded = false;
      }

      player.vy += 0.9;
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
          x: cx(player) + Math.cos(angle) * 110 - 11,
          y: cy(player) + Math.sin(angle) * 110 - 11,
          opacity: 0.8,
          life: 12,
          color: coreColor
        });
      }

      // attack
      const hitRangeBase = 190 + (coreStack * 10);
      let bossJustDied = false;

      enemies.forEach(en => {
        if (cx(en) < cx(player)) en.x += en.speed;
        else en.x -= en.speed;

        if (invulnTime <= 0 && aabbOverlap(player, en)) {
          player.hp -= en.isBoss ? 0.8 : 0.3;
        }

        const d = distCenter(player, en);
        const bossBonus = en.isBoss ? (en.w * 0.15) : 0;

        if (d < (hitRangeBase + bossBonus)) {
          en.hp -= currentAtk * 0.17;
          if (en.hp <= 0) {
            en.dead = true;
            if (en.isBoss) bossJustDied = true;
          }
        }
      });

      enemies = enemies.filter(en => {
        if (en.dead) {
          tryDropItem(en.x, en.y);
          score += en.isBoss ? 8000 : 150;
          exp += en.isBoss ? 150 : 30;
          return false;
        }
        return true;
      });

      if (bossJustDied) onBossCleared();

      if (exp >= 100) {
        level++;
        exp = 0;
        player.baseAtk += 15;
      }

      // lightning
      lightnings.forEach(ln => {
        ln.life--;
        if (ln.life < 15 && ln.life > 0) {
          if (invulnTime <= 0 && player.x < ln.x + ln.w && player.x + player.w > ln.x) player.hp -= 3;
        }
      });
      lightnings = lightnings.filter(ln => ln.life > 0);

      // pickup
      items = items.filter(it => {
        if (Math.abs(cx(player) - (it.x + it.w / 2)) < 65 &&
            Math.abs(cy(player) - (it.y + it.h / 2)) < 100) {

          if (it.type === "CORE") { coreStack++; awakeningTimeLeft = 10; coreColor = "#f0f"; showItemNotice("CORE AWAKENED!"); }
          else if (it.type === "THUNDER") { enemies.forEach(e => e.hp -= 4000); showItemNotice("ETHER THUNDER!"); }
          else if (it.type === "HEAL") { player.hp = Math.min(player.maxHp, player.hp + 60); showItemNotice("RECOVERED!"); }
          return false;
        }
        return true;
      });

      afterimages.forEach(a => { a.opacity -= 0.07; a.life--; });
      afterimages = afterimages.filter(a => a.life > 0);

      if (player.hp <= 0) endGame();

      syncHUD();
    }

    function draw() {
      if (img.bg.complete && img.bg.width > 0) ctx.drawImage(img.bg, 0, 0, W, H);
      else { ctx.fillStyle = "#010108"; ctx.fillRect(0, 0, W, H); }

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

      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, floorY);
      ctx.lineTo(W, floorY);
      ctx.stroke();

      items.forEach(it => {
        let itemImg = img.it_heal;
        if (it.type === "CORE") itemImg = img.it_core;
        else if (it.type === "THUNDER") itemImg = img.it_thunder;

        if (itemImg.complete && itemImg.width > 0) ctx.drawImage(itemImg, it.x, it.y, it.w, it.h);
        else {
          ctx.fillStyle = (it.type === "CORE") ? "#f0f" : (it.type === "THUNDER") ? "#ff0" : "#0f0";
          ctx.fillRect(it.x, it.y, it.w, it.h);
        }
      });

      afterimages.forEach(a => {
        ctx.globalAlpha = a.opacity;
        ctx.fillStyle = a.color || "#0ff";
        ctx.fillRect(a.x, a.y, 22, 22);
      });
      ctx.globalAlpha = 1;

      enemies.forEach(en => {
        const image = en.isBoss ? img.b : img.e;
        if (image.complete && image.width > 0) ctx.drawImage(image, en.x, en.y, en.w, en.h);
        else { ctx.fillStyle = en.isBoss ? "#ff0033" : "#ff55aa"; ctx.fillRect(en.x, en.y, en.w, en.h); }

        if (en.isBoss) {
          const ratio = clamp01(en.hp / en.maxHp);
          ctx.fillStyle = "#1a1a1a";
          ctx.fillRect(en.x, en.y - 30, en.w, 15);
          ctx.fillStyle = "#cc0000";
          ctx.fillRect(en.x, en.y - 30, en.w * ratio, 15);
        }
      });

      const blink = (invulnTime > 0) ? (Math.floor(performance.now() / 80) % 2 === 0) : true;
      if (blink) {
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
    }

    // ========= MAIN LOOP =========
    let last = performance.now();
    function frame(now) {
      try {
        const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
        last = now;
        update(dt);
        draw();
        requestAnimationFrame(frame);
      } catch (e) {
        showDebug(`RUNTIME ERROR:\n${e.stack || e.message || String(e)}`);
      }
    }

    // ========= INIT =========
    resize();
    player.x = W * 0.5 - player.w * 0.5;
    player.y = floorY - player.h;
    syncHUD();

    renderSaveInfo();
    setState("TITLE");

    // start spawners (they check state === PLAY)
    scheduleEnemySpawn();
    scheduleLightningSpawn();

    // kick loop
    ctx.fillStyle = "#010108";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.font = "18px Arial Black";
    ctx.fillText("Loading...", 20, Math.max(40, H - 30));
    requestAnimationFrame(frame);
  });
})();
