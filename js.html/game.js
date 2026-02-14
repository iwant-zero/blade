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

    // Touch controls
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
    const rewardBtns = [
      document.getElementById("reward-0"),
      document.getElementById("reward-1"),
      document.getElementById("reward-2"),
    ];
    const rewardNames = [
      document.getElementById("reward-name-0"),
      document.getElementById("reward-name-1"),
      document.getElementById("reward-name-2"),
    ];
    const rewardDescs = [
      document.getElementById("reward-desc-0"),
      document.getElementById("reward-desc-1"),
      document.getElementById("reward-desc-2"),
    ];

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

    // ========= IMPORTANT: VIRTUAL RESOLUTION (폰 화면 “너무 큼” 해결 핵심) =========
    // 이 월드 좌표계에서 게임이 돌아가고, 실제 화면에 자동 스케일/레터박스됨
    const WORLD_W = 960;
    const WORLD_H = 540;

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

    // ========= RENDER SCALE / VIEWPORT =========
    let screenW = 0, screenH = 0, DPR = 1;
    let viewScale = 1, viewW = WORLD_W, viewH = WORLD_H, viewOffX = 0, viewOffY = 0;

    const floorY = WORLD_H - 100;

    function beginScreen() {
      // 화면 전체 픽셀 기준
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    function beginWorld() {
      // 월드 좌표(WORLD_W/WORLD_H) 기준으로 보이게 스케일 + 중앙 정렬(레터박스)
      ctx.setTransform(DPR * viewScale, 0, 0, DPR * viewScale, viewOffX * DPR, viewOffY * DPR);
    }

    // ========= PLAYER =========
    const player = {
      x: WORLD_W * 0.5 - 40, y: floorY - 110, w: 80, h: 110,
      vx: 0, vy: 0, grounded: false, dir: 1,
      hp: 100, maxHp: 100, baseAtk: 45
    };

    function resize() {
      DPR = Math.max(1, window.devicePixelRatio || 1);
      screenW = Math.max(320, window.innerWidth);
      screenH = Math.max(240, window.innerHeight);

      // 캔버스는 화면을 꽉 채움(배경/레터박스 포함)
      canvas.style.width = screenW + "px";
      canvas.style.height = screenH + "px";
      canvas.width = Math.floor(screenW * DPR);
      canvas.height = Math.floor(screenH * DPR);

      // ✅ 월드(WORLD_W/H)를 화면에 “맞춰서” 보여주기 위한 스케일 계산
      viewScale = Math.min(screenW / WORLD_W, screenH / WORLD_H);
      viewW = WORLD_W * viewScale;
      viewH = WORLD_H * viewScale;
      viewOffX = (screenW - viewW) * 0.5;
      viewOffY = (screenH - viewH) * 0.5;

      // 플레이어 위치 보정(월드 기준)
      player.x = clamp(player.x, 0, WORLD_W - player.w);
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

    // ========= TOUCH =========
    function bindHoldButton(el, keyCode) {
      if (!el) return;
      const down = (e) => { e.preventDefault(); keys[keyCode] = true; };
      const up = (e) => { e.preventDefault(); keys[keyCode] = false; };

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

          const titleLoadBlocked = (deathPending ===
