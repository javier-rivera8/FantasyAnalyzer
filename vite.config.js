import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { handleEspnDraft, handleEspnLeague } from './server/espnLeague.mjs'

const espnLeagueApi = () => ({
  name: 'espn-league-api',
  configureServer(server) {
    server.middlewares.use('/api/espn/league', (req, res) => handleEspnLeague(req, res))
    server.middlewares.use('/api/espn/draft', (req, res) => handleEspnDraft(req, res))
  },
})

export default defineConfig({
  plugins: [react(), espnLeagueApi()],
  server: {
    port: 5173,
  },
})
