export const DRAFT_ROUNDS = 13
export const DRAFT_CATEGORIES = [
  ['pts', 'PTS'], ['reb', 'REB'], ['ast', 'AST'], ['threeMade', '3PM'],
  ['stl', 'STL'], ['blk', 'BLK'], ['fgPct', 'FG%'], ['ftPct', 'FT%'],
]

export function createDraft(teamCount = 12) {
  const count = Math.max(2, Math.min(20, Number(teamCount) || 12))
  const teams = Array.from({ length: count }, (_, index) => ({ id: `team-${index + 1}`, name: `Equipo ${index + 1}` }))
  return { version: 1, rounds: DRAFT_ROUNDS, teams, order: teams.map(team => team.id), myTeamId: teams[0].id, picks: [] }
}

export function validDraft(draft) {
  if (!draft || draft.version !== 1 || !Array.isArray(draft.teams) || !Array.isArray(draft.order) || !Array.isArray(draft.picks)) return false
  const ids = draft.teams.map(team => team.id)
  return ids.length >= 2 && ids.length <= 20 && new Set(ids).size === ids.length && draft.order.length === ids.length && draft.order.every(id => ids.includes(id)) && new Set(draft.order).size === ids.length && ids.includes(draft.myTeamId) && Number.isInteger(draft.rounds) && draft.rounds > 0
}

export function draftSlot(draft, overall = draft.picks.length + 1) {
  const count = draft.order.length
  const round = Math.floor((overall - 1) / count) + 1
  const position = (overall - 1) % count
  const orderIndex = round % 2 === 0 ? count - 1 - position : position
  const teamId = draft.order[orderIndex]
  return { overall, round, roundPick: position + 1, teamId, team: draft.teams.find(team => team.id === teamId), completed: round > draft.rounds }
}

export function assignDraftPosition(draft, teamId, position) {
  const target = Number(position) - 1
  const source = draft.order.indexOf(teamId)
  if (source < 0 || target < 0 || target >= draft.order.length) return draft
  const order = [...draft.order]
  ;[order[source], order[target]] = [order[target], order[source]]
  return { ...draft, order }
}

export function addDraftPick(draft, playerId) {
  const id = String(playerId)
  if (!id || draft.picks.some(pick => pick.playerId === id)) return draft
  const slot = draftSlot(draft)
  if (slot.completed) return draft
  return { ...draft, picks: [...draft.picks, { overall: slot.overall, round: slot.round, teamId: slot.teamId, playerId: id }] }
}

export function removeDraftPick(draft, overall) {
  if (draft.picks.at(-1)?.overall !== overall) return draft
  return { ...draft, picks: draft.picks.slice(0, -1) }
}

const COUNTING_STATS = ['pts', 'reb', 'ast', 'threeMade', 'stl', 'blk']
const PERCENT_STATS = ['fgPct', 'ftPct']

export function projectDraftPlayers(players) {
  const qualified = players.filter(player => Number(player.gp) >= 20 && Number(player.min) >= 15)
  const average = (pool, key) => pool.reduce((sum, player) => sum + Number(player[key] || 0), 0) / Math.max(1, pool.length)
  const positions = [...new Set(players.map(player => player.position))]
  const means = Object.fromEntries(positions.map(position => {
    const pool = qualified.filter(player => player.position === position)
    return [position, Object.fromEntries([...COUNTING_STATS, ...PERCENT_STATS].map(key => [key, average(pool.length ? pool : qualified, key)]))]
  }))
  const projected = players.map(player => {
    const gp = Number(player.gp || 0)
    const reliability = Math.min(.92, gp / (gp + 12))
    const age = Number(player.age || 27)
    const ageFactor = age >= 35 ? .96 : age >= 32 ? .985 : 1
    const estimate = { ...player, gp: Math.min(82, Math.max(1, Math.round(gp * .65 + 68 * .35 - Math.max(0, age - 32) * 1.5))) }
    for (const key of COUNTING_STATS) estimate[key] = Number(((Number(player[key] || 0) * reliability + means[player.position][key] * (1 - reliability)) * ageFactor).toFixed(1))
    for (const key of PERCENT_STATS) estimate[key] = Number((Number(player[key] || 0) * reliability + means[player.position][key] * (1 - reliability)).toFixed(1))
    estimate.fantasyScore = estimate.pts + estimate.reb * 1.2 + estimate.ast * 1.5 + estimate.stl * 3 + estimate.blk * 3 + estimate.threeMade * .8 + (estimate.fgPct - 45) * .55 + (estimate.ftPct - 75) * .22
    return estimate
  })
  const scores = projected.map(player => player.fantasyScore)
  const min = Math.min(...scores), max = Math.max(...scores)
  return projected.map(player => ({ ...player, value: Math.max(1, Math.round(40 + (player.fantasyScore - min) / (max - min || 1) * 59)) }))
}
