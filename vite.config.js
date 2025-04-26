import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import fs from 'fs';

// 使用fs读取manifest.json
const manifest = JSON.parse(fs.readFileSync('./manifest.json', 'utf-8'));

export default defineConfig({
  plugins: [
    crx({ manifest }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: 'js/background.js',
        content: 'js/content.js',
        popup: 'popup.html',
        offscreen: 'offscreen.html'
      },
      output: {
        entryFileNames: 'js/[name].js',
        chunkFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/\.(css)$/i.test(assetInfo.name)) {
            return 'css/[name][extname]';
          }
          if (/\.(png|jpe?g|gif|svg)$/i.test(assetInfo.name)) {
            return 'icons/[name][extname]';
          }
          return '[name][extname]';
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': '/'
    }
  },
  server: {
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3001
    }
  }
});