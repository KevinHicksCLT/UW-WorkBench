import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev proxy forwards /api/* to the local Express server and STRIPS the /api
// prefix — the server mounts its routers at the root (/auth, /uw), and the
// frontend api client prefixes every call with /api.
export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.PORT) || 5173,
    proxy: {
      '/api': {
        target: process.env.BACKEND_PROXY || 'http://localhost:4000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
