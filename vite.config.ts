/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_CF_PAGES ? '/' : '/Osaka-web/',
  test: {
    environment: 'node',
    include: ['scripts/**/*.test.ts', 'src/**/*.test.{ts,tsx}'],
  },
});
