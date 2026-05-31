import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev proxy forwards /api/* to the local Express server and STRIPS the /api
// prefix, mirroring what the Vercel `experimentalServices` backend
// (routePrefix "/api") does in production — so dev and prod paths match and
// Express mounts its routers at the root.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
