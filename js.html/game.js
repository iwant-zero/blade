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

    // ✅ Touch controls
    const touch = document.getElementById("touch");
    const tLeft = document.getElementById("t-left");
    const tRight = document.getElementById("t-right");
    const tJump = document.getElementById("t-jump");

    const titleMenu = document.getElementById("title-menu");
    const btnTitleBack = document.getElementById("btn-title-back");

    // Title slots
    const tokenLineTitle = document.getElementById("token-line-title");
    const slotBadge = [null,
      document.getElementById("slot-badge-1"),
      document.getElementById("slot-badge-2"),
      document.getElementById("slot-badge-3"),
    ];
    const slotActive = [null,
      document.getElementById("slot-active-1"),
      document.getElementById("slot-active-2"),
      document.getElementById("slot-active-3"),
    ];
    const slotMeta = [null,
      document.getElementById("slot-meta-1"),
      document.getElementById("slot-meta-2"),
      document.getElementById("slot-meta-3"),
    ];
    const slotLoadBtn = [null,
      document.getElementById("slot-load-1"),
      document.getElementById("slot-load-2"),
      document.getElementById("slot-load-3"),
    ];
    const slotNewBtn = [null,
      document.getElementById("slot-new-1"),
      document.getElementById("slot-new-2"),
      document.getElementById("slot-new-3"),
    ];
    const slotDelBtn = [null,
      document.getElementById("slot-del-1"),
      document.getElementById("slot-del-2"),
      document.getElementById("slot-del-3"),
    ];

    // Pause
    const pauseMenu = document.getElementById("pause-menu");
    const btnResume = document.getElementById("btn-resume");
    const btnSave = document.getElementById("btn-save");
    const btnRestart = document.getElementById("btn-restart");
    const btnToTitle = document.getElementById("btn-to-title");
    const tokenLinePause = document.getElementById("token-line-pause");
    const activeSlotNote = document.getElementById("active-slot-note");
    const miniSlotBtn = [null,
      document.getElementById("mini-slot-1"),
      document.getElementById("mini-slot-2"),
      document.getElementById("mini-slot-3"),
    ];

    // Reward
    const rewardMenu = document.getElementById("reward-menu");
    const rewardSub = document.getElementById("reward-sub");
    const rewardBtns = [document.getElementById("reward-0"), document.getElementById("reward-1"), document.getElementById("reward-2")];
    const rewardNames = [document.getElementById("reward-name-0"), document.getElementById("reward-name-1"), document.getElementById("reward-name-2")];
    const rewardDescs = [document.getElementById("reward-desc-0"), document.getElementById("reward-desc-1"), document.getElementById("reward-desc-2")];

    // Gameover
    const overlay = document.getElementById("overlay");
    const finalResult = document.getElementById("final-result");
    const tokenLineOver = document.getElementById("token-line-over");
    const overNote = document.getElementById("over-note");
    const goLoadBtn = [null,
      document.getElementById("go-load-1"),
      document.getElementById("go-load-2"),
      document.getElementById("go-load-3"),
    ];
    const btnRetry = document.getElementById("btn-retry");
    const btnOverTitle = document.getElementById("btn-over-title");

    // ========= CONSTANTS (SAVES) =========
    const SLOT_COUNT = 3;
    const SAVE_PREFIX = "blade_save_slot_v2_";
    const KEY_ACTIVE_SLOT = "blade_active_slot_v2";
    const KEY_CONTINUE_TOKEN = "blade_continue_token_v2";
    const KEY_DEATH_PENDING = "blade_death_pending_v2";

    const slotKey = (slot) => `${SAVE_PREFIX}${slot}`;

    // ========= HELPERS =========
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const clamp01 = (v) => Math.max(0, Math.min(1, v));
    const cx = (o) => o.x + o.w * 0.5;
    const cy = (o) => o.y + o.h * 0.5;
    const distCenter = (a, b) => Math.hypot(cx(a) - cx(b), cy(a) - cy(b));
    const aabbOverlap = (a, b) => (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y);

    function safeNowISO() {
      try { return new Date().toISOString(); } catch { return ""; }
    }

    function lsGet(key, fallback = null) {
      try {
        const v = localStorage.getItem(key);
        return (v === null || v === undefined) ? fallback : v;
      } catch { return fallback; }
    }
    function lsSet(key, val) { try { localStorage.setItem(key, String(val)); } catch {} }
    function lsDel(key) { try { localStorage.removeItem(key); } catch {} }

    function getActiveSlot() {
      const v = parseInt(lsGet(KEY_ACTIVE_SLOT, "1"), 10);
      if (!Number.isFinite(v)) return 1;
      return clamp(v, 1, SLOT_COUNT);
    }
    function setActiveSlot(slot) {
      const s = clamp(parseInt(slot, 10) || 1, 1, SLOT_COUNT);
      lsSet(KEY_ACTIVE_SLOT, s);
      renderAllMenus();
    }

    function getContinueToken() {
      const v = parseInt(lsGet(KEY_CONTINUE_TOKEN, "0"), 10);
      return (v === 1) ? 1 : 0;
    }
    function setContinueToken(v) {
      lsSet(KEY_CONTINUE_TOKEN, v ? 1 : 0);
      renderAllMenus();
    }

    function getDeathPending() {
      const v = parseInt(lsGet(KEY_DEATH_PENDING, "0"), 10);
      return (v === 1) ? 1 : 0;
    }
    function setDeathPending(v) {
      lsSet(KEY_DEATH_PENDING, v ? 1 : 0);
      renderAllMenus();
    }

    function readSave(slot) {
      try {
        const raw = localStorage.getItem(slotKey(slot));
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || data.v !== 2) return null;
        return data;
      } catch { return null; }
    }
    function writeSave(slot, data) {
      try {
        localStorage.setItem(slotKey(slot), JSON.stringify(data));
        return true;
      } catch { return false; }
    }
    function clearSave(slot) { lsDel(slotKey(slot)); }
    function anySaveExists() {
      for (let s = 1; s <= SLOT_COUNT; s++) if (readSave(s)) return true;
      return false;
    }

    // ========= MOBILE VH FIX =========
    function setVhUnit(){
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    }
    window.addEventListener('resize', setVhUnit);
    setVhUnit();

    // ========= CANVAS SIZE (HiDPI) =========
    let W = 0, H = 0, DPR = 1;
    let floorY = 0;

    const player = {
      x: 0, y: 0, w: 80, h: 110,
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
    let state = "TITLE"; // "TITLE" | "PLAY" | "PAUSE" | "REWARD" | "GAMEOVER"
    let titleFromGame = false;
    let titleReturnState = "PAUSE";

    let score = 0;
    let level = 1;
    let exp = 0;
    let wave = 1;

    let coreStack = 0;
    let awakeningTimeLeft = 0;
    let coreColor = "#0ff";
    let invulnTime = 0;

    let enemies = [];
    let items = [];
    let lightnings = [];
    let afterimages = [];
    const keys = {};
    let currentRewards = [];

    // ========= TOUCH BINDING =========
    function bindHoldButton(el, keyCode) {
      if (!el) return;
      const down = (e) => {
        e.preventDefault();
        keys[keyCode] = true;
        try { el.setPointerCapture && el.setPointerCapture(e.pointerId); } catch {}
      };
      const up = (e) => {
        e.preventDefault();
        keys[keyCode] = false;
        try { el.releasePointerCapture && el.releasePointerCapture(e.pointerId); } catch {}
      };

      el.addEventListener("pointerdown", down, { passive:false });
      el.addEventListener("pointerup", up, { passive:false });
      el.addEventListener("pointercancel", up, { passive:false });
      el.addEventListener("pointerleave", up, { passive:false });
      el.addEventListener("contextmenu", (e)=>e.preventDefault());
    }

    bindHoldButton(tLeft, "KeyA");
    bindHoldButton(tRight, "KeyD");
    bindHoldButton(tJump, "Space");

    function setTouchVisible(on) {
      if (!touch) return;
      // 터치 디바이스(대충)일 때만 보여주기
      const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
      touch.style.display = (on && coarse) ? "flex" : "none";
    }

    // ========= UI =========
    function showOverlay(el, on) {
      if (!el) return;
      el.style.display = on ? "flex" : "none";
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

    function updateTokenLines() {
      const token = getContinueToken();
      const text = `이어하기 토큰: ${token}/1`;
      if (tokenLineTitle) tokenLineTitle.textContent = text;
      if (tokenLinePause) tokenLinePause.textContent = text;
      if (tokenLineOver) tokenLineOver.textContent = text;
    }

    function syncTitleBackButton() {
      if (!btnTitleBack) return;
      btnTitleBack.style.display = (state === "TITLE" && titleFromGame) ? "inline-block" : "none";
    }

    function renderSlotUI() {
      const active = getActiveSlot();
      const token = getContinueToken();
      const deathPending = getDeathPending();

      for (let s = 1; s <= SLOT_COUNT; s++) {
        const data = readSave(s);

        if (slotActive[s]) slotActive[s].style.display = (s === active) ? "inline-block" : "none";

        if (!data) {
          if (slotBadge[s]) slotBadge[s].textContent = "EMPTY";
          if (slotMeta[s]) slotMeta[s].textContent = "No save data.";
          if (slotLoadBtn[s]) slotLoadBtn[s].disabled = true;
          if (slotDelBtn[s]) slotDelBtn[s].disabled = true;
        } else {
          if (slotBadge[s]) slotBadge[s].textContent = "SAVED";
          const lines = [
            `LEVEL: ${data.level}   WAVE: ${data.wave}`,
            `SCORE: ${data.score}`,
            `HP: ${Math.round(data.player?.hp ?? 0)}/${Math.round(data.player?.maxHp ?? 0)}`,
            `ATK: ${Math.round(data.player?.baseAtk ?? 0)}`,
            `SAVED: ${data.savedAt || "-"}`
          ];
          if (slotMeta[s]) slotMeta[s].textContent = lines.join("\n");
          if (slotDelBtn[s]) slotDelBtn[s].disabled = false;

          const titleLoadBlocked = (deathPending === 1 && token === 0);
          if (slotLoadBtn[s]) slotLoadBtn[s].disabled = titleLoadBlocked ? true : false;
        }
      }

      for (let s = 1; s <= SLOT_COUNT; s++) {
        if (!miniSlotBtn[s]) continue;
        miniSlotBtn[s].classList.toggle("active", s === active);
      }
      if (activeSlotNote) activeSlotNote.textContent = `ACTIVE: SLOT ${active}`;

      updateTokenLines();
    }

    function renderGameOverUI() {
      const token = getContinueToken();
      const hasAny = anySaveExists();

      if (overNote) {
        if (!hasAny) overNote.textContent = "저장 데이터가 없습니다. (SAVE 또는 보스 체크포인트 저장 필요)";
        else if (token === 0) overNote.textContent = "이어하기 토큰이 0입니다. (저장으로 다시 충전)";
        else overNote.textContent = "불러올 슬롯을 선택하세요. (이어하기 1회 소모)";
      }

      for (let s = 1; s <= SLOT_COUNT; s++) {
        const data = readSave(s);
        const btn = goLoadBtn[s];
        if (!btn) continue;

        if (!data) {
          btn.disabled = true;
          btn.textContent = `LOAD SLOT ${s} (EMPTY)`;
        } else {
          btn.textContent = `LOAD SLOT ${s} (LV.${data.level} / W.${data.wave})`;
          btn.disabled = !(token === 1);
        }
      }

      updateTokenLines();
    }

    function renderAllMenus() {
      renderSlotUI();
      renderGameOverUI();
      syncTitleBackButton();
    }

    function setState(next) {
      if (next === "GAMEOVER") {
        titleFromGame = false;
        titleReturnState = "PAUSE";
      }

      state = next;

      showOverlay(titleMenu, state === "TITLE");
      showOverlay(pauseMenu, state === "PAUSE");
      showOverlay(rewardMenu, state === "REWARD");
      showOverlay(overlay, state === "GAMEOVER");

      if (pauseBtn) {
        const show = (state === "PLAY" || state === "PAUSE");
        pauseBtn.style.display = show ? "block" : "none";
        pauseBtn.textContent = (state === "PAUSE") ? "▶" : "⏸";
      }

      // ✅ 터치 버튼은 PLAY에서만 표시 (죽음/메뉴에서는 숨김)
      setTouchVisible(state === "PLAY");

      if (bgm) {
        if (state === "PLAY") {
          if (bgm.currentTime > 0) bgm.play().catch(()=>{});
        } else {
          bgm.pause();
        }
      }

      renderAllMenus();
    }

    // ========= SAVE POLICIES =========
    function saveToSlot(slot, reasonText = "SAVED") {
      if (player.hp <= 0) return false;

      const s = clamp(slot, 1, SLOT_COUNT);
      const data = {
        v: 2,
        slot: s,
        savedAt: safeNowISO(),
        score, level, exp, wave,
        player: { hp: player.hp, maxHp: player.maxHp, baseAtk: player.baseAtk },
        core: { stack: coreStack, time: awakeningTimeLeft, color: coreColor }
      };

      const ok = writeSave(s, data);
      if (ok) {
        setContinueToken(1);
        showItemNotice(`${reasonText} (SLOT ${s})`);
      } else {
        showItemNotice("SAVE FAILED");
      }
      return ok;
    }

    function applySaveData(data) {
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

      invulnTime = 1.2;
      syncHUD();
    }

    function loadFromSlot(slot, fromDeath = false) {
      const s = clamp(slot, 1, SLOT_COUNT);
      const data = readSave(s);
      if (!data) { showItemNotice(`SLOT ${s} EMPTY`); return false; }

      if (fromDeath) {
        const token = getContinueToken();
        if (token !== 1) { showItemNotice("NO CONTINUE"); return false; }
        setContinueToken(0);
        setDeathPending(0);
      }

      setActiveSlot(s);
      applySaveData(data);

      titleFromGame = false;
      titleReturnState = "PAUSE";

      setState("PLAY");
      showItemNotice(`LOADED (SLOT ${s})`);
      return true;
    }

    // ========= FLOW =========
    function keysReset() { for (const k in keys) keys[k] = false; }

    function startNewGame(slot) {
      const s = clamp(slot, 1, SLOT_COUNT);
      setActiveSlot(s);
      clearSave(s);
      setContinueToken(0);
      setDeathPending(0);

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

      titleFromGame = false;
      titleReturnState = "PAUSE";

      syncHUD();
      setState("PLAY");
      showItemNotice(`NEW GAME (SLOT ${s})`);
    }

    function toTitle() {
      keysReset();
      titleFromGame = false;
      titleReturnState = "PAUSE";
      setState("TITLE");
    }

    function openTitleFromPause() {
      titleFromGame = true;
      titleReturnState = "PAUSE";
      setState("TITLE");
    }

    function backToGame() {
      if (!titleFromGame) return;
      setState(titleReturnState || "PAUSE");
    }

    function endGame() {
      setDeathPending(1);
      titleFromGame = false;
      titleReturnState = "PAUSE";
      setState("GAMEOVER");

      if (finalResult) {
        finalResult.textContent = `SCORE: ${score} | LEVEL: ${level} | WAVE: ${wave}`;
      }
    }

    // ========= INPUT =========
    function togglePause() {
      if (state === "PLAY") setState("PAUSE");
      else if (state === "PAUSE") setState("PLAY");
    }

    if (pauseBtn) {
      pauseBtn.addEventListener("click", () => togglePause());
      pauseBtn.addEventListener("touchstart", (e) => { e.preventDefault(); togglePause(); }, { passive:false });
    }

    if (btnTitleBack) btnTitleBack.addEventListener("click", () => backToGame());

    if (btnResume) btnResume.addEventListener("click", () => setState("PLAY"));
    if (btnSave) btnSave.addEventListener("click", () => saveToSlot(getActiveSlot(), "SAVED"));
    if (btnRestart) btnRestart.addEventListener("click", () => startNewGame(getActiveSlot()));
    if (btnToTitle) btnToTitle.addEventListener("click", () => openTitleFromPause());

    for (let s = 1; s <= SLOT_COUNT; s++) {
      const b = miniSlotBtn[s];
      if (!b) continue;
      b.addEventListener("click", () => setActiveSlot(s));
    }

    for (let s = 1; s <= SLOT_COUNT; s++) {
      if (slotLoadBtn[s]) slotLoadBtn[s].addEventListener("click", () => {
        const fromDeath = (getDeathPending() === 1);
        loadFromSlot(s, fromDeath);
      });
      if (slotNewBtn[s]) slotNewBtn[s].addEventListener("click", () => startNewGame(s));
      if (slotDelBtn[s]) slotDelBtn[s].addEventListener("click", () => {
        clearSave(s);
        showItemNotice(`DELETED SLOT ${s}`);
        renderAllMenus();
      });
    }

    if (btnRetry) btnRetry.addEventListener("click", () => startNewGame(getActiveSlot()));
    if (btnOverTitle) btnOverTitle.addEventListener("click", () => toTitle());
    for (let s = 1; s <= SLOT_COUNT; s++) {
      const b = goLoadBtn[s];
      if (!b) continue;
      b.addEventListener("click", () => loadFromSlot(s, true));
    }

    window.addEventListener("keydown", (e) => {
      if (["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code)) e.preventDefault();

      if (state === "TITLE") {
        if (titleFromGame && (e.code === "Escape" || e.code === "KeyP")) {
          e.preventDefault();
          backToGame();
        }
        return;
      }

      if (state === "GAMEOVER" || state === "REWARD") return;

      if (e.code === "KeyP" || e.code === "Escape") {
        e.preventDefault();
        togglePause();
        return;
      }

      keys[e.code] = true;
      if (bgm && bgm.paused && (state === "PLAY" || state === "PAUSE")) bgm.play().catch(()=>{});
    }, { passive:false });

    window.addEventListener("keyup", (e) => { keys[e.code] = false; });

    // ========= SPAWN SYSTEM =========
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
        try { if (state === "PLAY") spawnEnemy(); }
        finally { scheduleEnemySpawn(); }
      }, enemySpawnMs());
    }

    function scheduleLightningSpawn() {
      setTimeout(() => {
        try { if (state === "PLAY") spawnLightnings(); }
        finally { scheduleLightningSpawn(); }
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
      const mhp = 100 + (level * 30);
      enemies.push({
        x: Math.random() > 0.5 ? -150 : W + 150,
        y: floorY - 95,
        w: 75,
        h: 95,
        hp: mhp,
        maxHp: mhp,
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

    // ========= REWARD / CHECKPOINT AUTOSAVE =========
    const REWARD_POOL = [
      { id:"heal_full", name:"나노 리부트", desc:"HP 완전 회복 + 최대 HP +20", apply:()=>{ player.maxHp += 20; player.hp = player.maxHp; } },
      { id:"atk_up", name:"코어 튜닝", desc:"기본 공격력 +25", apply:()=>{ player.baseAtk += 25; } },
      { id:"core_stack", name:"에테르 코어 주입", desc:"CORE 스택 +1 & 오버드라이브 10초", apply:()=>{ coreStack += 1; awakeningTimeLeft = 10; coreColor="#f0f"; } },
      { id:"thunder_burst", name:"에테르 썬더", desc:"현재 화면 적에게 대미지 6000", apply:()=>{ enemies.forEach(e => { e.hp -= 6000; }); } },
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
      openRewardMenu(wave + 1);
    }

    function applyReward(index) {
      const r = currentRewards[index];
      if (!r) return;

      wave += 1;
      r.apply();
      invulnTime = Math.max(invulnTime, 1.0);

      // ✅ 보상 선택 완료 순간에만 자동 저장
      saveToSlot(getActiveSlot(), "CHECKPOINT");

      showItemNotice(`WAVE ${wave} START`);
      setState("PLAY");
    }

    rewardBtns.forEach((btn, i) => {
      if (!btn) return;
      btn.addEventListener("click", () => {
        if (state !== "REWARD") return;
        applyReward(i);
      });
    });

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

      lightnings.forEach(ln => {
        ln.life--;
        if (ln.life < 15 && ln.life > 0) {
          if (invulnTime <= 0 && player.x < ln.x + ln.w && player.x + player.w > ln.x) player.hp -= 3;
        }
      });
      lightnings = lightnings.filter(ln => ln.life > 0);

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

    setActiveSlot(getActiveSlot());
    renderAllMenus();
    setState("TITLE");

    scheduleEnemySpawn();
    scheduleLightningSpawn();

    ctx.fillStyle = "#010108";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.font = "18px Arial Black";
    ctx.fillText("Loading...", 20, Math.max(40, H - 30));
    requestAnimationFrame(frame);
  });
})();
