import { removeBackground } from '@imgly/background-removal'
import { env as ortEnv } from 'onnxruntime-web'

interface RemoveBgMsg {
    op: 'removebg'
    id: string
    blob: Blob
    publicPath: string
    ortWasmPath: string
}

let ortConfigured = false

window.addEventListener('message', (e: MessageEvent) => {
    const msg = e.data as RemoveBgMsg
    if (msg?.op !== 'removebg') return
    void handle(msg)
})

const post = (data:unknown) => window.parent.postMessage(data, '*')

async function handle(msg: RemoveBgMsg): Promise<void> {
    try {
        if (!ortConfigured) {
            ortConfigured = true
            Object.defineProperty(ortEnv.wasm, 'numThreads', {get:() => 1, set: ()=>{}})
            Object.defineProperty(ortEnv.wasm, 'proxy', {get: () => false, set: () => {}})
            Object.defineProperty(ortEnv.wasm, 'wasmPaths', {get: () => msg.ortWasmPath, set: () => {}})
        }
        const png = await removeBackground(msg.blob, {
            publicPath: msg.publicPath,
            model: 'isnet_fp16',
            progress: (key, current, total) => {
                post({ev:'progress', id:msg.id, key, current,total})
            },
        })
        post({ev: 'result', id:msg.id, ok:true, blob:png})
    } catch (err) {
        post({ev: 'result', id:msg.id, ok:false, error: err instanceof Error ? err.message : String(err)})
    }
}