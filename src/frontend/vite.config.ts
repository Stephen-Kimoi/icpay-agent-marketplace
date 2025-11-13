import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    environment("all", { prefix: "CANISTER_" }),
    environment("all", { prefix: "DFX_" }),
    environment("all", { prefix: "PUBLIC_" }),
    environment("all", { prefix: "VITE_" }),
  ],
  envDir: '../',
  define: {
    'process.env': process.env
  },
  css: {
    postcss: './postcss.config.js',
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    hmr: {
      clientPort: 443
    },
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '00bb-196-96-113-250.ngrok-free.app',
      '.ngrok-free.app'
    ],
    cors: true
  },
}); 