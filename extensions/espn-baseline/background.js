const BASELINE_MATCHES = ['http://localhost/*', 'http://127.0.0.1/*', 'https://fantasy-analyzer-jr-2026.web.app/*', 'https://fantasy-analyzer-jr-2026.firebaseapp.com/*']
function isEspn(url) {
  try { const value = new URL(url); return value.origin === 'https://fantasy.espn.com' && value.pathname === '/basketball/draft' } catch { return false }
}
function isBaseline(url) {
  try { const value = new URL(url); return ['http://localhost', 'http://127.0.0.1'].includes(`${value.protocol}//${value.hostname}`) || ['https://fantasy-analyzer-jr-2026.web.app', 'https://fantasy-analyzer-jr-2026.firebaseapp.com'].includes(value.origin) } catch { return false }
}
async function notify(snapshot) {
  const tabs = await chrome.tabs.query({ url: BASELINE_MATCHES })
  await Promise.allSettled(tabs.map(tab => chrome.tabs.sendMessage(tab.id, { type: 'BASELINE_SNAPSHOT', snapshot })))
}
async function handle(message, sender) {
  if (message.type === 'ESPN_SNAPSHOT') {
    const { sourceTabId } = await chrome.storage.local.get('sourceTabId')
    if (!isEspn(sender.tab?.url) || sender.tab.id !== sourceTabId) return { ok: false }
    const snapshot = message.snapshot
    const url = new URL(sender.tab.url)
    if (!snapshot || snapshot.version !== 1 || snapshot.draftId !== `${url.searchParams.get('seasonId')}:${url.searchParams.get('leagueId')}` || !Array.isArray(snapshot.picks) || snapshot.picks.length > 1000) return { ok: false }
    await chrome.storage.local.set({ snapshot, updatedAt: Date.now() })
    await notify(snapshot)
    return { ok: true }
  }
  if (message.type === 'BASELINE_GET' && isBaseline(sender.tab?.url)) {
    const { snapshot, sourceTabId, updatedAt } = await chrome.storage.local.get(['snapshot', 'sourceTabId', 'updatedAt'])
    return { snapshot: snapshot || null, active: !!sourceTabId, updatedAt }
  }
  // Only the extension's popup can choose or stop an ESPN source tab.
  if (sender.tab || sender.url !== chrome.runtime.getURL('popup.html')) return { ok: false }
  if (message.type === 'POPUP_STATUS') return chrome.storage.local.get(['sourceTabId', 'snapshot', 'updatedAt'])
  if (message.type === 'POPUP_START') {
    const tab = await chrome.tabs.get(message.tabId)
    if (!isEspn(tab.url)) throw new Error('Abre la sala de draft de ESPN y vuelve a intentar.')
    await chrome.storage.local.set({ sourceTabId: tab.id, snapshot: null, updatedAt: null })
    await notify(null)
    await chrome.tabs.sendMessage(tab.id, { type: 'ESPN_SCAN' })
    return { ok: true }
  }
  if (message.type === 'POPUP_STOP') {
    await chrome.storage.local.remove(['sourceTabId', 'snapshot', 'updatedAt'])
    await notify(null)
    return { ok: true }
  }
  return { ok: false }
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  handle(message, sender).then(respond).catch(error => respond({ ok: false, error: error.message }))
  return true
})
chrome.tabs.onRemoved.addListener(async tabId => {
  const { sourceTabId } = await chrome.storage.local.get('sourceTabId')
  if (tabId === sourceTabId) {
    await chrome.storage.local.remove('sourceTabId')
    await notify(null)
  }
})
