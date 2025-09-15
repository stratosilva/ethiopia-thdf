import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/dhis2': {
        target: 'https://staging.ephi.gov.et',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/dhis2/, '/api'),
      },
    },
  },
});
