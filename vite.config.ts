import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // GitHub Pages project site: https://<user>.github.io/<repo>/
  base: command === 'serve' ? '/' : '/araf/',
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setupTests.ts'],
  },
}));

