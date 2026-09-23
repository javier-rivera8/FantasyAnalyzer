const ESPN_API_ORIGIN = 'https://lm-api-reads.fantasy.espn.com'
const REQUEST_TIMEOUT_MS = 30_000
const MAX_BODY_SIZE = 1024 * 1024
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || 'https://fantasy-analyzer-jr-2026.web.app,https://fantasy-analyzer-jr-2026.firebaseapp.com')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
)

class EspnRequestError extends Error {
  constructor(message, status = 502) {
    super(message)
    this.status = status
  }
}

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(payload))
}

async function readJson(req) {
  try {
    const parsedBody = req.body
    if (parsedBody !== undefined) {
      if (Buffer.isBuffer(parsedBody)) {
        if (parsedBody.length > MAX_BODY_SIZE) throw new Error('PAYLOAD_TOO_LARGE')
        return JSON.parse(parsedBody.toString('utf8') || '{}')
      }
      if (typeof parsedBody === 'string') {
        if (Buffer.byteLength(parsedBody) > MAX_BODY_SIZE) throw new Error('PAYLOAD_TOO_LARGE')
        return JSON.parse(parsedBody || '{}')
      }
      if (Buffer.byteLength(JSON.stringify(parsedBody || {})) > MAX_BODY_SIZE) throw new Error('PAYLOAD_TOO_LARGE')
      return parsedBody || {}
    }
  } catch (error) {
    if (error?.message === 'PAYLOAD_TOO_LARGE') throw error
    throw new Error('INVALID_JSON')
  }

  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_SIZE) throw new Error('PAYLOAD_TOO_LARGE')
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
  } catch {
    throw new Error('INVALID_JSON')
  }
}

function setCorsHeaders(req, res) {
  const origin = req.headers?.origin
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('access-control-allow-origin', origin)
    res.setHeader('vary', 'Origin')
  }
  res.setHeader('access-control-allow-methods', 'POST, OPTIONS')
  res.setHeader('access-control-allow-headers', 'content-type')
  res.setHeader('access-control-max-age', '86400')
}

function validateRequest(body) {
  const { leagueId, season, swid, espnS2 } = body
  if (!/^\d+$/.test(String(leagueId || '')) || !/^\d{4}$/.test(String(season || ''))) return 'League ID o temporada inválidos.'
  if ((swid && !espnS2) || (!swid && espnS2)) return 'Para una liga privada se necesitan SWID y espn_s2.'
  if ([swid, espnS2].some((value) => value && (/\r|\n/.test(String(value)) || String(value).length > 8192))) return 'Las credenciales de ESPN no tienen un formato válido.'
  return null
}

function unwrapEspnPayload(payload) {
  const data = Array.isArray(payload) ? payload[0] : payload
  return data && typeof data === 'object' ? data : null
}

function requestHeaders(body) {
  const headers = {
    accept: 'application/json, text/plain, */*',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152.0.0.0 Safari/537.36',
    'x-fantasy-source': 'kona',
  }
  if (body.swid && body.espnS2) headers.cookie = `SWID=${String(body.swid).trim()}; espn_s2=${String(body.espnS2).trim()}`
  return headers
}

