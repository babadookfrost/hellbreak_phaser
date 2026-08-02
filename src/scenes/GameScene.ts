import Phaser from 'phaser';
import { js as EasyStar } from 'easystarjs';

export class GameScene extends Phaser.Scene {
    private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | Phaser.Physics.Arcade.Sprite;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasdKeys!: {
        W: Phaser.Input.Keyboard.Key;
        A: Phaser.Input.Keyboard.Key;
        S: Phaser.Input.Keyboard.Key;
        D: Phaser.Input.Keyboard.Key;
    };
    private playerSpeed = 200;

    // Virtual Joystick variables
    private joystickBase?: Phaser.GameObjects.Arc;
    private joystickThumb?: Phaser.GameObjects.Arc;
    private isDraggingJoystick = false;
    private joystickVector = new Phaser.Math.Vector2(0, 0);
    private joystickPointer?: Phaser.Input.Pointer;

    // Time-freeze variables
    private isMoving = false;
    private targetTimeScale = 0.03;

    // Map and Generation variables
    private obstacles!: Phaser.Physics.Arcade.StaticGroup;
    private readonly TILE_SIZE = 40;
    private readonly MAP_WIDTH = 1920;
    private readonly MAP_HEIGHT = 1080;
    private gridWidth!: number;
    private gridHeight!: number;
    private grid!: number[][]; // 0: empty, 1: obstacle

    // Enemy and Pathfinding
    private enemy!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | Phaser.Physics.Arcade.Sprite;
    private easystar!: EasyStar;
    private enemySpeed = 120;
    private path: {x: number, y: number}[] = [];
    private lastPathCalcTime = 0;
    private pathRecalcInterval = 500; // Recalculate path every 500ms (game time)

    constructor() {
        super('GameScene');
    }

    preload() {
    }

    create() {
        this.physics.world.setBounds(0, 0, this.MAP_WIDTH, this.MAP_HEIGHT);

        // Player placeholder (blue square)
        const playerGraphics = this.make.graphics({x: 0, y: 0});
        playerGraphics.fillStyle(0x0088ff, 1);
        playerGraphics.fillRect(0, 0, 32, 32);
        playerGraphics.generateTexture('playerTexture', 32, 32);

        // Obstacle placeholder (gray square)
        const obstacleGraphics = this.make.graphics({x: 0, y: 0});
        obstacleGraphics.fillStyle(0x555555, 1);
        obstacleGraphics.fillRect(0, 0, this.TILE_SIZE, this.TILE_SIZE);
        obstacleGraphics.generateTexture('obstacleTexture', this.TILE_SIZE, this.TILE_SIZE);

        this.generateMap();

        const startX = Math.floor(this.gridWidth / 2) * this.TILE_SIZE + this.TILE_SIZE / 2;
        const startY = Math.floor(this.gridHeight / 2) * this.TILE_SIZE + this.TILE_SIZE / 2;

        this.player = this.physics.add.sprite(startX, startY, 'playerTexture');
        this.player.setCollideWorldBounds(true);
        this.physics.add.collider(this.player, this.obstacles);

        // Enemy placeholder (red square)
        const enemyGraphics = this.make.graphics({x: 0, y: 0});
        enemyGraphics.fillStyle(0xff0000, 1);
        enemyGraphics.fillRect(0, 0, 32, 32);
        enemyGraphics.generateTexture('enemyTexture', 32, 32);

        // Place enemy in an empty spot away from player
        let enemyX = 0;
        let enemyY = 0;
        let foundSpot = false;
        while (!foundSpot) {
            const gx = Phaser.Math.Between(1, this.gridWidth - 2);
            const gy = Phaser.Math.Between(1, this.gridHeight - 2);
            if (this.grid[gy][gx] === 0 && Phaser.Math.Distance.Between(gx, gy, Math.floor(this.gridWidth/2), Math.floor(this.gridHeight/2)) > 10) {
                enemyX = gx * this.TILE_SIZE + this.TILE_SIZE / 2;
                enemyY = gy * this.TILE_SIZE + this.TILE_SIZE / 2;
                foundSpot = true;
            }
        }

        this.enemy = this.physics.add.sprite(enemyX, enemyY, 'enemyTexture');
        this.enemy.setCollideWorldBounds(true);
        this.physics.add.collider(this.enemy, this.obstacles);

        // Setup Pathfinding
        this.easystar = new EasyStar();
        this.easystar.setGrid(this.grid);
        this.easystar.setAcceptableTiles([0]);
        // Allow diagonals if desired, though we'll keep it simple for now or enable it:
        this.easystar.enableDiagonals();
        // Since we enable diagonals, we should avoid corner clipping
        this.easystar.enableCornerCutting();

        // Input setup (PC)
        if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
            this.wasdKeys = this.input.keyboard.addKeys({
                W: Phaser.Input.Keyboard.KeyCodes.W,
                A: Phaser.Input.Keyboard.KeyCodes.A,
                S: Phaser.Input.Keyboard.KeyCodes.S,
                D: Phaser.Input.Keyboard.KeyCodes.D
            }) as { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key; };
        }

