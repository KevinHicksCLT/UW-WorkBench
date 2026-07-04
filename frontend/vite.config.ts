import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev proxy forwards /api/* to the local Express server and STRIPS the /api
// prefix, mirroring what the Vercel `experimentalServices` backend
// (routePrefix "/api") does in production — so dev and prod paths match and
// Express mounts its routers at the root.
export default defineConfig({
  plugins: [react()],
  // Build-time commit SHA for the feedback widget's auto-captured context.
  // Vercel populates VERCEL_GIT_COMMIT_SHA at build; local dev reports "dev".
  define: {
    __COMMIT_SHA__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev'),
  },
  // Pre-bundle the heavy viz libs in the initial optimize pass so Vite doesn't
  // re-optimize mid-load (which caused "504 Outdated Optimize Dep" on first run).
  optimizeDeps: {
    include: ['@xyflow/react', '@dagrejs/dagre'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // Defaults to the local backend; override with BACKEND_PROXY to point an
        // alternate-port dev/validation instance without editing this file.
        target: process.env.BACKEND_PROXY || 'http://localhost:4000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
