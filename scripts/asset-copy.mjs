import {cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync} from 'node:fs'
import {dirname,join} from 'node:path'
import {fileURLtoPath} from 'node:url'

const root = join(dirname(fileURLtoPath(import.meta.url)), '..')
const nm = join(root, 'node_modules')
const pub = join(root, 'public')

// imgly prune cuz imgly import provides a lot of unwanted files
// BEGIN AI USAGE SECTION
const keep = [
  '/onnxruntime-web/ort-wasm.wasm',
  '/onnxruntime-web/ort-wasm-simd.wasm',
  '/onnxruntime-web/ort-wasm-threaded.wasm',
  '/onnxruntime-web/ort-wasm-simd-threaded.wasm',
  '/models/medium',
]
// END AI USAGE SECTION

const datadist = join(nm, '@imgly/background-removal-data/dist')
const imglyoutput = join(pub, 'imgly')
const marker = join(imglyoutput, '.copied-v1')

if (!existsSync(marker)) {
    mkdirSync(imglyoutput, {recursive: true})
    const resources = JSON.parse(readFileSync(join(datadist, 'resources.json'), 'utf8'))
    const pruned = {}
    let bytes = 0
    for (const key of keep) {
        if (!resources[key]) throw new Error(`resource is missing from package: ${key}`)
        pruned[key] = resources[key]
        for (const chunk of resources[key].chunks) {
            copyFileSync(join(datadist, chunk.hash), join(imglyoutput, chunk.hash))
            bytes += chunk.offsets[1] - chunk.offsets[0]
        }
    }
    writeFileSync(join(imglyoutput, 'resources.json'), JSON.stringify(pruned))
    writeFileSync(marker, '')
    console.log(`${(bytes / 1e6).toFixed(1)} MD to public/imgly`)
} else {
    console.log('already uploaded imgly assets')
}