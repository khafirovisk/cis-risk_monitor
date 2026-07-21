import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Em dev, faz proxy de /api -> backend NestJS (:3000), preservando cookies de sessão.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
