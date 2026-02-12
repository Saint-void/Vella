import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  return {
    server: {
      host: true,
      port: 5172,
      strictPort: true,
      allowedHosts: [
        "exhilaratingly-heaveless-lael.ngrok-free.dev"
      ],
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
  };
});

