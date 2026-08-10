import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, ArrowLeftRight, ArrowRight, ArrowUpRight, Bell, Check, ChevronDown,
  ChevronLeft, ChevronRight, Crown, Gauge, Info, LayoutDashboard, MoreHorizontal,
  Plus, RefreshCcw, Search, SlidersHorizontal, Sparkles, Star, Target, Trophy,
  Upload, UserRound, Users, X, Zap,
} from 'lucide-react'

const NAV = [
  { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
  { id: 'team', label: 'Mi equipo', icon: Users },
  { id: 'players', label: 'Jugadores', icon: Search },
  { id: 'trade', label: 'Trade Lab', icon: ArrowLeftRight, badge: '8 CAT' },
  { id: 'draft', label: 'Draft Room', icon: Trophy },
]

const CATEGORY_META = [
  ['pts', 'PTS'], ['ftPct', 'FT%'], ['threeMade', '3PTM'], ['fgPct', 'FG%'],
  ['ast', 'AST'], ['reb', 'REB'], ['stl', 'STL'], ['blk', 'BLK'],
]

const STRATEGIES = [
  { id: 'balanced', name: 'Balance total', kicker: 'Recomendado', copy: 'Valor sólido en las ocho categorías.', icon: Target },
  { id: 'punt-ft', name: 'Punt FT%', kicker: 'Big men', copy: 'Prioriza REB, BLK, FG% y volumen interior.', icon: Gauge },
  { id: 'small-ball', name: 'Small ball', kicker: 'Guard-heavy', copy: 'Maximiza 3PTM, AST, STL y FT%.', icon: Zap },
  { id: 'punt-ast', name: 'Punt AST', kicker: 'Eficiencia', copy: 'Prioriza porcentajes, REB y BLK.', icon: Activity },
]

const TEAM_COLORS = {
  ATL:'#e03a3e', BOS:'#007a33', BKN:'#111', CHA:'#1d1160', CHI:'#ce1141', CLE:'#6f263d', DAL:'#00538c', DEN:'#0e2240', DET:'#c8102e',
  GS:'#1d428a', HOU:'#ce1141', IND:'#002d62', LAC:'#c8102e', LAL:'#552583', MEM:'#5d76a9', MIA:'#98002e', MIL:'#00471b', MIN:'#0c2340',
  NO:'#0c2340', NY:'#f58426', OKC:'#007ac1', ORL:'#0077c0', PHI:'#006bb6', PHX:'#1d1160', POR:'#e03a3e', SAC:'#5a2d81', SA:'#8a8d8f',
  TOR:'#ce1141', UTAH:'#002b5c', WSH:'#002b5c', FA:'#777',
}

const fmt = (value, digits = 1) => Number(value || 0).toFixed(digits)
const initials = (name = '') => name.split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase()
const unique = (values) => [...new Set(values.filter(Boolean).map(String))]
const teamName = (team) => team?.name || [team?.location, team?.nickname].filter(Boolean).join(' ') || team?.abbrev || `Equipo ${team?.id || ''}`

function useStoredState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try { const stored = localStorage.getItem(key); return stored ? JSON.parse(stored) : initialValue } catch { return initialValue }
  })
  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)) }, [key, value])
  return [value, setValue]
}

