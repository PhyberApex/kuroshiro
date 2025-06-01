import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const srcDir = path.resolve(__dirname, '../../ui/public/screens')
const destDir = path.resolve(__dirname, '../dist/public/screens')

function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true })
  }
  const entries = fs.readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath)
    }
    else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

if (!fs.existsSync(srcDir)) {
  console.error(`Source directory does not exist: ${srcDir}`)
  process.exit(1)
}

copyDirSync(srcDir, destDir)
console.log(`Copied screens from ${srcDir} to ${destDir}`)
