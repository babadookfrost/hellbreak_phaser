import Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    create() {
        // Тёмный фон
        this.cameras.main.setBackgroundColor('#111111');

        // Текст "Мясорубка v2" по центру (960 / 2 = 480, 540 / 2 = 270)
        const text = this.add.text(480, 270, 'Мясорубка v2', {
            fontFamily: 'Arial',
            fontSize: '64px',
            color: '#ff4400',
            fontStyle: 'bold'
        });
        text.setOrigin(0.5);

        // Легкое свечение / тень (drop shadow)
        text.setShadow(0, 0, '#ff0000', 10, false, true);
    }
}
