import { handleEspnLeague } from '../../server/espnLeague.mjs'

export default function handler(req, res) {
  return handleEspnLeague(req, res)
}
