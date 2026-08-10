import { removeBackground } from '@imgly/background-removal'

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
        const png = await removeBackground(msg.blob, {
            publicPath: msg.publicPath,
            model: 'medium',
            proxyToWorker: false,
            progress: (key, current, total) => {
                post({ev:'progress', id:msg.id, key, current,total})
            },
        })
        post({ev: 'result', id:msg.id, ok:true, blob:png})
    } catch (err) {
        post({ev: 'result', id:msg.id, ok:false, error: err instanceof Error ? err.message : String(err)})
    }
}