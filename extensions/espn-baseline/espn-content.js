(() => {
  let fingerprint = '', timer
  let failures = 0
  async function scan(force = false) {
    try {
      const snapshot = BaselineEspnParser.readEspnDraft(document, location.href)
      if (!snapshot) return
      const next = JSON.stringify(snapshot)
      if (!force && next === fingerprint) return
      const result = await chrome.runtime.sendMessage({ type: 'ESPN_SNAPSHOT', snapshot })
      if (result?.ok) fingerprint = next
      failures = 0
    } catch {
      // Updating/unloading an unpacked extension invalidates old content scripts.
      // Reloading the ESPN tab restores the connection without changing picks.
      if (++failures > 3 && !chrome.runtime?.id) observer.disconnect()
    }
  }
  const observer = new MutationObserver(() => {
    clearTimeout(timer)
    timer = setTimeout(() => scan(), 400)
  })
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true })
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message.type === 'ESPN_SCAN') {
      scan(true).then(() => respond({ ok: true }))
      return true
    }
    return false
  })
  setInterval(() => scan(), 2000)
  scan()
})()
