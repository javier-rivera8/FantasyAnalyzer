// ESPN's draft INIT is a base64, big-endian storable stream, not JSON.
// Versions and field order follow ESPN's basketball draft client.
const schemas = {
  init: [1, 'leagueId:i teamId:i league:league'],
  league: [1, 'leagueId:i draftType:i universeId:i draftDate:date draftState:i block:block rules:rules positions:position[] slots:slot[] picks:pick[]'],
  block: [1, 'leagueId:i state:i expiration:date nominationTeamIndex:i playerId:i teamId:i slotId:i amount:i'],
  rules: [2, 'leagueId:i initialPickTime:i minimumPickTime:i nominationTime:i selectionTime:i breaks:breaks protection:protection pauseTime:i nominationDelay:i minimumBid:i maximumBid:i minimumHighBidMultiplier:d maximumHighBidMultiplier:d minimumCurrentBidMultiplier:d maximumCurrentBidMultiplier:d defaultBalance:i rosterRequired:b benchSlot:i injurySlot:i invalidSlot:i censor:b chat:b scoring:scoring firstTier:b'],
  breaks: [1, 'leagueId:i interval:i intervalType:i'],
  protection: [1, 'leagueId:i cutoff:i cutoffType:i'],
  scoring: [1, 'leagueId:i scoringType:i categories:category[]'],
  category: [3, 'leagueId:i statId:i value:d isTeam:b'],
  position: [1, 'leagueId:i positionId:i maximum:i'],
  slot: [1, 'leagueId:i slotId:i categoryId:i positions:slotPosition[]'],
  slotPosition: [1, 'leagueId:i categoryId:i positionId:i'],
  pick: [3, 'leagueId:i teamId:i pickNumber:i playerId:i slotId:i bidAmount:i nominatingTeamId:i isKeeper:b autodraftTypeId:i selectorId:i'],
}

export function decodeDraftInit(base64) {
  const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0))
  const view = new DataView(bytes.buffer)
  let offset = 0
  const read = (size, method) => {
    if (offset + size > view.byteLength) throw new Error('Estado inicial de ESPN incompleto.')
    const value = view[method](offset)
    offset += size
    return value
  }
  const decode = type => {
    if (type === 'i') return read(4, 'getInt32')
    if (type === 'b') return read(1, 'getUint8') === 1
    if (type === 'd') return read(8, 'getFloat64')
    if (type === 'date') return decode('i') ? Number(read(8, 'getBigInt64')) : null
    if (type.endsWith('[]')) {
      const count = decode('i')
      if (count < 0 || count > 10000) throw new Error('Lista de ESPN inválida.')
      return Array.from({ length: count }, () => decode(type.slice(0, -2)))
    }
    const present = decode('i')
    if (present === 0) return null
    const [version, fields] = schemas[type]
    if (present !== 1 || decode('i') !== version) throw new Error('ESPN cambió el formato del draft en vivo.')
    return Object.fromEntries(fields.split(' ').map(field => {
      const [name, fieldType] = field.split(':')
      return [name, decode(fieldType)]
    }))
  }
  // Only read through the pick list; owner profiles and personal queues follow it.
  const result = decode('init')
  if (!result?.league || !Array.isArray(result.league.picks)) throw new Error('ESPN no envió el historial del draft.')
  return result
}

function withState(detail, state) {
  return { ...detail, drafted: state === 2, inProgress: state === 1, paused: state === 3, liveState: state }
}

export function applyMockMessage(data, message) {
  const [type, ...fields] = message.trim().split(/\s+/)
  const detail = data.draftDetail || {}
  if (type === 'ERROR') throw new Error('ESPN rechazó el canal live. La sala puede haber caducado; vuelve a conectarla.')
  if (type === 'INIT') {
    const init = decodeDraftInit(fields[0])
    if (String(init.leagueId) !== String(data.id)) throw new Error('El estado recibido pertenece a otra sala de ESPN.')
    const picks = init.league.picks.filter(Boolean).map(pick => ({
      ...pick, id: pick.pickNumber, overallPickNumber: pick.pickNumber,
    })).sort((a, b) => a.overallPickNumber - b.overallPickNumber)
    return { ...data, draftDetail: withState({ picks, currentTeamId: '', liveReady: true }, init.league.draftState) }
  }
  if (!detail.liveReady) return data
  if (type === 'STATE') return { ...data, draftDetail: withState(detail, Number(fields[0])) }
  if (type === 'SELECTING' || type === 'NOMINATION' || (type === 'CLOCK' && [1, 6].includes(Number(fields[0])))) {
    const teamId = Number(fields[type === 'CLOCK' ? 2 : 0])
    if (!(teamId > 0)) return data
    return { ...data, draftDetail: { ...detail, currentTeamId: teamId } }
  }
  if (type === 'SELECTED' || type === 'SOLD') {
    const [teamId, playerId, slotId, bidAmount] = fields.map(Number)
    if (!(teamId > 0) || !(playerId > 0)) throw new Error('ESPN envió una selección inválida.')
    if (detail.picks.some(pick => pick.playerId === playerId)) return data
    const index = detail.picks.findIndex(pick => !(pick.playerId > 0))
    if (index < 0) throw new Error('El historial del draft necesita resincronizarse.')
    const picks = detail.picks.map((pick, i) => i === index ? { ...pick, teamId, playerId, slotId, bidAmount: bidAmount || 0 } : pick)
    return { ...data, draftDetail: { ...detail, picks, currentTeamId: '', drafted: picks.every(pick => pick.playerId > 0) } }
  }
  if (type === 'UNDONE' || type === 'RESET') {
    const cutoff = type === 'RESET' ? 0 : Number(fields[0])
    if (!Number.isInteger(cutoff) || cutoff < 0) throw new Error('ESPN envió una corrección inválida.')
    const picks = detail.picks.map(pick => pick.overallPickNumber > cutoff && !pick.isKeeper
      ? { ...pick, playerId: 0, bidAmount: 0, teamId: pick.nominatingTeamId || pick.teamId } : pick)
    return { ...data, draftDetail: { ...detail, picks, drafted: false, currentTeamId: '' } }
  }
  return data
}