        // Virtual Joystick setup (Mobile)
        this.setupVirtualJoystick();

        // Camera setup
        this.cameras.main.setBounds(0, 0, this.MAP_WIDTH, this.MAP_HEIGHT);
        this.cameras.main.startFollow(this.player);
        // Set a 200x200 deadzone in the center
        this.cameras.main.setDeadzone(200, 200);
    }

    private setupVirtualJoystick() {
        // Create visual elements for joystick but keep them hidden initially
        this.joystickBase = this.add.circle(0, 0, 60, 0xffffff, 0.2).setDepth(1000).setVisible(false).setScrollFactor(0);
        this.joystickThumb = this.add.circle(0, 0, 30, 0xffffff, 0.5).setDepth(1001).setVisible(false).setScrollFactor(0);

        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            // Only activate if not already dragging and in the left half of the screen (optional, but good for dual stick later)
            if (!this.isDraggingJoystick && pointer.x < this.cameras.main.width) {
                this.isDraggingJoystick = true;
                this.joystickPointer = pointer;

                this.joystickBase?.setPosition(pointer.x, pointer.y).setVisible(true);
                this.joystickThumb?.setPosition(pointer.x, pointer.y).setVisible(true);
                this.joystickVector.set(0, 0);
            }
        });

        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (this.isDraggingJoystick && this.joystickPointer?.id === pointer.id) {
                // Calculate distance and angle from base
                if (!this.joystickBase || !this.joystickThumb) return;

                const dx = pointer.x - this.joystickBase.x;
                const dy = pointer.y - this.joystickBase.y;
                let distance = Math.sqrt(dx * dx + dy * dy);
                const maxDistance = 60; // Max drag distance

                const angle = Math.atan2(dy, dx);

                if (distance > maxDistance) {
                    distance = maxDistance;
                }

                this.joystickThumb.setPosition(
                    this.joystickBase.x + Math.cos(angle) * distance,
                    this.joystickBase.y + Math.sin(angle) * distance
                );

                // Normalized vector [-1, 1]
                this.joystickVector.set(
                    Math.cos(angle) * (distance / maxDistance),
                    Math.sin(angle) * (distance / maxDistance)
                );
            }
        });

        this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
            if (this.isDraggingJoystick && this.joystickPointer?.id === pointer.id) {
                this.isDraggingJoystick = false;
                this.joystickPointer = undefined;
                this.joystickBase?.setVisible(false);
                this.joystickThumb?.setVisible(false);
                this.joystickVector.set(0, 0);
            }
        });
    }

    private generateMap() {
        this.gridWidth = Math.floor(this.MAP_WIDTH / this.TILE_SIZE);
        this.gridHeight = Math.floor(this.MAP_HEIGHT / this.TILE_SIZE);

        let validMapFound = false;

        while (!validMapFound) {
            // Initialize grid
            this.grid = Array.from({ length: this.gridHeight }, () => Array(this.gridWidth).fill(0));

            // Generate borders
            for (let x = 0; x < this.gridWidth; x++) {
                this.grid[0][x] = 1;
                this.grid[this.gridHeight - 1][x] = 1;
            }
            for (let y = 0; y < this.gridHeight; y++) {
                this.grid[y][0] = 1;
                this.grid[y][this.gridWidth - 1] = 1;
            }

            // Define center (spawn point)
            const centerX = Math.floor(this.gridWidth / 2);
            const centerY = Math.floor(this.gridHeight / 2);

            // Populate internal obstacles
            const obstacleDensity = 0.15; // 15% chance
            for (let y = 1; y < this.gridHeight - 1; y++) {
                for (let x = 1; x < this.gridWidth - 1; x++) {
                    // Leave some space around the spawn point
                    if (Math.abs(x - centerX) < 3 && Math.abs(y - centerY) < 3) {
                        continue;
                    }
                    if (Math.random() < obstacleDensity) {
                        this.grid[y][x] = 1;
                    }
                }
            }

            // Check connectivity using Flood Fill
            validMapFound = this.checkMapConnectivity(centerX, centerY);
        }

        // Render obstacles
        this.obstacles = this.physics.add.staticGroup();
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (this.grid[y][x] === 1) {
                    const px = x * this.TILE_SIZE + this.TILE_SIZE / 2;
                    const py = y * this.TILE_SIZE + this.TILE_SIZE / 2;
                    this.obstacles.create(px, py, 'obstacleTexture');
                }
            }
        }
    }

    private checkMapConnectivity(startX: number, startY: number): boolean {
        // Count total empty tiles
        let totalEmpty = 0;
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (this.grid[y][x] === 0) totalEmpty++;
            }
        }

        // Flood fill to find reachable tiles
        const visited = Array.from({ length: this.gridHeight }, () => Array(this.gridWidth).fill(false));
        let reachableEmpty = 0;
        const stack = [{ x: startX, y: startY }];

        while (stack.length > 0) {
            const { x, y } = stack.pop()!;

            if (x < 0 || x >= this.gridWidth || y < 0 || y >= this.gridHeight) continue;
            if (visited[y][x] || this.grid[y][x] === 1) continue;

            visited[y][x] = true;
            reachableEmpty++;

            stack.push({ x: x + 1, y: y });
            stack.push({ x: x - 1, y: y });
            stack.push({ x: x, y: y + 1 });
            stack.push({ x: x, y: y - 1 });
        }

        // We consider the map valid if at least 95% of empty tiles are reachable
        // Some tiny isolated 1-2 block areas are fine, but prefer fully connected.
        // Let's enforce 100% connectivity for internal play area.
        return reachableEmpty === totalEmpty;
    }

    update(_time: number, _delta: number) {
        // We use the raw delta (unaffected by scene timeScale) or adjust it?
        // Actually, Phaser's scene update `delta` is affected by `this.time.timeScale`.
        // To get real unscaled delta for our lerp, we can use the game's loop raw delta.
        const unscaledDelta = this.game.loop.delta;

        this.handlePlayerMovement();
        this.handleTimeFreeze(unscaledDelta);
        this.handleEnemyAI(unscaledDelta);
    }

    private handlePlayerMovement() {
        let inputX = 0;
        let inputY = 0;

        // PC Input
        if (this.cursors && this.wasdKeys) {
            if (this.cursors.left.isDown || this.wasdKeys.A.isDown) inputX -= 1;
            if (this.cursors.right.isDown || this.wasdKeys.D.isDown) inputX += 1;
            if (this.cursors.up.isDown || this.wasdKeys.W.isDown) inputY -= 1;
            if (this.cursors.down.isDown || this.wasdKeys.S.isDown) inputY += 1;
        }

        // Mobile Input overrides/adds to PC input
        if (this.isDraggingJoystick) {
            // Apply a small deadzone for joystick to avoid drift
            if (Math.abs(this.joystickVector.x) > 0.1) inputX = this.joystickVector.x;
            if (Math.abs(this.joystickVector.y) > 0.1) inputY = this.joystickVector.y;
        }

        // Normalize vector if using keyboard so diagonals aren't faster
        if (inputX !== 0 && inputY !== 0 && !this.isDraggingJoystick) {
            const length = Math.sqrt(inputX * inputX + inputY * inputY);
            inputX /= length;
            inputY /= length;
        }

        if (this.player.body) {
            // Note: Since we manipulate timeScale, we need to ensure the player's speed
            // doesn't drop to zero just because physics time slows down, so they can keep moving.
            // When timeScale is 0.03, if we give velocity 200, it moves at 200 * 0.03 = 6 px/s.
            // To compensate and allow the player to move at normal speed while everything else is slow,
            // we multiply the player's velocity by (1 / timeScale).
            // However, we are changing timeScale based on player movement, so when player moves, timeScale approaches 1.

            const currentTimeScale = this.physics.world.timeScale;
            // The velocity needs to be adjusted so the player's movement feels independent of the world time scale.
            // physics.world.timeScale affects how much position changes per frame: delta * timeScale * velocity
            // So to maintain constant visual speed, we divide the desired velocity by timeScale.

            // To prevent division by zero or extremely high values if timeScale gets too close to 0:
            const safeTimeScale = Math.max(currentTimeScale, 0.01);

            this.player.body.velocity.x = (inputX * this.playerSpeed) / safeTimeScale;
            this.player.body.velocity.y = (inputY * this.playerSpeed) / safeTimeScale;

            this.isMoving = (inputX !== 0 || inputY !== 0);
        }
    }

    private handleEnemyAI(unscaledDelta: number) {
        if (!this.enemy.body) return;

        // Since timeScale slows down the game, the path recaluation timer should probably use unscaled delta
        // or scaled delta? The requirement: "Таймер должен учитывать timeScale мира."
        // So we use scene's delta which is affected by timeScale. Wait, to do that easily, we just accumulate `this.game.loop.delta * this.physics.world.timeScale`
        // which roughly corresponds to game time elapsed.
        const scaledDelta = unscaledDelta * this.physics.world.timeScale;

        this.lastPathCalcTime += scaledDelta;

        if (this.lastPathCalcTime >= this.pathRecalcInterval) {
            this.lastPathCalcTime = 0;
            this.calculateEnemyPath();
        }

        // Process EasyStar queue
        this.easystar.calculate();

        // Move along the path
        if (this.path && this.path.length > 0) {
            const targetNode = this.path[0];
            const targetX = targetNode.x * this.TILE_SIZE + this.TILE_SIZE / 2;
            const targetY = targetNode.y * this.TILE_SIZE + this.TILE_SIZE / 2;

            const dist = Phaser.Math.Distance.Between(this.enemy.x, this.enemy.y, targetX, targetY);

            if (dist < 5) { // Reached the node
                this.path.shift(); // Remove reached node

                // If path is empty, stop
                if (this.path.length === 0) {
                    this.enemy.body.velocity.x = 0;
                    this.enemy.body.velocity.y = 0;
                    return;
                }
            } else {
                // Move towards current node
                const angle = Phaser.Math.Angle.Between(this.enemy.x, this.enemy.y, targetX, targetY);

                // Again, scale velocity by (1 / timeScale) to keep real movement speed constant
                // wait, if enemy's velocity is scaled by 1/timeScale, it means it moves at full speed ALWAYS.
                // Should the enemy slow down when time freezes? Yes! "Влияет ли замедление времени на скорость отклика управления? Обычно управление (инпуты) должно работать в реальном времени, а timeScale применять замедление только к физике и игровым таймерам"
                // If time slows down, physics time slows down, so normal velocity will be visually slower.
                // We DON'T scale enemy velocity by 1/timeScale. We just set it normally.

                this.enemy.body.velocity.x = Math.cos(angle) * this.enemySpeed;
                this.enemy.body.velocity.y = Math.sin(angle) * this.enemySpeed;
            }
        } else {
            // No path, stop
            this.enemy.body.velocity.x = 0;
            this.enemy.body.velocity.y = 0;
        }
    }

    private calculateEnemyPath() {
        if (!this.player || !this.enemy) return;

        // Current enemy grid pos
        const ex = Math.floor(this.enemy.x / this.TILE_SIZE);
        const ey = Math.floor(this.enemy.y / this.TILE_SIZE);

        // "Strategic" AI: Target cell is slightly offset from player based on player's velocity or position
        let targetGridX = Math.floor(this.player.x / this.TILE_SIZE);
        let targetGridY = Math.floor(this.player.y / this.TILE_SIZE);

        // Distance in tiles
        const distTiles = Phaser.Math.Distance.Between(ex, ey, targetGridX, targetGridY);

        if (distTiles > 3) {
            // If far enough, try to predict/offset
            let offsetX = 0;
            let offsetY = 0;

            if (this.player.body && this.isMoving) {
                // Offset in direction of player movement
                offsetX = Math.sign(this.player.body.velocity.x) * 2;
                offsetY = Math.sign(this.player.body.velocity.y) * 2;
            } else {
                // Offset to the side of the direct line of sight (just some "flanking" logic)
                // Pick a pseudo-random perpendicular direction
                const dx = targetGridX - ex;
                const dy = targetGridY - ey;

                if (Math.abs(dx) > Math.abs(dy)) {
                    offsetY = (Math.random() > 0.5 ? 1 : -1) * 2;
                } else {
                    offsetX = (Math.random() > 0.5 ? 1 : -1) * 2;
                }
            }

            // Ensure offset is within bounds and reachable
            const testX = Phaser.Math.Clamp(targetGridX + offsetX, 1, this.gridWidth - 2);
            const testY = Phaser.Math.Clamp(targetGridY + offsetY, 1, this.gridHeight - 2);

            if (this.grid[testY][testX] === 0) {
                targetGridX = testX;
                targetGridY = testY;
            }
        }

        this.easystar.findPath(ex, ey, targetGridX, targetGridY, (path) => {
            if (path) {
                // Ignore the first node if it's the current tile
                if (path.length > 0 && path[0].x === ex && path[0].y === ey) {
                    path.shift();
                }
                this.path = path;
            }
        });
    }

    private handleTimeFreeze(delta: number) {
        // Target scale: 1.0 if moving, 0.03 if standing still
        this.targetTimeScale = this.isMoving ? 1.0 : 0.03;

        const currentScale = this.physics.world.timeScale;

        // Use an independent time delta for lerping time scale so it doesn't get stuck when time is slow
        // delta is in ms, we want transition to take ~200ms (0.2s)
        // Lerp factor = delta / transitionTime
        const lerpFactor = Math.min(delta / 200, 1.0);

        let newScale = Phaser.Math.Linear(currentScale, this.targetTimeScale, lerpFactor);

        // Apply clamp to avoid floating point issues
        newScale = Phaser.Math.Clamp(newScale, 0.03, 1.0);

        this.physics.world.timeScale = newScale;
        this.time.timeScale = newScale;
    }
}
