import { createReadStream, existsSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleEspnDraft, handleEspnLeague } from './server/espnLeague.mjs'

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), 'dist')
const port = Number(process.env.PORT || 4173)
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.png':'image/png', '.svg':'image/svg+xml' }

createServer(async (req, res) => {
  if (req.url?.split('?')[0] === '/api/espn/league') return handleEspnLeague(req, res)
  if (req.url?.split('?')[0] === '/api/espn/draft') return handleEspnDraft(req, res)
  const pathname = decodeURIComponent((req.url || '/').split('?')[0])
  const requested = normalize(pathname).replace(/^(\.\.[/\\])+/, '')
  let file = join(root, requested === '/' ? 'index.html' : requested)
  if (!file.startsWith(root) || !existsSync(file) || (await stat(file)).isDirectory()) file = join(root, 'index.html')
  res.statusCode = 200
  res.setHeader('content-type', mime[extname(file)] || 'application/octet-stream')
  createReadStream(file).pipe(res)
}).listen(port, '0.0.0.0', () => console.log(`Baseline disponible en http://localhost:${port}`))
