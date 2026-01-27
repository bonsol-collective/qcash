import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { resolve } from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    wasm(),
    topLevelAwait(),
  ],
  build:{
    rollupOptions:{
      input:{
        main:resolve(__dirname,'index.html'),
        background: resolve(__dirname, 'src/background.ts'),
      },
      output:{
        entryFileNames: '[name].js' // Forces background.ts -> background.js
      }
    }
  }
})
