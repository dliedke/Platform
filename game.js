// Game setup
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const livesCount = document.getElementById('lives-count');
const scoreCount = document.getElementById('score-count');
const levelCount = document.getElementById('level-count');
const weaponType = document.getElementById('weapon-type');
const gameOver = document.getElementById('game-over');
const levelComplete = document.getElementById('level-complete');
const restartButton = document.getElementById('restart-button');
const nextLevelButton = document.getElementById('next-level-button');
let isMobileDevice = false;

// Add this at the beginning of your code to create a global offset variable
const MOBILE_VERTICAL_OFFSET = 140; // This is the value you can adjust to move everything up
const MOBILE_MONSTER_SPEED_MODIFIER = 0.4; // Monsters are 60% slower on mobile
const JUMP_SLOWDOWN_FACTOR = 1; // Adjust this value between 0.5-0.8 to control jump speed

// Detect if we're on a mobile device
function detectMobileDevice() {
    isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
        || (window.innerWidth <= 767);
}

// Call this function on initialization
detectMobileDevice();
window.addEventListener('resize', detectMobileDevice);

// Game state
let game = {
    lives: 5,
    score: 0,
    level: 1,
    running: true,
    weaponPower: 1,
    weaponTypes: ['Basic', 'Enhanced', 'Super', 'Ultra', 'Legendary'],
    gravity: 0.4,
    groundY: canvas.height - 50,
    scrollSpeed: 2,
    monsterSpawnFrequency: 0.009, // Reduced from 0.01
    powerUpSpawnRate: 300, // Increased from 300 (less frequent)
    levelProgress: 0,
    levelLength: 9000, // Slightly shorter than original 10000
    platformDensity: 0.8, // Reduced from 1.0
    playerControlledScroll: true,
    cameraX: 0
};

// Update player physics for higher, slower jumps
let player = {
    x: 100,
    y: game.groundY - 60, // This will now use the correct ground level
    width: 40,
    height: 60,
    velX: 0,
    velY: 0,
    speed: 5,
    jumpPower: 15,
    isJumping: false,
    isAttacking: false,
    attackCooldown: 0,
    attackDuration: 20,
    invulnerable: false,
    invulnerableTime: 0,
    color: '#FF5555',
    facingRight: true
};

// Arrays for game objects
let platforms = [];
let monsters = [];
let projectiles = [];
let powerUps = [];
let dyingMonsters = []; // New array for monsters in their death animation

// Add control instructions
const controlsDiv = document.createElement('div');
controlsDiv.id = 'controls';
controlsDiv.style.position = 'absolute';
controlsDiv.style.top = '10px';
controlsDiv.style.right = '10px';
controlsDiv.style.color = 'white';
controlsDiv.style.fontSize = '16px';
controlsDiv.style.textShadow = '2px 2px 4px #000';
controlsDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
controlsDiv.style.padding = '10px';
controlsDiv.style.borderRadius = '5px';
controlsDiv.innerHTML = 'Controls: SPACE to Jump, X to Shoot, Arrow Keys to Move';
document.getElementById('game-container').appendChild(controlsDiv);

// Modify the resizeCanvas function to include this offset
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
        
    // Set ground level with offset for mobile
    if (isMobileDevice) {
        game.groundY = canvas.height - 50 - MOBILE_VERTICAL_OFFSET;
    } else {
        game.groundY = canvas.height - 50;
    }
    
    // Position player
    if (player) {
        player.y = game.groundY - player.height;
    }
    
    // Setup mobile controls if needed
    if (isMobileDevice) {
        setupMobileControls();
    } else {
        // Remove mobile controls if we're on desktop
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) {
            mobileControls.remove();
        }
    }
}


resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Platform generator function with smaller platforms
function generatePlatforms() {
    platforms = [];
    
    // Ground platform - make it extremely wide to ensure it never disappears
    platforms.push({
        x: -2000, // Start far left of the screen
        y: game.groundY,
        width: game.levelLength + canvas.width * 10, // Add extra width to ensure it extends beyond level end
        height: 50,
        color: '#4CAF50'
    });
    
    // Generate platforms across the entire level length
    const platformCount = Math.floor(40 * game.platformDensity); // Increased from 20 to 40
    
    // Platform sizes
    const platformSizes = [
        { width: 250, height: 25 },
        { width: 220, height: 25 },
        { width: 280, height: 25 },
        { width: 230, height: 25 },
        { width: 260, height: 25 }
    ];
    
    // Heights where platforms can appear
    const possibleHeights = [
        game.groundY - 120,
        game.groundY - 160,
        game.groundY - 200,
        game.groundY - 240,
        game.groundY - 280
    ];
    
    // Generate platforms evenly across the entire level length
    for (let i = 0; i < platformCount; i++) {
        // Choose a random platform size
        const sizeIndex = Math.floor(Math.random() * platformSizes.length);
        const size = platformSizes[sizeIndex];
        
        // Choose a random height
        const heightIndex = Math.floor(Math.random() * possibleHeights.length);
        const height = possibleHeights[heightIndex];
        
        // Calculate x position to spread platforms evenly across the entire level length
        // We divide the level length into roughly equal sections for platform placement
        const sectionLength = game.levelLength / (platformCount - 5); // Subtract a few to account for initial platforms
        const xPos = canvas.width + (i * sectionLength);
        
        // Add some random variation to prevent too much regularity
        const xVariation = Math.random() * 120 - 60;
        
        platforms.push({
            x: xPos + xVariation,
            y: height,
            width: size.width,
            height: size.height,
            color: '#795548'
        });
        
        // Add some extra smaller platforms for level progression (reduced chance)
        if (Math.random() < 0.25) { // Increased from 0.15 to 0.25 for more platforms
            platforms.push({
                x: xPos + 180 + Math.random() * 120,
                y: height + (Math.random() > 0.5 ? -50 : 50),
                width: 120 + Math.random() * 80,
                height: 25,
                color: '#A1887F'
            });
        }
    }
    
    // Sort platforms by x position for easier debugging
    platforms.sort((a, b) => a.x - b.x);
}


