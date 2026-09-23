// Optional live diagnostic. Credentials are supplied through stdin and never logged.
import { handleEspnMockDraft } from '../server/espnLeague.mjs'
import { applyMockMessage } from '../src/espnMockProtocol.mjs'

let input = ''
for await (const chunk of process.stdin) input += chunk
const body = JSON.parse(input)
let payload
await handleEspnMockDraft({ method: 'POST', headers: {}, body }, {
  setHeader() {},
  end(value) { payload = JSON.parse(value) },
})
if (payload.error) { console.log(JSON.stringify({ error: payload.error })); process.exit(1) }
let data = payload.data
const socket = new WebSocket(payload.meta.socketUrl)
const timeout = setTimeout(() => { console.log('Live diagnostic finished'); socket.close() }, 20000)
socket.onopen = () => console.log('Socket opened')
socket.onerror = () => console.log('Socket connection error')
socket.onclose = event => { clearTimeout(timeout); console.log('Socket closed: ' + event.code) }
socket.onmessage = async event => {
  const text = typeof event.data === 'string' ? event.data : await event.data.text()
  for (const line of text.trim().split('\n')) {
    const type = line.split(' ')[0]
    try {
      data = applyMockMessage(data, line)
      console.log(JSON.stringify({ type, ready: Boolean(data.draftDetail?.liveReady), picks: data.draftDetail?.picks?.filter(pick => pick.playerId > 0).length, state: data.draftDetail?.liveState }))
    } catch (error) { console.log(JSON.stringify({ type, error: error.message })) }
    if (type === 'ERROR') socket.close()
  }
}