function usePlayerData() {
  const [data, setData] = useState({ players: [], season: '', count: 0, source: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  useEffect(() => {
    fetch('/data/players.json')
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((payload) => { setData(payload); setError(false) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])
  return { ...data, loading, error }
}

function projectRoster(roster) {
  if (!roster.length) return null
  const result = {}
  CATEGORY_META.forEach(([key]) => {
    if (key === 'fgPct' || key === 'ftPct') {
      const weighted = roster.reduce((sum, player) => sum + Number(player[key] || 0) * Math.max(1, Number(player.min || 1)), 0)
      const weight = roster.reduce((sum, player) => sum + Math.max(1, Number(player.min || 1)), 0)
      result[key] = weighted / weight
    } else result[key] = roster.reduce((sum, player) => sum + Number(player[key] || 0), 0)
  })
  return result
}

function compareRosters(roster, opponent) {
  const mine = projectRoster(roster)
  const theirs = projectRoster(opponent)
  if (!mine || !theirs) return null
  const categories = CATEGORY_META.map(([key, label]) => ({ key, label, mine: mine[key], theirs: theirs[key], win: mine[key] > theirs[key] }))
  return { categories, wins: categories.filter((cat) => cat.win).length, losses: categories.filter((cat) => !cat.win).length }
}

function rosterStrengths(roster, players) {
  if (!roster.length || !players.length) return []
  const rosterProjection = projectRoster(roster)
  const pool = players.filter((player) => player.gp >= 10)
  return CATEGORY_META.map(([key, label]) => {
    const teamAverage = key === 'fgPct' || key === 'ftPct' ? rosterProjection[key] : rosterProjection[key] / roster.length
    const percentile = Math.round((pool.filter((player) => Number(player[key] || 0) <= teamAverage).length / Math.max(1, pool.length)) * 100)
    return { key, label, value: Math.min(99, Math.max(1, percentile)), type: percentile >= 67 ? 'strong' : percentile <= 33 ? 'weak' : '' }
  })
}

function timeAgo(iso) {
  if (!iso) return 'Nunca'
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (minutes < 1) return 'Ahora mismo'
  if (minutes < 60) return `Hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  return hours < 24 ? `Hace ${hours} h` : `Hace ${Math.round(hours / 24)} d`
}

function normalizeDraftState(data, league, players) {
  const detail=data.draftDetail||{}
  const rawPicks=Array.isArray(detail.picks)?detail.picks:Array.isArray(detail.pickHistory)?detail.pickHistory:[]
  const picks=rawPicks.map((pick,index)=>{
    const playerId=String(pick.playerId||pick.player?.id||pick.athleteId||'')
    const teamId=String(pick.teamId||pick.nominatingTeamId||pick.team?.id||'')
    return {
      id:String(pick.id||`${teamId}-${playerId}-${index}`), playerId, teamId,
      overall:Number(pick.overallPickNumber||pick.overall||index+1),
      round:Number(pick.roundId||pick.round||Math.floor(index/Math.max(1,data.teams?.length||league?.leagueSize||1))+1),
      roundPick:Number(pick.roundPickNumber||pick.roundPick||index%Math.max(1,data.teams?.length||league?.leagueSize||1)+1),
      bidAmount:pick.bidAmount??null,
      player:players.find(player=>String(player.id)===playerId)||null,
    }
  }).sort((a,b)=>a.overall-b.overall)
  const teams=(data.teams||league?.teams||[]).map(team=>({id:String(team.id),name:teamName(team),abbrev:team.abbrev||initials(teamName(team))}))
  const draftSettings=data.settings?.draftSettings||{}
  const rawOrder=detail.pickOrder||draftSettings.pickOrder||draftSettings.order||[]
  const order=(Array.isArray(rawOrder)?rawOrder:[]).map(item=>String(typeof item==='object'?(item.teamId||item.id):item)).filter(Boolean)
  const teamCount=Math.max(1,order.length||teams.length||league?.leagueSize||1)
  const nextOverall=picks.length+1
  const currentRound=Number(detail.round||detail.currentRound||Math.floor((nextOverall-1)/teamCount)+1)
  const position=(nextOverall-1)%teamCount
  const snakeIndex=currentRound%2===0?teamCount-1-position:position
  const inferredTeamId=order.length?order[snakeIndex]||null:null
  const currentTeamId=String(detail.currentTeamId||detail.onClockTeamId||detail.currentPick?.teamId||inferredTeamId||'')
  const completed=Boolean(detail.drafted||detail.complete||detail.completed)
  const inProgress=Boolean(detail.inProgress??(!completed&&picks.length>0))
  const currentTeam=teams.find(team=>team.id===currentTeamId)||league?.teams?.find(team=>String(team.id)===currentTeamId)||null
  return {
    picks, teams, order, completed, inProgress,
    ready:Boolean(detail.ready||detail.draftReady||data.status?.isActive),
    currentRound, nextOverall, currentTeamId, currentTeam,
    secondsPerPick:Number(detail.secondsPerPick||draftSettings.timePerSelection||0),
    totalRounds:Number(detail.rounds||draftSettings.rounds||0),
    rawStatus:Object.keys(detail).length?'available':'waiting',
  }
}

function useLiveDraft({ enabled, league, auth, players }) {
  const [draft,setDraft]=useState(null)
  const [error,setError]=useState('')
  const [refreshing,setRefreshing]=useState(false)
  const [lastUpdated,setLastUpdated]=useState(null)
  const inFlight=useRef(false)
  const refresh=useCallback(async()=>{
    if(!league||inFlight.current)return
    if(league.isPrivate&&!auth?.swid){setError('Vuelve a autenticar la liga privada para iniciar el seguimiento live.');return}
    inFlight.current=true;setRefreshing(true)
    try{
      const response=await fetch('/api/espn/draft',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({leagueId:league.leagueId,season:league.season,swid:auth?.swid,espnS2:auth?.espnS2})})
      const payload=await response.json()
      if(!response.ok)throw new Error(payload.error||'No se pudo leer el draft de ESPN.')
      setDraft(normalizeDraftState(payload.data,league,players));setError('');setLastUpdated(new Date().toISOString())
    }catch(fetchError){setError(fetchError.message)}finally{inFlight.current=false;setRefreshing(false)}
  },[league,auth?.swid,auth?.espnS2,players])
  useEffect(()=>{
    if(!enabled||!league)return
    refresh()
    const interval=setInterval(refresh,2500)
    return()=>clearInterval(interval)
  },[enabled,league,refresh])
  return { draft,error,refreshing,lastUpdated,refresh }
}

function PlayerPhoto({ player, size = 'md' }) {
  const [failed, setFailed] = useState(false)
  if (!player) return null
  return <div className={`player-photo ${size}`} style={{ '--team': TEAM_COLORS[player.team] || '#777' }}>
    {!failed && player.headshot ? <img src={player.headshot} alt={player.name} onError={() => setFailed(true)} /> : <span>{initials(player.name)}</span>}
  </div>
}

function Logo({ compact = false }) {
  return <div className="brand" aria-label="Baseline"><div className="brand-mark"><span/><span/></div>{!compact&&<div><strong>BASELINE</strong><small>FANTASY INTELLIGENCE</small></div>}</div>
}

function Sidebar({ page, setPage, collapsed, setCollapsed, user, onProfile }) {
  return <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
    <div className="sidebar-top"><Logo compact={collapsed}/><button className="collapse-button" onClick={()=>setCollapsed(!collapsed)} aria-label="Contraer menú"><ChevronLeft size={17}/></button></div>
    <nav><span className="nav-eyebrow">ANÁLISIS</span>{NAV.map(({id,label,icon:Icon,badge})=><button key={id} className={page===id?'active':''} onClick={()=>setPage(id)} title={label}><Icon size={19}/><span>{label}</span>{badge&&<em>{badge}</em>}</button>)}</nav>
    <button className="user-mini" onClick={onProfile} title="Editar perfil"><div className="avatar">{initials(user.name)}</div>{!collapsed&&<div><strong>{user.name}</strong><span>League Manager</span></div>}{!collapsed&&<MoreHorizontal size={18}/>}</button>
  </aside>
}

function Header({ title, count, onImport, onSearch, onNotifications, notificationCount }) {
  return <header className="topbar">
    <div className="mobile-logo"><Logo compact/></div><div className="topbar-title"><h2>{title}</h2>{count!=null&&<span>{count} jugadores</span>}</div>
    <button className="global-search" onClick={onSearch}><Search size={18}/><span>Buscar jugador, equipo...</span></button>
    <button className="icon-button notification" onClick={onNotifications} aria-label="Notificaciones"><Bell size={19}/>{notificationCount>0&&<i/>}</button>
    <button className="import-button" onClick={onImport}><Upload size={17}/> Importar ESPN</button>
  </header>
}

function SectionHeading({ eyebrow, title, description, action }) {
  return <div className="section-heading"><div><span>{eyebrow}</span><h2>{title}</h2>{description&&<p>{description}</p>}</div>{action}</div>
}

function EmptyState({ icon: Icon = Upload, title, copy, action, actionLabel }) {
  return <div className="empty-state"><div className="empty-state-icon"><Icon size={24}/></div><h3>{title}</h3><p>{copy}</p>{action&&<button className="primary" onClick={action}>{actionLabel}<ArrowRight size={15}/></button>}</div>
}

function Dashboard({ players, roster, opponentRoster, league, watchlist, setPage, openPlayer, toggleWatchlist, onImport, openWatchlist }) {
  const leaders = useMemo(()=>[...players].sort((a,b)=>b.value-a.value).slice(0,8),[players])
  const matchup = useMemo(()=>compareRosters(roster,opponentRoster),[roster,opponentRoster])
  const opportunities = leaders.slice(4,8)
  const teamValue = roster.reduce((sum,player)=>sum+Number(player.value||0),0)
  const record = league?.record
  const rankText = record?.rank ? `#${record.rank}` : String(players.length)
  const signal = matchup ? `${Math.round(matchup.wins/8*100)}%` : '100%'
  return <div className="page dashboard-page">
    <section className="hero">
      <div className="hero-aurora aurora-one"/><div className="hero-aurora aurora-two"/><div className="hero-noise"/>
      <div className="hero-copy"><span className="eyebrow"><i/> H2H 8-CAT · DATOS ESPN</span><h1>Tu ventaja,<br/><em>cuantificada.</em></h1><p>{roster.length?'Tu roster, tus categorías y cada decisión conectados con datos reales.':'Conecta tu equipo o construye un roster para activar análisis personalizados.'}</p>
        <div className="hero-badges"><span><b>{players.length}</b> jugadores reales</span><span><b>{roster.length}</b> en tu roster</span></div>
        <div className="hero-actions">{roster.length?<button className="primary" onClick={()=>setPage('trade')}>Analizar un trade <ArrowRight size={17}/></button>:<button className="primary" onClick={onImport}>Importar mi equipo <Upload size={17}/></button>}<button className="text-button" onClick={()=>setPage('players')}>Explorar jugadores <ChevronRight size={16}/></button></div>
      </div>
      <div className="hero-visual"><div className="hero-monogram">8CAT</div><div className="motion-orbit orbit-one"/><div className="motion-orbit orbit-two"/><div className="rank-ring"><span>{record?.rank?'LEAGUE RANK':'PLAYER POOL'}</span><strong>{rankText}</strong><small>{league?.leagueName||'ESPN data'}</small></div>
        {leaders.slice(0,3).map((player,index)=><div className={`floating-player fp-${index+1}`} key={player.id}><PlayerPhoto player={player} size="lg"/></div>)}
        <div className="hero-signal"><div><Activity size={15}/><span>{matchup?'MATCHUP EDGE':'DATA STATUS'}</span></div><strong>{signal}</strong><i><em style={{width:signal}}/></i></div>
        <div className="hero-category-float"><Sparkles size={14}/><span>{matchup?'VENTAJA':'TOP VALUE'}</span><b>{matchup?`+${Math.max(0,matchup.wins-matchup.losses)} CAT`:leaders[0]?.value||'—'}</b></div><div className="hero-grid"/>
      </div>
    </section>
    <section className="category-marquee"><div className="marquee-label"><span>FORMATO</span><strong>H2H 8-CAT</strong></div><div className="marquee-categories">{CATEGORY_META.map(([,label],index)=><span key={label}><i>{String(index+1).padStart(2,'0')}</i>{label}</span>)}</div><div className="marquee-live"><i/> ESPN DATA</div></section>
    <section className="metric-grid">
      <div className="metric-card dark"><div className="metric-head"><span>MI RÉCORD</span><Crown size={18}/></div><strong>{record?`${record.wins}—${record.losses}`:'—'}</strong><p>{record?`${record.rank?`#${record.rank} · `:''}${league.leagueName}`:'Importa una liga para ver tu récord'}</p><div className="record-dots">{record&&Array.from({length:record.wins+record.losses},(_,i)=><i className={i<record.wins?'win':'loss'} key={i}/>)}</div></div>
      <div className="metric-card"><div className="metric-head"><span>MATCHUP</span><Activity size={18}/></div><strong>{matchup?`${matchup.wins}—${matchup.losses}`:'—'}</strong><p>{league?.opponent?.name?`vs. ${league.opponent.name}`:'Sin rival sincronizado'}</p><div className="mini-progress"><span style={{width:matchup?`${matchup.wins/8*100}%`:'0%'}}/></div><small>{matchup?'Proyección calculada con estadísticas reales':'Importa el matchup desde ESPN'}</small></div>
      <div className="metric-card"><div className="metric-head"><span>VALOR DEL EQUIPO</span><Crown size={18}/></div><strong>{teamValue||'—'}</strong><p>{roster.length?`${roster.length} jugadores · valor 8-CAT`:'Roster vacío'}</p><div className="comparison"><span>Temporada</span><b>{league?.seasonLabel||'—'}</b></div></div>
      <div className="metric-card accent"><div className="metric-head"><span>WATCHLIST</span><Star size={18}/></div><strong>{watchlist.length}</strong><p>Jugadores guardados</p><button onClick={openWatchlist}>Abrir watchlist <ArrowRight size={15}/></button></div>
    </section>
    <section className="dashboard-columns">
      <div className="surface matchup-card"><div className="card-title-row"><div><span>{league?.scoringPeriodId?`PERIODO ${league.scoringPeriodId}`:'MATCHUP ESPN'}</span><h3>Tu matchup</h3></div><span className="static-pill">8 CAT</span></div>
        {!matchup?<EmptyState icon={Activity} title="No hay matchup conectado" copy="Importa tu liga pública de ESPN para comparar ambos rosters." action={onImport} actionLabel="Importar ESPN"/>:<><div className="matchup-teams"><div className="matchup-team"><div className="team-avatar orange">{initials(league.teamName)}</div><div><strong>{league.teamName}</strong><span>{record?`${record.wins}—${record.losses}`:'Sin récord'}</span></div></div><div className="score-prediction"><small>PROYECTADO</small><strong>{matchup.wins} <em>—</em> {matchup.losses}</strong></div><div className="matchup-team opponent"><div><strong>{league.opponent.name}</strong><span>{league.opponent.record?`${league.opponent.record.wins}—${league.opponent.record.losses}`:'Rival ESPN'}</span></div><div className="team-avatar black">{initials(league.opponent.name)}</div></div></div><div className="category-list">{matchup.categories.map(cat=><div className="category-row" key={cat.key}><b className={cat.win?'winner':''}>{fmt(cat.mine)}{cat.key.includes('Pct')?'%':''}</b><div><span>{cat.label}</span><div className="duel-bar"><i style={{width:`${cat.mine/(cat.mine+cat.theirs||1)*100}%`}}/><em/></div></div><b className={!cat.win?'winner':''}>{fmt(cat.theirs)}{cat.key.includes('Pct')?'%':''}</b></div>)}</div><button className="full-text-button" onClick={()=>setPage('team')}>Ver mi equipo <ArrowRight size={15}/></button></>}
      </div>
      <div className="surface roster-snapshot"><div className="card-title-row"><div><span>MI EQUIPO</span><h3>Roster actual</h3></div><button onClick={()=>setPage('team')}>Ver todos</button></div>{!roster.length?<EmptyState icon={Users} title="Roster vacío" copy="Importa ESPN o añade jugadores desde el directorio." action={()=>setPage('players')} actionLabel="Buscar jugadores"/>:<div className="roster-list">{roster.slice(0,6).map((player,index)=><button className="roster-row" key={player.id} onClick={()=>openPlayer(player)}><span className="rank">{String(index+1).padStart(2,'0')}</span><PlayerPhoto player={player}/><div className="player-name"><strong>{player.name}</strong><span>{player.team} · {player.position}</span></div><div className="player-form"><span>8-CAT</span><strong>{player.value}</strong></div><ChevronRight size={16}/></button>)}</div>}</div>
    </section>
    <section className="surface market-section"><SectionHeading eyebrow="NBA PLAYER POOL" title="Valor real, sin estimados de disponibilidad." description="Jugadores destacados según el modelo H2H 8-CAT y estadísticas reales de ESPN." action={<button className="outline-button" onClick={()=>setPage('players')}>Ver todos <ArrowRight size={15}/></button>}/><div className="opportunity-grid">{opportunities.map((player)=><div className="opportunity-card" key={player.id}><button className="opportunity-main" onClick={()=>openPlayer(player)}><div className="opp-top"><span className="availability">VALUE {player.value}</span><span className="trend">{player.gp} GP</span></div><PlayerPhoto player={player} size="xl"/><h3>{player.name}</h3><p>{player.team} · {player.position}</p><div className="stat-triplet"><div><span>PTS</span><b>{fmt(player.pts)}</b></div><div><span>REB</span><b>{fmt(player.reb)}</b></div><div><span>AST</span><b>{fmt(player.ast)}</b></div></div></button><button className={`add-player ${watchlist.includes(player.id)?'saved':''}`} onClick={()=>toggleWatchlist(player.id)}><Star size={15} fill={watchlist.includes(player.id)?'currentColor':'none'}/>{watchlist.includes(player.id)?'Quitar de watchlist':'Añadir a watchlist'}</button></div>)}</div></section>
  </div>
}

function PlayersPage({ players, openPlayer, watchlist, toggleWatchlist, watchlistOnly, setWatchlistOnly }) {
  const [query,setQuery]=useState(''); const [position,setPosition]=useState('TODOS'); const [sort,setSort]=useState('value'); const [limit,setLimit]=useState(25)
  const [showFilters,setShowFilters]=useState(false); const [team,setTeam]=useState('TODOS'); const [minGp,setMinGp]=useState(0)
  const teams=useMemo(()=>['TODOS',...unique(players.map(p=>p.team)).sort()],[players])
  const activeFilters=(team!=='TODOS'?1:0)+(minGp>0?1:0)+(watchlistOnly?1:0)
  const filtered=useMemo(()=>[...players].filter(p=>(!query||`${p.name} ${p.team}`.toLowerCase().includes(query.toLowerCase()))&&(position==='TODOS'||p.position?.includes(position))&&(team==='TODOS'||p.team===team)&&p.gp>=minGp&&(!watchlistOnly||watchlist.includes(p.id))).sort((a,b)=>Number(b[sort]||0)-Number(a[sort]||0)),[players,query,position,team,minGp,sort,watchlistOnly,watchlist])
  return <div className="page players-page"><SectionHeading eyebrow="PLAYER INDEX · H2H 8-CAT" title="Conoce el valor real." description="Ranking real de ESPN en PTS, FT%, 3PTM, FG%, AST, REB, STL y BLK."/>
    <div className="filter-bar"><label className="search-input"><Search size={18}/><input placeholder="Buscar por jugador o equipo" value={query} onChange={e=>{setQuery(e.target.value);setLimit(25)}}/>{query&&<button onClick={()=>setQuery('')} aria-label="Limpiar búsqueda"><X size={15}/></button>}</label><div className="position-pills">{['TODOS','PG','SG','SF','PF','C','G','F'].map(item=><button className={position===item?'active':''} onClick={()=>setPosition(item)} key={item}>{item}</button>)}</div><button className="filter-button" onClick={()=>setShowFilters(!showFilters)}><SlidersHorizontal size={17}/> Filtros {activeFilters>0&&<span>{activeFilters}</span>}</button></div>
    {showFilters&&<div className="advanced-filters"><label>Equipo<select value={team} onChange={e=>setTeam(e.target.value)}>{teams.map(item=><option key={item}>{item}</option>)}</select></label><label>Partidos mínimos<input type="number" min="0" max="82" value={minGp} onChange={e=>setMinGp(Number(e.target.value)||0)}/></label><label className="saved-toggle"><input type="checkbox" checked={watchlistOnly} onChange={e=>setWatchlistOnly(e.target.checked)}/> Sólo watchlist</label><button onClick={()=>{setTeam('TODOS');setMinGp(0);setWatchlistOnly(false)}}>Limpiar filtros</button></div>}
    <div className="table-meta"><span>Mostrando <b>{Math.min(limit,filtered.length)}</b> de <b>{filtered.length}</b></span><div>Ordenar por <select value={sort} onChange={e=>setSort(e.target.value)}><option value="value">Fantasy Value 8-CAT</option>{CATEGORY_META.map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></div></div>
    <div className="surface players-table-wrap">{!filtered.length?<EmptyState icon={Search} title="Sin resultados" copy="Ajusta los filtros o añade jugadores a tu watchlist."/>:<><table className="players-table"><thead><tr><th>#</th><th>JUGADOR</th><th>GP</th><th>PTS</th><th>FT%</th><th>3PTM</th><th>FG%</th><th>AST</th><th>REB</th><th>STL</th><th>BLK</th><th>VALOR</th><th/></tr></thead><tbody>{filtered.slice(0,limit).map((player,index)=><tr key={player.id} onClick={()=>openPlayer(player)}><td>{index+1}</td><td><div className="table-player"><PlayerPhoto player={player}/><div><strong>{player.name}</strong><span>{player.team} · {player.position}</span></div></div></td><td>{player.gp}</td><td><b>{fmt(player.pts)}</b></td><td>{fmt(player.ftPct)}%</td><td>{fmt(player.threeMade)}</td><td>{fmt(player.fgPct)}%</td><td>{fmt(player.ast)}</td><td>{fmt(player.reb)}</td><td>{fmt(player.stl)}</td><td>{fmt(player.blk)}</td><td><div className={`value-chip ${player.value>89?'elite':player.value>74?'strong':''}`}>{player.value}</div></td><td><button className={`star-button ${watchlist.includes(player.id)?'saved':''}`} onClick={e=>{e.stopPropagation();toggleWatchlist(player.id)}} aria-label="Cambiar watchlist"><Star size={17} fill={watchlist.includes(player.id)?'currentColor':'none'}/></button></td></tr>)}</tbody></table>{limit<filtered.length&&<button className="load-more" onClick={()=>setLimit(limit+25)}>Cargar 25 más <ChevronDown size={16}/></button>}</>}</div>
  </div>
}

function LeagueComparison({ league, players }) {
  const teams=useMemo(()=>league.teams.map(team=>{const roster=players.filter(player=>team.rosterIds.includes(String(player.id)));return {...team,roster,projection:projectRoster(roster),value:roster.reduce((sum,player)=>sum+Number(player.value||0),0)}}).sort((a,b)=>b.value-a.value),[league.teams,players])
  const [leftId,setLeftId]=useState(String(league.teamId))
  const [rightId,setRightId]=useState(String(league.opponent?.id||teams.find(team=>team.id!==String(league.teamId))?.id||''))
  useEffect(()=>{setLeftId(String(league.teamId));setRightId(String(league.opponent?.id||teams.find(team=>team.id!==String(league.teamId))?.id||''))},[league.teamId,league.opponent?.id,teams])
  useEffect(()=>{if(leftId===rightId)setRightId(teams.find(team=>team.id!==leftId)?.id||'')},[leftId,rightId,teams])
  const left=teams.find(team=>team.id===leftId); const right=teams.find(team=>team.id===rightId); const comparison=left&&right?compareRosters(left.roster,right.roster):null
  return <section className="league-comparison"><SectionHeading eyebrow="LIGA COMPLETA" title="Compara todos los equipos." description={`${teams.length} rosters importados desde ESPN y valorados con el mismo modelo H2H 8-CAT.`}/>
    <div className="surface compare-workbench"><div className="compare-selectors"><label>Equipo A<select value={leftId} onChange={e=>setLeftId(e.target.value)}>{teams.map(team=><option value={team.id} key={team.id}>{team.name}</option>)}</select></label><ArrowLeftRight size={20}/><label>Equipo B<select value={rightId} onChange={e=>setRightId(e.target.value)}>{teams.filter(team=>team.id!==leftId).map(team=><option value={team.id} key={team.id}>{team.name}</option>)}</select></label></div>
      {comparison&&<><div className="compare-score"><div><span>{left.name}</span><strong>{comparison.wins}</strong><small>VALUE {left.value}</small></div><em>—</em><div><span>{right.name}</span><strong>{comparison.losses}</strong><small>VALUE {right.value}</small></div></div><div className="compare-categories">{comparison.categories.map(category=><div key={category.key}><b className={category.win?'winner':''}>{fmt(category.mine)}{category.key.includes('Pct')?'%':''}</b><span>{category.label}</span><b className={!category.win?'winner':''}>{fmt(category.theirs)}{category.key.includes('Pct')?'%':''}</b></div>)}</div></>}
    </div>
    <div className="surface league-table-wrap"><table className="league-table"><thead><tr><th>#</th><th>EQUIPO</th><th>RÉCORD</th><th>JUG.</th><th>VALUE</th>{CATEGORY_META.map(([,label])=><th key={label}>{label}</th>)}<th/></tr></thead><tbody>{teams.map((team,index)=><tr className={team.id===String(league.teamId)?'my-team':''} key={team.id}><td>{index+1}</td><td><div className="league-team-name"><span>{team.abbrev}</span><strong>{team.name}</strong></div></td><td>{team.record?`${team.record.wins}—${team.record.losses}`:'—'}</td><td>{team.roster.length}</td><td><b>{team.value}</b></td>{CATEGORY_META.map(([key])=><td key={key}>{team.projection?fmt(team.projection[key]):'—'}{team.projection&&key.includes('Pct')?'%':''}</td>)}<td><button onClick={()=>{setLeftId(String(league.teamId));setRightId(team.id)}} disabled={team.id===String(league.teamId)}>Comparar</button></td></tr>)}</tbody></table></div>
  </section>
}

function TeamPage({ roster, players, league, openPlayer, onImport, setPage }) {
  const strengths=useMemo(()=>rosterStrengths(roster,players),[roster,players]); const weakest=[...strengths].sort((a,b)=>a.value-b.value).slice(0,2); const total=roster.reduce((s,p)=>s+p.value,0)
  if(!roster.length)return <div className="page team-page"><SectionHeading eyebrow="MI EQUIPO" title="Conecta tu roster." description="No mostramos un equipo ficticio: importa ESPN o añade jugadores reales manualmente."/><div className="surface large-empty"><EmptyState icon={Users} title="Todavía no hay jugadores" copy="Puedes importar una liga pública o privada de ESPN, o construir el roster desde Jugadores." action={onImport} actionLabel="Importar ESPN"/><button className="outline-button" onClick={()=>setPage('players')}>Construir manualmente <ArrowRight size={15}/></button></div></div>
  return <div className="page team-page"><div className="team-hero"><div><span className="eyebrow">MI EQUIPO · {league?'ESPN':'MANUAL'}</span><h1>{league?.teamName||'Equipo de Javier'}</h1><p>{league?`${league.leagueName} · H2H 8-CAT · ${league.leagueSize} equipos`:'Roster H2H 8-CAT guardado localmente'}</p></div><div className="team-record"><span>RÉCORD</span><strong>{league?.record?`${league.record.wins}—${league.record.losses}`:'—'}</strong><small>{league?.record?.rank?`#${league.record.rank}`:'Sin datos ESPN'}</small></div><div className="team-record"><span>VALOR</span><strong>{total}</strong><small>{roster.length} jugadores</small></div><button className="outline-button light" onClick={onImport}><RefreshCcw size={16}/>{league?'Sincronizar':'Importar ESPN'}</button></div>
    <section className="team-insights"><div className="surface strength-card"><span>PERFIL REAL DEL ROSTER</span><h3>Percentiles 8-CAT</h3>{strengths.map(item=><div className="strength-row" key={item.key}><b>{item.label}</b><div><i className={item.type} style={{width:`${item.value}%`}}/></div><span>{item.value}</span></div>)}</div><div className="surface recommendation-card"><div className="insight-icon"><Sparkles size={21}/></div><span>INSIGHT DEL ROSTER</span><h3>{weakest.length?`Refuerza ${weakest.map(x=>x.label).join(' y ')}.`:'Roster listo'}</h3><p>{weakest.length?`Estas son las categorías con menor percentil frente al pool NBA real. El Trade Lab priorizará su impacto.`:'Añade jugadores para calcular fortalezas.'}</p><button onClick={()=>setPage('trade')}>Buscar objetivos de trade <ArrowRight size={15}/></button></div></section>
    <section className="roster-section"><div className="card-title-row"><div><span>ROSTER ACTUAL</span><h3>{roster.length} jugadores</h3></div><div className="last-sync"><i/>{league?timeAgo(league.syncedAt):'Guardado localmente'}</div></div><div className="roster-grid">{roster.map((player,index)=><button className="team-player-card" onClick={()=>openPlayer(player)} key={player.id}><div className="slot">{index<9?'ACTIVO':'BE'}</div><PlayerPhoto player={player} size="xl"/><div className="team-card-copy"><span>{player.team} · {player.position}</span><h3>{player.name}</h3></div><div className="card-value"><span>8-CAT</span><strong>{player.value}</strong></div><div className="stat-triplet"><div><span>PTS</span><b>{fmt(player.pts)}</b></div><div><span>REB</span><b>{fmt(player.reb)}</b></div><div><span>AST</span><b>{fmt(player.ast)}</b></div></div><div className="next-game"><span>{player.gp} GP</span><b>{fmt(player.min)} MIN</b></div></button>)}</div></section>
    {league?.teams?.length>1&&<LeagueComparison league={league} players={players}/>} 
  </div>
}

function PlayerPicker({ label, selected, setSelected, players, exclude = [], allowClear = false }) {
  const [open,setOpen]=useState(false); const [query,setQuery]=useState(''); const current=players.find(p=>p.id===selected)
  const matches=players.filter(p=>!exclude.includes(p.id)&&(!query||p.name.toLowerCase().includes(query.toLowerCase()))).slice(0,8)
  return <div className="player-picker"><span>{label}</span><button className="picker-selected" onClick={()=>setOpen(!open)}>{current?<><PlayerPhoto player={current}/><div><strong>{current.name}</strong><small>{current.team} · {current.position} · VAL {current.value}</small></div><ChevronDown size={16}/></>:<><Plus size={18}/> Seleccionar jugador</>}</button>{open&&<div className="picker-menu"><label><Search size={15}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar jugador..."/></label>{allowClear&&current&&<button onClick={()=>{setSelected(null);setOpen(false)}}><X size={16}/><div><strong>Quitar jugador</strong><span>Eliminar esta pieza</span></div></button>}{matches.map(player=><button key={player.id} onClick={()=>{setSelected(player.id);setOpen(false);setQuery('')}}><PlayerPhoto player={player}/><div><strong>{player.name}</strong><span>{player.team} · {player.position}</span></div><b>{player.value}</b></button>)}</div>}</div>
}

function TradePage({ players, roster, league, seedPlayer, clearSeed }) {
  const defaultSend=roster[0]?.id||players[1]?.id; const defaultReceive=players.find(p=>!roster.some(r=>r.id===p.id))?.id||players[0]?.id
  const [send,setSend]=useState(defaultSend); const [receive,setReceive]=useState(defaultReceive); const [send2,setSend2]=useState(null); const [receive2,setReceive2]=useState(null); const [extraSend,setExtraSend]=useState(false); const [extraReceive,setExtraReceive]=useState(false); const [analyzed,setAnalyzed]=useState(false)
  useEffect(()=>{if(seedPlayer){setReceive(seedPlayer);setAnalyzed(false);clearSeed()}},[seedPlayer,clearSeed])
  useEffect(()=>{if(!players.some(p=>p.id===send))setSend(defaultSend);if(!players.some(p=>p.id===receive))setReceive(defaultReceive)},[players,defaultSend,defaultReceive,send,receive])
  const sendPlayers=[send,send2].map(id=>players.find(p=>p.id===id)).filter(Boolean); const receivePlayers=[receive,receive2].map(id=>players.find(p=>p.id===id)).filter(Boolean)
  const total=(list,key)=>list.reduce((sum,p)=>sum+Number(p[key]||0),0); const sendValue=total(sendPlayers,'value'); const receiveValue=total(receivePlayers,'value'); const difference=receiveValue-sendValue; const fairness=Math.max(0,Math.round(100-Math.abs(difference)/Math.max(1,sendValue,receiveValue)*100))
  const impacts=CATEGORY_META.map(([key,label])=>({key,label,diff:Number((total(receivePlayers,key)-total(sendPlayers,key)).toFixed(1))})); const catWins=impacts.filter(x=>x.diff>0).length
  const reset=()=>{setSend(defaultSend);setReceive(defaultReceive);setSend2(null);setReceive2(null);setExtraSend(false);setExtraReceive(false);setAnalyzed(false)}
  return <div className="page trade-page"><SectionHeading eyebrow="TRADE LAB · H2H 8-CAT" title="Ve el trade antes de hacerlo." description="Todo el cálculo usa estadísticas reales del dataset ESPN." action={<button className="outline-button" onClick={reset}><RefreshCcw size={15}/> Reiniciar</button>}/><section className="trade-builder surface"><div className="trade-side"><div className="trade-side-heading"><div className="team-avatar orange">JR</div><div><span>RECIBES</span><strong>{league?.teamName||'Tu equipo'}</strong></div></div><PlayerPicker label="JUGADOR" selected={receive} setSelected={setReceive} players={players} exclude={[send,send2]}/>{extraReceive&&<PlayerPicker label="SEGUNDA PIEZA" selected={receive2} setSelected={setReceive2} players={players} exclude={[send,send2,receive]} allowClear/>}{!extraReceive&&<button className="add-piece" onClick={()=>setExtraReceive(true)}><Plus size={16}/> Añadir otro jugador</button>}</div><div className="trade-center"><button onClick={()=>{const a=send,b=send2;setSend(receive);setSend2(receive2);setReceive(a);setReceive2(b);setExtraSend(extraReceive);setExtraReceive(extraSend);setAnalyzed(false)}} aria-label="Intercambiar lados"><ArrowLeftRight size={22}/></button><span>TRADE</span></div><div className="trade-side"><div className="trade-side-heading"><div className="team-avatar black">RIV</div><div><span>ENTREGAS</span><strong>Otro equipo</strong></div></div><PlayerPicker label="JUGADOR" selected={send} setSelected={setSend} players={players} exclude={[receive,receive2]}/>{extraSend&&<PlayerPicker label="SEGUNDA PIEZA" selected={send2} setSelected={setSend2} players={players} exclude={[receive,receive2,send]} allowClear/>}{!extraSend&&<button className="add-piece" onClick={()=>setExtraSend(true)}><Plus size={16}/> Añadir otro jugador</button>}</div><div className="analyze-row"><button className="primary" onClick={()=>setAnalyzed(true)} disabled={!sendPlayers.length||!receivePlayers.length}><Sparkles size={17}/> Analizar este trade</button><p>Valor, ocho categorías e impacto en tu construcción</p></div></section>
    {analyzed&&<section className="trade-results revealed"><div className="surface verdict-card"><div className="verdict-top"><div><span>VEREDICTO 8-CAT</span><h2>{difference>5?'Valor favorable':difference<-5?'Estás pagando de más':'Trade equilibrado'}</h2><p>{difference===0?'El valor total es idéntico.':`${difference>0?'Recibes':'Cedes'} ${Math.abs(difference)} puntos netos de valor 8-CAT.`}</p></div><div className="grade"><span>EQUIDAD</span><strong>{fairness}</strong></div></div><div className="fairness"><div><span>Equidad del intercambio</span><b>{fairness}%</b></div><div className="fairness-bar"><i style={{width:`${fairness}%`}}/><em/></div></div><div className="bundle-summary"><div><span>RECIBES</span>{receivePlayers.map(p=><strong key={p.id}>{p.name} · {p.value}</strong>)}</div><ArrowRight size={21}/><div><span>ENTREGAS</span>{sendPlayers.map(p=><strong key={p.id}>{p.name} · {p.value}</strong>)}</div></div></div><div className="surface impact-card"><div className="card-title-row"><div><span>IMPACTO REAL</span><h3>Cambio por categoría</h3></div><Info size={17}/></div><div className="impact-list">{impacts.map(item=><div key={item.key}><b>{item.label}</b><div className="impact-axis"><i className={item.diff<0?'negative':''} style={{width:`${Math.min(50,Math.abs(item.diff)*3+6)}%`,left:item.diff>=0?'50%':`${50-Math.min(50,Math.abs(item.diff)*3+6)}%`}}/></div><span className={item.diff>=0?'positive':'negative'}>{item.diff>0?'+':''}{item.diff}</span></div>)}</div></div><div className="surface scenario-card"><div className="card-title-row"><div><span>ESCENARIO CALCULADO</span><h3>Balance de categorías del trade</h3></div><span className="pill">H2H 8-CAT</span></div><div className="scenario-category-score"><div><span>CATEGORÍAS QUE MEJORAN</span><strong>{catWins}</strong></div><ArrowRight size={24}/><div><span>CATEGORÍAS QUE BAJAN</span><strong>{8-catWins}</strong></div>{league?.record&&<p>Tu récord ESPN actual es {league.record.wins}—{league.record.losses}; no se altera retrospectivamente con datos inventados.</p>}</div></div></section>}
  </div>
}

function strategyScore(player,strategy){const base=player.value;if(strategy==='punt-ft')return base+player.reb*1.2+player.blk*4+player.fgPct*.12-player.ftPct*.05;if(strategy==='small-ball')return base+player.ast*1.4+player.stl*3+player.threeMade*3+player.ftPct*.08;if(strategy==='punt-ast')return base+player.reb*.8+player.blk*3+player.fgPct*.1-player.ast*.25;return base}

function DraftPage({ players, openPlayer, league, espnAuth, onReconnect }) {
  const [strategy,setStrategy]=useState('balanced')
  const [manualRound,setManualRound]=useState(1)
  const [slot,setSlot]=useState(1)
  const [manualDrafted,setManualDrafted]=useStoredState('baseline-draft',[])
  const [queue,setQueue]=useStoredState('baseline-draft-queue',[])
  const [position,setPosition]=useState('TODOS')
  const [rankMode,setRankMode]=useState('FIT')
  const [liveEnabled,setLiveEnabled]=useState(false)
  const live=useLiveDraft({enabled:liveEnabled,league,auth:espnAuth,players})
  const liveDrafted=live.draft?.picks.map(pick=>pick.playerId).filter(Boolean)||[]
  const draftedIds=liveEnabled&&live.draft?liveDrafted:manualDrafted
  const activeQueue=queue.filter(id=>!draftedIds.includes(id))
  const myPicks=liveEnabled&&live.draft
    ? live.draft.picks.filter(pick=>pick.teamId===String(league?.teamId)).map(pick=>pick.player).filter(Boolean)
    : manualDrafted.map(id=>players.find(player=>player.id===id)).filter(Boolean)
  const strengths=rosterStrengths(myPicks,players)
  const currentRound=liveEnabled&&live.draft?live.draft.currentRound:manualRound
  const currentPick=liveEnabled&&live.draft?`#${live.draft.nextOverall}`:`${manualRound}.${String(slot).padStart(2,'0')}`
  const myTurn=liveEnabled&&live.draft?.currentTeamId===String(league?.teamId)
  const canConnect=Boolean(league)&&(!league.isPrivate||Boolean(espnAuth?.swid))
  const available=useMemo(()=>players.filter(player=>!draftedIds.includes(player.id)&&(position==='TODOS'||player.position?.includes(position))).sort((a,b)=>rankMode==='FIT'?strategyScore(b,strategy)-strategyScore(a,strategy):b.value-a.value),[players,draftedIds,position,strategy,rankMode])
  const toggleQueue=id=>setQueue(items=>items.includes(id)?items.filter(item=>item!==id):unique([...items,id]))

  return <div className="page draft-page">
    <div className="draft-header"><div><span className="eyebrow">DRAFT ROOM · {liveEnabled?'ESPN LIVE':'PREPARACIÓN'}</span><h1>{myTurn?'Estás en el reloj.':'Construye con intención.'}</h1><p>{liveEnabled?'Picks sincronizados automáticamente; confirma tus selecciones dentro de ESPN.':'Conecta la liga para convertir este board en un asistente live.'}</p></div><div className="draft-status"><span>{liveEnabled?'PRÓXIMO PICK':'PICK MANUAL'}</span><strong>{currentPick}</strong>{!liveEnabled&&<label>Posición<select value={slot} onChange={e=>setSlot(Number(e.target.value))}>{Array.from({length:12},(_,i)=><option key={i+1}>{i+1}</option>)}</select></label>}{!liveEnabled&&<button onClick={()=>{setManualDrafted([]);setManualRound(1)}}><RefreshCcw size={15}/> Reiniciar</button>}</div></div>

    <section className={`live-draft-console ${liveEnabled?'connected':''} ${myTurn?'my-turn':''}`}><div className="live-console-head"><div className="live-indicator"><i/><div><span>ESPN DRAFT SYNC</span><strong>{!league?'Liga no conectada':liveEnabled?(live.draft?.completed?'Draft finalizado':live.error?'Conexión interrumpida':'Seguimiento activo'):'Listo para conectar'}</strong></div></div><div className="live-actions">{liveEnabled&&<button onClick={live.refresh} disabled={live.refreshing}><RefreshCcw className={live.refreshing?'spin':''} size={15}/>Actualizar</button>}{liveEnabled?<button onClick={()=>setLiveEnabled(false)}><X size={15}/>Desconectar</button>:<button className="connect-live" onClick={()=>canConnect?setLiveEnabled(true):onReconnect()}>{canConnect?<><Activity size={15}/>Conectar draft live</>:<><Upload size={15}/>{league?.isPrivate?'Reautenticar ESPN':'Importar liga ESPN'}</>}</button>}</div></div>
      {live.error&&<div className="live-error"><Info size={15}/><span>{live.error}</span>{league?.isPrivate&&!espnAuth?.swid&&<button onClick={onReconnect}>Introducir credenciales</button>}</div>}
      {liveEnabled&&live.draft&&<div className="live-stats"><div><span>EN EL RELOJ</span><strong>{live.draft.completed?'—':live.draft.currentTeam?.name||'Esperando ESPN'}</strong></div><div><span>PICK</span><strong>{live.draft.nextOverall}</strong></div><div><span>RONDA</span><strong>{live.draft.currentRound}{live.draft.totalRounds?` / ${live.draft.totalRounds}`:''}</strong></div><div><span>SELECCIONES</span><strong>{live.draft.picks.length}</strong></div><div><span>ACTUALIZADO</span><strong>{live.lastUpdated?timeAgo(live.lastUpdated):'—'}</strong></div></div>}
      {myTurn&&<div className="on-clock-banner"><Zap size={18}/><div><strong>Javier Rivera está en el reloj</strong><span>El board ya excluyó todos los picks de ESPN y recalculó el mejor fit.</span></div></div>}
      {liveEnabled&&live.draft?.picks.length>0&&<div className="live-pick-feed"><span>ÚLTIMOS PICKS</span><div>{live.draft.picks.slice(-6).reverse().map(pick=><div key={pick.id}>{pick.player?<PlayerPhoto player={pick.player}/>:<div className="unknown-pick">?</div>}<div><strong>{pick.player?.name||`Jugador ESPN ${pick.playerId}`}</strong><small>{live.draft.teams.find(team=>team.id===pick.teamId)?.name||`Equipo ${pick.teamId}`} · #{pick.overall}</small></div></div>)}</div></div>}
    </section>

    <section className="strategy-section"><SectionHeading eyebrow="01 · ELIGE TU PLAN" title="Estrategia de construcción"/><div className="strategy-grid">{STRATEGIES.map(({id,name,kicker,copy,icon:Icon})=><button className={`strategy-card ${strategy===id?'active':''}`} onClick={()=>setStrategy(id)} key={id}><div><Icon size={21}/>{strategy===id&&<span className="check"><Check size={13}/></span>}</div><span>{kicker}</span><h3>{name}</h3><p>{copy}</p></button>)}</div></section>
    <section className="draft-layout"><div className="surface draft-board"><div className="card-title-row"><div><span>02 · MEJORES DISPONIBLES</span><h3>Board {liveEnabled?'live':'dinámico'}</h3></div><div className="board-filters"><select value={position} onChange={e=>setPosition(e.target.value)}><option>TODOS</option>{['PG','SG','SF','PF','C'].map(p=><option key={p}>{p}</option>)}</select><button onClick={()=>setRankMode(rankMode==='FIT'?'VALUE':'FIT')}><SlidersHorizontal size={15}/>{rankMode}</button></div></div><div className="draft-recommendation"><Sparkles size={18}/><div><strong>Recomendación para {currentPick}</strong><p>{liveEnabled&&live.draft?`${live.draft.picks.length} jugadores eliminados automáticamente. `:''}Ordenado por {rankMode==='FIT'?`encaje con ${STRATEGIES.find(s=>s.id===strategy)?.name}`:'valor H2H 8-CAT'}.</p></div></div><div className="draft-list">{available.slice(0,10).map((player,index)=><div className={`draft-row ${queue.includes(player.id)?'queued':''}`} key={player.id}><span className="draft-rank">{index+1}</span><button className="draft-player" onClick={()=>openPlayer(player)}><PlayerPhoto player={player}/><div><strong>{player.name}</strong><span>{player.team} · {player.position}</span></div></button><div className="fit-score"><span>{rankMode}</span><b>{Math.min(99,Math.round(rankMode==='FIT'?strategyScore(player,strategy):player.value))}</b></div><div className="category-tags"><span>{player.pts>23?'PTS':player.reb>8?'REB':'FG%'}</span><span>{player.ast>6?'AST':player.blk>1.2?'BLK':'VALUE'}</span></div><button className="draft-button" onClick={()=>liveEnabled?toggleQueue(player.id):(setManualDrafted([...manualDrafted,player.id]),setManualRound(manualRound+1))}>{liveEnabled?(queue.includes(player.id)?'Quitar cola':'A la cola'):'Draftear'}</button></div>)}</div></div>
      <aside className="draft-sidebar"><div className="surface build-card"><span>{liveEnabled?'MI ROSTER ESPN':'TU CONSTRUCCIÓN REAL'}</span><h3>Percentiles del draft</h3>{!myPicks.length?<div className="empty-picks"><Target size={25}/><p>{liveEnabled?'Tus picks aparecerán al sincronizarse.':'Draftea un jugador para calcular tu perfil.'}</p></div>:<div className="draft-profile-list">{strengths.map(item=><div key={item.key}><span>{item.label}</span><i><em style={{width:`${item.value}%`}}/></i><b>{item.value}</b></div>)}</div>}</div><div className="surface drafted-card"><div className="card-title-row"><div><span>{liveEnabled?'MIS PICKS ESPN':'TUS PICKS'}</span><h3>{myPicks.length} seleccionados</h3></div></div>{!myPicks.length?<div className="empty-picks"><Trophy size={25}/><p>Tus picks aparecerán aquí.</p></div>:myPicks.map((player,index)=><div className="picked-player" key={player.id}><span>{index+1}</span><PlayerPhoto player={player}/><div><strong>{player.name}</strong><small>{player.position} · {player.team}</small></div>{!liveEnabled&&<button onClick={()=>setManualDrafted(manualDrafted.filter(id=>id!==player.id))} aria-label="Quitar pick"><X size={14}/></button>}</div>)}</div>{liveEnabled&&<div className="surface queue-card"><div className="card-title-row"><div><span>COLA LOCAL</span><h3>{activeQueue.length} jugadores</h3></div></div>{activeQueue.map((id,index)=>{const player=players.find(item=>item.id===id);return player?<div className="picked-player" key={id}><span>{index+1}</span><PlayerPhoto player={player}/><div><strong>{player.name}</strong><small>FIT {Math.min(99,Math.round(strategyScore(player,strategy)))}</small></div><button onClick={()=>toggleQueue(id)} aria-label="Quitar de cola"><X size={14}/></button></div>:null})}</div>}</aside>
    </section>
  </div>
}

function PlayerModal({ player, season, onClose, toggleWatchlist, saved, inRoster, toggleRoster, useTrade }) {
  if(!player)return null
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="player-modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={onClose}><X size={19}/></button><div className="player-modal-hero" style={{'--team':TEAM_COLORS[player.team]||'#555'}}><div className="player-modal-copy"><span>{player.teamName||player.team} · {player.position}</span><h2>{player.name}</h2><div><span className="status-dot"/> {player.status==='active'?'Activo':player.status} {player.age&&<><em>•</em>{player.age} años</>}</div></div><PlayerPhoto player={player} size="hero"/><div className="modal-rating"><span>VALUE 8-CAT</span><strong>{player.value}</strong><small>{player.gp} GP</small></div></div><div className="modal-content"><div className="modal-actions"><button className={saved?'saved':''} onClick={()=>toggleWatchlist(player.id)}><Star size={16} fill={saved?'currentColor':'none'}/>{saved?'Quitar de watchlist':'Añadir a watchlist'}</button><button className={inRoster?'saved':''} onClick={()=>toggleRoster(player.id)}><Users size={16}/>{inRoster?'Quitar de mi equipo':'Añadir a mi equipo'}</button><button onClick={()=>useTrade(player.id)}><ArrowLeftRight size={16}/>Usar en Trade Lab</button></div><div className="season-line"><div><span>TEMPORADA {season}</span><b>{player.gp} GP · {fmt(player.min)} MIN</b></div><span>{player.team} · {player.position}</span></div><div className="modal-stats">{CATEGORY_META.map(([key,label])=><div key={key}><span>{label}</span><strong>{fmt(player[key])}{key.includes('Pct')?'%':''}</strong><small>por partido</small></div>)}</div><div className="modal-insight"><Sparkles size={20}/><div><span>LECTURA 8-CAT</span><p><b>{player.name}</b> destaca principalmente en {CATEGORY_META.map(([key,label])=>({label,value:player[key]})).sort((a,b)=>b.value-a.value).slice(0,2).map(x=>x.label).join(' y ')}. Valor calculado únicamente con estadísticas ESPN.</p></div></div></div></div></div>
}

function ImportModal({ onClose, players, onImported, existing }) {
  const [leagueId,setLeagueId]=useState(existing?.leagueId||'')
  const [teamId,setTeamId]=useState(String(existing?.teamId||1))
  const [season,setSeason]=useState(String(existing?.season||2026))
  const [mode,setMode]=useState(existing?.isPrivate?'private':'public')
  const [swid,setSwid]=useState('')
  const [espnS2,setEspnS2]=useState('')
  const [status,setStatus]=useState('idle')
  const [errorMessage,setErrorMessage]=useState('')

  const importTeam=async()=>{
    if(!leagueId||!teamId){setStatus('error');setErrorMessage('Escribe el League ID y tu Team ID.');return}
    if(mode==='private'&&(!swid||!espnS2)){setStatus('error');setErrorMessage('Una liga privada necesita SWID y espn_s2.');return}
    setStatus('loading');setErrorMessage('')
    try{
      const response=await fetch('/api/espn/league',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({leagueId,season,swid:mode==='private'?swid:undefined,espnS2:mode==='private'?espnS2:undefined})})
      const payload=await response.json()
      if(!response.ok)throw new Error(payload.error||'No se pudo importar la liga.')
      const data=payload.data
      const readIds=t=>t?.roster?.entries?.map(e=>String(e.playerPoolEntry?.player?.id)).filter(Boolean)||[]
      const readRecord=t=>t?.record?.overall?{wins:t.record.overall.wins||0,losses:t.record.overall.losses||0,ties:t.record.overall.ties||0,rank:t.record.overall.rank||t.currentProjectedRank||null}:null
      const source=data.teams?.find(t=>String(t.id)===String(teamId))
      if(!source)throw new Error('El Team ID no existe dentro de esta liga.')
      const ids=readIds(source)
      if(!players.some(p=>ids.includes(String(p.id))))throw new Error('El roster no contiene jugadores presentes en el dataset actual.')
      const period=data.scoringPeriodId||data.status?.currentScoringPeriod
      const match=data.schedule?.find(game=>(!period||game.matchupPeriodId===period)&&(String(game.home?.teamId)===String(teamId)||String(game.away?.teamId)===String(teamId)))
      const opponentId=match?(String(match.home?.teamId)===String(teamId)?match.away?.teamId:match.home?.teamId):null
      const allTeams=(data.teams||[]).map(team=>({id:String(team.id),name:teamName(team),abbrev:team.abbrev||initials(teamName(team)),record:readRecord(team),rosterIds:readIds(team)}))
      const opponent=allTeams.find(team=>team.id===String(opponentId))||null
      onImported({league:{leagueId:String(leagueId),teamId:String(teamId),season:Number(season),seasonLabel:`${Number(season)-1}-${String(season).slice(-2)}`,leagueName:data.settings?.name||`Liga ESPN ${leagueId}`,teamName:teamName(source),teamAbbrev:source.abbrev||initials(teamName(source)),leagueSize:allTeams.length,record:readRecord(source),opponent:opponent?{id:opponent.id,name:opponent.name,abbrev:opponent.abbrev,record:opponent.record}:null,opponentRosterIds:opponent?.rosterIds||[],teams:allTeams,isPrivate:mode==='private',scoringPeriodId:period||null,syncedAt:new Date().toISOString()},rosterIds:ids,auth:mode==='private'?{swid,espnS2}:null})
      setSwid('');setEspnS2('');setStatus('success');setTimeout(onClose,700)
    }catch(error){setStatus('error');setErrorMessage(error.message)}
  }

  return <div className="modal-backdrop" onMouseDown={onClose}><div className="import-modal private-import" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={onClose}><X size={19}/></button><div className="espn-mark">E</div><span>CONECTA TU LIGA</span><h2>Importar desde ESPN</h2><p>Importa todos los equipos, rosters, récords y el matchup actual.</p>
    <div className="league-mode"><button className={mode==='public'?'active':''} onClick={()=>setMode('public')}>Liga pública</button><button className={mode==='private'?'active':''} onClick={()=>setMode('private')}>Liga privada</button></div>
    <label><span>LEAGUE ID</span><input value={leagueId} onChange={e=>setLeagueId(e.target.value)} placeholder="ID de tu liga" inputMode="numeric"/></label><div className="import-fields"><label><span>TEAM ID</span><input value={teamId} onChange={e=>setTeamId(e.target.value)} inputMode="numeric"/></label><label><span>TEMPORADA</span><select value={season} onChange={e=>setSeason(e.target.value)}><option value="2026">2025–26</option><option value="2025">2024–25</option></select></label></div>
    {mode==='private'&&<div className="private-fields"><div className="credential-note"><Info size={16}/><p>Copia `SWID` y `espn_s2` desde las cookies de fantasy.espn.com mientras tu sesión esté abierta. Se usan una sola vez y no se guardan.</p></div><label><span>SWID</span><input value={swid} onChange={e=>setSwid(e.target.value)} placeholder="{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}" autoComplete="off"/></label><label><span>ESPN_S2</span><input type="password" value={espnS2} onChange={e=>setEspnS2(e.target.value)} placeholder="Cookie espn_s2" autoComplete="off"/></label></div>}
    {status==='error'&&<div className="form-message error">{errorMessage}</div>}{status==='success'&&<div className="form-message success"><Check size={15}/>Liga y todos sus equipos sincronizados.</div>}<button className="primary import-submit" onClick={importTeam} disabled={status==='loading'}>{status==='loading'?<><RefreshCcw className="spin" size={17}/>Importando liga...</>:<>Importar todos los equipos <ArrowRight size={17}/></>}</button><small>{mode==='private'?'Las credenciales viajan sólo a tu servidor local y no se almacenan.':'Las ligas públicas no necesitan credenciales.'}</small>
  </div></div>
}

function SearchModal({ players, onClose, openPlayer, setPage }) {
  const [query,setQuery]=useState(''); const results=players.filter(p=>!query||`${p.name} ${p.team}`.toLowerCase().includes(query.toLowerCase())).slice(0,8)
  useEffect(()=>{const fn=e=>e.key==='Escape'&&onClose();window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn)},[onClose])
  return <div className="search-backdrop" onMouseDown={onClose}><div className="command-menu" onMouseDown={e=>e.stopPropagation()}><label><Search size={20}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Busca cualquier jugador..."/><kbd>ESC</kbd></label><span className="command-label">{query?'RESULTADOS':'MEJORES VALORES 8-CAT'}</span>{results.map(p=><button key={p.id} onClick={()=>{openPlayer(p);onClose()}}><PlayerPhoto player={p}/><div><strong>{p.name}</strong><span>{p.team} · {p.position}</span></div><b>{p.value}</b><ChevronRight size={15}/></button>)}<div className="command-footer"><button onClick={()=>{setPage('players');onClose()}}>Ver todos <ArrowRight size={14}/></button><span>{results.length} resultados</span></div></div></div>
}

function NotificationPanel({ league, watchlist, season, count, onClose, onImport, openWatchlist }) {
  return <div className="popover-backdrop" onMouseDown={onClose}><div className="notification-panel" onMouseDown={e=>e.stopPropagation()}><div className="panel-head"><div><span>ACTIVIDAD</span><h3>Notificaciones</h3></div><button onClick={onClose}><X size={17}/></button></div>{!league&&<button className="notification-item" onClick={onImport}><Upload size={18}/><div><strong>Conecta tu liga ESPN</strong><span>Activa roster, récord y matchup reales.</span></div><ChevronRight size={15}/></button>}<button className="notification-item" onClick={openWatchlist}><Star size={18}/><div><strong>{watchlist.length} en tu watchlist</strong><span>Revisa tus jugadores guardados.</span></div><ChevronRight size={15}/></button><div className="notification-item static"><Activity size={18}/><div><strong>Dataset {season}</strong><span>{count} jugadores cargados desde ESPN.</span></div><Check size={15}/></div></div></div>
}

function ProfileModal({ user, setUser, onClose }) {
  const [name,setName]=useState(user.name)
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="profile-modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close dark-close" onClick={onClose}><X size={18}/></button><div className="profile-avatar">{initials(name)}</div><span>PERFIL LOCAL</span><h2>Tu identidad</h2><p>Este nombre se usa en el dashboard y permanece guardado en este navegador.</p><label>Nombre<input value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre"/></label><button className="primary" onClick={()=>{if(name.trim())setUser({...user,name:name.trim()});onClose()}}>Guardar cambios <Check size={16}/></button></div></div>
}

export default function App() {
  const {players,season,count,source,loading,error}=usePlayerData(); const [page,setPage]=useState('dashboard'); const [collapsed,setCollapsed]=useState(false); const [selected,setSelected]=useState(null); const [showImport,setShowImport]=useState(false); const [showSearch,setShowSearch]=useState(false); const [showNotifications,setShowNotifications]=useState(false); const [showProfile,setShowProfile]=useState(false)
  const [user,setUser]=useStoredState('baseline-user',{name:'Javier Rivera'}); const [watchlist,setWatchlist]=useStoredState('baseline-watchlist',[]); const [rosterIds,setRosterIds]=useStoredState('baseline-roster',[]); const [league,setLeague]=useStoredState('baseline-league',null); const [espnAuth,setEspnAuth]=useState(null); const [watchlistOnly,setWatchlistOnly]=useState(false); const [tradeSeed,setTradeSeed]=useState(null)
  const roster=players.filter(p=>rosterIds.includes(String(p.id))); const opponentRoster=players.filter(p=>league?.opponentRosterIds?.includes(String(p.id)))
  const toggleWatchlist=id=>setWatchlist(list=>list.includes(String(id))?list.filter(item=>item!==String(id)):unique([...list,id])); const toggleRoster=id=>setRosterIds(list=>list.includes(String(id))?list.filter(item=>item!==String(id)):unique([...list,id]))
  const openWatchlist=()=>{setWatchlistOnly(true);setPage('players');setShowNotifications(false)}; const useTrade=id=>{setTradeSeed(String(id));setPage('trade');setSelected(null)}
  const handleImport=({league:nextLeague,rosterIds:nextRoster,auth})=>{setLeague(nextLeague);setRosterIds(unique(nextRoster));setEspnAuth(auth||null)}
  useEffect(()=>{const listener=e=>{if(e.ctrlKey&&e.key.toLowerCase()==='k'){e.preventDefault();setShowSearch(true)}};window.addEventListener('keydown',listener);return()=>window.removeEventListener('keydown',listener)},[])
  if(loading)return <div className="app-loading"><RefreshCcw className="spin" size={24}/><strong>Cargando datos reales de ESPN...</strong></div>
  if(error||!players.length)return <div className="app-loading error-screen"><Info size={28}/><strong>No se pudo cargar el dataset NBA.</strong><p>Comprueba que public/data/players.json esté disponible.</p><button className="primary" onClick={()=>window.location.reload()}>Reintentar <RefreshCcw size={15}/></button></div>
  const titles={dashboard:'Inicio',team:'Mi equipo',players:'Jugadores',trade:'Trade Lab',draft:'Draft Room'}
  return <div className="app-shell"><Sidebar page={page} setPage={setPage} collapsed={collapsed} setCollapsed={setCollapsed} user={user} onProfile={()=>setShowProfile(true)}/><main className="main-shell"><Header title={titles[page]} count={page==='players'?count:null} onImport={()=>setShowImport(true)} onSearch={()=>setShowSearch(true)} onNotifications={()=>setShowNotifications(true)} notificationCount={(league?0:1)+watchlist.length}/><div className="content-shell">
    {page==='dashboard'&&<Dashboard players={players} roster={roster} opponentRoster={opponentRoster} league={league} watchlist={watchlist} setPage={setPage} openPlayer={setSelected} toggleWatchlist={toggleWatchlist} onImport={()=>setShowImport(true)} openWatchlist={openWatchlist}/>} 
    {page==='team'&&<TeamPage roster={roster} players={players} league={league} openPlayer={setSelected} onImport={()=>setShowImport(true)} setPage={setPage}/>} 
    {page==='players'&&<PlayersPage players={players} openPlayer={setSelected} watchlist={watchlist} toggleWatchlist={toggleWatchlist} watchlistOnly={watchlistOnly} setWatchlistOnly={setWatchlistOnly}/>} 
    {page==='trade'&&<TradePage players={players} roster={roster} league={league} seedPlayer={tradeSeed} clearSeed={()=>setTradeSeed(null)}/>} 
    {page==='draft'&&<DraftPage players={players} openPlayer={setSelected} league={league} espnAuth={espnAuth} onReconnect={()=>setShowImport(true)}/>} 
  </div><footer><span>BASELINE · H2H 8-CAT</span><span>Datos: {source} · {season} · {count} jugadores</span><span>{league?`ESPN · ${timeAgo(league.syncedAt)}`:'Sin liga conectada'}</span></footer></main><nav className="mobile-nav">{NAV.map(({id,label,icon:Icon})=><button className={page===id?'active':''} onClick={()=>setPage(id)} key={id}><Icon size={19}/><span>{label}</span></button>)}</nav>
    {selected&&<PlayerModal player={selected} season={season} onClose={()=>setSelected(null)} toggleWatchlist={toggleWatchlist} saved={watchlist.includes(String(selected.id))} inRoster={rosterIds.includes(String(selected.id))} toggleRoster={toggleRoster} useTrade={useTrade}/>} 
    {showImport&&<ImportModal players={players} existing={league} onClose={()=>setShowImport(false)} onImported={handleImport}/>} 
    {showSearch&&<SearchModal players={players} onClose={()=>setShowSearch(false)} openPlayer={setSelected} setPage={setPage}/>} 
    {showNotifications&&<NotificationPanel league={league} watchlist={watchlist} season={season} count={count} onClose={()=>setShowNotifications(false)} onImport={()=>{setShowNotifications(false);setShowImport(true)}} openWatchlist={openWatchlist}/>} 
    {showProfile&&<ProfileModal user={user} setUser={setUser} onClose={()=>setShowProfile(false)}/>} 
  </div>
}
