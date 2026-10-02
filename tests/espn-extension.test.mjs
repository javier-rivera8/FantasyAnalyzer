import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { createDraft, draftSlot, validDraft } from '../src/draftModel.mjs'
import { syncEspnSnapshot, validateEspnSnapshot } from '../src/espnExtensionSync.mjs'

const fixture = JSON.parse(await readFile(new URL('./fixtures/espn-draft-snapshot.json', import.meta.url)))
const { players } = JSON.parse(await readFile(new URL('../public/data/players.json', import.meta.url)))
const parserContext = vm.createContext({ URL })
vm.runInContext(await readFile(new URL('../extensions/espn-baseline/espn-parser.js', import.meta.url), 'utf8'), parserContext)
const parse = parserContext.BaselineEspnParser.readEspnDraft
const partial = picks => ({ ...fixture, picks, completeHistory: false })
const full = picks => ({ ...fixture, picks, completeHistory: true })

// Model the actual DOM selectors observed in ESPN, including the headshot ID,
// R/P text and roster options with whitespace. This fixture needs no DOM package.
function documentFixture(picks = fixture.picks) {
  const options = fixture.teams.map(team => ({ value: team.id.slice(5), textContent: ` ${team.name}  ` }))
  const cards = picks.map(pick => ({
    querySelector: selector => selector === '.playerinfo__playername' ? { textContent: pick.playerName }
      : selector === '.pick-info' ? { textContent: `R${pick.round}, P${pick.roundPick} -  ${fixture.teams.find(team => team.id === pick.teamId).name} ` } : null,
    querySelectorAll: selector => selector === 'img' ? [{ getAttribute: () => `https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/${pick.playerId}.png&w=96` }] : [],
  }))
  return {
    querySelector: selector => selector === 'h1' ? { textContent: fixture.title } : null,
    querySelectorAll: selector => selector === 'select' ? [{ options }] : selector === '.pick-message__container' ? cards
      : selector === 'option' ? Array.from({ length: 13 }, (_, index) => ({ textContent: `Round ${index + 1}` })) : [],
  }
}
const url = 'https://fantasy.espn.com/basketball/draft?leagueId=1140712594&seasonId=2027&teamId=5&memberId=not-exported'

test('real ESPN DOM shape extracts all 156 selections and ignores memberId', () => {
  const snapshot = parse(documentFixture(), url)
  assert.equal(snapshot.picks.length, 156)
  assert.equal(snapshot.completeHistory, true)
  assert.equal(snapshot.unreadable, 0)
  assert.equal(snapshot.myTeamId, 'espn-5')
  assert.equal(snapshot.picks[0].playerId, '4278073')
  assert.equal(snapshot.picks[14].overall, 15)
  assert.equal(snapshot.picks[14].teamId, 'espn-5')
  assert.ok(!JSON.stringify(snapshot).includes('not-exported'))
  validateEspnSnapshot(snapshot)
})

test('parser only accepts basketball draft URLs with a room and season', () => {
  assert.equal(parse(documentFixture(), 'https://fantasy.espn.com/basketball/mockdraftlobby'), null)
  assert.equal(parse(documentFixture(), 'https://example.com/basketball/draft?leagueId=1&seasonId=2027'), null)
})

test('parser marks missing and empty histories as partial', () => {
  assert.equal(parse(documentFixture(fixture.picks.slice(100)), url).completeHistory, false)
  assert.equal(parse(documentFixture([]), url).completeHistory, false)
})

test('all actual picks import with ESPN teams, IDs and snake order', () => {
  const draft = syncEspnSnapshot(createDraft(), fixture, players)
  assert.equal(draft.picks.length, 156)
  assert.equal(draft.myTeamId, 'espn-5')
  assert.equal(draft.teams.length, 12)
  assert.equal(draft.picks[14].playerName, 'Cooper Flagg')
  assert.equal(draftSlot(draft).completed, true)
  assert.equal(validDraft(draft), true)
  for (const pick of draft.picks) assert.equal(pick.teamId, draftSlot(draft, pick.overall).teamId)
})

test('repeated messages are idempotent', () => {
  const draft = syncEspnSnapshot(createDraft(), fixture, players)
  assert.deepEqual(syncEspnSnapshot(draft, fixture, players), draft)
})

test('late connection catches up and appends exactly once', () => {
  const draft = syncEspnSnapshot(createDraft(), full(fixture.picks.slice(0, 30)), players)
  const next = syncEspnSnapshot(draft, partial(fixture.picks.slice(30, 31)), players)
  assert.equal(next.picks.length, 31)
  assert.deepEqual(syncEspnSnapshot(next, partial(fixture.picks.slice(30, 31)), players), next)
  assert.equal(syncEspnSnapshot(next, fixture, players).picks.length, 156)
})

