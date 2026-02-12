import * as THREE from 'three';

// 텍스처 로더 추가 (이미지를 불러오는 역할)
const loader = new THREE.TextureLoader();
const floorTex = loader.load('assets/floor.png'); // 여러분이 올린 이미지 경로

// 지면에 실제 텍스처 입히기
const floorMat = new THREE.MeshStandardMaterial({ 
    map: floorTex, 
    bumpMap: floorTex, 
    roughness: 0.2 
});

// 캐릭터에 마력의 잔상 효과 (Sprite 사용)
function createAetherEffect(pos) {
    const spriteMap = loader.load('assets/glow.png');
    const spriteMat = new THREE.SpriteMaterial({ map: spriteMap, color: 0x00ffff, transparent: true, opacity: 0.5 });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.copy(pos);
    scene.add(sprite);
    // ... 잔상 애니메이션 로직
}

// 이후 몬스터, 아이템도 큐브가 아닌 Sprite나 실제 텍스처를 입힌 Plane으로 교체
