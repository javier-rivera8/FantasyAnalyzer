import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/espn-fantasy': {
        target: 'https://fantasy.espn.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/espn-fantasy/, ''),
      },
    },
  },
})
