/**
 * Generate the favicon set + PWA manifest from the sidebar photo (§7), and copy
 * brand images into the single static assets tree (§6.3). Run in `prebuild`.
 *
 * Outputs to public/ (passthrough, unhashed — no second /_astro asset root):
 *   favicon-16x16.png, favicon-32x32.png, favicon-48x48.png,
 *   apple-touch-icon.png (180), android-chrome-192x192.png, -512x512.png,
 *   favicon.ico (32), site.webmanifest
 *   assets/images/{opengraph.jpg, sidebar_profile.png}
 */
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)))
const brand = resolve(repoRoot, "src/assets/brand")
const pub = resolve(repoRoot, "public")
const source = resolve(brand, "sidebar_profile.png")

/** Wrap a PNG buffer in a single-image ICO container. */
function pngToIco(png: Buffer, size = 32): Buffer {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(1, 4) // image count
  const dir = Buffer.alloc(16)
  dir.writeUInt8(size >= 256 ? 0 : size, 0) // width
  dir.writeUInt8(size >= 256 ? 0 : size, 1) // height
  dir.writeUInt16LE(1, 4) // color planes
  dir.writeUInt16LE(32, 6) // bits per pixel
  dir.writeUInt32LE(png.length, 8) // image size
  dir.writeUInt32LE(22, 12) // offset
  return Buffer.concat([header, dir, png])
}

async function png(size: number, out: string): Promise<void> {
  await sharp(source).resize(size, size, { fit: "cover" }).png().toFile(resolve(pub, out))
}

async function main(): Promise<void> {
  mkdirSync(pub, { recursive: true })
  mkdirSync(resolve(pub, "assets/images"), { recursive: true })

  await png(16, "favicon-16x16.png")
  await png(32, "favicon-32x32.png")
  await png(48, "favicon-48x48.png")
  await png(180, "apple-touch-icon.png")
  await png(192, "android-chrome-192x192.png")
  await png(512, "android-chrome-512x512.png")

  const ico32 = await sharp(source).resize(32, 32, { fit: "cover" }).png().toBuffer()
  writeFileSync(resolve(pub, "favicon.ico"), pngToIco(ico32, 32))

  writeFileSync(
    resolve(pub, "site.webmanifest"),
    JSON.stringify(
      {
        name: "Claus Conrad",
        short_name: "Claus Conrad",
        icons: [
          { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
        ],
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
      },
      null,
      2,
    ),
  )

  copyFileSync(resolve(brand, "opengraph.jpg"), resolve(pub, "assets/images/opengraph.jpg"))
  copyFileSync(
    resolve(brand, "sidebar_profile.png"),
    resolve(pub, "assets/images/sidebar_profile.png"),
  )

  console.log("[favicons] generated favicon set + manifest + brand images → public/")
}

main().catch((err) => {
  console.error("[favicons] ERROR:", err)
  process.exit(1)
})
