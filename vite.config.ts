import { defineConfig } from 'vite';

export default defineConfig({
  base: '/hellbreak_phaser/',
  build: {
    // Убираем предупреждение о большом размере чанка, так как Phaser сам по себе крупный
    chunkSizeWarningLimit: 1500,
  }
});
