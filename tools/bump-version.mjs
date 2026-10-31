// Incrémente la version de Rivio partout où elle est écrite.
// Usage: node tools/bump-version.mjs [0.64]   (sans argument : +1 sur la dernière décimale)
//
// Trois endroits doivent rester alignés, sinon l'appli affiche une version qui
// ne correspond pas à ce qui tourne :
//   - VERSION            (fichier de référence, lu par ce script)
//   - index.html         (#app-version, affiché dans Profil)
//   - sw.js              (VERSION="cdj-vNN", nom du cache du service worker)
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const read = (p) => readFile(path.join(root, p), 'utf8')

let current = '0.0'
if (existsSync(path.join(root, 'VERSION'))) {
  current = (await read('VERSION')).trim()
}

let next = process.argv[2]
if (!next) {
  const [maj, min] = current.split('.').map(Number)
  next = `${maj}.${(min || 0) + 1}`
}

// sw.js travaille sur une séquence distincte (v63 pour la 0.62) : on repart du
// numéro de cache existant et on l'incrémente d'un cran.
const swSrc = await read('sw.js')
const swMatch = swSrc.match(/const VERSION="cdj-v(\d+)"/)
const swNext = swMatch ? Number(swMatch[1]) + 1 : 1

const html = await read('index.html')
const before = html.match(/<span id="app-version">([^<]+)<\/span>/)

await writeFile(path.join(root, 'VERSION'), next + '\n', 'utf8')
await writeFile(
  path.join(root, 'index.html'),
  html.replace(/<span id="app-version">[^<]+<\/span>/, `<span id="app-version">${next}</span>`),
  'utf8'
)
await writeFile(
  path.join(root, 'sw.js'),
  swSrc.replace(/const VERSION="cdj-v\d+"/, `const VERSION="cdj-v${swNext}"`),
  'utf8'
)

console.log(`version ${current} -> ${next}`)
console.log(`index.html  : ${before ? before[1] : '?'} -> ${next}`)
console.log(`sw.js cache : ${swMatch ? 'v' + swMatch[1] : '?'} -> v${swNext}`)
