import Phaser from 'phaser';

export class TitleScene extends Phaser.Scene {
    constructor() {
        super('TitleScene');
    }

    preload() {
        this.load.audio('horror_sound', 'horror.wav');
    }

    create() {
        const sound = this.sound.add('horror_sound');
        sound.play();

        // Тёмный фон
        this.cameras.main.setBackgroundColor('#050000');

        // Create a programmatic fire particle texture
        const graphics = this.make.graphics({x: 0, y: 0});
        graphics.fillStyle(0xffffff, 1);
        // Draw a soft circle
        graphics.fillCircle(8, 8, 8);
        graphics.generateTexture('fireParticle', 16, 16);

        const titleText = 'Мясорубка v2';
        const fontSize = 64;

        // Use a temporary text object to measure character widths
        const tempText = this.add.text(0, 0, '', {
            fontFamily: 'Arial',
            fontSize: `${fontSize}px`,
            fontStyle: 'bold'
        }).setVisible(false);

        const letters: Phaser.GameObjects.Text[] = [];
        let totalWidth = 0;
        const letterWidths: number[] = [];

        // Calculate individual widths
        for (let i = 0; i < titleText.length; i++) {
            tempText.setText(titleText[i]);
            const w = tempText.width;
            letterWidths.push(w);
            totalWidth += w;
        }

        // Add some spacing between characters
        const spacing = 5;
        totalWidth += spacing * (titleText.length - 1);

        const startX = 480 - totalWidth / 2;
        const startY = 270;
        let currentX = startX;

        // Create individual letter objects
        const emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];

        for (let i = 0; i < titleText.length; i++) {
            const char = titleText[i];
            const w = letterWidths[i];

            // Only animate and apply effects to non-space characters
            if (char !== ' ') {
                // Determine a unique fire style for this letter based on its index
                // We mix reds, oranges, yellows, and occasionally green/blue for a demonic vibe
                let colorTint;
                const randColor = Math.random();
                if (randColor > 0.85) {
                    // Demonic Green/Blue flame
                    colorTint = [ 0x00ff88, 0x0088ff, 0x002288 ];
                } else if (randColor > 0.6) {
                    // Deep hell red
                    colorTint = [ 0xff0000, 0x880000, 0x330000 ];
                } else {
                    // Standard bright fire
                    colorTint = [ 0xffcc00, 0xff6600, 0xff0000 ];
                }

                const letter = this.add.text(currentX + w / 2, startY, char, {
                    fontFamily: 'Arial',
                    fontSize: `${fontSize}px`,
                    color: '#ff4400',
                    fontStyle: 'bold'
                });

                // Set origin to center for proper scaling
                letter.setOrigin(0.5, 0.5);
                letter.setShadow(0, 0, '#ff0000', 10, false, true);

                // Initial state for animation
                letter.setAlpha(0);
                letter.setScale(0.5);

                letters.push(letter);

                // Add Particle Emitter for this letter
                const emitter = this.add.particles(0, 0, 'fireParticle', {
                    x: letter.x,
                    y: letter.y + fontSize * 0.3, // start near the bottom of the letter
                    lifespan: { min: 400, max: 1200 }, // vary lifespan
                    speedY: { min: -100, max: -300 }, // move up
                    speedX: { min: -20, max: 20 }, // slight spread
                    scale: { start: Math.random() * 0.5 + 0.8, end: 0 },
                    alpha: { start: 0.8, end: 0 },
                    tint: colorTint,
                    blendMode: 'ADD',
                    frequency: 30, // rate of fire
                    emitZone: {
                        type: 'random',
                        source: new Phaser.Geom.Rectangle(-w/2 + 5, -10, w - 10, 20) as unknown as Phaser.Types.GameObjects.Particles.RandomZoneSource
                    }
                });

                // Start emitters completely hidden/inactive
                emitter.setAlpha(0);
                emitters.push(emitter);
            }

            currentX += w + spacing;
        }

        tempText.destroy();

        // Horror trailer reveal animation
        const revealDuration = 6800; // Build up slightly before the boom at 6.8s

        // Fade in letters
        this.tweens.add({
            targets: letters,
            alpha: { from: 0, to: 1 },
            scale: { from: 0.5, to: 1.1 },
            duration: revealDuration,
            ease: 'Sine.easeInOut',
            delay: this.tweens.stagger(150, { start: 0 }), // Staggered appearance
            onComplete: () => {
                // Boom happens around here, adding a shake/flicker effect
                this.cameras.main.shake(300, 0.015);

                // Add continuous subtle floating/scaling for eerie feel
                this.tweens.add({
                    targets: letters,
                    scale: 1.15,
                    duration: 3000,
                    ease: 'Sine.easeInOut',
                    yoyo: true,
                    repeat: -1,
                    delay: this.tweens.stagger(100)
                });
            }
        });

        // Fade in fire emitters gradually alongside the text
        this.tweens.add({
            targets: emitters,
            alpha: { from: 0, to: 1 },
            duration: revealDuration,
            ease: 'Sine.easeIn',
            delay: this.tweens.stagger(150, { start: 0 }),
        });

        // Add a random flicker to the letters to simulate fire light
        this.time.addEvent({
            delay: 100,
            loop: true,
            callback: () => {
                letters.forEach(letter => {
                    // Randomly adjust alpha very slightly to simulate flickering light
                    // Only apply if the letter has already faded in (alpha > 0.5)
                    if (letter.alpha > 0.5) {
                        const flickerAlpha = Phaser.Math.FloatBetween(0.8, 1.0);
                        letter.setAlpha(flickerAlpha);
                    }
                });
            }
        });

        // Click to start
        const startText = this.add.text(480, 450, 'CLICK TO START', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#ffffff'
        }).setOrigin(0.5, 0.5).setAlpha(0);

        this.tweens.add({
            targets: startText,
            alpha: { from: 0.3, to: 1 },
            duration: 1000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1,
            delay: 2000
        });

        this.input.once('pointerdown', () => {
            this.scene.start('GameScene');
        });
    }
}
