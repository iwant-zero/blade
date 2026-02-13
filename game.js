import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- 1. 엔진 초기화 ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020205);
scene.fog = new THREE.FogExp2(0x020205, 0.02);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// --- 2. 텍스처 로딩 (이미지 우선 사용) ---
const loader = new THREE.TextureLoader();
const floorTex = loader.load('assets/floor.jpg', (tex) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(10, 10);
});
const playerTex = loader.load('assets/player.png'); // 빌드 시 사용할 주인공 이미지

// --- 3. 환경 구성 ---
const floorGeo = new THREE.PlaneGeometry(200, 200);
const floorMat = new THREE.MeshStandardMaterial({ 
    map: floorTex.image ? floorTex : null, 
    color: floorTex.image ? 0xffffff : 0x1a1a2e 
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const ambient = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambient);

const pointLight = new THREE.PointLight(0x00ffff, 20, 50);
pointLight.position.set(0, 10, 0);
scene.add(pointLight);

// --- 4. 플레이어 & 에테르 블레이드 ---
const player = new THREE.Group();

// 캐릭터 (이미지가 있으면 이미지로, 없으면 캡슐로 표시)
const charGeo = new THREE.BoxGeometry(1.5, 2.5, 0.1); 
const charMat = new THREE.MeshStandardMaterial({ 
    map: playerTex, 
    transparent: true, 
    side: THREE.DoubleSide 
});
const character = new THREE.Mesh(charGeo, charMat);
character.position.y = 1.25;
player.add(character);

// 빛나는 검 (푸른 마력의 원천)
const bladeGeo = new THREE.BoxGeometry(0.1, 2.5, 0.3);
const bladeMat = new THREE.MeshStandardMaterial({ 
    color: 0x00ffff, 
    emissive: 0x00ffff, 
    emissiveIntensity: 5 
});
const blade = new THREE.Mesh(bladeGeo, bladeMat);
blade.position.set(0.8, 1.5, 0.2);
player.add(blade);
scene.add(player);

// --- 5. 시스템 변수 ---
let stats = { hp: 100, mp: 100 };
let enemies = [];
const keys = {};
let isAttacking = false;

// --- 6. 푸른 마력의 잔상 강화 로직 ---
function createAetherAfterimage() {
    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    blade.getWorldPosition(worldPos);
    blade.getWorldQuaternion(worldQuat);

    const ghost = new THREE.Mesh(
        bladeGeo,
        new THREE.MeshBasicMaterial({ 
            color: 0x00ffff, 
            transparent: true, 
            opacity: 0.5,
            blending: THREE.AdditiveBlending 
        })
    );
    ghost.position.copy(worldPos);
    ghost.quaternion.copy(worldQuat);
    scene.add(ghost);

    // 잔상 데미지 판정
    const damageInterval = setInterval(() => {
        enemies.forEach((e, idx) => {
            if(e.position.distanceTo(ghost.position) < 2.5) {
                e.userData.hp -= 0.5;
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
        life -= 0.05;
        ghost.material.opacity = life;
        if(life <= 0) {
            clearInterval(fade);
            clearInterval(damageInterval);
            scene.remove(ghost);
        }
    }, 50);
}

// --- 7. 적 소환 & 사냥 ---
function spawnEnemy() {
    const enemy = new THREE.Mesh(
        new THREE.SphereGeometry(1, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xff0044, wireframe: true })
    );
    enemy.position.set(Math.random()*40-20, 1, Math.random()*40-20);
    enemy.userData = { hp: 10 };
    scene.add(enemy);
    enemies.push(enemy);
}
for(let i=0; i<8; i++) spawnEnemy();

// --- 8. 이벤트 처리 ---
window.onkeydown = (e) => keys[e.code] = true;
window.onkeyup = (e) => keys[e.code] = false;
window.onmousedown = () => { if(!isAttacking) performAttack(); };

function performAttack() {
    isAttacking = true;
    log("에테르 블레이드 해방!");
    setTimeout(() => { isAttacking = false; }, 600);
}

function log(msg) {
    const l = document.getElementById('game-log');
    if(l) l.innerText = `> ${msg}`;
}

// --- 9. 메인 루프 ---
function animate() {
    requestAnimationFrame(animate);
    
    // 플레이어 이동
    const speed = 0.15;
    if(keys['KeyW']) player.position.z -= speed;
    if(keys['KeyS']) player.position.z += speed;
    if(keys['KeyA']) player.position.x -= speed;
    if(keys['KeyD']) player.position.x += speed;

    // 공격 애니메이션 & 잔상
    if(isAttacking) {
        blade.rotation.x += 0.5;
        createAetherAfterimage();
    } else {
        blade.rotation.x = THREE.MathUtils.lerp(blade.rotation.x, Math.PI/6, 0.1);
    }

    // UI 동기화
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
