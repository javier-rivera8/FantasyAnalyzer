import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, RefreshCcw, Search, Trophy, X } from 'lucide-react'
import { addDraftPick, assignDraftPosition, createDraft, DRAFT_CATEGORIES, draftSlot, projectDraftPlayers, removeDraftPick, validDraft } from './draftModel.mjs'
import { simulateDraftStandings } from './draftSimulation.mjs'
import { ESPN_BRIDGE_SOURCE, syncEspnSnapshot, validateEspnSnapshot } from './espnExtensionSync.mjs'
import './draftRoom.css'

const STORAGE_KEY = 'baseline-manual-draft-v1'
const STRATEGIES = [
  { id: 'balanced', name: 'Balance total' },
  { id: 'punt-ft', name: 'Punt FT%' },
  { id: 'small-ball', name: 'Small ball' },
  { id: 'punt-ast', name: 'Punt AST' },
]

function readDraft() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return validDraft(stored) ? stored : createDraft()
  } catch { return createDraft() }
}

function score(player, strategy) {
  const base = Number(player.value || 0)
  if (strategy === 'punt-ft') return base + player.reb * 1.2 + player.blk * 4 + player.fgPct * .12 - player.ftPct * .05
  if (strategy === 'small-ball') return base + player.ast * 1.4 + player.stl * 3 + player.threeMade * 3 + player.ftPct * .08
  if (strategy === 'punt-ast') return base + player.reb * .8 + player.blk * 3 + player.fgPct * .1 - player.ast * .25
  return base
}

const stat = (value, percent = false) => `${Number(value || 0).toFixed(1)}${percent ? '%' : ''}`

