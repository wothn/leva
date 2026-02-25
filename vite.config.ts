import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './src/manifest'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        offscreen: 'src/offscreen/index.html',
      },
    },
  },
  plugins: [crx({ manifest })],
})
