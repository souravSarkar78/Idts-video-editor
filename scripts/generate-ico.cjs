const fs = require('fs');
const { execFileSync } = require('child_process');

const sizes = [16, 24, 32, 48, 64, 128, 256];
const pngBuffers = [];

for (const s of sizes) {
  const tmpPath = `src-tauri/icons/tmp_${s}.png`;
  execFileSync('ffmpeg', ['-y', '-i', 'public/idts-logo.jpg', '-vf', `scale=${s}:${s}`, tmpPath], { stdio: 'pipe' });
  pngBuffers.push({
    size: s,
    data: fs.readFileSync(tmpPath)
  });
  try { fs.unlinkSync(tmpPath); } catch {}
}

// Build ICO header + directory
const count = pngBuffers.length;
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // icon type
header.writeUInt16LE(count, 4);

let offset = 6 + count * 16;
const dirEntries = [];

for (const item of pngBuffers) {
  const dir = Buffer.alloc(16);
  dir.writeUInt8(item.size === 256 ? 0 : item.size, 0); // width (0 = 256)
  dir.writeUInt8(item.size === 256 ? 0 : item.size, 1); // height (0 = 256)
  dir.writeUInt8(0, 2); // color count
  dir.writeUInt8(0, 3); // reserved
  dir.writeUInt16LE(1, 4); // planes
  dir.writeUInt16LE(32, 6); // bpp
  dir.writeUInt32LE(item.data.length, 8); // size
  dir.writeUInt32LE(offset, 12); // offset
  dirEntries.push(dir);
  offset += item.data.length;
}

const icoBuffer = Buffer.concat([header, ...dirEntries, ...pngBuffers.map(b => b.data)]);
fs.writeFileSync('src-tauri/icons/icon.ico', icoBuffer);
console.log('Multi-resolution icon.ico created successfully! Bytes:', icoBuffer.length);
