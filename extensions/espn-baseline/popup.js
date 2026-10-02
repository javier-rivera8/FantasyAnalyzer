const status = document.getElementById('status')
async function refresh() {
  const state = await chrome.runtime.sendMessage({ type: 'POPUP_STATUS' })
  status.textContent = state.sourceTabId ? state.snapshot
    ? `${state.snapshot.picks.length} picks capturados · ${state.snapshot.connectionFailed ? 'ESPN perdió conexión; historial conservado' : 'Sala conectada'}`
    : 'Esperando datos de la sala. Recarga ESPN si acabas de instalar la extensión.' : 'Captura detenida.'
  document.getElementById('stop').disabled = !state.sourceTabId
}
document.getElementById('start').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    const result = await chrome.runtime.sendMessage({ type: 'POPUP_START', tabId: tab.id })
    if (!result.ok) throw new Error(result.error || 'No se pudo conectar. Recarga la pestaña de ESPN.')
    await refresh()
  } catch (error) { status.textContent = error.message }
})
document.getElementById('stop').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'POPUP_STOP' }); await refresh()
})
refresh()
setInterval(refresh, 2000)