// Create a platform below the player at the start
function createInitialPlatform() {
    platforms.push({
        x: 50,
        y: game.groundY,
        width: 300,
        height: 50,
        color: '#4CAF50'
    });
}

// Input handling
let keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    // Prevent space scrolling the page
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
    }
});
window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// For touch devices
let touchStartX = 0;
let touchJump = false;
let touchAttack = false;

canvas.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    
    if (touch.clientY < canvas.height / 2) {
        touchJump = true;
    } else {
        touchAttack = true;
    }
    
    e.preventDefault();
});

canvas.addEventListener('touchend', () => {
    touchJump = false;
    touchAttack = false;
});

canvas.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    if (touch.clientX < touchStartX - 30) {
        keys.ArrowLeft = true;
        keys.ArrowRight = false;
    } else if (touch.clientX > touchStartX + 30) {
        keys.ArrowRight = true;
        keys.ArrowLeft = false;
    } else {
        keys.ArrowLeft = false;
        keys.ArrowRight = false;
    }
    e.preventDefault();
});

// Game update function with player-controlled scrolling
function update() {
    if (!game.running) return;
    
    // Track if we need to scroll
    let shouldScroll = false;
    
    // Handle player movement
    if (keys.ArrowLeft || keys.a) {
        player.velX = -player.speed * (isMobileDevice ? 1.2 : 1);
        player.facingRight = false;
        // No scrolling when moving left
    } else if (keys.ArrowRight || keys.d) {
        player.velX = player.speed * (isMobileDevice ? 1.2 : 1);
        player.facingRight = true;
        
        // Scroll the world when player moves right past a threshold
        const scrollThreshold =canvas.width / 2.5;  // 1/2.5 of screen width
            
        if (game.playerControlledScroll && player.x > scrollThreshold) {
            shouldScroll = true;
            // Stop player from moving past the threshold
            player.velX = 0;
            // Player stays in position but the world moves
            game.cameraX += game.scrollSpeed;
            // Update level progress based on player movement
            game.levelProgress += game.scrollSpeed;
        }
    } else {
        player.velX = 0;
    }
    
    // Handle jumping
     // Handle jumping with modified physics for slower jumps
     if ((keys.ArrowUp || keys.w || keys[' '] || touchJump) && !player.isJumping) {
        // Reduce initial velocity but keep same potential height
        player.velY = -player.jumpPower * JUMP_SLOWDOWN_FACTOR;
        player.isJumping = true;
        touchJump = false;
    }
    
    // Handle attack (with 'x' key)
    if ((keys.x || keys.e || keys.Control || touchAttack) && !player.isAttacking && player.attackCooldown <= 0) {
        player.isAttacking = true;
        player.attackCooldown = player.attackDuration;
        
        // Create projectile - fix the position to always be from player's center
        const projectileY = player.y + player.height / 2 - 5; // Middle of player
        
        projectiles.push({
            x: player.facingRight ? player.x + player.width : player.x - 20,
            y: projectileY,
            width: 10 + game.weaponPower * 5,
            height: 10,
            speed: player.facingRight ? 10 : -10, // Direction based on player facing
            power: game.weaponPower,
            color: getWeaponColor(game.weaponPower)
        });
        
        touchAttack = false;
    }
    
    // Update player position with gravity
    // Apply gravity with the same factor to maintain height
    if (player.isJumping) {
        // Apply reduced gravity while jumping to match reduced initial velocity
        player.velY += game.gravity * JUMP_SLOWDOWN_FACTOR;
    } else {
        // Normal gravity when not jumping
        player.velY += game.gravity;
    }
    
    player.y += player.velY;
    player.x += player.velX;
    
    // Keep player in bounds
    if (player.x < 0) {
        player.x = 0;
    } else if (player.x > canvas.width - player.width) {
        player.x = canvas.width - player.width;
    }
    
    // Check platform collisions for player
    player.isJumping = true; // Assume in air unless on platform
    
    for (let i = 0; i < platforms.length; i++) {
        let platform = platforms[i];
        
        // Check if player is on a platform
        if (player.y + player.height > platform.y &&
            player.y + player.height < platform.y + platform.height + 10 &&
            player.x + player.width > platform.x &&
            player.x < platform.x + platform.width &&
            player.velY > 0) {
            
            player.y = platform.y - player.height;
            player.velY = 0;
            player.isJumping = false;
        }
        
        // Move platforms only when player moves right past middle of screen
        if (shouldScroll) {
            platform.x -= game.scrollSpeed;
        }
    }
    
    // Attack cooldown
    if (player.attackCooldown > 0) {
        player.attackCooldown--;
    } else {
        player.isAttacking = false;
    }
    
    // Invulnerability frames
    if (player.invulnerable) {
        player.invulnerableTime--;
        if (player.invulnerableTime <= 0) {
            player.invulnerable = false;
        }
    }
    
    // Update projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        let projectile = projectiles[i];
        
        // First apply projectile's own movement
        projectile.x += projectile.speed;
        
        // Then adjust for world scrolling if necessary
        if (shouldScroll) {
            // Compensate for world scrolling to maintain projectile's relative position
            projectile.x -= game.scrollSpeed;
        }
        
        // Remove projectiles that go off screen
        if (projectile.x > canvas.width || projectile.x < 0) {
            projectiles.splice(i, 1);
        }
    }
    
    // Spawn monsters if needed
    if (Math.random() > game.monsterSpawnFrequency) {
        spawnMonster();
    }
    
    // Update monsters
