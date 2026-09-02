/**
 * Rasterises the brand SVGs in assets/brand/ into the PNGs the manifest,
 * Apple, and social crawlers need. Run with `pnpm gen:icons`.
 *
 * Uses @resvg/resvg-js rather than ImageMagick: ImageMagick has no librsvg
 * delegate on this machine and silently drops stroked paths and gradients,
 * emitting a blank image instead of failing loudly.
 *
 * Note the OG image draws real text, so it depends on a system font being
 * resolvable. On a host without Helvetica/Arial, resvg falls back to whatever
 * it can find and the wordmark may shift — regenerate on macOS for the
 * committed asset, or pin a font file via `font.fontFiles`.
 */
import { Resvg } from '@resvg/resvg-js'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const brand = join(root, 'assets', 'brand')
const out = join(root, 'public')

const TARGETS = [
  { src: 'mark.svg', file: 'icon-192.png', width: 192 },
  { src: 'mark.svg', file: 'icon-512.png', width: 512 },
  // Full bleed, not the rounded mark: iOS masks corners itself, and alpha
  // corners come out black on a home screen.
  { src: 'mark-fullbleed.svg', file: 'apple-touch-icon.png', width: 180 },
  { src: 'mark-maskable.svg', file: 'icon-maskable-512.png', width: 512 },
  { src: 'og.svg', file: 'og-image.png', width: 1200 },
]

mkdirSync(out, { recursive: true })

for (const { src, file, width } of TARGETS) {
  const svg = readFileSync(join(brand, src))
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: { loadSystemFonts: true, defaultFontFamily: 'Helvetica' },
  })
  const png = resvg.render().asPng()
  writeFileSync(join(out, file), png)
  console.log(`${file.padEnd(24)} ${width}px  ${(png.length / 1024).toFixed(1)} kB`)
}

console.log(`\n${TARGETS.length} assets written to public/`)
