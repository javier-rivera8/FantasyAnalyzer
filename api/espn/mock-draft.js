import { handleEspnMockDraft } from '../../server/espnLeague.mjs'

export default function handler(req, res) {
  return handleEspnMockDraft(req, res)
}
