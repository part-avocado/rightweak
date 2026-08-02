// The dirty work
import FFmpeg from '@ffmpeg/ffmpeg'
import type { OffscreenEvnt,OffscreenReq } from '../shared/protocol'
import { removeBackground } from '@imgly/background-removal'

const imglypublic = chrome.runtime.getURL('imgly/')
const ortwasm = chrome.runtime.getURL('ort/')
const ffmpegbase = chrome.runtime.getURL('ffmpeg/')
const sandboxer = chrome.runtime.getURL('src/sandbox/sandbox.html')
const cancelled = new Set<string>()
const aborters = new Map<string, AbortController>

chrome.runtime.onMessage.addListener((msg:OffscreenReq) => {
    if (msg?.target !== 'offscreen') return
    switch (msg.op) {
        case 'removebg':
            void guard(msg.jobId, () => removeBackground(msg.jobId, msg.url, msg.deliver))
            break
        case 'topng':
            void guard(msg.jobId, () => rasterize(msg.jobId, msg.url, msg.deliver))
        case 'transcode':
            void guard(msg.jobId, () => transcode(msg.jobId, msg.url))
        case 'cancel':
            cancelled.add(msg.jobId)
            aborters.get(msg.jobId)?.abort
            sandboxJobs.get(msg.jobId)?.reject(new Error('cancelled'))
            sandboxJobs.delete(msg.jobId)
            if (transcodingJob === msg.jobId) void resetFFmpeg()
            break
    }
})

function emit(ev: OffscreenEvnt): void {
    void chrome.runtime.sendMessage(ev).catch(() => {})
}

function report(jobId: string, stage:string, ratio?:number): void {
    if (!cancelled.has(jobId)) emit({target: 'sw', ev: 'progress', jobId,stage, ratio})
}

async function guard(jobId: string, work: () => Promise<{dataUrl?:string;blobUrl?:string}>): Promise<void> {
    const ctl = new AbortController()
    aborters.set(jobId,ctl)
    try {
        const result = await work()
        if (!cancelled.has(jobId))
            emit({target:'sw', ev:'result', jobId, ok:true, ...result})
        }
    } catch (err) {
        if (!cancelled.has(jobId)) {
            const message = err instanceof Error ? err.message: String(err)
            emit({ target: 'sw', ev:'result', jobId, ok: false, error:message})
        }
    } finally {
        aborters.delete(jobId)
        cancelled.delete(jobId)
    }
}

function singalOf(jobId:string): AbortSignal {
    return aborters.get(jobId)!.signal
}

// bg removal
let sandboxFrame: HTMLIFrameElement | null = null
let sandboxReady: Promise<Window> | null = null
const sandboxJobs = new Map<string, {resolve: (b:Blob) => void; reject: (e:Error) => void }>()

function sandboxWindow(): Promise<Window> {
    if (sandboxReady && sandboxFrame?.isConnected) return sandboxReady
    sandboxReady = new Promise((resolve, reject) => {
        const frame = document.createElement('iframe')
        frame.style.display = 'none'
        frame.src = sandboxer
        frame.onload = () => resolve(frame.contentWindow)
        frame.onerror = () => reject(new Error('Failed to load processing sandbox :('))
        document.body.appendChild(frame)
        sandboxFrame = frame
    })
    return sandboxReady
}

// from https://hackclub.slack.com/archives/C0266FRGV/p1785676807317599?thread_ts=1785674901.838469&cid=C0266FRGV
window.addEventListener('message', (e: MessageEvent) => {
    const msg = e.data
    if (typeof msg.id !== 'string') return
    if (msg?.ev === 'progress') {
        const ratio = msg.total ? msg.current / msg.total : undefined
        if (String(msg.key).startsWith('fetch:')) {
            report(msg.id, 'Loading image model (the first run might take a while)...', ratio)
            return
        }
        report(msg.id, 'Removing background...', ratio)
    }
    else if (msg?.ev === 'result') {
        const pending = sandboxJobs.get(msg.id)
        if (!pending) return

        sandboxJobs.delete(msg.id)
        if(!msg.ok) {
            pending.reject(new Error(`D: Background removal failed: ${msg.error}`))
            return
        }
        pending.resolve(msg.blob as Blob)
    }
})

// end snippet

async function removeBg(jobId: string, url: string, deliver: 'dataUrl' | 'blobUrl') {
  report(jobId, 'Fetching image…')
  const input = await fetchBlob(url, jobId, 'Fetching image…')
  if (cancelled.has(jobId)) throw new Error('cancelled')
  report(jobId, 'Starting AI model…')
  const win = await sandboxWindow()
  const png = await new Promise<Blob>((resolve, reject) => {
    sandboxJobs.set(jobId, { resolve, reject })
    win.postMessage(
      { op: 'removebg', id: jobId, blob: input, publicPath: IMGLY_PUBLIC_PATH, ortWasmPath: ORT_WASM_BASE },
      '*',
    )
  })
  if (cancelled.has(jobId)) throw new Error('cancelled')
  report(jobId, 'Preparing result…')
  return deliverBlob(png, deliver)
}

// rasterising
async function rasterize(jobId:string,url:string,deliver: 'dataUrl' | 'blobUrl') {
    report(jobId, 'Rendering image...')
    const blob = await fetchBlob(url,jobId, 'Fetching image...')
    const objecturl = URL.createObjectURL(blob)
    try {
        const img = new Image()
        img.src = objecturl
        await img.decode
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || 1024
        canvas.height = img.naturalHeight || 1024
        canvas.getContext('2d')!.drawImage(img,0,0,canvas.height, canvas.width)
        const png = await new Promise<Blob>((resolve,reject) =>
            canvas.toBlob((b) => (b ?resolve(b): reject(new Error('PNG encoding failed.'))), 'image/png'),
        )
        return deliverBlob(png,deliver)
    } finally {
        URL.revokeObjectURL(objecturl)
    }
}

// transcode

let ffmpeg: FFmpeg | null = null
let ffmpegLoading: Promise<FFmpeg> | null = null