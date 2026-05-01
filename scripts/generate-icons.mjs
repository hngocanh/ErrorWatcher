import sharp from 'sharp'
import { mkdirSync } from 'fs'

mkdirSync('public/icons', { recursive: true })

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <circle cx="64" cy="64" r="60" fill="#E24B4A"/>
  <text x="64" y="88" text-anchor="middle" font-size="80" font-family="Arial" font-weight="bold" fill="white">!</text>
</svg>`

const input = Buffer.from(svg)

for (const size of [16, 48, 128]) {
  await sharp(input)
    .resize(size, size)
    .png()
    .toFile(`public/icons/icon${size}.png`)
  console.log(`created icon${size}.png`)
}