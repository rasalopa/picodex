import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  // github pages serves project sites from /<repo>/; local dev stays at /
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
});
