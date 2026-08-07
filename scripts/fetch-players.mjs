import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const season = Number(process.argv[2] || 2026)
const endpoint = new URL('https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete')
endpoint.search = new URLSearchParams({
  region: 'us',
  lang: 'en',
  contentorigin: 'espn',
  isqualified: 'false',
  page: '1',
  limit: '1000',
  sort: 'offensive.avgPoints:desc',
  seasontype: '2',
  season: String(season),
}).toString()

const response = await fetch(endpoint, { headers: { 'user-agent': 'BaselineFantasy/1.0' } })
if (!response.ok) throw new Error(`ESPN respondió ${response.status}`)
const payload = await response.json()

const fieldNames = Object.fromEntries(payload.categories.map((category) => [category.name, category.names]))
const readCategory = (entry, name) => {
  const category = entry.categories?.find((item) => item.name === name)
  return Object.fromEntries((fieldNames[name] || []).map((key, index) => [key, category?.values?.[index] ?? null]))
}
const round = (value, digits = 1) => value == null ? 0 : Number(Number(value).toFixed(digits))

const players = payload.athletes.map((entry) => {
  const athlete = entry.athlete
  const general = readCategory(entry, 'general')
  const offense = readCategory(entry, 'offensive')
  const defense = readCategory(entry, 'defensive')
  const fantasyScore = (offense.avgPoints || 0) + (general.avgRebounds || 0) * 1.2 +
    (offense.avgAssists || 0) * 1.5 + (defense.avgSteals || 0) * 3 +
    (defense.avgBlocks || 0) * 3 - (offense.avgTurnovers || 0) +
    (offense.avgThreePointFieldGoalsMade || 0) * 0.5

  return {
    id: athlete.id,
    name: athlete.displayName,
    firstName: athlete.firstName,
    lastName: athlete.lastName,
    team: athlete.teamShortName || athlete.teams?.[0]?.abbreviation || 'FA',
    teamName: athlete.teamName || 'Free Agent',
    teamId: athlete.teamId || null,
    teamLogo: athlete.teamLogos?.[0]?.href || null,
    position: athlete.position?.abbreviation || '—',
    age: athlete.age || null,
    status: athlete.status?.type || 'active',
    headshot: athlete.headshot?.href || `https://a.espncdn.com/i/headshots/nba/players/full/${athlete.id}.png`,
    gp: round(general.gamesPlayed, 0),
    min: round(general.avgMinutes),
    pts: round(offense.avgPoints),
    reb: round(general.avgRebounds),
    ast: round(offense.avgAssists),
    stl: round(defense.avgSteals),
    blk: round(defense.avgBlocks),
    tov: round(offense.avgTurnovers),
    fgPct: round(offense.fieldGoalPct),
    ftPct: round(offense.freeThrowPct),
    threePct: round(offense.threePointFieldGoalPct),
    threeMade: round(offense.avgThreePointFieldGoalsMade),
    fantasyScore: round(fantasyScore),
  }
}).filter((player) => player.name && player.gp > 0)

const scores = players.map((player) => player.fantasyScore)
const max = Math.max(...scores)
const min = Math.min(...scores)
players.forEach((player) => {
  player.value = Math.max(1, Math.round(40 + ((player.fantasyScore - min) / (max - min || 1)) * 59))
})

const output = {
  generatedAt: new Date().toISOString(),
  season: payload.requestedSeason?.displayName || `${season - 1}-${String(season).slice(-2)}`,
  count: players.length,
  source: 'ESPN NBA Statistics',
  players,
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
await fs.mkdir(path.join(root, 'public', 'data'), { recursive: true })
await fs.writeFile(path.join(root, 'public', 'data', 'players.json'), JSON.stringify(output))
console.log(`Guardados ${players.length} jugadores de la temporada ${output.season}.`)
