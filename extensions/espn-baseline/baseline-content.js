(() => {
  const source = 'baseline-espn-extension-v1'
  let lastSnapshot = null
  const deliver = () => {
    if (!document.querySelector('meta[name="baseline-draft-sync"]')) return
    window.postMessage({ source, type: 'SNAPSHOT', snapshot: lastSnapshot, extensionInstalled: true }, location.origin)
  }
  async function refresh() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'BASELINE_GET' })
      lastSnapshot = response?.active ? response.snapshot : null
      deliver()
    } catch { /* Reload the tab after updating the unpacked extension. */ }
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message.type === 'BASELINE_SNAPSHOT') { lastSnapshot = message.snapshot; deliver(); respond({ ok: true }) }
  })
  window.addEventListener('message', event => {
    if (event.source === window && event.origin === location.origin && event.data?.source === 'baseline-app-v1' && event.data.type === 'READY') refresh()
  })
  refresh()
  // Heartbeat also discovers a closed ESPN tab and reconnects after navigation.
  setInterval(refresh, 3000)
})()
