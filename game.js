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

// --- 텍스처 로딩 ---
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

// --- 플레이어 ---
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
let stats = { hp: 100, mp: 100 };
let enemies = [];
const keys = {};
let isAttacking = false;

// --- [핵심] 푸른 마력의 잔상 강화 시스템 ---
function createAetherBladeAfterimage() {
    const ghost = blade.clone();
    // 플레이어와 검의 현재 위치/회전값을 월드 좌표로 변환하여 복사
    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    blade.getWorldPosition(worldPos);
    blade.getWorldQuaternion(worldQuat);
    
    ghost.position.copy(worldPos);
    ghost.quaternion.copy(worldQuat);
    
    ghost.material = new THREE.MeshBasicMaterial({ 
        color: 0x00ffff, 
        transparent: true, 
        opacity: 0.6,
        blending: THREE.AdditiveBlending 
    });
    scene.add(ghost);
    
    // [강화] 잔상이 적을 침식하는 공격 판정
    const damageInterval = setInterval(() => {
        enemies.forEach((e, idx) => {
            if(e.position.distanceTo(ghost.position) < 2.5) {
                e.userData.hp -= 0.2; // 초당 약 2데미지
                if(e.userData.hp <= 0) {
                    log("푸른 마력의 잔상이 적을 소멸시켰습니다.");
                    scene.remove(e);
                    enemies.splice(idx, 1);
                    spawnEnemy(); // 적 재생성
                }
            }
        });
    }, 100);

    // Fade Out 효과
    let life = 1.0;
    const fade = setInterval(() => {
        life -= 0.05;
        ghost.material.opacity = life;
        if(life <= 0) {
            clearInterval(fade);
            clearInterval(damageInterval);
            scene.remove(ghost);
        }
    }, 30);
}

// --- 사냥 로직 ---
function spawnEnemy() {
    const enemy = new THREE.Mesh(
        new THREE.SphereGeometry(0.8, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xff0044, wireframe: true })
    );
    enemy.position.set(Math.random()*40-20, 1, Math.random()*40-20);
    enemy.userData = { hp: 5 }; // 잔상 공격을 견디도록 HP 상향
    scene.add(enemy);
    enemies.push(enemy);
}
for(let i=0; i<10; i++) spawnEnemy();

// --- 입력 처리 ---
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

// --- 엔진 루프 ---
function animate() {
    requestAnimationFrame(animate);
    
    const speed = 0.15;
    if(keys['KeyW']) player.position.z -= speed;
    if(keys['KeyS']) player.position.z += speed;
    if(keys['KeyA']) player.position.x -= speed;
    if(keys['KeyD']) player.position.x += speed;

    if(isAttacking) {
        blade.rotation.x += 0.4;
        createAetherBladeAfterimage(); // 공격 중 실시간 잔상 생성
    } else {
        blade.rotation.x = THREE.MathUtils.lerp(blade.rotation.x, Math.PI/6, 0.1);
    }

    document.getElementById('hp-bar').style.width = stats.hp + '%';
    document.getElementById('mp-bar').style.width = stats.mp + '%';

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