async function espnDraftSecurity(body) {
  const { leagueId, season, teamId, memberId } = body
  const url = new URL(
    `/apis/v3/games/fba/seasons/${season}/segments/0/leagues/${leagueId}/teams/${teamId}/draftSecurity`,
    ESPN_API_ORIGIN,
  )
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      headers: requestHeaders(body),
      redirect: 'follow',
      signal: controller.signal,
    })
    const text = await response.text()
    let payload = text
    try { payload = JSON.parse(text) } catch { /* The endpoint may return a plain token. */ }
    if (!response.ok) {
      throw new EspnRequestError(
        response.status === 401 || response.status === 403
          ? 'ESPN rechazó la sesión. Actualiza SWID y espn_s2.'
          : 'ESPN no permitió abrir el canal live de esta sala mock.',
        response.status === 401 || response.status === 403 ? 401 : 502,
      )
    }
    const securityPart = String(payload || '').trim()
    if (!securityPart) throw new EspnRequestError('ESPN no devolvió el token live del mock.', 502)
    const draftToken = `fba:${leagueId}:${teamId}:${memberId}:${securityPart}`
    const query = new URLSearchParams({
      1: 'fba',
      2: String(leagueId),
      3: String(teamId),
      4: String(memberId),
      5: draftToken,
      6: 'false',
      7: 'false',
      8: 'KONA',
      nocache: String(Math.floor(Math.random() * 1_000_000)),
    })
    return `wss://fantasydraft.espn.com/game-fba/league-${leagueId}/JOIN?${query}`
  } catch (error) {
    if (error instanceof EspnRequestError) throw error
    throw new EspnRequestError(
      error?.name === 'AbortError' ? 'ESPN tardó demasiado en abrir el canal live.' : 'No se pudo abrir el canal live de ESPN.',
      error?.name === 'AbortError' ? 504 : 502,
    )
  } finally {
    clearTimeout(timeout)
  }
}

function requestAttempts(body, views, scoringPeriodId, matchupPeriodId) {
  const { leagueId, season } = body
  const attempts = [
    {
      name: 'modern',
      url: new URL(`/apis/v3/games/fba/seasons/${season}/segments/0/leagues/${leagueId}`, ESPN_API_ORIGIN),
    },
    {
      name: 'history',
      url: new URL(`/apis/v3/games/fba/leagueHistory/${leagueId}`, ESPN_API_ORIGIN),
      seasonId: season,
    },
  ]

  for (const attempt of attempts) {
    if (attempt.seasonId) attempt.url.searchParams.set('seasonId', attempt.seasonId)
    for (const view of views) attempt.url.searchParams.append('view', view)
    if (scoringPeriodId != null) attempt.url.searchParams.set('scoringPeriodId', String(scoringPeriodId))
    if (matchupPeriodId != null) attempt.url.searchParams.set('matchupPeriodId', String(matchupPeriodId))
  }
  return attempts
}

async function espnGet(body, { views, scoringPeriodId, matchupPeriodId }) {
  const failures = []
  for (const attempt of requestAttempts(body, views, scoringPeriodId, matchupPeriodId)) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const response = await fetch(attempt.url, {
        headers: requestHeaders(body),
        redirect: 'follow',
        signal: controller.signal,
      })
      const text = await response.text()
      let payload = null
      try { payload = JSON.parse(text) } catch { /* ESPN can return an HTML error page. */ }
      const data = unwrapEspnPayload(payload)
      if (response.ok && data) return { data, endpointUsed: attempt.name }
      failures.push({ status: response.status, endpoint: attempt.name })
    } catch (error) {
      failures.push({ status: error?.name === 'AbortError' ? 504 : 502, endpoint: attempt.name })
    } finally {
      clearTimeout(timeout)
    }
  }

  const authFailure = failures.some(({ status }) => status === 401 || status === 403)
  throw new EspnRequestError(
    authFailure
      ? 'ESPN rechazó la sesión. Revisa SWID y espn_s2 e inténtalo de nuevo.'
      : 'ESPN no devolvió datos para esa liga y temporada.',
    authFailure ? 401 : failures.some(({ status }) => status === 504) ? 504 : 502,
  )
}

function rosterEntries(team) {
  return Array.isArray(team?.roster?.entries) ? team.roster.entries : []
}

function mergeRosterSnapshot(data, snapshot) {
  const snapshotTeams = new Map((snapshot.teams || []).map((team) => [String(team.id), team]))
  data.teams = (data.teams || []).map((team) => {
    const snapshotTeam = snapshotTeams.get(String(team.id))
    return snapshotTeam?.roster ? { ...team, roster: snapshotTeam.roster } : team
  })
  return data
}

