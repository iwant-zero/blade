import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- 초기화 ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020205);
scene.fog = new THREE.FogExp2(0x020205, 0.03);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ReinhardToneMapping;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// --- 텍스처 로딩 (assets 폴더 이미지 사용) ---
const loader = new THREE.TextureLoader();
const floorTex = loader.load('assets/floor.jpg');
floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
floorTex.repeat.set(20, 20);

// --- 환경 구성 ---
const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.1, metalness: 0.5 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const ambient = new THREE.AmbientLight(0x4040ff, 0.4);
scene.add(ambient);

const sun = new THREE.PointLight(0x00ffff, 10, 50);
sun.position.set(0, 10, 0);
scene.add(sun);

// --- 플레이어 (에테르 나이트) ---
const player = new THREE.Group();
const charBody = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.5, 1, 4, 16),
    new THREE.MeshStandardMaterial({ color: 0x050510, metalness: 1, roughness: 0.1 })
);
charBody.position.y = 1;
player.add(charBody);

const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 2.5, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 10 })
);
blade.position.set(0.8, 1.8, 0);
player.add(blade);
scene.add(player);

// --- 시스템 변수 ---
let stats = { hp: 100, mp: 100, inv: [] };
let enemies = [];
const keys = {};

// --- 파티클 시스템 (푸른 마력의 잔상) ---
function createAfterimage() {
    const ghost = blade.clone();
    ghost.position.copy(player.position).add(blade.position);
    ghost.rotation.copy(player.rotation).add(blade.rotation);
    ghost.material = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.5 });
    scene.add(ghost);
    
    let life = 1.0;
    const fade = setInterval(() => {
        life -= 0.1;
        ghost.material.opacity = life;
        if(life <= 0) {
            clearInterval(fade);
            scene.remove(ghost);
        }
    }, 50);
}

// --- 사냥 로직 ---
function spawnEnemy() {
    const enemy = new THREE.Mesh(
        new THREE.SphereGeometry(0.8, 6, 6),
        new THREE.MeshStandardMaterial({ color: 0xff0044, wireframe: true })
    );
    enemy.position.set(Math.random()*60-30, 1, Math.random()*60-30);
    enemy.userData = { hp: 2 };
    scene.add(enemy);
    enemies.push(enemy);
}
for(let i=0; i<12; i++) spawnEnemy();

// --- 입력 처리 ---
window.onkeydown = (e) => {
    keys[e.code] = true;
    if(e.code === 'KeyI') document.getElementById('inventory-window').classList.toggle('hidden');
    if(e.code === 'KeyQ') castNova();
};
window.onkeyup = (e) => keys[e.code] = false;

let isAttacking = false;
window.onmousedown = () => { if(!isAttacking) performAttack(); };

function performAttack() {
    isAttacking = true;
    log("에테르 블레이드 휘두르기!");
    setTimeout(() => {
        enemies.forEach((e, idx) => {
            if(e.position.distanceTo(player.position) < 4) {
                scene.remove(e);
                enemies.splice(idx, 1);
                log("그림자 생명체 처치!");
                stats.mp = Math.min(100, stats.mp + 10);
                setTimeout(spawnEnemy, 2000);
            }
        });
        isAttacking = false;
    }, 300);
}

function castNova() {
    if(stats.mp < 30) return log("MP 부족!");
    stats.mp -= 30;
    log("에테르 노바 발사!");
    // 광역 시각 효과 로직 추가 가능
}

function log(msg) {
    const l = document.getElementById('game-log');
    l.innerText = `> ${msg}`;
}

// --- 메인 엔진 루프 ---
function animate() {
    requestAnimationFrame(animate);
    
    // 이동
    const speed = 0.2;
    if(keys['KeyW']) player.position.z -= speed;
    if(keys['KeyS']) player.position.z += speed;
    if(keys['KeyA']) player.position.x -= speed;
    if(keys['KeyD']) player.position.x += speed;

    // 공격 중 잔상 생성
    if(isAttacking) {
        blade.rotation.x += 0.5;
        createAfterimage();
    } else {
        blade.rotation.x = Math.PI/6;
    }

    // UI 업데이트
    document.getElementById('hp-bar').style.width = stats.hp + '%';
    document.getElementById('mp-bar').style.width = stats.mp + '%';

    controls.target.copy(player.position);
    controls.update();
    renderer.render(scene, camera);
}
animate();

window.onresize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
};
