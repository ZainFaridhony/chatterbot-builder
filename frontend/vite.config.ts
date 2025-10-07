import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Filter noisy util._extend deprecation warnings emitted by transitive dependencies.
const originalEmitWarning = process.emitWarning;
process.emitWarning = (warning, ...args) => {
  const message = typeof warning === 'string' ? warning : warning?.message;
  if (message && message.includes('util._extend')) {
    return;
  }
  return originalEmitWarning.call(process, warning as any, ...args);
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