async function ensureRosterData(body, data) {
  if ((data.teams || []).some((team) => rosterEntries(team).length)) return data
  const requestedPeriod = data.status?.finalScoringPeriod || data.scoringPeriodId || data.status?.latestScoringPeriod
  if (!Number.isInteger(Number(requestedPeriod)) || Number(requestedPeriod) <= 0) return data

  try {
    const snapshot = await espnGet(body, {
      views: ['mTeam', 'mRoster'],
      scoringPeriodId: Number(requestedPeriod),
    })
    return mergeRosterSnapshot(data, snapshot.data)
  } catch {
    return data
  }
}

async function handleEspn(req, res, { views, label, ensureRosters = false }) {
  setCorsHeaders(req, res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST')
    return sendJson(res, 405, { error: `Usa POST para consultar ${label}.` })
  }
  try {
    const body = await readJson(req)
    const validationError = validateRequest(body)
    if (validationError) return sendJson(res, 400, { error: validationError })

    const result = await espnGet(body, { views })
    const data = ensureRosters ? await ensureRosterData(body, result.data) : result.data
    if (!Array.isArray(data.teams)) throw new EspnRequestError(`ESPN no devolvió ${label}.`, 502)
    return sendJson(res, 200, { data, meta: { endpointUsed: result.endpointUsed } })
  } catch (error) {
    if (error?.message === 'PAYLOAD_TOO_LARGE') return sendJson(res, 413, { error: 'Solicitud demasiado grande.' })
    if (error?.message === 'INVALID_JSON') return sendJson(res, 400, { error: 'La solicitud no contiene JSON válido.' })
    return sendJson(res, error?.status || 500, { error: error?.message || 'No se pudo contactar ESPN.' })
  }
}

export function handleEspnLeague(req, res) {
  return handleEspn(req, res, {
    views: ['mSettings', 'mTeam', 'mRoster', 'mMatchupScore', 'mSchedule', 'mStandings', 'mDraftDetail', 'mStatus'],
    label: 'una liga válida',
    ensureRosters: true,
  })
}

export function handleEspnDraft(req, res) {
  return handleEspn(req, res, {
    views: ['mDraftDetail', 'mTeam', 'mSettings', 'mStatus', 'mRoster'],
    label: 'el estado del draft',
  })
}

export async function handleEspnMockDraft(req, res) {
  setCorsHeaders(req, res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST')
    return sendJson(res, 405, { error: 'Usa POST para conectar una sala mock.' })
  }

  try {
    const body = await readJson(req)
    const validationError = validateRequest(body)
    if (validationError) return sendJson(res, 400, { error: validationError })
    if (!body.swid || !body.espnS2) return sendJson(res, 400, { error: 'El seguimiento live del mock requiere SWID y espn_s2.' })
    if (!/^\d+$/.test(String(body.teamId || ''))) return sendJson(res, 400, { error: 'El Team ID del mock no es válido.' })
    if (!body.memberId || /[\r\n]/.test(String(body.memberId)) || String(body.memberId).length > 160) {
      return sendJson(res, 400, { error: 'No se pudo identificar el Member ID de ESPN.' })
    }

    const [result, socketUrl] = await Promise.all([
      espnGet(body, { views: ['draftInit', 'mSettings', 'mTeam', 'mStatus'] }),
      espnDraftSecurity(body),
    ])
    const data = result.data
    if (!Array.isArray(data.teams)) throw new EspnRequestError('ESPN no devolvió una sala mock válida.', 502)
    const subtype = String(data.settings?.draftSettings?.leagueSubType || '').toUpperCase()
    if (!subtype.includes('MOCK')) throw new EspnRequestError('Ese ID no corresponde a una sala mock de ESPN.', 400)
    return sendJson(res, 200, {
      data,
      meta: { endpointUsed: result.endpointUsed, transport: 'websocket', socketUrl },
    })
  } catch (error) {
    if (error?.message === 'PAYLOAD_TOO_LARGE') return sendJson(res, 413, { error: 'Solicitud demasiado grande.' })
    if (error?.message === 'INVALID_JSON') return sendJson(res, 400, { error: 'La solicitud no contiene JSON válido.' })
    return sendJson(res, error?.status || 500, { error: error?.message || 'No se pudo conectar el mock de ESPN.' })
  }
}