for (let i = monsters.length - 1; i >= 0; i--) {
    let monster = monsters[i];
    
    // Apply gravity to monsters
    monster.velY += game.gravity;
    monster.y += monster.velY;
    
    // Store the monster's original x position before applying scrolling
    const originalX = monster.x;
    
    // Move monsters with world if scrolling
    if (shouldScroll) {
        monster.x -= game.scrollSpeed;
    }
    
    // Platform collision detection for monsters
    let onPlatform = false;
    for (let j = 0; j < platforms.length; j++) {
        let platform = platforms[j];
        if (monster.y + monster.height > platform.y &&
            monster.y + monster.height < platform.y + platform.height + 10 &&
            monster.x + monster.width > platform.x &&
            monster.x < platform.x + platform.width &&
            monster.velY > 0) {
            
            monster.y = platform.y - monster.height;
            monster.velY = 0;
            onPlatform = true;
            
            // Store reference to current platform
            monster.currentPlatform = j;
        }
    }
    
    // Move monster left independently of scrolling, but with reduced speed when scrolling
    if (onPlatform) {
        // If we're scrolling, reduce or eliminate the monster's own movement
        // to prevent them from moving too fast
        if (shouldScroll) {
            // Option 1: No additional movement when scrolling
            // This makes monsters only move with the world scroll
            // monster.x = originalX - game.scrollSpeed;
            
            // Option 2: Reduced speed when scrolling
            monster.x -= monster.speed * 0.3; // Reduced movement speed during scrolling
        } else {
            // Normal speed when not scrolling
            monster.x -= monster.speed;
        }
        
        // Check if monster is at the left edge of its platform
        if (monster.currentPlatform !== undefined) {
            const platform = platforms[monster.currentPlatform];
            // Check if monster is at edge (either side) and should fall
            if (monster.x < platform.x || monster.x + monster.width > platform.x + platform.width) {
                // Monster should fall off the platform
                onPlatform = false;
                monster.currentPlatform = undefined;
            }
        }
    } else {
        // When not on platform, apply normal speed if not scrolling,
        // or reduced speed if scrolling
        if (shouldScroll) {
            monster.x -= monster.speed * 0.3;
        } else {
            monster.x -= monster.speed;
        }
    }
    
    // Monster hits player
    if (!player.invulnerable && 
        player.x < monster.x + monster.width &&
        player.x + player.width > monster.x &&
        player.y < monster.y + monster.height &&
        player.y + player.height > monster.y) {
        
        takeDamage();
        monsters.splice(i, 1);
        continue;
    }

     // Projectile hits monster   
    let monsterHit = false;
    for (let j = projectiles.length - 1; j >= 0; j--) {
        let projectile = projectiles[j];
        
        if (projectile.x < monster.x + monster.width &&
            projectile.x + projectile.width > monster.x &&
            projectile.y < monster.y + monster.height &&
            projectile.y + projectile.height > monster.y) {
            
            monster.health -= projectile.power;
            projectiles.splice(j, 1);
            
            if (monster.health <= 0) {
                game.score += monster.points;
                
                // Instead of immediately removing the monster, add it to dyingMonsters
                dyingMonsters.push({
                    x: monster.x,
                    y: monster.y,
                    width: monster.width,
                    height: monster.height,
                    color: monster.color,
                    opacity: 1,
                    particles: createExplosionParticles(monster.x + monster.width/2, monster.y + monster.height/2, 10),
                    frameCount: 0,
                    maxFrames: 40 // How long the animation lasts
                });
                
                monsters.splice(i, 1);
                monsterHit = true;
                break;
            }
        }
    }
        
        if (monsterHit) continue;
        
        // Remove monsters that go off screen
        if (monster.x + monster.width < 0) {
            monsters.splice(i, 1);
        }
    }
    
    // Update power-ups
    if (Math.random() * game.powerUpSpawnRate < 1) {
        spawnPowerUp();
    }
    
    for (let i = powerUps.length - 1; i >= 0; i--) {
        let powerUp = powerUps[i];
        
        // Move power-ups with world if scrolling
        if (shouldScroll) {
            powerUp.x -= game.scrollSpeed;
        }
        
        // Apply gravity to powerups
        powerUp.velY += game.gravity;
        powerUp.y += powerUp.velY;
        
        // Power-up platform collision
        for (let j = 0; j < platforms.length; j++) {
            let platform = platforms[j];
            if (powerUp.y + powerUp.height > platform.y &&
                powerUp.y + powerUp.height < platform.y + platform.height + 10 &&
                powerUp.x + powerUp.width > platform.x &&
                powerUp.x < platform.x + platform.width &&
                powerUp.velY > 0) {
                
                powerUp.y = platform.y - powerUp.height;
                powerUp.velY = 0;
            }
        }
        
        // Player collects power-up
        if (player.x < powerUp.x + powerUp.width &&
            player.x + player.width > powerUp.x &&
            player.y < powerUp.y + powerUp.height &&
            player.y + player.height > powerUp.y) {
            
            applyPowerUp(powerUp.type);
            powerUps.splice(i, 1);
            continue;
        }
        
        // Remove power-ups that go off screen
        if (powerUp.x + powerUp.width < 0) {
            powerUps.splice(i, 1);
        }
    }
    
    // Update level progress when scrolling
    if (shouldScroll && game.levelProgress >= game.levelLength) {
        completeLevel();
    }
    
    // Update dying monsters
    for (let i = dyingMonsters.length - 1; i >= 0; i--) {
        let dyingMonster = dyingMonsters[i];
        
        // Update frame count
        dyingMonster.frameCount++;
        
        // Update opacity
        dyingMonster.opacity = 1 - (dyingMonster.frameCount / dyingMonster.maxFrames);
        
        // Update particles
        for (let j = 0; j < dyingMonster.particles.length; j++) {
            let particle = dyingMonster.particles[j];
            particle.x += particle.speedX;
            particle.y += particle.speedY;
            particle.opacity = dyingMonster.opacity;
        }
        
        // Move with world scrolling
        if (shouldScroll) {
            dyingMonster.x -= game.scrollSpeed;
        }
        
        // Remove dying monster if animation is complete
        if (dyingMonster.frameCount >= dyingMonster.maxFrames) {
            dyingMonsters.splice(i, 1);
        }
    }

    // Update UI
    updateUI();
}