test('a partial visible history never deletes earlier selections', () => {
  const draft = syncEspnSnapshot(createDraft(), fixture, players)
  assert.deepEqual(syncEspnSnapshot(draft, partial(fixture.picks.slice(140)), players), draft)
  assert.deepEqual(syncEspnSnapshot(draft, partial([]), players), draft)
})

test('out-of-order messages buffer gaps and fill them on reconnect', () => {
  let draft = syncEspnSnapshot(createDraft(), partial([fixture.picks[2]]), players)
  assert.equal(draft.picks.length, 0)
  assert.equal(draft.espnSync.pending, 1)
  draft = syncEspnSnapshot(draft, partial([fixture.picks[0]]), players)
  assert.equal(draft.picks.length, 1)
  assert.equal(draft.espnSync.pending, 1)
  draft = syncEspnSnapshot(draft, partial([fixture.picks[1]]), players)
  assert.equal(draft.picks.length, 3)
  assert.equal(draft.espnSync.pending, 0)
})

test('an authoritative shorter history applies undo and corrections', () => {
  const draft = syncEspnSnapshot(createDraft(), full(fixture.picks.slice(0, 30)), players)
  const undone = syncEspnSnapshot(draft, full(fixture.picks.slice(0, 29)), players)
  assert.equal(undone.picks.length, 29)
  const correction = { ...fixture.picks[29], playerId: '999999999', playerName: 'New player' }
  const corrected = syncEspnSnapshot(undone, full([...fixture.picks.slice(0, 29), correction]), players)
  assert.equal(corrected.picks.at(-1).playerId, '999999999')
})

test('players outside the statistics dataset retain names and picks', () => {
  const draft = syncEspnSnapshot(createDraft(), fixture, [])
  assert.equal(draft.picks.length, 156)
  assert.equal(draft.espnSync.unmatched, 156)
  assert.equal(draft.picks[14].playerName, 'Cooper Flagg')
})

test('accented names match only an unambiguous dataset player', () => {
  const pick = { ...fixture.picks[0], playerId: '', playerName: 'Nikóla Jokić' }
  const draft = syncEspnSnapshot(createDraft(), full([pick]), [{ id: '3112335', name: 'Nikola Jokic' }])
  assert.equal(draft.picks[0].playerId, '3112335')
  assert.equal(draft.picks[0].unmatched, false)
  const ambiguous = syncEspnSnapshot(createDraft(), full([pick]), [{ id: '1', name: 'Nikola Jokic' }, { id: '2', name: 'Nikola Jokic' }])
  assert.equal(ambiguous.picks[0].unmatched, true)
})

test('manual selection of own team survives subsequent sync', () => {
  const draft = { ...syncEspnSnapshot(createDraft(), full(fixture.picks.slice(0, 12)), players), myTeamId: 'espn-11' }
  assert.equal(syncEspnSnapshot(draft, fixture, players).myTeamId, 'espn-11')
})

test('a different draft never inherits previous picks or teams', () => {
  const draft = syncEspnSnapshot(createDraft(), fixture, players)
  const next = syncEspnSnapshot(draft, { ...full(fixture.picks.slice(0, 3)), draftId: '2027:123' }, players)
  assert.equal(next.picks.length, 3)
  assert.equal(next.espnSync.draftId, '2027:123')
})

test('invalid room, duplicate picks, duplicate players and false completeness are rejected', () => {
  assert.throws(() => validateEspnSnapshot({ ...fixture, draftId: 'bad' }))
  assert.throws(() => validateEspnSnapshot(full([fixture.picks[0], fixture.picks[0]])))
  assert.throws(() => validateEspnSnapshot(full([fixture.picks[0], { ...fixture.picks[1], playerId: fixture.picks[0].playerId }])))
  assert.throws(() => validateEspnSnapshot(full(fixture.picks.slice(1))))
  assert.throws(() => validateEspnSnapshot({ ...fixture, order: fixture.order.slice(1) }))
})

test('a failed ESPN connection still preserves a readable history', () => {
  const draft = syncEspnSnapshot(createDraft(), { ...fixture, connectionFailed: true }, players)
  assert.equal(draft.picks.length, 156)
})