export default function DraftRoom({ players, season, openPlayer, PlayerPhoto, rosterStrengths }) {
  const [draft, setDraft] = useState(readDraft)
  const [source, setSource] = useState('past')
  const [strategy, setStrategy] = useState('balanced')
  const [rank, setRank] = useState('fit')
  const [position, setPosition] = useState('TODOS')
  const [query, setQuery] = useState('')
  const [visible, setVisible] = useState(40)
  const [selectedTeam, setSelectedTeam] = useState('')
  const [showOrder, setShowOrder] = useState(true)
  const [espnEnabled, setEspnEnabled] = useState(() => Boolean(draft.espnSync))
  const [espnSnapshot, setEspnSnapshot] = useState(null)
  const [extensionInstalled, setExtensionInstalled] = useState(false)
  const [bridgeOnline, setBridgeOnline] = useState(false)
  const [syncError, setSyncError] = useState('')
  const lastBridgeAt = useRef(0)
  const draftRef = useRef(draft)
  draftRef.current = draft

  useEffect(() => {
    const receive = event => {
      if (event.source !== window || event.origin !== location.origin || event.data?.source !== ESPN_BRIDGE_SOURCE || event.data.type !== 'SNAPSHOT') return
      try {
        const snapshot = event.data.snapshot
        if (snapshot) validateEspnSnapshot(snapshot)
        lastBridgeAt.current = Date.now()
        setExtensionInstalled(true)
        setBridgeOnline(true)
        setEspnSnapshot(current => JSON.stringify(current) === JSON.stringify(snapshot) ? current : snapshot)
      } catch (error) { setSyncError(error.message) }
    }
    window.addEventListener('message', receive)
    window.postMessage({ source: 'baseline-app-v1', type: 'READY' }, location.origin)
    const heartbeat = setInterval(() => setBridgeOnline(Date.now() - lastBridgeAt.current < 10000), 3000)
    return () => { window.removeEventListener('message', receive); clearInterval(heartbeat) }
  }, [])

  useEffect(() => {
    if (!espnEnabled || !espnSnapshot || draftRef.current.espnSync?.draftId !== espnSnapshot.draftId) return
    try {
      const next = syncEspnSnapshot(draftRef.current, espnSnapshot, players)
      if (JSON.stringify(next) !== JSON.stringify(draftRef.current)) setDraft(next)
      setSyncError('')
    } catch (error) { setSyncError(error.message) }
  }, [espnSnapshot, espnEnabled, players])

  const connectEspn = () => {
    if (!espnSnapshot) return
    if (draft.picks.length && draft.espnSync?.draftId !== espnSnapshot.draftId && !window.confirm('¿Reemplazar el draft guardado en Baseline por esta sala de ESPN?')) return
    try {
      setDraft(syncEspnSnapshot(draft, espnSnapshot, players))
      setSelectedTeam('')
      setEspnEnabled(true)
      setSyncError('')
    } catch (error) { setSyncError(error.message) }
  }
  const disconnectEspn = () => {
    setEspnEnabled(false)
    setDraft(current => ({ ...current, espnSync: undefined }))
    setSyncError('')
  }
  const otherEspnRoom = espnEnabled && espnSnapshot && draft.espnSync?.draftId !== espnSnapshot.draftId
  const syncStatus = !extensionInstalled ? 'Instala la extensión y recarga ESPN y Baseline.'
    : !bridgeOnline ? 'La extensión dejó de responder. Recarga Baseline para reconectar.'
    : !espnSnapshot ? 'Captura detenida. Activa una sala desde la extensión en ESPN.'
    : otherEspnRoom ? 'Hay otra sala disponible. Conéctala para reemplazar este draft.'
    : espnEnabled ? `${draft.picks.length} picks sincronizados · ${draft.espnSync?.title || 'ESPN'}`
    : `${espnSnapshot.picks.length} picks disponibles en ESPN. Pulsa Conectar ESPN.`

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(draft)) }, [draft])
  const projections = useMemo(() => projectDraftPlayers(players), [players])
  const standings = useMemo(() => simulateDraftStandings(draft, projections), [draft, projections])
  const seasonStart = Number(String(season).match(/\d{4}/)?.[0] || 2025)
  const forecastSeason = `${seasonStart + 1}–${String(seasonStart + 2).slice(-2)}`
  const displayPlayers = source === 'forecast' ? projections : players
  const playerById = useMemo(() => new Map(displayPlayers.map(player => [String(player.id), player])), [displayPlayers])
  const pickedIds = useMemo(() => new Set(draft.picks.map(pick => pick.playerId)), [draft.picks])
  const slot = draftSlot(draft)
  const currentTeamId = selectedTeam || slot.teamId
  const ownPicks = draft.picks.filter(pick => pick.teamId === draft.myTeamId).map(pick => playerById.get(pick.playerId)).filter(Boolean)
  const strengths = rosterStrengths(ownPicks, displayPlayers)
  const teamName = id => draft.teams.find(team => team.id === id)?.name || 'Equipo'
  const lowerQuery = query.trim().toLocaleLowerCase()
  const available = useMemo(() => displayPlayers.filter(player =>
    !pickedIds.has(String(player.id)) &&
    (position === 'TODOS' || player.position === position) &&
    (!lowerQuery || `${player.name} ${player.team} ${player.position}`.toLocaleLowerCase().includes(lowerQuery))
  ).sort((a, b) => (rank === 'fit' ? score(b, strategy) - score(a, strategy) : b.value - a.value) || a.name.localeCompare(b.name)), [displayPlayers, pickedIds, position, lowerQuery, rank, strategy])
  const choose = player => {
    if (slot.completed || espnEnabled) return
    setDraft(current => addDraftPick(current, player.id))
    setSelectedTeam('')
  }
  const reset = () => {
    if (espnEnabled) return
    if (!window.confirm('¿Reiniciar el draft manual y borrar todas las selecciones guardadas?')) return
    setDraft(current => ({ ...current, picks: [] }))
  }
  const changeCount = count => {
    if (draft.picks.length || espnEnabled) return
    setDraft(createDraft(count))
  }
  const nextForSelected = selectedTeam && selectedTeam !== slot.teamId
    ? `Seleccionado: ${teamName(selectedTeam)}. El próximo pick sigue siendo de ${teamName(slot.teamId)}.` : ''

  return <div className="page manual-draft">
    <header className="manual-draft-hero">
      <div><span className="eyebrow">DRAFT ROOM · {espnEnabled ? 'ESPN SYNC' : 'MANUAL'}</span><h1>Tu draft, pick a pick.</h1><p>{espnEnabled ? 'Las selecciones de ESPN actualizan tu board, rosters y recomendaciones automáticamente.' : 'Registra cada selección manualmente o conecta la extensión para seguir tu draft de ESPN.'} Los picks y el orden se guardan en este navegador.</p></div>
      <div className="manual-clock"><span>EN EL RELOJ</span><strong>{slot.completed ? 'Finalizado' : `#${slot.overall} · ${teamName(slot.teamId)}`}</strong><small>{draft.picks.length} de {draft.order.length * draft.rounds} picks · Ronda {Math.min(slot.round, draft.rounds)} de {draft.rounds}</small></div>
    </header>

    <section className="manual-espn-sync surface">
      <div className="manual-section-head"><div><span>ESPN · SINCRONIZACIÓN</span><h2>Conecta tu draft</h2><p role="status"><i className={`manual-sync-dot ${espnEnabled && bridgeOnline && espnSnapshot && !otherEspnRoom ? 'active' : ''}`}/>{syncStatus}</p></div><div className="manual-sync-actions">
        {(!espnEnabled || otherEspnRoom) && <button className="manual-pick-button" onClick={connectEspn} disabled={!espnSnapshot || !bridgeOnline}>{otherEspnRoom ? 'Conectar nueva sala' : 'Conectar ESPN'}</button>}
        {espnEnabled && <button className="manual-text-button" onClick={disconnectEspn}>Volver a manual</button>}
        <a className="manual-text-button" href="/espn-baseline-extension.zip" download>Descargar extensión</a>
      </div></div>
      {syncError && <p className="manual-sync-warning" role="alert">{syncError}</p>}
      {espnEnabled && espnSnapshot?.connectionFailed && <p className="manual-sync-warning">ESPN perdió la conexión con su servidor. Los picks capturados se conservan; las nuevas selecciones llegarán cuando ESPN reconecte.</p>}
      {espnEnabled && draft.espnSync?.pending > 0 && <p className="manual-sync-warning">Faltan picks anteriores: {draft.espnSync.pending} selecciones esperan completar el historial. Abre «Pick History» en ESPN con todas las rondas.</p>}
      {espnEnabled && draft.espnSync?.unmatched > 0 && <p className="manual-sync-warning">{draft.espnSync.unmatched} jugadores seleccionados no tienen estadísticas en el dataset. Sus picks están guardados; la predicción y el perfil solo incluyen jugadores con datos.</p>}
      <details className="manual-sync-instructions"><summary>Cómo instalar y conectar</summary><ol><li>Descarga el ZIP y extráelo en una carpeta.</li><li>En Chrome abre chrome://extensions, activa «Modo de desarrollador» y pulsa «Cargar descomprimida». Selecciona la carpeta extraída que contiene manifest.json.</li><li>Recarga ESPN y Baseline. En la pestaña del draft de ESPN, abre la extensión y pulsa «Usar esta sala de ESPN».</li><li>Vuelve a este Draft Room y pulsa «Conectar ESPN». Mantén ambas pestañas abiertas en el mismo navegador.</li></ol></details>
    </section>

    <section className="manual-setup surface">
      <div className="manual-section-head"><div><span>01 · CONFIGURACIÓN</span><h2>Orden del draft</h2><p>{espnEnabled ? 'Equipos y orden importados de ESPN. Selecciona tu equipo para personalizar el análisis.' : 'Asigna una posición a cada equipo. La segunda ronda invierte el orden.'}</p></div><button className="manual-text-button" onClick={() => setShowOrder(value => !value)} aria-expanded={showOrder}>{showOrder ? 'Ocultar' : 'Mostrar'} <ChevronDown size={14}/></button></div>
      <div className="manual-setup-controls">
        <label>Equipos<select value={draft.teams.length} onChange={event => changeCount(Number(event.target.value))} disabled={draft.picks.length > 0 || espnEnabled}>{Array.from({ length: 19 }, (_, i) => i + 2).map(count => <option value={count} key={count}>{count}</option>)}</select></label>
        <label>Mi equipo<select value={draft.myTeamId} onChange={event => setDraft(current => ({ ...current, myTeamId: event.target.value }))}>{draft.teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
        <button className="manual-reset" onClick={reset} disabled={!draft.picks.length || espnEnabled}><RefreshCcw size={15}/> Reiniciar picks</button>
      </div>
      {showOrder && <div className="manual-team-grid">{draft.teams.map(team => <div className="manual-team" key={team.id}>
        <label>POSICIÓN<select aria-label={`Posición de ${team.name}`} value={draft.order.indexOf(team.id) + 1} onChange={event => setDraft(current => assignDraftPosition(current, team.id, Number(event.target.value)))} disabled={draft.picks.length > 0 || espnEnabled}>{draft.order.map((_, index) => <option value={index + 1} key={index}>{index + 1}</option>)}</select></label>
        <input aria-label={`Nombre de ${team.name}`} value={team.name} maxLength={160} disabled={espnEnabled} onChange={event => setDraft(current => ({ ...current, teams: current.teams.map(item => item.id === team.id ? { ...item, name: event.target.value } : item) }))}/>
        {team.id === draft.myTeamId && <span className="manual-my-team">MÍO</span>}
      </div>)}</div>}
      {draft.picks.length > 0 && <p className="manual-help">{espnEnabled ? 'Los equipos y sus nombres se sincronizan desde ESPN. Vuelve a manual para editarlos.' : 'El número de equipos y las posiciones quedan fijos después del primer pick para conservar el historial. Los nombres siguen siendo editables.'}</p>}
    </section>

    <section className="manual-pick-summary surface">
      <div><span>02 · SIGUIENTE SELECCIÓN</span><h2>{slot.completed ? 'Draft completo' : `${teamName(slot.teamId)} elige en el pick #${slot.overall}`}</h2><p>{slot.completed ? (espnEnabled ? 'Todas las selecciones están sincronizadas. Las correcciones se hacen en ESPN.' : 'Puedes deshacer el último pick para continuar.') : `Ronda ${slot.round} · pick ${slot.roundPick} de la ronda · ${espnEnabled ? 'selección sincronizada desde ESPN.' : 'selección manual para cualquier equipo.'}`}</p></div>
      {!espnEnabled && draft.picks.length > 0 && <button onClick={() => setDraft(current => removeDraftPick(current, current.picks.at(-1).overall))}><RefreshCcw size={15}/> Deshacer último pick</button>}
    </section>

    <section className="manual-standings surface">
      <div className="manual-section-head"><div><span>SIMULACIÓN · 200 ESCENARIOS</span><h2>Predicción de posiciones</h2><p>Se actualiza con cada selección registrada. Los cupos restantes se completan con jugadores disponibles del board.</p></div><span className="manual-standings-badge">{draft.picks.length} picks reales · {draft.order.length * draft.rounds - draft.picks.length} simulados</span></div>
      <div className="manual-standings-wrap"><table><thead><tr><th>POS.</th><th>EQUIPO</th><th>PICKS</th><th>POS. PROMEDIO</th><th>1ER LUGAR</th><th>TOP {Math.min(4, draft.teams.length)}</th><th>VICTORIAS*</th></tr></thead><tbody>{standings.map((team, index) => <tr key={team.id} className={team.id === draft.myTeamId ? 'mine' : ''}><td><b>{index + 1}</b></td><td><strong>{team.name}</strong>{team.id === draft.myTeamId && <small>MI EQUIPO</small>}</td><td>{team.picks} / {draft.rounds}</td><td>{stat(team.averageRank)}</td><td>{stat(team.firstOdds)}%</td><td>{stat(team.topFourOdds)}%</td><td>{stat(team.averageWins)}</td></tr>)}</tbody></table></div>
      <p className="manual-standings-note">* Victorias en enfrentamientos hipotéticos entre todos los equipos, comparando H2H 8-CAT. Es una estimación de Baseline, no el calendario ni la clasificación de ESPN.</p>
    </section>

    <section className="manual-strategy"><div className="manual-section-head"><div><span>03 · ESTRATEGIA</span><h2>Prioriza tu construcción</h2></div></div><div className="manual-strategy-options">{STRATEGIES.map(item => <button key={item.id} className={strategy === item.id ? 'active' : ''} onClick={() => setStrategy(item.id)}>{item.name}</button>)}</div></section>

    <div className="manual-main">
      <section className="surface manual-board">
        <div className="manual-section-head"><div><span>04 · JUGADORES DISPONIBLES</span><h2>Board dinámico</h2><p>{available.length} jugadores disponibles · estadísticas por partido</p></div></div>
        <div className="manual-board-controls">
          <div className="manual-source" role="group" aria-label="Fuente de estadísticas"><button className={source === 'past' ? 'active' : ''} onClick={() => setSource('past')}>{season || '2025–26'} real</button><button className={source === 'forecast' ? 'active' : ''} onClick={() => setSource('forecast')}>Proyección {forecastSeason}</button></div>
          <label className="manual-search"><Search size={16}/><input aria-label="Buscar jugador" placeholder="Buscar jugador o equipo" value={query} onChange={event => { setQuery(event.target.value); setVisible(40) }}/></label>
          <select aria-label="Filtrar posición" value={position} onChange={event => { setPosition(event.target.value); setVisible(40) }}><option value="TODOS">Todas las posiciones</option>{[...new Set(players.map(player => player.position))].sort().map(item => <option key={item}>{item}</option>)}</select>
          <select aria-label="Ordenar jugadores" value={rank} onChange={event => setRank(event.target.value)}><option value="fit">Mejor encaje</option><option value="value">Mayor valor</option></select>
        </div>
        <p className="manual-source-note">{source === 'past' ? `Cifras reales de ${season || '2025–26'} según el dataset local de ESPN.` : 'Estimación Baseline: regresión hacia el promedio por posición, ajustada por partidos jugados y edad. No es una proyección oficial de ESPN.'}</p>
        <div className="manual-table-wrap"><table className="manual-table"><thead><tr><th>#</th><th>JUGADOR</th><th>GP</th>{DRAFT_CATEGORIES.map(([, label]) => <th key={label}>{label}</th>)}<th>VALUE</th><th>ACCIÓN</th></tr></thead><tbody>{available.slice(0, visible).map((player, index) => <tr key={player.id}><td>{index + 1}</td><td><button className="manual-player-button" onClick={() => openPlayer(players.find(item => String(item.id) === String(player.id)))}><PlayerPhoto player={player}/><span><strong>{player.name}</strong><small>{player.team} · {player.position}</small></span></button></td><td>{player.gp}</td>{DRAFT_CATEGORIES.map(([key]) => <td key={key}>{stat(player[key], key.endsWith('Pct'))}</td>)}<td><b>{player.value}</b></td><td><button className="manual-pick-button" onClick={() => choose(player)} disabled={slot.completed || espnEnabled}><Check size={14}/> Elegir</button></td></tr>)}</tbody></table></div>
        {!available.length && <p className="manual-empty">No hay jugadores disponibles con esos filtros.</p>}
        {visible < available.length && <button className="manual-more" onClick={() => setVisible(count => count + 40)}>Mostrar más jugadores</button>}
      </section>

      <aside className="manual-side">
        <div className="surface manual-team-picks"><div className="manual-section-head"><div><span>ROSTERS</span><h2>Selecciones por equipo</h2></div></div><select aria-label="Ver equipo" value={currentTeamId} onChange={event => setSelectedTeam(event.target.value)}>{draft.teams.map(team => <option value={team.id} key={team.id}>{team.name}</option>)}</select>{nextForSelected && <p className="manual-help">{nextForSelected}</p>}{draft.picks.filter(pick => pick.teamId === currentTeamId).map(pick => <div className="manual-roster-row" key={pick.overall}><span>#{pick.overall}</span><strong>{playerById.get(pick.playerId)?.name || pick.playerName || 'Jugador'}</strong></div>)}{!draft.picks.some(pick => pick.teamId === currentTeamId) && <p className="manual-empty">Este equipo aún no tiene picks.</p>}</div>
        <div className="surface manual-profile"><span>MI EQUIPO · {teamName(draft.myTeamId)}</span><h2>Perfil 8-CAT</h2>{ownPicks.length ? strengths.map(item => <div className="manual-profile-row" key={item.key}><span>{item.label}</span><i><em style={{ width: `${item.value}%` }}/></i><b>{item.value}</b></div>) : <p className="manual-empty">Tu perfil aparecerá al registrar un pick para tu equipo.</p>}</div>
        <div className="surface manual-history"><span>HISTORIAL</span><h2>Últimos picks</h2>{draft.picks.slice(-12).reverse().map(pick => <div className="manual-history-row" key={pick.overall}><span>#{pick.overall}</span><div><strong>{playerById.get(pick.playerId)?.name || pick.playerName || 'Jugador'}</strong><small>{teamName(pick.teamId)} · ronda {pick.round}</small></div>{!espnEnabled && pick.overall === draft.picks.length && <button aria-label="Deshacer último pick" onClick={() => setDraft(current => removeDraftPick(current, pick.overall))}><X size={14}/></button>}</div>)}{!draft.picks.length && <p className="manual-empty"><Trophy size={22}/> Los picks aparecerán aquí.</p>}</div>
      </aside>
    </div>
  </div>
}
