import { createDraft, validDraft } from './draftModel.mjs'

export const ESPN_BRIDGE_SOURCE = 'baseline-espn-extension-v1'
const normalizeName = name => String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

export function validateEspnSnapshot(snapshot) {
  if (!snapshot || snapshot.version !== 1 || !/^\d{4}:\d+$/.test(snapshot.draftId || '')) throw new Error('Sala de ESPN inválida.')
  if (!Array.isArray(snapshot.teams) || snapshot.teams.length < 2 || snapshot.teams.length > 20) throw new Error('Lista de equipos inválida.')
  const ids = snapshot.teams.map(team => team.id)
  if (ids.some(id => !/^espn-\d+$/.test(id)) || new Set(ids).size !== ids.length || snapshot.teams.some(team => typeof team.name !== 'string' || !team.name.trim() || team.name.length > 160)) throw new Error('Equipos de ESPN inválidos.')
  if (!Array.isArray(snapshot.order) || snapshot.order.length !== ids.length || new Set(snapshot.order).size !== ids.length || snapshot.order.some(id => !ids.includes(id))) throw new Error('Orden de ESPN inválido.')
  if (!Number.isInteger(snapshot.rounds) || snapshot.rounds < 1 || snapshot.rounds > 50 || !Array.isArray(snapshot.picks) || snapshot.picks.length > snapshot.rounds * ids.length) throw new Error('Historial de ESPN inválido.')
  const positions = new Set(), players = new Set()
  for (const pick of snapshot.picks) {
    if (!Number.isInteger(pick.overall) || pick.overall < 1 || pick.overall > snapshot.rounds * ids.length || positions.has(pick.overall) || !ids.includes(pick.teamId) || typeof pick.playerName !== 'string' || !pick.playerName.trim() || pick.playerName.length > 160 || (pick.playerId && !/^\d+$/.test(pick.playerId))) throw new Error('Selección de ESPN inválida.')
    if (pick.playerId && players.has(pick.playerId)) throw new Error('Jugador duplicado en ESPN.')
    positions.add(pick.overall)
    if (pick.playerId) players.add(pick.playerId)
  }
  if (snapshot.completeHistory && ![...snapshot.picks].sort((a, b) => a.overall - b.overall).every((pick, index) => pick.overall === index + 1)) throw new Error('El historial de ESPN tiene huecos.')
  return snapshot
}

export function syncEspnSnapshot(current, snapshot, players) {
  validateEspnSnapshot(snapshot)
  const sameRoom = current.espnSync?.draftId === snapshot.draftId
  const teams = snapshot.teams.map(team => ({ id: team.id, name: team.name.trim() }))
  const byId = new Map(players.map(player => [String(player.id), player]))
  const byName = new Map()
  for (const player of players) {
    const name = normalizeName(player.name)
    // Ambiguous names must not silently match another player.
    byName.set(name, byName.has(name) ? null : player)
  }
  const incoming = snapshot.picks.map(pick => {
    const player = byId.get(pick.playerId) || byName.get(normalizeName(pick.playerName))
    return {
      overall: pick.overall, round: Math.floor((pick.overall - 1) / teams.length) + 1,
      teamId: pick.teamId, playerId: player ? String(player.id) : pick.playerId || `unmatched:${normalizeName(pick.playerName)}`,
      playerName: pick.playerName, espnPlayerId: pick.playerId || '', unmatched: !player,
    }
  })
  const previous = [...current.picks, ...(current.espnSync?.buffered || [])]
  const merged = new Map(sameRoom && !snapshot.completeHistory ? previous.map(pick => [pick.overall, pick]) : [])
  for (const pick of incoming) merged.set(pick.overall, pick)
  const picks = []
  const seen = new Set()
  for (let overall = 1; merged.has(overall); overall++) {
    const pick = merged.get(overall)
    if (seen.has(pick.playerId)) throw new Error('Dos picks se asociaron al mismo jugador de Baseline.')
    seen.add(pick.playerId)
    picks.push(pick)
  }
  const myTeamId = sameRoom && teams.some(team => team.id === current.myTeamId) ? current.myTeamId
    : teams.some(team => team.id === snapshot.myTeamId) ? snapshot.myTeamId : teams[0].id
  const result = {
    ...createDraft(teams.length), teams, order: [...snapshot.order], rounds: snapshot.rounds, myTeamId, picks,
    espnSync: { draftId: snapshot.draftId, title: String(snapshot.title || 'Draft ESPN').slice(0, 200), received: merged.size, pending: merged.size - picks.length, buffered: [...merged.values()].filter(pick => pick.overall > picks.length), unmatched: picks.filter(pick => pick.unmatched).length },
  }
  if (!validDraft(result)) throw new Error('No se pudo importar el draft de ESPN.')
  return result
}
