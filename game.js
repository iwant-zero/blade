// 기존 createAfterimage 함수에 공격 판정 로직 추가 예시
function createAetherBladeAfterimage() {
    const ghost = blade.clone();
    // ... 기존 위치 복사 코드 ...
    
    // [강화] 잔상이 남아있는 동안 근처 적에게 지속 데미지
    const damageInterval = setInterval(() => {
        enemies.forEach(e => {
            if(e.position.distanceTo(ghost.position) < 2) {
                e.userData.hp -= 0.1; // 잔상이 적을 갉아먹음
                log("푸른 마력의 잔상이 적을 침식합니다!");
            }
        });
    }, 100);

    // ... 기존 fade 아웃 로직 ...
    setTimeout(() => clearInterval(damageInterval), 500); 
}