async function backgroundHarness() {
  const stored = {}, sent = []
  let listener, removed
  const tabs = new Map([[7, { id: 7, url }], [8, { id: 8, url }], [9, { id: 9, url: 'http://localhost:5173/' }]])
  const chrome = {
    runtime: { getURL: path => `chrome-extension://test/${path}`, onMessage: { addListener: fn => { listener = fn } } },
    storage: { local: {
      get: async keys => Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, stored[key]])),
      set: async values => { Object.assign(stored, values) },
      remove: async keys => { for (const key of Array.isArray(keys) ? keys : [keys]) delete stored[key] },
    } },
    tabs: {
      get: async id => tabs.get(id), query: async () => [tabs.get(9)],
      sendMessage: async (id, message) => { sent.push({ id, message }); return { ok: true } },
      onRemoved: { addListener: fn => { removed = fn } },
    },
  }
  vm.runInContext(await readFile(new URL('../extensions/espn-baseline/background.js', import.meta.url), 'utf8'), vm.createContext({ chrome, URL }))
  const message = (data, sender = { url: 'chrome-extension://test/popup.html' }) => new Promise(resolve => listener(data, sender, resolve))
  return { message, stored, sent, remove: id => removed(id), espn: id => ({ tab: tabs.get(id) }), baseline: { tab: tabs.get(9) } }
}

test('background relays only the explicitly selected ESPN room to Baseline', async () => {
  const bg = await backgroundHarness()
  const payload = { type: 'ESPN_SNAPSHOT', snapshot: fixture }
  assert.equal((await bg.message(payload, bg.espn(7))).ok, false)
  assert.equal((await bg.message({ type: 'POPUP_START', tabId: 7 })).ok, true)
  assert.equal((await bg.message(payload, bg.espn(8))).ok, false)
  assert.equal((await bg.message(payload, bg.espn(7))).ok, true)
  assert.equal(bg.stored.snapshot.picks.length, 156)
  assert.ok(bg.sent.some(item => item.id === 9 && item.message.type === 'BASELINE_SNAPSHOT' && item.message.snapshot?.picks.length === 156))
  const read = await bg.message({ type: 'BASELINE_GET' }, bg.baseline)
  assert.equal(read.active, true)
  assert.equal(read.snapshot.picks.length, 156)
})

test('background rejects commands from webpages and cross-room snapshots', async () => {
  const bg = await backgroundHarness()
  assert.equal((await bg.message({ type: 'POPUP_START', tabId: 7 }, bg.baseline)).ok, false)
  await bg.message({ type: 'POPUP_START', tabId: 7 })
  assert.equal((await bg.message({ type: 'ESPN_SNAPSHOT', snapshot: { ...fixture, draftId: '2027:123' } }, bg.espn(7))).ok, false)
  assert.equal((await bg.message({ type: 'BASELINE_GET' }, { tab: { id: 22, url: 'https://example.com' } })).ok, false)
})

test('stopping capture or closing ESPN notifies Baseline and preserves its local draft', async () => {
  const bg = await backgroundHarness()
  await bg.message({ type: 'POPUP_START', tabId: 7 })
  await bg.message({ type: 'ESPN_SNAPSHOT', snapshot: fixture }, bg.espn(7))
  await bg.remove(7)
  assert.equal((await bg.message({ type: 'BASELINE_GET' }, bg.baseline)).active, false)
  assert.equal(bg.stored.snapshot.picks.length, 156)
  assert.equal(bg.sent.at(-1).message.snapshot, null)
  await bg.message({ type: 'POPUP_STOP' })
  assert.equal(bg.stored.snapshot, undefined)
})

test('bridge sends snapshots only to an identified Baseline page', async () => {
  let identified = false, listener
  const posts = []
  const window = { postMessage: (data, origin) => posts.push({ data, origin }), addEventListener: () => {} }
  const chrome = { runtime: {
    sendMessage: async () => ({ active: true, snapshot: fixture }),
    onMessage: { addListener: fn => { listener = fn } },
  } }
  vm.runInContext(await readFile(new URL('../extensions/espn-baseline/baseline-content.js', import.meta.url), 'utf8'), vm.createContext({
    chrome, window, location: { origin: 'http://localhost:5173' }, setInterval: () => {},
    document: { querySelector: () => identified ? {} : null },
  }))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(posts.length, 0)
  identified = true
  listener({ type: 'BASELINE_SNAPSHOT', snapshot: fixture }, {}, () => {})
  assert.equal(posts.length, 1)
  assert.equal(posts[0].data.snapshot.picks.length, 156)
  assert.equal(posts[0].origin, 'http://localhost:5173')
})
