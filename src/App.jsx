import { useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowDownRight, ArrowLeftRight, ArrowRight, ArrowUpRight, Bell, Check,
  ChevronDown, ChevronLeft, ChevronRight, CircleUserRound, Crown, Gauge, Info,
  LayoutDashboard, Menu, MoreHorizontal, Plus, RefreshCcw, Search, SlidersHorizontal,
  Sparkles, Star, Target, Trophy, Upload, Users, X, Zap,
} from 'lucide-react'
import { fallbackPlayers } from './data/fallbackPlayers'

const NAV = [
  { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
  { id: 'team', label: 'Mi equipo', icon: Users },
  { id: 'players', label: 'Jugadores', icon: Search },
  { id: 'trade', label: 'Trade Lab', icon: ArrowLeftRight, badge: 'BETA' },
  { id: 'draft', label: 'Draft Room', icon: Trophy },
]

const CATEGORY_META = [
  ['pts', 'PTS'], ['reb', 'REB'], ['ast', 'AST'], ['stl', 'STL'], ['blk', 'BLK'],
  ['threeMade', '3PM'], ['fgPct', 'FG%'], ['ftPct', 'FT%'], ['tov', 'TO'],
]

const STRATEGIES = [
  { id: 'balanced', name: 'Balance total', kicker: 'Recomendado', copy: 'Valor sólido en las 9 categorías sin debilidades estructurales.', icon: Target },
  { id: 'punt-ft', name: 'Punt FT%', kicker: 'Big men', copy: 'Prioriza rebotes, tapones, FG% y volumen interior.', icon: Gauge },
  { id: 'small-ball', name: 'Small ball', kicker: 'Guard-heavy', copy: 'Maximiza triples, asistencias, robos y tiros libres.', icon: Zap },
  { id: 'punt-ast', name: 'Punt AST', kicker: 'Eficiencia', copy: 'Reduce el costo de bases élite y domina porcentajes y pérdidas.', icon: Activity },
]

const TEAM_COLORS = {
  ATL:'#e03a3e', BOS:'#007a33', BKN:'#111', CHA:'#1d1160', CHI:'#ce1141', CLE:'#6f263d', DAL:'#00538c', DEN:'#0e2240',
  DET:'#c8102e', GS:'#1d428a', HOU:'#ce1141', IND:'#002d62', LAC:'#c8102e', LAL:'#552583', MEM:'#5d76a9', MIA:'#98002e',
  MIL:'#00471b', MIN:'#0c2340', NO:'#0c2340', NY:'#f58426', OKC:'#007ac1', ORL:'#0077c0', PHI:'#006bb6', PHX:'#1d1160',
  POR:'#e03a3e', SAC:'#5a2d81', SA:'#8a8d8f', TOR:'#ce1141', UTAH:'#002b5c', WSH:'#002b5c', FA:'#777',
}

function usePlayerData() {
  const [data, setData] = useState({ players: fallbackPlayers, season: '2025-26', count: fallbackPlayers.length, source: 'Vista local' })
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch('/data/players.json')
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((payload) => setData(payload))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])
  return { ...data, loading }
}

const fmt = (value, digits = 1) => Number(value || 0).toFixed(digits)
const initials = (name = '') => name.split(' ').map((part) => part[0]).slice(0, 2).join('')

function PlayerPhoto({ player, size = 'md' }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className={`player-photo ${size}`} style={{ '--team': TEAM_COLORS[player.team] || '#777' }}>
      {!failed && player.headshot ? (
        <img src={player.headshot} alt={player.name} onError={() => setFailed(true)} />
      ) : <span>{initials(player.name)}</span>}
    </div>
  )
}

function Logo({ compact = false }) {
  return (
    <div className="brand" aria-label="Baseline">
      <div className="brand-mark"><span></span><span></span></div>
      {!compact && <div><strong>BASELINE</strong><small>FANTASY INTELLIGENCE</small></div>}
    </div>
  )
}

function Sidebar({ page, setPage, collapsed, setCollapsed }) {
  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-top">
        <Logo compact={collapsed} />
        <button className="collapse-button" onClick={() => setCollapsed(!collapsed)} aria-label="Contraer menú">
          <ChevronLeft size={17} />
        </button>
      </div>
      <nav>
        <span className="nav-eyebrow">ANÁLISIS</span>
        {NAV.map(({ id, label, icon: Icon, badge }) => (
          <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)} title={label}>
            <Icon size={19} strokeWidth={2} />
            <span>{label}</span>{badge && <em>{badge}</em>}
          </button>
        ))}
      </nav>
      <div className="sidebar-callout">
        <Sparkles size={20} />
        {!collapsed && <><strong>Baseline Pro</strong><p>Proyecciones avanzadas y alertas en vivo.</p><button>Explorar Pro <ArrowRight size={14} /></button></>}
      </div>
      <div className="user-mini">
        <div className="avatar">JD</div>
        {!collapsed && <div><strong>Javier Díaz</strong><span>League Manager</span></div>}
        {!collapsed && <MoreHorizontal size={18} />}
      </div>
    </aside>
  )
}

