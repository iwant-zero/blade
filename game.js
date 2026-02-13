import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- 1. 엔진 초기화 ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050508);
scene.fog = new THREE.FogExp2(0x050508, 0.05);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// 카메라 초기 위치 설정 (플레이어 뒤쪽 위)
camera.position.set(0, 8, 12); 

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// --- 2. 텍스처 로더 ---
const loader = new THREE.TextureLoader();
const playerTex = loader.load('assets/player.png'); 

// --- 3. 환경 구성 ---
const gridHelper = new THREE.GridHelper(100, 50, 0x00ffff, 0x222244);
scene.add(gridHelper);

const floorGeo = new THREE.PlaneGeometry(200, 200);
const floorMat = new THREE.MeshStandardMaterial({ color: 0x101020, side: THREE.DoubleSide });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.01;
scene.add(floor);

const ambient = new THREE.AmbientLight(0xffffff, 1.2); 
scene.add(ambient);

const pointLight = new THREE.PointLight(0x00ffff, 50, 100);
pointLight.position.set(0, 10, 5);
scene.add(pointLight);

// --- 4. 플레이어 & 에테르 블레이드 ---
const player = new THREE.Group();
const charGeo = new THREE.BoxGeometry(1.5, 2.5, 0.1); 
const charMat = new THREE.MeshStandardMaterial({ map: playerTex, transparent: true, side: THREE.DoubleSide });
const character = new THREE.Mesh(charGeo, charMat);
character.position.y = 1.25;
player.add(character);

const bladeGeo = new THREE.BoxGeometry(0.1, 2.8, 0.4);
const bladeMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 10 });
const blade = new THREE.Mesh(bladeGeo, bladeMat);
blade.position.set(0.8, 1.8, 0.2);
player.add(blade);
scene.add(player);

// --- 5. 시스템 변수 ---
let stats = { hp: 100, mp: 100 };
let enemies = [];
const keys = {};
let isAttacking = false;

// --- 6. 푸른 마력의 잔상 로직 ---
function createAetherAfterimage() {
    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    blade.getWorldPosition(worldPos);
    blade.getWorldQuaternion(worldQuat);

    const ghost = new THREE.Mesh(bladeGeo, new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending }));
    ghost.position.copy(worldPos);
    ghost.quaternion.copy(worldQuat);
    scene.add(ghost);

    const damageInterval = setInterval(() => {
        enemies.forEach((e, idx) => {
            if(e.position.distanceTo(ghost.position) < 3) {
                e.userData.hp -= 1;
                if(e.userData.hp <= 0) {
                    log("잔상이 적을 소멸시켰습니다.");
                    scene.remove(e);
                    enemies.splice(idx, 1);
                    setTimeout(spawnEnemy, 2000);
                }
            }
        });
    }, 100);

    let life = 1.0;
    const fade = setInterval(() => {
        life -= 0.08;
        ghost.material.opacity = life;
        if(life <= 0) { clearInterval(fade); clearInterval(damageInterval); scene.remove(ghost); }
    }, 50);
}

// --- 7. 적 소환 ---
function spawnEnemy() {
    const enemy = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 12), new THREE.MeshStandardMaterial({ color: 0xff0044, wireframe: true, emissive: 0xff0044 }));
    enemy.position.set(Math.random()*60-30, 1, Math.random()*60-30);
    enemy.userData = { hp: 10 };
    scene.add(enemy);
    enemies.push(enemy);
}
for(let i=0; i<10; i++) spawnEnemy();

// --- 8. 이벤트 처리 ---
window.onkeydown = (e) => keys[e.code] = true;
window.onkeyup = (e) => keys[e.code] = false;
window.onmousedown = () => { if(!isAttacking) performAttack(); };

function performAttack() {
    isAttacking = true;
    log("에테르 블레이드 해방!");
    setTimeout(() => { isAttacking = false; }, 500);
}

function log(msg) {
    const l = document.getElementById('game-log');
    if(l) l.innerText = `> ${msg}`;
}

// --- 9. 메인 루프 (이동 방향 수정됨) ---
function animate() {
    requestAnimationFrame(animate);
    
    // 이동 속도 및 방향 (W: -z 전진, S: +z 후진으로 수정)
    const speed = 0.2;
    if(keys['KeyW'] || keys['ArrowUp']) player.position.z -= speed;
    if(keys['KeyS'] || keys['ArrowDown']) player.position.z += speed;
    if(keys['KeyA'] || keys['ArrowLeft']) player.position.x -= speed;
    if(keys['KeyD'] || keys['ArrowRight']) player.position.x += speed;

    // 공격 중 검 회전 및 잔상
    if(isAttacking) {
        blade.rotation.x += 0.5;
        createAetherAfterimage();
    } else {
        blade.rotation.x = THREE.MathUtils.lerp(blade.rotation.x, Math.PI/6, 0.1);
    }

    // UI 업데이트
    document.getElementById('hp-bar').style.width = stats.hp + '%';
    document.getElementById('mp-bar').style.width = stats.mp + '%';

    // 카메라가 플레이어를 부드럽게 따라다님
    controls.target.lerp(player.position, 0.1);
    controls.update();
    renderer.render(scene, camera);
}
animate();

window.onresize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
};
