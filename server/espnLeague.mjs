const ESPN_ORIGIN = 'https://fantasy.espn.com'

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(payload))
}

async function readJson(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 1024 * 1024) throw new Error('PAYLOAD_TOO_LARGE')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

function validateRequest(body) {
  const { leagueId, season, swid, espnS2 } = body
  if (!/^\d+$/.test(String(leagueId || '')) || !/^\d{4}$/.test(String(season || ''))) return 'League ID o temporada inválidos.'
  if ((swid && !espnS2) || (!swid && espnS2)) return 'Para una liga privada se necesitan SWID y espn_s2.'
  if ([swid, espnS2].some((value) => value && (/\r|\n/.test(String(value)) || String(value).length > 8192))) return 'Las credenciales de ESPN no tienen un formato válido.'
  return null
}

async function fetchEspn(body, views, refererPath) {
  const { leagueId, season, swid, espnS2 } = body
  const url = new URL(`/apis/v3/games/fba/seasons/${season}/segments/0/leagues/${leagueId}`, ESPN_ORIGIN)
  for (const view of views) url.searchParams.append('view', view)
  const headers = {
    accept: 'application/json, text/plain, */*',
    'user-agent': 'BaselineFantasyAnalyzer/1.0',
    origin: ESPN_ORIGIN,
    referer: `${ESPN_ORIGIN}${refererPath}?leagueId=${leagueId}`,
  }
  if (swid && espnS2) headers.cookie = `SWID=${String(swid).trim()}; espn_s2=${String(espnS2).trim()}`
  const upstream = await fetch(url, { headers, redirect: 'follow' })
  const text = await upstream.text()
  let data
  try { data = JSON.parse(text) } catch { data = null }
  return { upstream, data, privateRequest: Boolean(swid) }
}

async function handleEspn(req, res, { views, refererPath, label }) {
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST')
    return sendJson(res, 405, { error: `Usa POST para consultar ${label}.` })
  }
  try {
    const body = await readJson(req)
    const validationError = validateRequest(body)
    if (validationError) return sendJson(res, 400, { error: validationError })
    const { upstream, data, privateRequest } = await fetchEspn(body, views, refererPath)
    if (!upstream.ok || !data?.teams) {
      const privateFailure = upstream.status === 401 || upstream.status === 403 || privateRequest
      return sendJson(res, privateFailure ? 401 : upstream.status || 502, {
        error: privateFailure
          ? 'ESPN rechazó la sesión. Revisa SWID y espn_s2 e inténtalo de nuevo.'
          : `ESPN no devolvió ${label}. Revisa el League ID y la temporada.`,
      })
    }
    return sendJson(res, 200, { data })
  } catch (error) {
    const status = error?.message === 'PAYLOAD_TOO_LARGE' ? 413 : 500
    return sendJson(res, status, { error: status === 413 ? 'Solicitud demasiado grande.' : 'No se pudo contactar ESPN.' })
  }
}

export function handleEspnLeague(req, res) {
  return handleEspn(req, res, {
    views: ['mRoster', 'mTeam', 'mMatchup', 'mSettings', 'mStatus', 'mStandings'],
    refererPath: '/basketball/league',
    label: 'una liga válida',
  })
}

export function handleEspnDraft(req, res) {
  return handleEspn(req, res, {
    views: ['mDraftDetail', 'mTeam', 'mSettings', 'mStatus', 'mRoster'],
    refererPath: '/basketball/draft',
    label: 'el estado del draft',
  })
}