function Header({ title, count, onImport, onSearch }) {
  return (
    <header className="topbar">
      <div className="mobile-logo"><Logo compact /></div>
      <div className="topbar-title"><h2>{title}</h2>{count && <span>{count} jugadores</span>}</div>
      <button className="global-search" onClick={onSearch}><Search size={18} /><span>Buscar jugador, equipo...</span><kbd>⌘ K</kbd></button>
      <button className="icon-button notification"><Bell size={19} /><i /></button>
      <button className="import-button" onClick={onImport}><Upload size={17} /> Importar ESPN</button>
    </header>
  )
}

function SectionHeading({ eyebrow, title, description, action }) {
  return (
    <div className="section-heading">
      <div><span>{eyebrow}</span><h2>{title}</h2>{description && <p>{description}</p>}</div>
      {action}
    </div>
  )
}

function Dashboard({ players, setPage, openPlayer, roster }) {
  const leaders = players.slice(0, 5)
  const opportunities = players.filter((p) => p.gp > 20 && p.value > 70).slice(7, 11)
  return (
    <div className="page dashboard-page">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><i /> SEMANA 18 · EN VIVO</span>
          <h1>Tu ventaja,<br/><em>cuantificada.</em></h1>
          <p>Decisiones más inteligentes. Trades más justos.<br/>Una ruta clara hacia el campeonato.</p>
          <div className="hero-actions">
            <button className="primary" onClick={() => setPage('trade')}>Analizar un trade <ArrowRight size={17} /></button>
            <button className="text-button" onClick={() => setPage('players')}>Explorar jugadores <ChevronRight size={16} /></button>
          </div>
        </div>
        <div className="hero-visual">
          <div className="rank-ring"><span>POWER RANK</span><strong>#2</strong><small>↑ 1 esta semana</small></div>
          {leaders.slice(0,3).map((player, index) => (
            <div className={`floating-player fp-${index + 1}`} key={player.id}>
              <PlayerPhoto player={player} size="lg" />
            </div>
          ))}
          <div className="hero-grid"></div>
        </div>
      </section>

      <section className="metric-grid">
        <div className="metric-card dark">
          <div className="metric-head"><span>MI RÉCORD</span><span className="positive"><ArrowUpRight size={14}/> 12%</span></div>
          <strong>8—4</strong><p>2do de 12 equipos</p>
          <div className="record-dots">{Array.from({length:12},(_,i)=><i className={i<8?'win':'loss'} key={i}/>)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-head"><span>PROYECCIÓN SEMANAL</span><Activity size={18}/></div>
          <strong>6—3</strong><p>vs. Santurce Ballers</p>
          <div className="mini-progress"><span style={{width:'68%'}} /></div>
          <small>68% probabilidad de ganar</small>
        </div>
        <div className="metric-card">
          <div className="metric-head"><span>VALOR DEL EQUIPO</span><Crown size={18}/></div>
          <strong>842</strong><p>Fantasy Value total</p>
          <div className="comparison"><span>Promedio de liga</span><b>766</b></div>
        </div>
        <div className="metric-card accent">
          <div className="metric-head"><span>OPORTUNIDADES</span><Zap size={18}/></div>
          <strong>4</strong><p>Movimientos recomendados</p>
          <button onClick={() => setPage('players')}>Ver recomendaciones <ArrowRight size={15}/></button>
        </div>
      </section>

      <section className="dashboard-columns">
        <div className="surface matchup-card">
          <div className="card-title-row">
            <div><span>PROYECCIÓN · SEMANA 18</span><h3>Tu matchup</h3></div>
            <button>9 CAT <ChevronDown size={14}/></button>
          </div>
          <div className="matchup-teams">
            <div className="matchup-team"><div className="team-avatar orange">JD</div><div><strong>Baseline Club</strong><span>8—4 · #2</span></div></div>
            <div className="score-prediction"><small>PROYECTADO</small><strong>6 <em>—</em> 3</strong></div>
            <div className="matchup-team opponent"><div><strong>Santurce Ballers</strong><span>7—5 · #4</span></div><div className="team-avatar black">SB</div></div>
          </div>
          <div className="category-list">
            {[
              ['PTS',724,689,64],['REB',286,312,48],['AST',198,174,61],['STL',43,39,57],['BLK',31,36,46],['3PM',82,71,63],['FG%',49.2,47.8,59],['FT%',81.4,83.1,46],['TO',89,104,60],
            ].map(([label,a,b,width])=><div className="category-row" key={label}>
              <b className={a>b || label==='TO'&&a<b?'winner':''}>{a}{String(label).includes('%')?'%':''}</b>
              <div><span>{label}</span><div className="duel-bar"><i style={{width:`${width}%`}}/><em/></div></div>
              <b className={b>a || label==='TO'&&b<a?'winner':''}>{b}{String(label).includes('%')?'%':''}</b>
            </div>)}
          </div>
          <button className="full-text-button" onClick={() => setPage('team')}>Ver matchup completo <ArrowRight size={15}/></button>
        </div>

        <div className="surface roster-snapshot">
          <div className="card-title-row"><div><span>MI EQUIPO</span><h3>Núcleo del roster</h3></div><button onClick={() => setPage('team')}>Ver todos</button></div>
          <div className="roster-list">
            {roster.slice(0, 6).map((player,index)=><button className="roster-row" key={player.id} onClick={() => openPlayer(player)}>
              <span className="rank">{String(index+1).padStart(2,'0')}</span><PlayerPhoto player={player}/>
              <div className="player-name"><strong>{player.name}</strong><span>{player.team} · {player.position}</span></div>
              <div className="player-form"><span>{index%3===1?'TREND':'VALUE'}</span><strong className={index%3===1?'down':''}>{index%3===1?'−2.4%':player.value}</strong></div>
              <ChevronRight size={16}/>
            </button>)}
          </div>
        </div>
      </section>

      <section className="surface market-section">
        <SectionHeading eyebrow="MERCADO" title="Oportunidades que otros no ven." description="Jugadores con tendencia positiva y disponibilidad estimada." action={<button className="outline-button" onClick={()=>setPage('players')}>Ver todos <ArrowRight size={15}/></button>} />
        <div className="opportunity-grid">
          {opportunities.map((player,index)=><button className="opportunity-card" key={player.id} onClick={()=>openPlayer(player)}>
            <div className="opp-top"><span className="availability">{68-index*7}% DISP.</span><span className="trend"><ArrowUpRight size={13}/> {8+index*3}%</span></div>
            <PlayerPhoto player={player} size="xl" />
            <h3>{player.name}</h3><p>{player.team} · {player.position}</p>
            <div className="stat-triplet"><div><span>PTS</span><b>{fmt(player.pts)}</b></div><div><span>REB</span><b>{fmt(player.reb)}</b></div><div><span>AST</span><b>{fmt(player.ast)}</b></div></div>
            <div className="add-player"><Plus size={16}/> Añadir a watchlist</div>
          </button>)}
        </div>
      </section>
    </div>
  )
}

function PlayersPage({ players, openPlayer, watchlist, toggleWatchlist }) {
  const [query, setQuery] = useState('')
  const [position, setPosition] = useState('TODOS')
  const [sort, setSort] = useState('value')
  const [limit, setLimit] = useState(25)
  const positions = ['TODOS','PG','SG','SF','PF','C','G','F']
  const filtered = useMemo(() => players
    .filter((player) => !query || `${player.name} ${player.team}`.toLowerCase().includes(query.toLowerCase()))
    .filter((player) => position === 'TODOS' || player.position?.includes(position))
    .sort((a,b) => Number(b[sort]||0)-Number(a[sort]||0)), [players, query, position, sort])
  return (
    <div className="page players-page">
      <SectionHeading eyebrow="PLAYER INDEX" title="Conoce el valor real." description="Estadísticas de temporada, valor fantasy y tendencias de toda la NBA." />
      <div className="filter-bar">
        <label className="search-input"><Search size={18}/><input placeholder="Buscar por jugador o equipo" value={query} onChange={e=>{setQuery(e.target.value);setLimit(25)}}/>{query&&<button onClick={()=>setQuery('')}><X size={15}/></button>}</label>
        <div className="position-pills">{positions.map(item=><button className={position===item?'active':''} onClick={()=>setPosition(item)} key={item}>{item}</button>)}</div>
        <button className="filter-button"><SlidersHorizontal size={17}/> Filtros <span>2</span></button>
      </div>
      <div className="table-meta"><span>Mostrando <b>{Math.min(limit,filtered.length)}</b> de <b>{filtered.length}</b> jugadores</span><div>Ordenar por <select value={sort} onChange={e=>setSort(e.target.value)}><option value="value">Fantasy Value</option><option value="pts">Puntos</option><option value="reb">Rebotes</option><option value="ast">Asistencias</option><option value="stl">Robos</option><option value="blk">Tapones</option></select></div></div>
      <div className="surface players-table-wrap">
        <table className="players-table">
          <thead><tr><th>#</th><th>JUGADOR</th><th>GP</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>FG%</th><th>FT%</th><th>VALOR</th><th></th></tr></thead>
          <tbody>{filtered.slice(0,limit).map((player,index)=><tr key={player.id} onClick={()=>openPlayer(player)}>
            <td>{index+1}</td><td><div className="table-player"><PlayerPhoto player={player}/><div><strong>{player.name}</strong><span>{player.team} · {player.position}</span></div></div></td>
            <td>{player.gp}</td><td>{fmt(player.min)}</td><td><b>{fmt(player.pts)}</b></td><td>{fmt(player.reb)}</td><td>{fmt(player.ast)}</td><td>{fmt(player.stl)}</td><td>{fmt(player.blk)}</td><td>{fmt(player.fgPct)}%</td><td>{fmt(player.ftPct)}%</td>
            <td><div className={`value-chip ${player.value>89?'elite':player.value>74?'strong':''}`}>{player.value}</div></td>
            <td><button className={`star-button ${watchlist.includes(player.id)?'saved':''}`} onClick={e=>{e.stopPropagation();toggleWatchlist(player.id)}}><Star size={17} fill={watchlist.includes(player.id)?'currentColor':'none'}/></button></td>
          </tr>)}</tbody>
        </table>
        {limit<filtered.length&&<button className="load-more" onClick={()=>setLimit(limit+25)}>Cargar 25 más <ChevronDown size={16}/></button>}
      </div>
    </div>
  )
}

function TeamPage({ roster, openPlayer, onImport }) {
  const totalValue = roster.reduce((sum,p)=>sum+p.value,0)
  return (
    <div className="page team-page">
      <div className="team-hero">
        <div><span className="eyebrow">MI EQUIPO · ESPN</span><h1>Baseline Club</h1><p>San Juan H2H · 9 categorías · 12 equipos</p></div>
        <div className="team-record"><span>RÉCORD</span><strong>8—4</strong><small>2do lugar</small></div>
        <div className="team-record"><span>VALOR</span><strong>{totalValue}</strong><small>Top 11% liga</small></div>
        <button className="outline-button light" onClick={onImport}><RefreshCcw size={16}/> Sincronizar ESPN</button>
      </div>
      <section className="team-insights">
        <div className="surface strength-card"><span>PERFIL DEL EQUIPO</span><h3>Fortalezas y debilidades</h3>
          {[['PTS',88,'strong'],['AST',84,'strong'],['3PM',79,'strong'],['STL',68,''],['FT%',61,''],['REB',48,''],['BLK',37,'weak'],['FG%',34,'weak']].map(([name,value,type])=><div className="strength-row" key={name}><b>{name}</b><div><i className={type} style={{width:`${value}%`}}/></div><span>{value}</span></div>)}
        </div>
        <div className="surface recommendation-card"><div className="insight-icon"><Sparkles size={21}/></div><span>BASELINE INSIGHT</span><h3>Necesitas presencia interior.</h3><p>Tu roster está en el percentil 34 de FG% y 37 de tapones. Un interior eficiente puede convertir dos categorías perdidas.</p><button>Ver objetivos de trade <ArrowRight size={15}/></button></div>
      </section>
      <section className="roster-section">
        <div className="card-title-row"><div><span>ROSTER ACTIVO</span><h3>{roster.length} jugadores</h3></div><div className="last-sync"><i/> Sincronizado hace 4 min</div></div>
        <div className="roster-grid">{roster.map((player,index)=><button className="team-player-card" onClick={()=>openPlayer(player)} key={player.id}>
          <div className="slot">{['PG','SG','SF','PF','C','G','F','UTIL','UTIL','BE','BE','BE'][index]||'IR'}</div>
          <PlayerPhoto player={player} size="xl"/><div className="team-card-copy"><span>{player.team} · {player.position}</span><h3>{player.name}</h3></div>
          <div className="card-value"><span>VALUE</span><strong>{player.value}</strong></div>
          <div className="stat-triplet"><div><span>PTS</span><b>{fmt(player.pts)}</b></div><div><span>REB</span><b>{fmt(player.reb)}</b></div><div><span>AST</span><b>{fmt(player.ast)}</b></div></div>
          <div className="next-game"><span><i style={{background:TEAM_COLORS[player.team]}}/> {index%2?'vs':'@'} {['BOS','MIA','LAL','DEN'][index%4]}</span><b>{index%3? 'Hoy 7:30':'Mañana'}</b></div>
        </button>)}</div>
      </section>
    </div>
  )
}

function PlayerPicker({ label, selected, setSelected, players, exclude }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const current = players.find(p=>p.id===selected)
  const matches = players.filter(p=>p.id!==exclude && (!query || p.name.toLowerCase().includes(query.toLowerCase()))).slice(0,8)
  return <div className="player-picker"><span>{label}</span>
    <button className="picker-selected" onClick={()=>setOpen(!open)}>{current?<><PlayerPhoto player={current}/><div><strong>{current.name}</strong><small>{current.team} · {current.position} · VAL {current.value}</small></div><ChevronDown size={16}/></>:<><Plus size={18}/> Seleccionar jugador</>}</button>
    {open&&<div className="picker-menu"><label><Search size={15}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar jugador..."/></label>{matches.map(player=><button key={player.id} onClick={()=>{setSelected(player.id);setOpen(false);setQuery('')}}><PlayerPhoto player={player}/><div><strong>{player.name}</strong><span>{player.team} · {player.position}</span></div><b>{player.value}</b></button>)}</div>}
  </div>
}

function TradePage({ players }) {
  const [left, setLeft] = useState(players[6]?.id || players[0]?.id)
  const [right, setRight] = useState(players[4]?.id || players[1]?.id)
  const [analyzed, setAnalyzed] = useState(false)
  useEffect(()=>{if(!players.some(p=>p.id===left)) setLeft(players[6]?.id||players[0]?.id);if(!players.some(p=>p.id===right)) setRight(players[4]?.id||players[1]?.id)},[players])
  const a=players.find(p=>p.id===left)||players[0], b=players.find(p=>p.id===right)||players[1]
  const difference=(b?.value||0)-(a?.value||0)
  const fairness=Math.max(55,100-Math.abs(difference)*3)
  const impacts=CATEGORY_META.map(([key,label])=>({label,diff:Number((Number(b?.[key]||0)-Number(a?.[key]||0)).toFixed(1)), lower:key==='tov'}))
  const winsBefore=5, winsAfter=Math.max(2,Math.min(8,winsBefore+impacts.filter(x=>x.lower?x.diff<0:x.diff>0).length-4))
  return <div className="page trade-page">
    <SectionHeading eyebrow="TRADE LAB · BETA" title="Ve el trade antes de hacerlo." description="Compara valor, necesidades y el efecto real en tu temporada." action={<button className="outline-button"><RefreshCcw size={15}/> Reiniciar</button>}/>
    <section className="trade-builder surface">
      <div className="trade-side"><div className="trade-side-heading"><div className="team-avatar orange">TU</div><div><span>RECIBE</span><strong>Baseline Club</strong></div></div><PlayerPicker label="JUGADOR" selected={right} setSelected={setRight} players={players} exclude={left}/><button className="add-piece"><Plus size={16}/> Añadir jugador o pick</button></div>
      <div className="trade-center"><button onClick={()=>{setLeft(right);setRight(left)}}><ArrowLeftRight size={22}/></button><span>TRADE</span></div>
      <div className="trade-side"><div className="trade-side-heading"><div className="team-avatar black">RIV</div><div><span>RECIBE</span><strong>Rival</strong></div></div><PlayerPicker label="JUGADOR" selected={left} setSelected={setLeft} players={players} exclude={right}/><button className="add-piece"><Plus size={16}/> Añadir jugador o pick</button></div>
      <div className="analyze-row"><button className="primary" onClick={()=>setAnalyzed(true)}><Sparkles size={17}/> Analizar este trade</button><p>Basado en ROS, necesidades del roster y 9 categorías</p></div>
    </section>
    <section className={`trade-results ${analyzed?'revealed':''}`}>
      <div className="surface verdict-card">
        <div className="verdict-top"><div><span>VEREDICTO BASELINE</span><h2>{difference>5?'Trade favorable':difference<-5?'Pide un poco más':'Trade equilibrado'}</h2><p>{difference>=0?`Ganas ${Math.abs(difference)} puntos de valor y mejoras la construcción de tu roster.`:`Cedes ${Math.abs(difference)} puntos de valor, pero puedes ganar categorías de necesidad.`}</p></div><div className="grade"><span>NOTA</span><strong>{difference>5?'A':difference>=-3?'B+':'C+'}</strong></div></div>
        <div className="fairness"><div><span>Equidad del trade</span><b>{fairness}%</b></div><div className="fairness-bar"><i style={{width:`${fairness}%`}}/><em/></div><small>La zona óptima para ambos equipos es 85–100%</small></div>
        <div className="value-exchange"><div><PlayerPhoto player={b}/><div><span>RECIBES</span><strong>{b?.name}</strong></div><b>{b?.value}</b></div><ArrowRight size={22}/><div><PlayerPhoto player={a}/><div><span>ENTREGAS</span><strong>{a?.name}</strong></div><b>{a?.value}</b></div></div>
      </div>
      <div className="surface impact-card"><div className="card-title-row"><div><span>IMPACTO 9-CAT</span><h3>Cambio por categoría</h3></div><Info size={17}/></div><div className="impact-list">{impacts.map(item=>{const good=item.lower?item.diff<0:item.diff>0;return <div key={item.label}><b>{item.label}</b><div className="impact-axis"><i className={!good?'negative':''} style={{width:`${Math.min(50,Math.abs(item.diff)*3+6)}%`,left:good?'50%':`${50-Math.min(50,Math.abs(item.diff)*3+6)}%`}}/></div><span className={good?'positive':'negative'}>{item.diff>0?'+':''}{item.diff}</span></div>})}</div></div>
      <div className="surface scenario-card"><div className="card-title-row"><div><span>SIMULADOR DE ESCENARIO</span><h3>Si el trade ya hubiera ocurrido</h3></div><span className="pill">TEMPORADA COMPLETA</span></div><div className="record-comparison"><div><span>RÉCORD ACTUAL</span><strong>8—4</strong><small>66.7% victorias</small></div><ArrowRight size={24}/><div className="projected"><span>RÉCORD PROYECTADO</span><strong>{8+(winsAfter-winsBefore)}—{4-(winsAfter-winsBefore)}</strong><small><ArrowUpRight size={13}/> +{Math.max(1,(winsAfter-winsBefore)*3.2).toFixed(1)}% probabilidad</small></div></div><div className="week-chart"><div className="chart-labels"><span>W1</span><span>W4</span><span>W8</span><span>W12</span><span>W16</span><span>HOY</span></div><svg viewBox="0 0 620 130" preserveAspectRatio="none"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff5a1f" stopOpacity=".24"/><stop offset="1" stopColor="#ff5a1f" stopOpacity="0"/></linearGradient></defs><path className="area" d="M0,112 C60,105 70,90 125,92 S190,68 250,73 S320,48 380,55 S450,29 505,38 S575,15 620,20 L620,130 L0,130Z"/><path d="M0,112 C60,105 70,90 125,92 S190,68 250,73 S320,48 380,55 S450,29 505,38 S575,15 620,20"/><path className="baseline" d="M0,112 C80,100 110,98 160,102 S250,82 310,85 S420,67 485,73 S560,60 620,58"/></svg><div className="legend"><span><i/> Con trade</span><span><i/> Actual</span></div></div></div>
    </section>
  </div>
}

function strategyScore(player, strategy) {
  const base=player.value
  if(strategy==='punt-ft') return base+player.reb*1.2+player.blk*4+player.fgPct*.12-player.ftPct*.05
  if(strategy==='small-ball') return base+player.ast*1.4+player.stl*3+player.threeMade*3+player.ftPct*.08
  if(strategy==='punt-ast') return base+player.reb*.8+player.blk*3+player.fgPct*.1-player.ast*.25-player.tov*.8
  return base
}

function DraftPage({ players, openPlayer }) {
  const [strategy,setStrategy]=useState('balanced')
  const [round,setRound]=useState(3)
  const [drafted,setDrafted]=useState([])
  const available=useMemo(()=>players.filter(p=>!drafted.includes(p.id)).sort((a,b)=>strategyScore(b,strategy)-strategyScore(a,strategy)),[players,strategy,drafted])
  return <div className="page draft-page">
    <div className="draft-header"><div><span className="eyebrow">DRAFT ROOM</span><h1>Construye con intención.</h1><p>Recomendaciones dinámicas que se adaptan a cada pick.</p></div><div className="draft-status"><span>MOCK DRAFT · PICK</span><strong>{round}.06</strong><button onClick={()=>{setDrafted([]);setRound(1)}}><RefreshCcw size={15}/> Reiniciar</button></div></div>
    <section className="strategy-section"><SectionHeading eyebrow="01 · ELIGE TU PLAN" title="Estrategia de construcción"/><div className="strategy-grid">{STRATEGIES.map(({id,name,kicker,copy,icon:Icon})=><button className={`strategy-card ${strategy===id?'active':''}`} onClick={()=>setStrategy(id)} key={id}><div><Icon size={21}/>{strategy===id&&<span className="check"><Check size={13}/></span>}</div><span>{kicker}</span><h3>{name}</h3><p>{copy}</p></button>)}</div></section>
    <section className="draft-layout">
      <div className="surface draft-board"><div className="card-title-row"><div><span>02 · MEJORES DISPONIBLES</span><h3>Tu board dinámico</h3></div><div className="board-filters"><button>Todos <ChevronDown size={14}/></button><button><SlidersHorizontal size={15}/></button></div></div>
        <div className="draft-recommendation"><Sparkles size={18}/><div><strong>Recomendación para el pick {round}.06</strong><p>{strategy==='balanced'?'Prioriza valor sin abrir una debilidad nueva.':`Tu estrategia ${STRATEGIES.find(s=>s.id===strategy)?.name} sube jugadores complementarios en el board.`}</p></div></div>
        <div className="draft-list">{available.slice(0,10).map((player,index)=><div className="draft-row" key={player.id}><span className="draft-rank">{index+1}</span><button className="draft-player" onClick={()=>openPlayer(player)}><PlayerPhoto player={player}/><div><strong>{player.name}</strong><span>{player.team} · {player.position}</span></div></button><div className="fit-score"><span>FIT</span><b>{Math.min(99,Math.round(strategyScore(player,strategy)))}</b></div><div className="category-tags"><span>{player.pts>23?'PTS':player.reb>8?'REB':'EFF'}</span><span>{player.ast>6?'AST':player.blk>1.2?'BLK':'VALUE'}</span></div><button className="draft-button" onClick={()=>{setDrafted([...drafted,player.id]);setRound(round+1)}}>Draftear</button></div>)}</div>
      </div>
      <aside className="draft-sidebar"><div className="surface build-card"><span>TU CONSTRUCCIÓN</span><h3>Perfil proyectado</h3><div className="radar-wrap"><svg viewBox="0 0 220 200"><g className="radar-grid"><polygon points="110,12 196,62 175,160 45,160 24,62"/><polygon points="110,38 172,74 157,143 63,143 48,74"/><polygon points="110,67 144,86 136,124 84,124 76,86"/><line x1="110" y1="12" x2="110" y2="110"/><line x1="196" y1="62" x2="110" y2="110"/><line x1="175" y1="160" x2="110" y2="110"/><line x1="45" y1="160" x2="110" y2="110"/><line x1="24" y1="62" x2="110" y2="110"/></g><polygon className="radar-value" points={strategy==='small-ball'?'110,28 182,70 145,145 64,144 35,67':strategy==='punt-ft'?'110,18 165,78 170,156 65,145 48,76':'110,28 174,72 162,147 58,151 40,68'}/></svg><span className="r-top">PTS</span><span className="r-right">AST</span><span className="r-bottom-right">STL</span><span className="r-bottom-left">REB</span><span className="r-left">%</span></div><div className="build-summary"><span><i className="good"/>3 fortalezas</span><span><i/>1 neutral</span><span><i className="bad"/>1 riesgo</span></div></div>
        <div className="surface drafted-card"><div className="card-title-row"><div><span>TUS PICKS</span><h3>{drafted.length} seleccionados</h3></div></div>{drafted.length===0?<div className="empty-picks"><Trophy size={25}/><p>Tus picks aparecerán aquí y ajustarán el board.</p></div>:drafted.map((id,index)=>{const p=players.find(x=>x.id===id);return <div className="picked-player" key={id}><span>{index+1}</span><PlayerPhoto player={p}/><div><strong>{p.name}</strong><small>{p.position} · {p.team}</small></div><button onClick={()=>setDrafted(drafted.filter(x=>x!==id))}><X size={14}/></button></div>})}</div>
      </aside>
    </section>
  </div>
}

function PlayerModal({ player, onClose, toggleWatchlist, saved }) {
  if(!player)return null
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="player-modal" onMouseDown={e=>e.stopPropagation()}>
    <button className="modal-close" onClick={onClose}><X size={19}/></button>
    <div className="player-modal-hero" style={{'--team':TEAM_COLORS[player.team]||'#555'}}><div className="player-modal-copy"><span>{player.teamName||player.team} · {player.position}</span><h2>{player.name}</h2><div><span className="status-dot"/> Activo <em>•</em> {player.age?`${player.age} años`:'NBA'}</div></div><PlayerPhoto player={player} size="hero"/><div className="modal-rating"><span>FANTASY VALUE</span><strong>{player.value}</strong><small>Top {Math.max(1,100-player.value)}%</small></div></div>
    <div className="modal-content"><div className="modal-actions"><button className={saved?'saved':''} onClick={()=>toggleWatchlist(player.id)}><Star size={16} fill={saved?'currentColor':'none'}/> {saved?'En watchlist':'Añadir a watchlist'}</button><button><ArrowLeftRight size={16}/> Usar en Trade Lab</button></div>
      <div className="season-line"><div><span>TEMPORADA 2025–26</span><b>{player.gp} GP · {fmt(player.min)} MIN</b></div><span className="positive"><ArrowUpRight size={13}/> ROS estable</span></div>
      <div className="modal-stats">{CATEGORY_META.map(([key,label])=><div key={key}><span>{label}</span><strong>{fmt(player[key])}{key.includes('Pct')?'%':''}</strong><small>{['pts','ast','stl'].includes(key)?'↑ sobre media':'promedio'}</small></div>)}</div>
      <div className="modal-insight"><Sparkles size={20}/><div><span>BASELINE INSIGHT</span><p><b>{player.name}</b> aporta valor élite en {player.pts>25?'anotación':player.reb>9?'rebotes':'eficiencia'} y encaja mejor en construcciones que {player.ast>7?'protegen FG% alrededor de un creador primario.':'buscan producción consistente sin sacrificar volumen.'}</p></div></div>
    </div>
  </div></div>
}

function ImportModal({ onClose, players, onImported }) {
  const [league,setLeague]=useState('')
  const [team,setTeam]=useState('1')
  const [season,setSeason]=useState('2026')
  const [status,setStatus]=useState('idle')
  const importTeam=async()=>{
    if(!league){setStatus('missing');return}
    setStatus('loading')
    try{
      const url=`/espn-fantasy/apis/v3/games/fba/seasons/${season}/segments/0/leagues/${league}?view=mRoster&view=mTeam`
      const response=await fetch(url)
      if(!response.ok)throw new Error()
      const data=await response.json()
      const sourceTeam=data.teams?.find(item=>String(item.id)===String(team))
      const ids=sourceTeam?.roster?.entries?.map(entry=>String(entry.playerPoolEntry?.player?.id)).filter(Boolean)||[]
      const matched=players.filter(player=>ids.includes(String(player.id)))
      if(!matched.length)throw new Error()
      onImported(matched);setStatus('success');setTimeout(onClose,800)
    }catch{setStatus('error')}
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="import-modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={onClose}><X size={19}/></button><div className="espn-mark">E</div><span>CONECTA TU LIGA</span><h2>Importar desde ESPN</h2><p>Usa una liga pública para sincronizar tu roster. No necesitas copiar cada jugador.</p><label><span>LEAGUE ID</span><input value={league} onChange={e=>setLeague(e.target.value)} placeholder="Ej. 12345678"/></label><div className="import-fields"><label><span>TEAM ID</span><input value={team} onChange={e=>setTeam(e.target.value)}/></label><label><span>TEMPORADA</span><select value={season} onChange={e=>setSeason(e.target.value)}><option value="2026">2025–26</option><option value="2025">2024–25</option></select></label></div>{status==='missing'&&<div className="form-message error">Escribe el ID de tu liga.</div>}{status==='error'&&<div className="form-message error">No pudimos leer la liga. Verifica que sea pública y que los IDs sean correctos.</div>}{status==='success'&&<div className="form-message success"><Check size={15}/> Equipo sincronizado.</div>}<button className="primary import-submit" onClick={importTeam} disabled={status==='loading'}>{status==='loading'?<><RefreshCcw className="spin" size={17}/> Conectando...</>:<>Importar mi equipo <ArrowRight size={17}/></>}</button><small>Para ligas privadas se requiere autorización de ESPN en una integración de servidor.</small></div></div>
}

function SearchModal({ players, onClose, openPlayer, setPage }) {
  const [query,setQuery]=useState('')
  const results=players.filter(p=>!query||`${p.name} ${p.team}`.toLowerCase().includes(query.toLowerCase())).slice(0,8)
  useEffect(()=>{const fn=e=>e.key==='Escape'&&onClose();window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn)},[onClose])
  return <div className="search-backdrop" onMouseDown={onClose}><div className="command-menu" onMouseDown={e=>e.stopPropagation()}><label><Search size={20}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Busca cualquier jugador..."/><kbd>ESC</kbd></label><span className="command-label">{query?'RESULTADOS':'JUGADORES DESTACADOS'}</span>{results.map(p=><button key={p.id} onClick={()=>{openPlayer(p);onClose()}}><PlayerPhoto player={p}/><div><strong>{p.name}</strong><span>{p.team} · {p.position}</span></div><b>{p.value}</b><ChevronRight size={15}/></button>)}<div className="command-footer"><button onClick={()=>{setPage('players');onClose()}}>Ver todos los jugadores <ArrowRight size={14}/></button><span>↑↓ para navegar</span></div></div></div>
}

export default function App() {
  const { players, season, count, source, loading } = usePlayerData()
  const [page,setPage]=useState('dashboard')
  const [collapsed,setCollapsed]=useState(false)
  const [selected,setSelected]=useState(null)
  const [showImport,setShowImport]=useState(false)
  const [showSearch,setShowSearch]=useState(false)
  const [watchlist,setWatchlist]=useState([])
  const [customRoster,setCustomRoster]=useState(null)
  const roster=customRoster||players.filter((_,index)=>[0,2,6,7,11,15,19,24,31,42,53,68].includes(index)).slice(0,12)
  const titles={dashboard:'Inicio',team:'Mi equipo',players:'Jugadores',trade:'Trade Lab',draft:'Draft Room'}
  const toggleWatchlist=id=>setWatchlist(list=>list.includes(id)?list.filter(item=>item!==id):[...list,id])
  useEffect(()=>{
    const listener=e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setShowSearch(true)}}
    window.addEventListener('keydown',listener);return()=>window.removeEventListener('keydown',listener)
  },[])
  return <div className="app-shell">
    <Sidebar page={page} setPage={setPage} collapsed={collapsed} setCollapsed={setCollapsed}/>
    <main className="main-shell">
      <Header title={titles[page]} count={page==='players'?count:null} onImport={()=>setShowImport(true)} onSearch={()=>setShowSearch(true)}/>
      <div className="content-shell">
        {loading&&<div className="data-loading"><RefreshCcw className="spin" size={14}/> Actualizando datos NBA...</div>}
        {page==='dashboard'&&<Dashboard players={players} setPage={setPage} openPlayer={setSelected} roster={roster}/>} 
        {page==='team'&&<TeamPage roster={roster} openPlayer={setSelected} onImport={()=>setShowImport(true)}/>} 
        {page==='players'&&<PlayersPage players={players} openPlayer={setSelected} watchlist={watchlist} toggleWatchlist={toggleWatchlist}/>} 
        {page==='trade'&&<TradePage players={players}/>} 
        {page==='draft'&&<DraftPage players={players} openPlayer={setSelected}/>} 
      </div>
      <footer><span>BASELINE · NBA FANTASY ANALYZER</span><span>Datos: {source} · {season} · {count} jugadores</span><span>Actualización local</span></footer>
    </main>
    <nav className="mobile-nav">{NAV.map(({id,label,icon:Icon})=><button className={page===id?'active':''} onClick={()=>setPage(id)} key={id}><Icon size={19}/><span>{label}</span></button>)}</nav>
    {selected&&<PlayerModal player={selected} onClose={()=>setSelected(null)} toggleWatchlist={toggleWatchlist} saved={watchlist.includes(selected.id)}/>} 
    {showImport&&<ImportModal players={players} onClose={()=>setShowImport(false)} onImported={setCustomRoster}/>} 
    {showSearch&&<SearchModal players={players} onClose={()=>setShowSearch(false)} openPlayer={setSelected} setPage={setPage}/>} 
  </div>
}
