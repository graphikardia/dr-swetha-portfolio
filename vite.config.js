import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/dr-swetha-portfolio/',
  build: { assetsInlineLimit: 100000 }
});
