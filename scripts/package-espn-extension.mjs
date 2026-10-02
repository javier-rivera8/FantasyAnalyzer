// Produce a portable ZIP without requiring a zip executable or new dependency.
import { readdir, readFile, writeFile } from 'node:fs/promises'
const root = new URL('../extensions/espn-baseline/', import.meta.url)
const files = (await readdir(root)).filter(name => /\.(js|json|html|css|md)$/.test(name)).sort()
const chunks = [], directory = []
let offset = 0
function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}
for (const file of files) {
  const name = Buffer.from(file), data = await readFile(new URL(file, root)), crc = crc32(data)
  const header = Buffer.alloc(30)
  header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4)
  header.writeUInt16LE(33, 12) // 1980-01-01, deterministic archive timestamps
  header.writeUInt32LE(crc, 14); header.writeUInt32LE(data.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(name.length, 26)
  chunks.push(header, name, data)
  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(33, 14)
  central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42)
  directory.push(central, name)
  offset += header.length + name.length + data.length
}
const central = Buffer.concat(directory), end = Buffer.alloc(22)
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16)
await writeFile(new URL('../public/espn-baseline-extension.zip', import.meta.url), Buffer.concat([...chunks, central, end]))
console.log(`Extensión empaquetada: ${files.length} archivos → public/espn-baseline-extension.zip`)
