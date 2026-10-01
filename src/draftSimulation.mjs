import { draftSlot } from './draftModel.mjs'

const COUNTING = ['pts', 'reb', 'ast', 'threeMade', 'stl', 'blk']
const PERCENT = ['fgPct', 'ftPct']

function randomSource(seed) {
  let state = seed >>> 0 || 1
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 4294967296
  }
}

function rosterTotals(ids, byId) {
  const roster = ids.map(id => byId.get(id)).filter(Boolean)
  const totals = {}
  for (const key of COUNTING) totals[key] = roster.reduce((sum, player) => sum + Number(player[key] || 0) * Math.max(.4, Number(player.gp || 0) / 82) * 3.5, 0)
  for (const key of PERCENT) {
    const weight = player => Math.max(.4, Number(player.gp || 0) / 82) * Math.max(5, Number(player.min || 20))
    const totalWeight = roster.reduce((sum, player) => sum + weight(player), 0)
    totals[key] = totalWeight ? roster.reduce((sum, player) => sum + Number(player[key] || 0) * weight(player), 0) / totalWeight : 0
  }
  return totals
}

export function simulateDraftStandings(draft, projectedPlayers, runs = 200) {
  const teams = draft.teams
  const teamCount = teams.length
  const totalPicks = teamCount * draft.rounds
  const byId = new Map(projectedPlayers.map(player => [String(player.id), player]))
  const pool = [...projectedPlayers].sort((a, b) => b.value - a.value || String(a.id).localeCompare(String(b.id)))
  const totals = new Map(teams.map(team => [team.id, { rank: 0, first: 0, topFour: 0, wins: 0 }]))
  const actualPicks = new Map(teams.map(team => [team.id, draft.picks.filter(pick => pick.teamId === team.id).length]))
  const runCount = Math.max(1, Math.floor(runs))

  for (let run = 0; run < runCount; run += 1) {
    const random = randomSource(0x9e3779b9 ^ (run + 1) * 2654435761 ^ draft.picks.length * 1013904223)
    const rosters = new Map(teams.map(team => [team.id, []]))
    const taken = new Set()
    for (const pick of draft.picks) {
      if (rosters.has(pick.teamId) && byId.has(pick.playerId)) rosters.get(pick.teamId).push(pick.playerId)
      taken.add(pick.playerId)
    }
    // Complete the remaining snake picks with a random choice among the highest
    // ranked available players. Existing manual picks always remain fixed.
    let cursor = 0
    for (let overall = draft.picks.length + 1; overall <= totalPicks; overall += 1) {
      const slot = draftSlot(draft, overall)
      while (cursor < pool.length && taken.has(String(pool[cursor].id))) cursor += 1
      const candidates = []
      for (let index = cursor; index < pool.length && candidates.length < 12; index += 1) {
        if (!taken.has(String(pool[index].id))) candidates.push(pool[index])
      }
      if (!candidates.length) break
      const chosen = candidates[Math.floor(Math.pow(random(), 1.7) * candidates.length)]
      const id = String(chosen.id)
      taken.add(id)
      rosters.get(slot.teamId).push(id)
    }
    const categories = new Map(teams.map(team => [team.id, rosterTotals(rosters.get(team.id), byId)]))
    const records = new Map(teams.map(team => [team.id, { wins: 0, categoryWins: 0 }]))
    for (let left = 0; left < teamCount; left += 1) for (let right = left + 1; right < teamCount; right += 1) {
      const a = categories.get(teams[left].id), b = categories.get(teams[right].id)
      let aCategories = 0, bCategories = 0
      for (const key of [...COUNTING, ...PERCENT]) {
        const spread = PERCENT.includes(key) ? .035 : .13
        const aValue = a[key] * (1 + (random() + random() - 1) * spread)
        const bValue = b[key] * (1 + (random() + random() - 1) * spread)
        if (aValue > bValue) aCategories += 1
        else if (bValue > aValue) bCategories += 1
      }
      const leftRecord = records.get(teams[left].id), rightRecord = records.get(teams[right].id)
      leftRecord.categoryWins += aCategories
      rightRecord.categoryWins += bCategories
      if (aCategories > bCategories) leftRecord.wins += 1
      else if (bCategories > aCategories) rightRecord.wins += 1
      else { leftRecord.wins += .5; rightRecord.wins += .5 }
    }
    const ranking = [...teams].sort((a, b) => records.get(b.id).wins - records.get(a.id).wins || records.get(b.id).categoryWins - records.get(a.id).categoryWins || draft.order.indexOf(a.id) - draft.order.indexOf(b.id))
    ranking.forEach((team, index) => {
      const total = totals.get(team.id)
      total.rank += index + 1
      total.first += Number(index === 0)
      total.topFour += Number(index < Math.min(4, teamCount))
      total.wins += records.get(team.id).wins
    })
  }

  return teams.map(team => ({ ...team, picks: actualPicks.get(team.id), averageRank: totals.get(team.id).rank / runCount, firstOdds: totals.get(team.id).first / runCount * 100, topFourOdds: totals.get(team.id).topFour / runCount * 100, averageWins: totals.get(team.id).wins / runCount })).sort((a, b) => a.averageRank - b.averageRank || a.name.localeCompare(b.name))
}
