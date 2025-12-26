import { defineConfig } from 'vite';
import { copyFileSync, mkdirSync, readdirSync } from 'fs';
import { resolve } from 'path';

export default defineConfig({
  root: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  server: {
    port: 3000,
    open: true,
    cors: true
  },
  preview: {
    port: 4173,
    open: true
  },
  plugins: [{
    name: 'copy-src',
    closeBundle() {
      // Copy src/ files to dist/src/
      const srcDir = resolve(__dirname, 'src');
      const destDir = resolve(__dirname, 'dist/src');
      mkdirSync(destDir, { recursive: true });
      readdirSync(srcDir).forEach(file => {
        if (file.endsWith('.js')) {
          copyFileSync(resolve(srcDir, file), resolve(destDir, file));
        }
      });
    }
  }]
});