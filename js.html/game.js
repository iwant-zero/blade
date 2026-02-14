(() => {
  "use strict";
  window.__BLADE_BOOTED = true;

  document.addEventListener("DOMContentLoaded", () => {
    // ===== Debug =====
    const debugEl = document.getElementById("debug");
    const showDebug = (msg) => {
      if (!debugEl) return;
      debugEl.style.display = "block";
      debugEl.textContent = msg;
    };

    try {
      // ===== DOM =====
      const canvas = document.getElementById("gameCanvas");
      if (!canvas) { showDebug("Canvas not found: #gameCanvas"); return; }
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) { showDebug("2D context failed."); return; }
      ctx.imageSmoothingEnabled = true;

      const hpFill = document.getElementById("hp-fill");
      const expFill = document.getElementById("exp-fill");
      const itemMsg = document.getElementById("item-msg");
      const awkTimerUI = document.getElementById("awk-timer");
      const statsEl = document.getElementById("stats");
      const scoreEl = document.getElementById("score");
      const pauseBtn = document.getElementById("pause-btn");

      // Touch
      const touch = document.getElementById("touch");
      const tLeft = document.getElementById("t-left");
      const tRight = document.getElementById("t-right");
      const tJump = document.getElementById("t-jump");

      // Menus
      const titleMenu = document.getElementById("title-menu");
      const btnTitleBack = document.getElementById("btn-title-back");

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

      // ============================================================
      // "줌 아웃" : 월드 크기를 키워서 회피 공간 확보
      // ============================================================
      const WORLD_W = 1280;
      const WORLD_H = 720;
      const floorY = WORLD_H - 120;

      // ===== Render scaling (캔버스 실제 픽셀 기준) =====
      let scalePx = 1;
      let offPxX = 0;
      let offPxY = 0;

      function resize() {
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        const sw = Math.max(320, window.innerWidth);
        const sh = Math.max(240, window.innerHeight);

        canvas.style.width = sw + "px";
        canvas.style.height = sh + "px";
        canvas.width = Math.floor(sw * dpr);
        canvas.height = Math.floor(sh * dpr);

        scalePx = Math.min(canvas.width / WORLD_W, canvas.height / WORLD_H);
        offPxX = Math.floor((canvas.width - WORLD_W * scalePx) * 0.5);
        offPxY = Math.floor((canvas.height - WORLD_H * scalePx) * 0.5);
      }
      window.addEventListener("resize", resize);

      // ===== Saves =====
      const SLOT_COUNT = 3;
      const SAVE_PREFIX = "blade_save_slot_v2_";
      const KEY_ACTIVE_SLOT = "blade_active_slot_v2";
      const KEY_CONTINUE_TOKEN = "blade_continue_token_v2";
      const KEY_DEATH_PENDING = "blade_death_pending_v2";
      const slotKey = (slot) => `${SAVE_PREFIX}${slot}`;

      const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
      const clamp01 = (v) => Math.max(0, Math.min(1, v));
      const cx = (o) => o.x + o.w * 0.5;
      const cy = (o) => o.y + o.h * 0.5;
      const distCenter = (a, b) => Math.hypot(cx(a) - cx(b), cy(a) - cy(b));
      const aabbOverlap = (a, b) => (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y);

      function safeNowISO(){ try { return new Date().toISOString(); } catch { return ""; } }

      function lsGet(key, fallback=null){ try { const v = localStorage.getItem(key); return (v==null)?fallback:v; } catch { return fallback; } }
      function lsSet(key, val){ try { localStorage.setItem(key, String(val)); } catch {} }
      function lsDel(key){ try { localStorage.removeItem(key); } catch {} }

      function getActiveSlot(){ const v = parseInt(lsGet(KEY_ACTIVE_SLOT,"1"),10); return clamp(Number.isFinite(v)?v:1,1,SLOT_COUNT); }
      function setActiveSlot(slot){ lsSet(KEY_ACTIVE_SLOT, clamp(parseInt(slot,10)||1,1,SLOT_COUNT)); renderAllMenus(); }

      function getContinueToken(){ return parseInt(lsGet(KEY_CONTINUE_TOKEN,"0"),10)===1 ? 1 : 0; }
      function setContinueToken(v){ lsSet(KEY_CONTINUE_TOKEN, v?1:0); renderAllMenus(); }

      function getDeathPending(){ return parseInt(lsGet(KEY_DEATH_PENDING,"0"),10)===1 ? 1 : 0; }
      function setDeathPending(v){ lsSet(KEY_DEATH_PENDING, v?1:0); renderAllMenus(); }

      function readSave(slot){
        try{
          const raw = localStorage.getItem(slotKey(slot));
          if(!raw) return null;
          const data = JSON.parse(raw);
          if(!data || data.v!==2) return null;
          return data;
        } catch { return null; }
      }
      function writeSave(slot, data){ try{ localStorage.setItem(slotKey(slot), JSON.stringify(data)); return true; } catch { return false; } }
      function clearSave(slot){ lsDel(slotKey(slot)); }
      function anySaveExists(){ for(let s=1;s<=SLOT_COUNT;s++) if(readSave(s)) return true; return false; }

      // ===== Assets =====
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

      // ===== Game =====
      let state = "TITLE"; // TITLE | PLAY | PAUSE | REWARD | GAMEOVER
      let titleFromGame = false;
      let titleReturnState = "PAUSE";

      let score = 0, level = 1, exp = 0, wave = 1;
      let coreStack = 0, awakeningTimeLeft = 0, coreColor = "#0ff";
      let invulnTime = 0;

      const PLAYER_SPEED = 12;
      const JUMP_POWER = 19;

      const player = {
        x: WORLD_W*0.5 - 40, y: floorY - 110, w: 80, h: 110,
        vx: 0, vy: 0, grounded: false, dir: 1,
        hp: 100, maxHp: 100, baseAtk: 45
      };

      let enemies = [], items = [], lightnings = [], afterimages = [];
      const keys = {};
      let currentRewards = [];

      // ===== Touch (중복 바인딩 방지: 여기서만 1번 바인딩) =====
      function bindHoldButton(el, keyCode){
        if(!el) return;
        const down = (e)=>{ e.preventDefault(); keys[keyCode]=true; };
        const up = (e)=>{ e.preventDefault(); keys[keyCode]=false; };
        el.addEventListener("pointerdown", down, {passive:false});
        el.addEventListener("pointerup", up, {passive:false});
        el.addEventListener("pointercancel", up, {passive:false});
        el.addEventListener("pointerleave", up, {passive:false});
        el.addEventListener("contextmenu", (e)=>e.preventDefault());
      }
      bindHoldButton(tLeft, "KeyA");
      bindHoldButton(tRight, "KeyD");
      bindHoldButton(tJump, "Space");

      function setTouchVisible(on){
        if(!touch) return;
        const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
        touch.style.display = (on && coarse) ? "flex" : "none";
      }

      // ===== UI helpers =====
      function showOverlay(el, on){ if(el) el.style.display = on ? "flex" : "none"; }

      function showItemNotice(text){
        if(!itemMsg) return;
        itemMsg.innerText = text;
        itemMsg.style.display = "block";
        itemMsg.style.color = "#1a1a1a";
        setTimeout(()=>{ itemMsg.style.display="none"; }, 1600);
      }

      function syncHUD(){
        if(statsEl) statsEl.innerText = `LV.${level} 에테르 기사`;
        if(scoreEl) scoreEl.innerText = `SCORE: ${score}`;
        if(hpFill) hpFill.style.width = (clamp01(player.hp/player.maxHp)*100).toFixed(1) + "%";
        if(expFill) expFill.style.width = clamp(exp,0,100).toFixed(1) + "%";
      }

      function updateTokenLines(){
        const token = getContinueToken();
        const text = `이어하기 토큰: ${token}/1`;
        if(tokenLineTitle) tokenLineTitle.textContent = text;
        if(tokenLinePause) tokenLinePause.textContent = text;
        if(tokenLineOver) tokenLineOver.textContent = text;
      }

      function syncTitleBackButton(){
        if(!btnTitleBack) return;
        btnTitleBack.style.display = (state==="TITLE" && titleFromGame) ? "inline-block" : "none";
      }

      function renderSlotUI(){
        const active = getActiveSlot();
        const token = getContinueToken();
        const deathPending = getDeathPending();

        for(let s=1;s<=SLOT_COUNT;s++){
          const data = readSave(s);

          if(slotActive[s]) slotActive[s].style.display = (s===active) ? "inline-block" : "none";

          if(!data){
            if(slotBadge[s]) slotBadge[s].textContent="EMPTY";
            if(slotMeta[s]) slotMeta[s].textContent="No save data.";
            if(slotLoadBtn[s]) slotLoadBtn[s].disabled=true;
            if(slotDelBtn[s]) slotDelBtn[s].disabled=true;
          } else {
            if(slotBadge[s]) slotBadge[s].textContent="SAVED";
            const lines = [
              `LEVEL: ${data.level}   WAVE: ${data.wave}`,
              `SCORE: ${data.score}`,
              `HP: ${Math.round(data.player?.hp ?? 0)}/${Math.round(data.player?.maxHp ?? 0)}`,
              `ATK: ${Math.round(data.player?.baseAtk ?? 0)}`,
              `SAVED: ${data.savedAt || "-"}`
            ];
            if(slotMeta[s]) slotMeta[s].textContent = lines.join("\n");
            if(slotDelBtn[s]) slotDelBtn[s].disabled=false;

            const blocked = (deathPending===1 && token===0);
            if(slotLoadBtn[s]) slotLoadBtn[s].disabled = blocked ? true : false;
          }
        }

        for(let s=1;s<=SLOT_COUNT;s++){
          if(!miniSlotBtn[s]) continue;
          miniSlotBtn[s].classList.toggle("active", s===active);
        }
        if(activeSlotNote) activeSlotNote.textContent = `ACTIVE: SLOT ${active}`;

        updateTokenLines();
      }

      function renderGameOverUI(){
        const token = getContinueToken();
        const hasAny = anySaveExists();

        if(overNote){
          if(!hasAny) overNote.textContent = "저장 데이터가 없습니다. (SAVE 또는 보스 체크포인트 저장 필요)";
          else if(token===0) overNote.textContent = "이어하기 토큰이 0입니다. (저장으로 다시 충전)";
          else overNote.textContent = "불러올 슬롯을 선택하세요. (이어하기 1회 소모)";
        }

        for(let s=1;s<=SLOT_COUNT;s++){
          const data = readSave(s);
          const btn = goLoadBtn[s];
          if(!btn) continue;

          if(!data){
            btn.disabled=true;
            btn.textContent=`LOAD SLOT ${s} (EMPTY)`;
          } else {
            btn.textContent=`LOAD SLOT ${s} (LV.${data.level} / W.${data.wave})`;
            btn.disabled = !(token===1);
          }
        }

        updateTokenLines();
      }

      function renderAllMenus(){
        renderSlotUI();
        renderGameOverUI();
        syncTitleBackButton();
      }

      function setState(next){
        state = next;

        showOverlay(titleMenu, state==="TITLE");
        showOverlay(pauseMenu, state==="PAUSE");
        showOverlay(rewardMenu, state==="REWARD");
        showOverlay(overlay, state==="GAMEOVER");

        if(pauseBtn){
          const show = (state==="PLAY" || state==="PAUSE");
          pauseBtn.style.display = show ? "block" : "none";
          pauseBtn.textContent = (state==="PAUSE") ? "▶" : "⏸";
        }

        setTouchVisible(state==="PLAY");

        if(bgm){
          if(state==="PLAY"){
            if(bgm.currentTime>0) bgm.play().catch(()=>{});
          } else {
            bgm.pause();
          }
        }

        renderAllMenus();
      }

      // ===== Save / Load =====
      function saveToSlot(slot, reason="SAVED"){
        if(player.hp<=0) return false;
        const s = clamp(slot,1,SLOT_COUNT);

        const data = {
          v: 2,
          slot: s,
          savedAt: safeNowISO(),
          score, level, exp, wave,
          player: { hp: player.hp, maxHp: player.maxHp, baseAtk: player.baseAtk },
          core: { stack: coreStack, time: awakeningTimeLeft, color: coreColor }
        };

        const ok = writeSave(s, data);
        if(ok){
          setContinueToken(1);
          showItemNotice(`${reason} (SLOT ${s})`);
        } else {
          showItemNotice("SAVE FAILED");
        }
        return ok;
      }

      function applySaveData(data){
        score = Number(data.score)||0;
        level = clamp(Number(data.level)||1, 1, 9999);
        exp = clamp(Number(data.exp)||0, 0, 100);
        wave = clamp(Number(data.wave)||1, 1, 9999);

        const p = data.player||{};
        player.maxHp = clamp(Number(p.maxHp)||100, 1, 999999);
        player.hp = clamp(Number(p.hp)||player.maxHp, 1, player.maxHp);
        player.baseAtk = clamp(Number(p.baseAtk)||45, 1, 999999);

        const c = data.core||{};
        coreStack = clamp(Number(c.stack)||0, 0, 999);
        awakeningTimeLeft = clamp(Number(c.time)||0, 0, 999);
        coreColor = (typeof c.color==="string" && c.color) ? c.color : "#0ff";

        enemies = []; items = []; lightnings = []; afterimages = [];
        player.vx=0; player.vy=0; player.grounded=false; player.dir=1;
        player.x = WORLD_W*0.5 - player.w*0.5;
        player.y = floorY - player.h;
        invulnTime = 1.2;

        syncHUD();
      }

      function loadFromSlot(slot, fromDeath=false){
        const s = clamp(slot,1,SLOT_COUNT);
        const data = readSave(s);
        if(!data){ showItemNotice(`SLOT ${s} EMPTY`); return false; }

        if(fromDeath){
          if(getContinueToken() !== 1){ showItemNotice("NO CONTINUE"); return false; }
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

      // ===== Flow =====
      function keysReset(){ for(const k in keys) keys[k]=false; }

      function startNewGame(slot){
        const s = clamp(slot,1,SLOT_COUNT);
        setActiveSlot(s);
        clearSave(s);
        setContinueToken(0);
        setDeathPending(0);

        score=0; level=1; exp=0; wave=1;
        coreStack=0; awakeningTimeLeft=0; coreColor="#0ff";
        invulnTime=0;

        player.maxHp=100; player.hp=100; player.baseAtk=45;
        player.vx=0; player.vy=0; player.grounded=false; player.dir=1;

        enemies=[]; items=[]; lightnings=[]; afterimages=[];
        player.x = WORLD_W*0.5 - player.w*0.5;
        player.y = floorY - player.h;

        titleFromGame=false; titleReturnState="PAUSE";
        syncHUD();
        setState("PLAY");
        showItemNotice(`NEW GAME (SLOT ${s})`);
      }

      function toTitle(){
        keysReset();
        titleFromGame=false; titleReturnState="PAUSE";
        setState("TITLE");
      }

      function openTitleFromPause(){
        titleFromGame=true; titleReturnState="PAUSE";
        setState("TITLE");
      }

      function backToGame(){
        if(!titleFromGame) return;
        setState(titleReturnState || "PAUSE");
      }

      function endGame(){
        setDeathPending(1);
        titleFromGame=false; titleReturnState="PAUSE";
        setState("GAMEOVER");
        if(finalResult) finalResult.textContent = `SCORE: ${score} | LEVEL: ${level} | WAVE: ${wave}`;
      }

      // ===== Input =====
      function togglePause(){
        if(state==="PLAY") setState("PAUSE");
        else if(state==="PAUSE") setState("PLAY");
      }

      if(pauseBtn){
        pauseBtn.addEventListener("click", togglePause);
        pauseBtn.addEventListener("touchstart", (e)=>{ e.preventDefault(); togglePause(); }, {passive:false});
      }
      if(btnTitleBack) btnTitleBack.addEventListener("click", backToGame);

      if(btnResume) btnResume.addEventListener("click", ()=>setState("PLAY"));
      if(btnSave) btnSave.addEventListener("click", ()=>saveToSlot(getActiveSlot(), "SAVED"));
      if(btnRestart) btnRestart.addEventListener("click", ()=>startNewGame(getActiveSlot()));
      if(btnToTitle) btnToTitle.addEventListener("click", openTitleFromPause);

      for(let s=1;s<=SLOT_COUNT;s++){
        if(miniSlotBtn[s]) miniSlotBtn[s].addEventListener("click", ()=>setActiveSlot(s));
      }

      for(let s=1;s<=SLOT_COUNT;s++){
        if(slotLoadBtn[s]) slotLoadBtn[s].addEventListener("click", ()=>loadFromSlot(s, getDeathPending()===1));
        if(slotNewBtn[s]) slotNewBtn[s].addEventListener("click", ()=>startNewGame(s));
        if(slotDelBtn[s]) slotDelBtn[s].addEventListener("click", ()=>{
          clearSave(s);
          showItemNotice(`DELETED SLOT ${s}`);
          renderAllMenus();
        });
      }

      if(btnRetry) btnRetry.addEventListener("click", ()=>startNewGame(getActiveSlot()));
      if(btnOverTitle) btnOverTitle.addEventListener("click", toTitle);
      for(let s=1;s<=SLOT_COUNT;s++){
        if(goLoadBtn[s]) goLoadBtn[s].addEventListener("click", ()=>loadFromSlot(s, true));
      }

      window.addEventListener("keydown", (e) => {
        if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code)) e.preventDefault();

        if(state==="TITLE"){
          if(titleFromGame && (e.code==="Escape" || e.code==="KeyP")) { e.preventDefault(); backToGame(); }
          return;
        }
        if(state==="GAMEOVER" || state==="REWARD") return;

        if(e.code==="KeyP" || e.code==="Escape"){ e.preventDefault(); togglePause(); return; }

        keys[e.code] = true;
        if(bgm && bgm.paused && (state==="PLAY" || state==="PAUSE")) bgm.play().catch(()=>{});
      }, {passive:false});

      window.addEventListener("keyup", (e)=>{ keys[e.code]=false; });

      // ===== Spawn =====
      function enemySpawnMs(){ return clamp(2000 - (wave-1)*90, 850, 2000); }
      function lightningSpawnMs(){ return clamp(5200 - (wave-1)*120, 3400, 5200); }

      function scheduleEnemySpawn(){
        setTimeout(()=>{ try{ if(state==="PLAY") spawnEnemy(); } finally{ scheduleEnemySpawn(); } }, enemySpawnMs());
      }
      function scheduleLightningSpawn(){
        setTimeout(()=>{ try{ if(state==="PLAY") spawnLightnings(); } finally{ scheduleLightningSpawn(); } }, lightningSpawnMs());
      }

      function tryDropItem(x, y){
        if(Math.random() > 0.2) return;
        const r = Math.random();
        const type = (r<0.2) ? "CORE" : (r<0.5) ? "THUNDER" : "HEAL";
        items.push({ x: clamp(x, 20, WORLD_W-80), y: floorY-60, w:55, h:55, type });
      }

      function spawnBoss(){
        const bs = 1 + (level/100);
        const bossHp = 2500 * Math.pow(1.7, level/10);
        enemies.push({
          x: WORLD_W + 260,
          y: floorY - (230*bs),
          w: 180*bs,
          h: 230*bs,
          hp: bossHp, maxHp: bossHp,
          speed: 1.2 + (level/70),
          isBoss: true, dead: false
        });
        showItemNotice(`BOSS ALERT: LV.${level}`);
      }

      function spawnMob(){
        const mhp = 100 + (level*30);
        enemies.push({
          x: Math.random() > 0.5 ? -170 : WORLD_W + 170,
          y: floorY - 95,
          w: 75, h: 95,
          hp: mhp, maxHp: mhp,
          speed: 2.8 + (level*0.25),
          isBoss: false, dead: false
        });
      }

      function spawnEnemy(){
        const bossAlive = enemies.some(e=>e.isBoss);
        const isBossTurn = (level % 10 === 0);
        if(isBossTurn && !bossAlive) spawnBoss();
        else spawnMob();
      }

      // ============================================================
      // 번개: 레인 기반 + 안전 레인 1개 보장 + 경고 → 낙뢰
      // ============================================================
      const LN_LANES = 12;
      const LN_WARN_SEC = 0.75;

      // ✅ (2) 번개 데미지 2배로 강하게
      const LN_STRIKE_SEC = 0.28;
      const LN_DPS = 56; // (기존 28) -> 2배

      function shuffle(arr){
        for(let i=arr.length-1;i>0;i--){
          const j = Math.floor(Math.random()*(i+1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      }

      function spawnLightnings(){
        const laneW = WORLD_W / LN_LANES;

        const pLane = clamp(Math.floor((player.x + player.w*0.5) / laneW), 0, LN_LANES-1);
        const offset = (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.6 ? 1 : 2);
        const safeLane = clamp(pLane + offset, 0, LN_LANES-1);

        // ✅ (1) 번개는 항상 6개 떨어지게 고정
        const strikeCount = 6;

        const candidates = [];
        for(let i=0;i<LN_LANES;i++){
          if(i === safeLane) continue;
          candidates.push(i);
        }
        shuffle(candidates);

        const chosen = candidates.slice(0, strikeCount);
        for(const lane of chosen){
          const x0 = lane * laneW;
          const pad = laneW * 0.12;
          const w = laneW - pad*2;

          lightnings.push({
            x: x0 + pad,
            y: -220,
            w,
            h: WORLD_H + 240,
            phase: "warn",
            t: LN_WARN_SEC
          });
        }
      }

      // ===== Reward / Checkpoint =====
      const REWARD_POOL = [
        { id:"heal_full", name:"나노 리부트", desc:"HP 완전 회복 + 최대 HP +20", apply:()=>{ player.maxHp += 20; player.hp = player.maxHp; } },
        { id:"atk_up", name:"코어 튜닝", desc:"기본 공격력 +25", apply:()=>{ player.baseAtk += 25; } },
        { id:"core_stack", name:"에테르 코어 주입", desc:"CORE 스택 +1 & 오버드라이브 10초", apply:()=>{ coreStack += 1; awakeningTimeLeft = 10; coreColor="#f0f"; } },
        { id:"thunder_burst", name:"에테르 썬더", desc:"현재 화면 적에게 대미지 6000", apply:()=>{ enemies.forEach(e=>{ e.hp -= 6000; }); } },
        { id:"shield", name:"위상 실드", desc:"3초간 무적(피격 무시)", apply:()=>{ invulnTime = Math.max(invulnTime, 3.0); } },
        { id:"maxhp_big", name:"강화 프레임", desc:"최대 HP +50 (즉시 30 회복)", apply:()=>{ player.maxHp += 50; player.hp = clamp(player.hp+30, 1, player.maxHp); } }
      ];

      function pickRewards(){
        const pool = REWARD_POOL.slice();
        for(let i=pool.length-1;i>0;i--){
          const j = Math.floor(Math.random()*(i+1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        return pool.slice(0,3);
      }

      function openRewardMenu(nextWave){
        currentRewards = pickRewards();
        if(rewardSub) rewardSub.textContent = `WAVE ${wave} → ${nextWave}`;
        for(let i=0;i<3;i++){
          const r = currentRewards[i];
          if(rewardNames[i]) rewardNames[i].textContent = r.name;
          if(rewardDescs[i]) rewardDescs[i].textContent = r.desc;
        }
        setState("REWARD");
      }

      function onBossCleared(){
        enemies = [];
        openRewardMenu(wave+1);
      }

      function applyReward(idx){
        const r = currentRewards[idx];
        if(!r) return;
        wave += 1;
        r.apply();
        invulnTime = Math.max(invulnTime, 1.0);

        saveToSlot(getActiveSlot(), "CHECKPOINT");

        showItemNotice(`WAVE ${wave} START`);
        setState("PLAY");
      }

      rewardBtns.forEach((btn,i)=>{
        if(!btn) return;
        btn.addEventListener("click", ()=>{ if(state==="REWARD") applyReward(i); });
      });

      // ===== Update / Draw =====
      function update(dt){
        if(state!=="PLAY") return;

        if(invulnTime>0) invulnTime = Math.max(0, invulnTime-dt);

        if(awakeningTimeLeft>0){
          awakeningTimeLeft -= dt;
          if(awkTimerUI){
            awkTimerUI.style.display="block";
            awkTimerUI.innerText = `OVERDRIVE: ${Math.max(0,awakeningTimeLeft).toFixed(1)}s (x${coreStack})`;
          }
          if(awakeningTimeLeft<=0){
            coreStack=0; coreColor="#0ff";
            if(awkTimerUI) awkTimerUI.style.display="none";
          }
        }

        if(keys["KeyA"]){ player.vx=-PLAYER_SPEED; player.dir=-1; }
        else if(keys["KeyD"]){ player.vx=PLAYER_SPEED; player.dir=1; }
        else player.vx *= 0.85;

        if(keys["Space"] && player.grounded){ player.vy=-JUMP_POWER; player.grounded=false; }

        player.vy += 0.9;
        player.x += player.vx;
        player.y += player.vy;

        player.x = clamp(player.x, 0, WORLD_W-player.w);
        if(player.y > floorY-player.h){
          player.y = floorY-player.h;
          player.vy = 0;
          player.grounded = true;
        }

        const currentAtk = player.baseAtk*(1+coreStack*0.6);
        const rotationSpeed = 0.2 + (coreStack*0.06);
        const orbitCount = 1 + coreStack;

        for(let i=0;i<orbitCount;i++){
          const angle = (Date.now()/1000*(rotationSpeed*10)) + (i*Math.PI*2/orbitCount);
          afterimages.push({
            x: cx(player) + Math.cos(angle)*110 - 11,
            y: cy(player) + Math.sin(angle)*110 - 11,
            opacity: 0.8, life: 12, color: coreColor
          });
        }

        const hitRangeBase = 190 + (coreStack*10);
        let bossJustDied = false;

        enemies.forEach(en=>{
          if(cx(en)<cx(player)) en.x += en.speed;
          else en.x -= en.speed;

          if(invulnTime<=0 && aabbOverlap(player,en)){
            player.hp -= en.isBoss ? 0.8 : 0.3;
          }

          const d = distCenter(player,en);
          const bossBonus = en.isBoss ? (en.w*0.15) : 0;

          if(d < (hitRangeBase + bossBonus)){
            en.hp -= currentAtk*0.17;
            if(en.hp<=0){
              en.dead = true;
              if(en.isBoss) bossJustDied = true;
            }
          }
        });

        enemies = enemies.filter(en=>{
          if(en.dead){
            tryDropItem(en.x, en.y);
            score += en.isBoss ? 8000 : 150;
            exp += en.isBoss ? 150 : 30;
            return false;
          }
          return true;
        });

        if(bossJustDied) onBossCleared();

        if(exp>=100){
          level++; exp=0;
          player.baseAtk += 15;
        }

        // Lightning (warn -> strike)
        lightnings.forEach(ln=>{
          ln.t -= dt;

          if(ln.phase === "warn"){
            if(ln.t <= 0){
              ln.phase = "strike";
              ln.t = LN_STRIKE_SEC;
            }
          } else {
            if(invulnTime<=0 && player.x < ln.x+ln.w && player.x+player.w > ln.x){
              player.hp -= LN_DPS * dt;
            }
            if(ln.t <= 0){
              ln.dead = true;
            }
          }
        });
        lightnings = lightnings.filter(ln=>!ln.dead);

        // Items pickup
        items = items.filter(it=>{
          if(Math.abs(cx(player)-(it.x+it.w/2))<65 && Math.abs(cy(player)-(it.y+it.h/2))<100){
            if(it.type==="CORE"){ coreStack++; awakeningTimeLeft=10; coreColor="#f0f"; showItemNotice("CORE AWAKENED!"); }
            else if(it.type==="THUNDER"){ enemies.forEach(e=>e.hp -= 4000); showItemNotice("ETHER THUNDER!"); }
            else if(it.type==="HEAL"){ player.hp = Math.min(player.maxHp, player.hp+60); showItemNotice("RECOVERED!"); }
            return false;
          }
          return true;
        });

        afterimages.forEach(a=>{ a.opacity -= 0.07; a.life--; });
        afterimages = afterimages.filter(a=>a.life>0);

        if(player.hp<=0) endGame();
        syncHUD();
      }

      function draw(){
        ctx.setTransform(1,0,0,1,0,0);
        ctx.fillStyle = "#000";
        ctx.fillRect(0,0,canvas.width,canvas.height);

        ctx.setTransform(scalePx,0,0,scalePx, offPxX, offPxY);

        if(img.bg.complete && img.bg.width>0) ctx.drawImage(img.bg, 0,0, WORLD_W, WORLD_H);
        else { ctx.fillStyle="#010108"; ctx.fillRect(0,0,WORLD_W,WORLD_H); }

        // lightning (warn/strike)
        lightnings.forEach(ln=>{
          const isWarn = ln.phase === "warn";
          const alpha = isWarn ? 0.18 : 1.0;

          if(img.ln.complete && img.ln.width>0){
            ctx.globalAlpha = alpha;
            ctx.drawImage(img.ln, ln.x, ln.y, ln.w, ln.h);
            ctx.globalAlpha = 1.0;
          } else {
            ctx.globalAlpha = alpha;
            ctx.fillStyle = "rgba(255,255,255,0.95)";
            ctx.fillRect(ln.x, 0, ln.w, WORLD_H);
            ctx.globalAlpha = 1.0;
          }

          if(isWarn){
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(ln.x, floorY + 4, ln.w, 4);
            ctx.globalAlpha = 1.0;
          }
        });

        // floor
        ctx.strokeStyle="#1a1a1a";
        ctx.lineWidth=4;
        ctx.beginPath();
        ctx.moveTo(0,floorY);
        ctx.lineTo(WORLD_W,floorY);
        ctx.stroke();

        // items
        items.forEach(it=>{
          let itemImg = img.it_heal;
          if(it.type==="CORE") itemImg = img.it_core;
          else if(it.type==="THUNDER") itemImg = img.it_thunder;

          if(itemImg.complete && itemImg.width>0) ctx.drawImage(itemImg, it.x,it.y,it.w,it.h);
          else {
            ctx.fillStyle = (it.type==="CORE")?"#f0f":(it.type==="THUNDER")?"#ff0":"#0f0";
            ctx.fillRect(it.x,it.y,it.w,it.h);
          }
        });

        // afterimages
        afterimages.forEach(a=>{
          ctx.globalAlpha = a.opacity;
          ctx.fillStyle = a.color || "#0ff";
          ctx.fillRect(a.x,a.y,22,22);
        });
        ctx.globalAlpha = 1;

        // enemies
        enemies.forEach(en=>{
          const image = en.isBoss ? img.b : img.e;
          if(image.complete && image.width>0) ctx.drawImage(image, en.x,en.y,en.w,en.h);
          else { ctx.fillStyle = en.isBoss ? "#ff0033" : "#ff55aa"; ctx.fillRect(en.x,en.y,en.w,en.h); }

          if(en.isBoss){
            const ratio = clamp01(en.hp/en.maxHp);
            ctx.fillStyle="#1a1a1a";
            ctx.fillRect(en.x, en.y-30, en.w, 15);
            ctx.fillStyle="#cc0000";
            ctx.fillRect(en.x, en.y-30, en.w*ratio, 15);
          }
        });

        // player
        const blink = (invulnTime>0) ? (Math.floor(performance.now()/80)%2===0) : true;
        if(blink){
          ctx.save();
          if(player.dir===-1){
            ctx.translate(player.x+player.w, player.y);
            ctx.scale(-1,1);
            if(img.p.complete && img.p.width>0) ctx.drawImage(img.p, 0,0, player.w,player.h);
            else { ctx.fillStyle="#00e5ff"; ctx.fillRect(0,0,player.w,player.h); }
          } else {
            if(img.p.complete && img.p.width>0) ctx.drawImage(img.p, player.x,player.y, player.w,player.h);
            else { ctx.fillStyle="#00e5ff"; ctx.fillRect(player.x,player.y,player.w,player.h); }
          }
          ctx.restore();
        }
      }

      // ===== Loop =====
      let last = performance.now();
      function frame(now){
        const dt = Math.min(0.05, Math.max(0.001, (now-last)/1000));
        last = now;
        update(dt);
        draw();
        requestAnimationFrame(frame);
      }

      // ===== Init =====
      resize();
      syncHUD();

      setActiveSlot(getActiveSlot());
      renderAllMenus();
      setState("TITLE");

      scheduleEnemySpawn();
      scheduleLightningSpawn();

      requestAnimationFrame(frame);

    } catch (e) {
      showDebug(`BOOT ERROR:\n${e.stack || e.message || String(e)}`);
    }
  });
})();
