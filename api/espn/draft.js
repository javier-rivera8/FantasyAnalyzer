import { handleEspnDraft } from '../../server/espnLeague.mjs'

export default function handler(req, res) {
  return handleEspnDraft(req, res)
}