// Draw game elements
function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background (with parallax based on camera position)
    drawBackground();
    
    // Draw platforms
    for (let i = 0; i < platforms.length; i++) {
        let platform = platforms[i];
        ctx.fillStyle = platform.color;
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
        
        // Add grass effect on top of platforms
        ctx.fillStyle = '#8BC34A';
        ctx.fillRect(platform.x, platform.y, platform.width, 5);
    }
    
    // Draw player (enhanced graphics)
    drawPlayer();
    
    // Draw projectiles with glow effect
    for (let i = 0; i < projectiles.length; i++) {
        let projectile = projectiles[i];
        // Add glow effect
        ctx.shadowColor = projectile.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = projectile.color;
        ctx.beginPath();
        ctx.arc(projectile.x + projectile.width/2, projectile.y + projectile.height/2, 
                projectile.width/2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
    
    // Draw monsters (enhanced graphics)
    for (let i = 0; i < monsters.length; i++) {
        let monster = monsters[i];
        drawMonster(monster);
    }

    // Draw dying monsters
    for (let i = 0; i < dyingMonsters.length; i++) {
        let dyingMonster = dyingMonsters[i];
        
        // Draw fading monster
        ctx.globalAlpha = dyingMonster.opacity;
        ctx.fillStyle = dyingMonster.color;
        ctx.beginPath();
        ctx.roundRect(dyingMonster.x, dyingMonster.y, dyingMonster.width, dyingMonster.height, 5);
        ctx.fill();
        
        // Draw explosion particles
        for (let j = 0; j < dyingMonster.particles.length; j++) {
            let particle = dyingMonster.particles[j];
            ctx.fillStyle = particle.color;
            ctx.globalAlpha = particle.opacity;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Reset global alpha
        ctx.globalAlpha = 1;
    }
        
        // Draw power-ups
    for (let i = 0; i < powerUps.length; i++) {
        let powerUp = powerUps[i];
        ctx.fillStyle = powerUp.color;
        ctx.beginPath();
        ctx.arc(powerUp.x + powerUp.width/2, powerUp.y + powerUp.height/2, 
                powerUp.width/2, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw icon or letter inside
        ctx.fillStyle = 'white';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(powerUp.icon, powerUp.x + powerUp.width/2, powerUp.y + powerUp.height/2);
    }
    
    // Draw level progress bar
    const progressWidth = (game.levelProgress / game.levelLength) * canvas.width;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillRect(0, 10, canvas.width, 5);
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(0, 10, progressWidth, 5);
}

// Draw player with better graphics
function drawPlayer() {
    if (player.invulnerable && Math.floor(Date.now() / 100) % 2 === 0) {
        // Flashing effect when invulnerable
        ctx.fillStyle = '#FFFFFF';
    } else {
        ctx.fillStyle = player.color;
    }
    
    // Body
    ctx.beginPath();
    ctx.roundRect(player.x, player.y, player.width, player.height, 5);
    ctx.fill();
    
    // Eyes
    ctx.fillStyle = 'white';
    if (player.facingRight) {
        ctx.beginPath();
        ctx.arc(player.x + player.width - 10, player.y + 15, 5, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.beginPath();
        ctx.arc(player.x + 10, player.y + 15, 5, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Pupils
    ctx.fillStyle = 'black';
    if (player.facingRight) {
        ctx.beginPath();
        ctx.arc(player.x + player.width - 8, player.y + 15, 2, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.beginPath();
        ctx.arc(player.x + 8, player.y + 15, 2, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Mouth
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    if (player.facingRight) {
        ctx.beginPath();
        ctx.arc(player.x + player.width - 15, player.y + 30, 8, 0, Math.PI);
        ctx.stroke();
    } else {
        ctx.beginPath();
        ctx.arc(player.x + 15, player.y + 30, 8, 0, Math.PI);
        ctx.stroke();
    }
    
    // Weapon
    ctx.fillStyle = getWeaponColor(game.weaponPower);
    if (player.facingRight) {
        ctx.fillRect(player.x + player.width - 5, player.y + player.height/2, 15, 5);
    } else {
        ctx.fillRect(player.x - 10, player.y + player.height/2, 15, 5);
    }
}

// Draw monster with better graphics
function drawMonster(monster) {
    // Body
    ctx.fillStyle = monster.color;
    ctx.beginPath();
    ctx.roundRect(monster.x, monster.y, monster.width, monster.height, 5);
    ctx.fill();
    
    // Eyes
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(monster.x + monster.width/4, monster.y + monster.height/3, monster.width/10, 0, Math.PI * 2);
    ctx.arc(monster.x + 3*monster.width/4, monster.y + monster.height/3, monster.width/10, 0, Math.PI * 2);
    ctx.fill();
    
    // Pupils
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(monster.x + monster.width/4 - 2, monster.y + monster.height/3, monster.width/20, 0, Math.PI * 2);
    ctx.arc(monster.x + 3*monster.width/4 - 2, monster.y + monster.height/3, monster.width/20, 0, Math.PI * 2);
    ctx.fill();
    
    // Angry eyebrows
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(monster.x + monster.width/8, monster.y + monster.height/4);
    ctx.lineTo(monster.x + 3*monster.width/8, monster.y + monster.height/6);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(monster.x + 5*monster.width/8, monster.y + monster.height/6);
    ctx.lineTo(monster.x + 7*monster.width/8, monster.y + monster.height/4);
    ctx.stroke();
    
    // Evil grin
    ctx.beginPath();
    ctx.moveTo(monster.x + monster.width/4, monster.y + 2*monster.height/3);
    ctx.lineTo(monster.x + 3*monster.width/4, monster.y + 2*monster.height/3);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(monster.x + monster.width/4, monster.y + 2*monster.height/3);
    ctx.lineTo(monster.x + monster.width/3, monster.y + 3*monster.height/4);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(monster.x + 3*monster.width/4, monster.y + 2*monster.height/3);
    ctx.lineTo(monster.x + 2*monster.width/3, monster.y + 3*monster.height/4);
    ctx.stroke();
    
    // Health bar
    const healthPercent = monster.health / monster.maxHealth;
    ctx.fillStyle = 'red';
    ctx.fillRect(monster.x, monster.y - 15, monster.width, 8);
    ctx.fillStyle = 'green';
    ctx.fillRect(monster.x, monster.y - 15, monster.width * healthPercent, 8);
}

// Função de desenho do background corrigida para dispositivos móveis
function drawBackground() {
    // Gradient de céu
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#E0F7FA');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Sol
    ctx.fillStyle = '#FFEB3B';
    ctx.beginPath();
    ctx.arc(100, 100, 50, 0, Math.PI * 2);
    ctx.fill();
    
    // Define a posição do chão de acordo com o tipo de dispositivo
    const groundPosition = isMobileDevice ? game.groundY : game.groundY;
    
    // Nuvens - usando game.cameraX para efeito parallax
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (let i = 0; i < 5; i++) {
        const cloudX = ((i * 300 - (game.cameraX * 0.1)) % (canvas.width * 2)) - 200;
        drawCloud(cloudX, 120 + i * 20, 100 + i * 20);
    }
    
    // Montanhas distantes (parallax mais lento)
    ctx.fillStyle = '#6A5ACD';
    for (let i = 0; i < 5; i++) {
        const mountainX = ((i * 500 - (game.cameraX * 0.2) % 2000) % (canvas.width * 3)) - 500;
        drawMountain(mountainX, groundPosition - 100, 300, 150); // Ajustado para ficar acima do chão
    }
    
    // Colinas mais próximas (parallax médio)
    ctx.fillStyle = '#32CD32';
    for (let i = 0; i < 7; i++) {
        const hillX = ((i * 400 - (game.cameraX * 0.5) % 1600) % (canvas.width * 2)) - 400;
        drawHill(hillX, groundPosition - 50, 200, 100); // Ajustado para ficar acima do chão
    }
    
    // Arbustos mais próximos (parallax mais rápido)
    ctx.fillStyle = '#228B22';
    for (let i = 0; i < 10; i++) {
        const bushX = ((i * 200 - (game.cameraX * 0.8) % 1000) % (canvas.width * 1.5)) - 200;
        drawBush(bushX, groundPosition - 10, 100, 30); // Ajustado para ficar acima do chão
    }
}

// Draw cloud
function drawCloud(x, y, size) {
    ctx.beginPath();
    ctx.arc(x, y, size/3, 0, Math.PI * 2);
    ctx.arc(x + size/2, y - size/6, size/2, 0, Math.PI * 2);
    ctx.arc(x + size, y, size/3, 0, Math.PI * 2);
    ctx.arc(x + size/2, y + size/6, size/2, 0, Math.PI * 2);
    ctx.fill();
}

// Helper drawing functions
function drawMountain(x, y, width, height) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width/2, y - height);
    ctx.lineTo(x + width, y);
    ctx.fill();
    
    // Snow caps
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.moveTo(x + width/2 - 20, y - height + 30);
    ctx.lineTo(x + width/2, y - height);
    ctx.lineTo(x + width/2 + 20, y - height + 30);
    ctx.fill();
}

function drawHill(x, y, width, height) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + width/2, y - height, x + width, y);
    ctx.fill();
}

function drawBush(x, y, width, height) {
    ctx.beginPath();
    ctx.arc(x, y, width/4, 0, Math.PI * 2);
    ctx.arc(x + width/4, y - height/2, width/4, 0, Math.PI * 2);
    ctx.arc(x + width/2, y, width/4, 0, Math.PI * 2);
    ctx.arc(x + 3*width/4, y - height/2, width/4, 0, Math.PI * 2);
    ctx.arc(x + width, y, width/4, 0, Math.PI * 2);
    ctx.fill();
}

function spawnMonster() {
    // Reduced spawn check globally
    if (Math.random() > game.monsterSpawnFrequency * 0.6) {
        return;
    }
    
    // Apply speed modifier for mobile
    const speedModifier = isMobileDevice ? MOBILE_MONSTER_SPEED_MODIFIER : 1;
    
    const monsterTypes = [
        {
            width: 40,
            height: 40,
            speed: (1.2 + game.level * 0.15) * speedModifier, // Apply speed modifier
            health: 1 * game.level,
            maxHealth: 1 * game.level,
            points: 10,
            color: '#FF0000',
            velY: 0
        },
        {
            width: 60,
            height: 30,
            speed: (1.6 + game.level * 0.12) * speedModifier, // Apply speed modifier
            health: 2 * game.level,
            maxHealth: 2 * game.level,
            points: 20,
            color: '#8B0000',
            velY: 0
        },
        {
            width: 50,
            height: 50,
            speed: (0.8 + game.level * 0.08) * speedModifier, // Apply speed modifier
            health: 3 * game.level,
            maxHealth: 3 * game.level,
            points: 30,
            color: '#800080',
            velY: 0
        }
    ];
    
    const typeIndex = Math.floor(Math.random() * monsterTypes.length);
    const monsterType = monsterTypes[typeIndex];
    
    // Adjust the search area for platforms based on device
    // For mobile, look for platforms further to the right
    const searchStartX = canvas.width - 50;
    const searchEndX = isMobileDevice ? 
                       canvas.width + 400 : // Much further right on mobile
                       canvas.width + 200;  // Normal distance on desktop
    
    // Find platforms in the adjusted area
    const enteringPlatforms = platforms.filter(p => 
        p.x > searchStartX && 
        p.x < searchEndX &&
        p.y < game.groundY - 20 &&
        p.width >= monsterType.width + 60);
    
    if (enteringPlatforms.length > 0) {
        // Find the matching platform index
        const spawnPlatform = enteringPlatforms[Math.floor(Math.random() * enteringPlatforms.length)];
        const platformIndex = platforms.findIndex(p => p === spawnPlatform);
        
        // Spawn monster at the RIGHT end of the platform
        const spawnX = spawnPlatform.x + spawnPlatform.width - monsterType.width - 20;
        
        monsters.push({
            x: spawnX,
            y: spawnPlatform.y - monsterType.height,
            currentPlatform: platformIndex,
            velY: 0,
            ...monsterType
        });
    }
}

// Spawn a power-up
function spawnPowerUp() {
    const powerUpTypes = [
        {
            type: 'health',
            width: 30,
            height: 30,
            color: '#FF69B4',
            icon: '♥',
            velY: 0
        },
        {
            type: 'weapon',
            width: 30,
            height: 30,
            color: '#FFD700',
            icon: '⚔️',
            velY: 0
        },
        {
            type: 'speed',
            width: 30,
            height: 30,
            color: '#00BFFF',
            icon: '⚡',
            velY: 0
        }
    ];
    
    const typeIndex = Math.floor(Math.random() * powerUpTypes.length);
    const powerUpType = powerUpTypes[typeIndex];
    
    // Find a platform to spawn on
    let spawnPlatform = null;
    const visiblePlatforms = platforms.filter(p => 
        p.x > canvas.width && 
        p.x < canvas.width * 1.5 &&
        p.y < game.groundY);
    
    if (visiblePlatforms.length > 0) {
        spawnPlatform = visiblePlatforms[Math.floor(Math.random() * visiblePlatforms.length)];
        powerUps.push({
            x: spawnPlatform.x + spawnPlatform.width/2,
            y: spawnPlatform.y - powerUpType.height,
            ...powerUpType
        });
    } else {
        // Spawn on ground if no platform available
        powerUps.push({
            x: canvas.width + Math.random() * 200,
            y: game.groundY - powerUpType.height - 10,
            ...powerUpType
        });
    }
}

// Apply power-up effect
function applyPowerUp(type) {
    switch(type) {
        case 'health':
            if (game.lives < 5) {
                game.lives++;
                updateLivesDisplay();
            }
            break;
        case 'weapon':
            if (game.weaponPower < 5) {
                game.weaponPower++;
                weaponType.textContent = game.weaponTypes[game.weaponPower - 1];
            }
            break;
        case 'speed':
            player.speed += 0.5;
            setTimeout(() => {
                player.speed -= 0.5;
            }, 10000); // Speed boost lasts 10 seconds
            break;
    }
}

// Function to create explosion particles
function createExplosionParticles(x, y, count) {
    const particles = [];
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            size: 3 + Math.random() * 5,
            speedX: (Math.random() - 0.5) * 5,
            speedY: (Math.random() - 0.5) * 5,
            color: getRandomExplosionColor(),
            opacity: 1
        });
    }
    return particles;
}

// Get random color for explosion particles
function getRandomExplosionColor() {
    const colors = ['#FF4500', '#FFA500', '#FFFF00', '#FF0000', '#FF69B4'];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Get color based on weapon power
function getWeaponColor(power) {
    const colors = ['#FFFF00', '#FFA500', '#FF4500', '#9932CC', '#FF00FF'];
    return colors[power - 1] || colors[0];
}

// Take damage when hit by a monster
function takeDamage() {
    if (!player.invulnerable) {
        game.lives--;
        updateLivesDisplay();
        
        player.invulnerable = true;
        player.invulnerableTime = 60; // Invulnerable for 60 frames
        
        if (game.lives <= 0) {
            endGame();
        }
    }
}

// Update lives display with stars
function updateLivesDisplay() {
    let starsHtml = '';
    for (let i = 0; i < 5; i++) {
        if (i < game.lives) {
            starsHtml += '⭐';
        } else {
            starsHtml += '☆';
        }
    }
    livesCount.innerHTML = starsHtml;
}

// End the game
function endGame() {
    game.running = false;
    
    // Add a more prominent score display for mobile
    if (isMobileDevice) {
        // Clear any existing score display first
        const existingScoreDisplay = document.getElementById('prominent-score');
        if (existingScoreDisplay) {
            existingScoreDisplay.remove();
        }
        
        // Create prominent score display
        const prominentScore = document.createElement('h1');
        prominentScore.id = 'prominent-score';
        prominentScore.textContent = `Score: ${game.score}`;
        prominentScore.style.fontSize = '32px';
        prominentScore.style.marginBottom = '20px';
        prominentScore.style.color = '#FFD700'; // Gold color
        
        // Insert it at the beginning of the game over popup
        gameOver.insertBefore(prominentScore, gameOver.firstChild);
    }
    
    gameOver.style.display = 'block';
}

// Complete the current level
function completeLevel() {
    game.running = false;
    
    // Clear any existing continue message before adding a new one
    while (levelComplete.lastChild && levelComplete.lastChild.tagName === "P") {
        levelComplete.removeChild(levelComplete.lastChild);
    }
    
    // Only add the "Press SPACE" message on desktop
    if (!isMobileDevice) {
        const continueMsg = document.createElement('p');
        continueMsg.textContent = 'Press SPACE to continue';
        continueMsg.style.marginTop = '10px';
        levelComplete.appendChild(continueMsg);
    } else {
        // For mobile, add a more touch-friendly message
        const continueMsg = document.createElement('p');
        continueMsg.textContent = 'Tap the Continue button to proceed';
        continueMsg.style.marginTop = '10px';
        levelComplete.appendChild(continueMsg);
    }
    
    levelComplete.style.display = 'block';
    
    // Remove any existing space listeners first
    window.removeEventListener('keydown', spaceNextLevelListener);
    
    // Add event listener for space to continue (only needed for desktop)
    if (!isMobileDevice) {
        window.addEventListener('keydown', spaceNextLevelListener);
    }
}

// Handle space key to continue to next level
function spaceNextLevelListener(e) {
    if (e.key === ' ' && !game.running && levelComplete.style.display === 'block') {
        window.removeEventListener('keydown', spaceNextLevelListener);
        startNextLevel();
    }
}

// Start the next level
function startNextLevel() {
    levelComplete.style.display = 'none';
    game.running = true;
    game.levelProgress = 0;
    levelCount.textContent = game.level + 1;
    game.level++;
    
    // Increase difficulty gradually
    game.scrollSpeed += 0.3;
    game.monsterSpawnFrequency += 0.002; // Slight increase in spawn frequency
    if (game.monsterSpawnFrequency > 0.03) {
        game.monsterSpawnFrequency = 0.03; // Cap at 3% chance per frame
    }
    
    // Increase platform density for higher levels (more platforms)
    game.platformDensity += 0.2;
    if (game.platformDensity > 3) {
        game.platformDensity = 3; // Cap at 3x the base density
    }
    
    // Reset platforms and regenerate
    generatePlatforms();
    createInitialPlatform();
    
    // Clear existing monsters and power-ups
    monsters = [];
    powerUps = [];
    
    // Reset camera position
    game.cameraX = 0;
    
    // Start the game loop if it's not running
    if (!animationId) {
        gameLoop();
    }
}

// Restart the game
function restartGame() {
    game = {
        lives: 5,
        score: 0,
        level: 1,
        running: true,
        weaponPower: 1,
        weaponTypes: ['Basic', 'Enhanced', 'Super', 'Ultra', 'Legendary'],
        gravity: 0.4,
        groundY: canvas.height - 50,
        scrollSpeed: 5,
        monsterSpawnFrequency: 0.009, // Reduced from 0.01
        powerUpSpawnRate: 300, // Increased from 300 (less frequent)
        levelProgress: 0,
        levelLength: 9000, // Slightly shorter than original 10000
        platformDensity: 0.8, // Reduced from 1.0
        playerControlledScroll: true,
        cameraX: 0
    };
    
    player = {
        x: 100,
        y: game.groundY - 60, // This will now use the correct ground level
        width: 40,
        height: 60,
        velX: 0,
        velY: 0,
        speed: 5,
        jumpPower: 15,
        isJumping: false,
        isAttacking: false,
        attackCooldown: 0,
        attackDuration: 20,
        invulnerable: false,
        invulnerableTime: 0,
        color: '#FF5555',
        facingRight: true
    };
    
    monsters = [];
    projectiles = [];
    powerUps = [];
    
    setupMobileControls();
    resizeCanvas();

    generatePlatforms();
    createInitialPlatform();
    
    updateUI();
    updateLivesDisplay();
    gameOver.style.display = 'none';
    
    // Start the game loop
    if (!animationId) {
        gameLoop();
    }
}

// Update UI elements
function updateUI() {
    scoreCount.textContent = game.score;
    levelCount.textContent = game.level;
    weaponType.textContent = game.weaponTypes[game.weaponPower - 1];
    updateLivesDisplay();
}

// Variable to track animation frame
let animationId;

// Game loop
function gameLoop() {
    if (!game.running) {
        cancelAnimationFrame(animationId);
        animationId = null;
        return;
    }
    
    update();
    draw();
    animationId = requestAnimationFrame(gameLoop);
}

// Event listeners for buttons
restartButton.addEventListener('click', restartGame);
nextLevelButton.addEventListener('click', startNextLevel);

// Add polyfill for roundRect if not supported
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
        if (radius === undefined) {
            radius = 5;
        }
        this.beginPath();
        this.moveTo(x + radius, y);
        this.lineTo(x + width - radius, y);
        this.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.lineTo(x + width, y + height - radius);
        this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.lineTo(x + radius, y + height);
        this.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.lineTo(x, y + radius);
        this.quadraticCurveTo(x, y, x + radius, y);
        this.closePath();
        return this;
    };
}

// Mude o posicionamento dos controles para ficar mais acima do fundo
function setupMobileControls() {
    // Remove controles existentes
    const existingControls = document.getElementById('mobile-controls');
    if (existingControls) {
        existingControls.remove();
    }
    
    // Verifica se é dispositivo móvel usando a variável global
    if (!isMobileDevice) return;
    
    // Cria container para controles móveis
    const mobileControls = document.createElement('div');
    mobileControls.id = 'mobile-controls';
    mobileControls.style.position = 'absolute';
    mobileControls.style.bottom = '110px'; // Posicionado mais acima como solicitado
    mobileControls.style.left = '0';
    mobileControls.style.width = '100%';
    mobileControls.style.display = 'flex';
    mobileControls.style.justifyContent = 'space-between';
    mobileControls.style.padding = '0 0px';
    mobileControls.style.boxSizing = 'border-box';
    mobileControls.style.zIndex = '1000';
    
    // Botões da esquerda
    const leftControls = document.createElement('div');
    leftControls.style.display = 'flex';
    leftControls.style.gap = '10px';
    
    // Botão esquerda
    const leftBtn = document.createElement('button');
    leftBtn.textContent = '←';
    leftBtn.style.width = '70px';
    leftBtn.style.height = '70px';
    leftBtn.style.fontSize = '24px';
    leftBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    leftBtn.style.color = 'white';
    leftBtn.style.border = '2px solid white';
    leftBtn.style.borderRadius = '8px';
    
    // Botão direita
    const rightBtn = document.createElement('button');
    rightBtn.textContent = '→';
    rightBtn.style.width = '70px';
    rightBtn.style.height = '70px';
    rightBtn.style.fontSize = '24px';
    rightBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    rightBtn.style.color = 'white';
    rightBtn.style.border = '2px solid white';
    rightBtn.style.borderRadius = '8px';
    
    leftControls.appendChild(leftBtn);
    leftControls.appendChild(rightBtn);
    
    // Botões da direita
    const rightControls = document.createElement('div');
    rightControls.style.display = 'flex';
    rightControls.style.gap = '10px';
    
    // Botão pular
    const jumpBtn = document.createElement('button');
    jumpBtn.textContent = 'JUMP';
    jumpBtn.style.width = '80px';
    jumpBtn.style.height = '70px';
    jumpBtn.style.fontSize = '14px';
    jumpBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    jumpBtn.style.color = 'white';
    jumpBtn.style.border = '2px solid white';
    jumpBtn.style.borderRadius = '8px';
    
    // Botão atirar
    const shootBtn = document.createElement('button');
    shootBtn.textContent = 'SHOOT';
    shootBtn.style.width = '80px';
    shootBtn.style.height = '70px';
    shootBtn.style.fontSize = '14px';
    shootBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    shootBtn.style.color = 'white';
    shootBtn.style.border = '2px solid white';
    shootBtn.style.borderRadius = '8px';
    
    rightControls.appendChild(jumpBtn);
    rightControls.appendChild(shootBtn);
    
    // Adiciona os containers de botões aos controles móveis
    mobileControls.appendChild(leftControls);
    mobileControls.appendChild(rightControls);
    
    // Adiciona ao documento
    document.getElementById('game-container').appendChild(mobileControls);
    
    // Eventos de toque para os botões
    leftBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys.ArrowLeft = true;
    });
    
    leftBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        keys.ArrowLeft = false;
    });
    
    rightBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys.ArrowRight = true;
    });
    
    rightBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        keys.ArrowRight = false;
    });
    
    jumpBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys[' '] = true;
    });
    
    jumpBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        keys[' '] = false;
    });
    
    shootBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys.x = true;
    });
    
    shootBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        keys.x = false;
    });
}

