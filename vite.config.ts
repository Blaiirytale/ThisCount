import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Must match your GitHub repo name: https://<username>.github.io/ThisCount/
  base: '/ThisCount/',
});
