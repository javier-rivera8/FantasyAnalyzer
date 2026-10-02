// Shared by the ESPN content script and the Node regression tests.
function readEspnDraft(doc, pageUrl) {
  const url = new URL(pageUrl)
  const leagueId = url.searchParams.get('leagueId')
  const seasonId = url.searchParams.get('seasonId')
  if (url.hostname !== 'fantasy.espn.com' || !url.pathname.includes('/basketball/draft') || !leagueId || !seasonId) return null
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim()
  const rosterSelect = [...doc.querySelectorAll('select')].find(select => {
    const options = [...select.options]
    return options.length >= 2 && options.length <= 20 && options.every(option => /^\d+$/.test(option.value) && Number(option.value) > 0)
      && !options.some(option => /^(Round |\d+ seconds|\d+ minutes|\d+ hours)/.test(option.textContent))
  })
  if (!rosterSelect) return null
  const teams = [...rosterSelect.options].map(option => ({ id: `espn-${option.value}`, name: clean(option.textContent) }))
  if (new Set(teams.map(team => team.id)).size !== teams.length) return null
  const names = new Map(teams.map(team => [team.name, team.id]))
  const picks = []
  let unreadable = 0
  const cards = [...doc.querySelectorAll('.pick-message__container')]
  for (const card of cards) {
    const playerName = clean(card.querySelector('.playerinfo__playername')?.textContent)
    const info = card.querySelector('.pick-info')
    const match = clean(info?.textContent).match(/^R(\d+),\s*P(\d+)\s*-\s*(.+)$/)
    const teamId = match && names.get(clean(match[3]))
    const image = [...card.querySelectorAll('img')].map(img => img.getAttribute('src') || '').find(src => /\/players\/full\/\d+\.png/.test(src))
    const playerId = image?.match(/\/players\/full\/(\d+)\.png/)?.[1] || ''
    const round = Number(match?.[1]), roundPick = Number(match?.[2])
    if (!playerName || !teamId || round < 1 || round > 50 || roundPick < 1 || roundPick > teams.length) { unreadable++; continue }
    picks.push({ overall: (round - 1) * teams.length + roundPick, round, roundPick, teamId, playerId, playerName })
  }
  picks.sort((a, b) => a.overall - b.overall)
  // The roster menu is in draft order in ESPN's basketball room. Completed
  // round-one picks provide an independent authoritative order when available.
  const firstRound = picks.filter(pick => pick.round === 1)
  const order = firstRound.length === teams.length && new Set(firstRound.map(pick => pick.teamId)).size === teams.length
    ? firstRound.map(pick => pick.teamId) : teams.map(team => team.id)
  const roundOptions = [...doc.querySelectorAll('option')].map(option => clean(option.textContent).match(/^Round (\d+)$/)).filter(Boolean)
  const rounds = Math.max(roundOptions.length ? 1 : 13, ...roundOptions.map(match => Number(match[1])), ...picks.map(pick => pick.round))
  const completeHistory = unreadable === 0 && picks.length > 0 && picks.every((pick, index) => pick.overall === index + 1)
  const connectionFailed = [...doc.querySelectorAll('[role="dialog"]')].some(dialog => /Connection Failed|unsuccessful/.test(dialog.textContent || ''))
  return {
    version: 1, draftId: `${seasonId}:${leagueId}`, leagueId, seasonId,
    title: clean(doc.querySelector('h1')?.textContent), teams, order, rounds,
    myTeamId: `espn-${url.searchParams.get('teamId') || ''}`,
    picks, completeHistory, unreadable, connectionFailed,
  }
}

globalThis.BaselineEspnParser = { readEspnDraft }