// Touch movement handling
let xDown = null;
let yDown = null;
let touchActive = false;
let lastTouchX = 0;

function handleTouchStart(evt) {
    // Check if touch is in bottom action button area
    const bottomActionArea = canvas.height - 150;
    if (evt.touches[0].clientY > bottomActionArea && evt.touches[0].clientX > canvas.width - 200) {
        // This area is reserved for jump/shoot buttons
        return;
    }
    
    const firstTouch = evt.touches[0];
    xDown = firstTouch.clientX;
    yDown = firstTouch.clientY;
    touchActive = true;
    lastTouchX = xDown;
    
    // Reset movement keys
    keys.ArrowLeft = false;
    keys.ArrowRight = false;
}

function handleTouchMove(evt) {
    if (!touchActive) return;
    
    // Check if touch is in bottom action button area
    const bottomActionArea = canvas.height - 150;
    if (evt.touches[0].clientY > bottomActionArea && evt.touches[0].clientX > canvas.width - 200) {
        // This area is reserved for jump/shoot buttons
        return;
    }
    
    if (!xDown || !yDown) return;
    
    const xUp = evt.touches[0].clientX;
    const yUp = evt.touches[0].clientY;
    
    const xDiff = xDown - xUp;
    const yDiff = yDown - yUp;
    
    // Determine horizontal movement direction based on current touch position
    // compared to last known position
    if (xUp < lastTouchX - 5) {
        // Moving left
        keys.ArrowLeft = true;
        keys.ArrowRight = false;
    } else if (xUp > lastTouchX + 5) {
        // Moving right
        keys.ArrowRight = true;
        keys.ArrowLeft = false;
    }
    
    // Update last touch X position
    lastTouchX = xUp;
    
    // Detect quick upward swipe for jump
    if (Math.abs(yDiff) > Math.abs(xDiff) && yDiff > 50 && !player.isJumping) {
        keys[' '] = true;
        // Reset after a short delay
        setTimeout(() => {
            keys[' '] = false;
        }, 100);
        
        // Reset touch start position to prevent multiple jumps
        yDown = yUp;
    }
}

function handleTouchEnd(evt) {
    // Reset movement keys
    keys.ArrowLeft = false;
    keys.ArrowRight = false;
    touchActive = false;
    xDown = null;
    yDown = null;
}

// Update existing canvas event listeners
canvas.removeEventListener('touchstart', function(){});
canvas.removeEventListener('touchend', function(){});
canvas.removeEventListener('touchmove', function(){});

// Add this line near the end of the file, before the game loop starts
setupMobileControls();

// Call this on window resize too
window.addEventListener('resize', () => {
    resizeCanvas();
    setupMobileControls();
});

// Ensure window orientation changes update controls correctly
window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        resizeCanvas();
        setupMobileControls();
    }, 100);
});

// Initialize the game
generatePlatforms();
createInitialPlatform();
updateUI();
updateLivesDisplay();
gameLoop();