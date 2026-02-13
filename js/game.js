const player = document.getElementById('player');
const monster = document.getElementById('monster');
const scoreDisplay = document.getElementById('score');

let score = 0;

let gameWidth = document.getElementById('game-container').clientWidth;
let gameHeight = document.getElementById('game-container').clientHeight;

let playerPos = { x: gameWidth / 2 - 20, y: gameHeight / 2 - 20 };
const playerSize = player.clientWidth || 40;
const monsterSize = monster.clientWidth || 40;
const speed = 8;

function setPos(elem, pos) {
  const maxX = gameWidth - playerSize;
  const maxY = gameHeight - playerSize;
  const x = Math.min(Math.max(0, pos.x), maxX);
  const y = Math.min(Math.max(0, pos.y), maxY);
  elem.style.left = x + 'px';
  elem.style.top = y + 'px';
}

// 몬스터를 랜덤 위치에 배치
function spawnMonster() {
  const x = Math.random() * (gameWidth - monsterSize);
  const y = Math.random() * (gameHeight - monsterSize);
  monster.style.left = x + 'px';
  monster.style.top = y + 'px';
}

// 공격 기능: 플레이어와 몬스터 거리 검사
function attack() {
  const mx = parseFloat(monster.style.left);
  const my = parseFloat(monster.style.top);
  const dx = playerPos.x - mx;
  const dy = playerPos.y - my;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 50) {
    score++;
    scoreDisplay.textContent = `점수: ${score}`;

    spawnMonster();
  }
}

// 키보드 입력 처리 (PC)
function onKeyDown(e) {
  switch (e.key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      playerPos.y -= speed;
      break;
    case 'ArrowDown':
    case 's':
    case 'S':
      playerPos.y += speed;
      break;
    case 'ArrowLeft':
    case 'a':
    case 'A':
      playerPos.x -= speed;
      break;
    case 'ArrowRight':
    case 'd':
    case 'D':
      playerPos.x += speed;
      break;
    case ' ':
      attack();
      break;
  }
  setPos(player, playerPos);
}

// 터치 버튼 입력 처리 (모바일)
function addTouchListeners() {
  const directions = {
    'btn-up': { x: 0, y: -speed },
    'btn-down': { x: 0, y: speed },
    'btn-left': { x: -speed, y: 0 },
    'btn-right': { x: speed, y: 0 }
  };

  for (const id in directions) {
    const btn = document.getElementById(id);
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      movePlayer(directions[id]);
    });
    // 터치하면서 계속 이동하게 처리하려면 터치 무브나 반복 함수 추가 가능
  }

  const attackBtn = document.getElementById('btn-attack');
  attackBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    attack();
  });
}

// 플레이어 위치 이동 함수
function movePlayer(delta) {
  playerPos.x += delta.x;
  playerPos.y += delta.y;
  setPos(player, playerPos);
}

// 초기 위치 설정 및 이벤트 바인딩
function init() {
  setPos(player, playerPos);
  spawnMonster();
  window.addEventListener('keydown', onKeyDown);

  if ('ontouchstart' in window) {
    addTouchListeners();
  }
}

window.addEventListener('load', init);

// 화면 크기 변경 시 게임 크기, 위치 보정
window.addEventListener('resize', () => {
  gameWidth = document.getElementById('game-container').clientWidth;
  gameHeight = document.getElementById('game-container').clientHeight;
  // 플레이어 위치도 화면 내로 보정
  setPos(player, playerPos);
  // 몬스터 위치도 화면 크기 내로 제한 필요 시 조정 가능
});
