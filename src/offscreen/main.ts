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
    catch (err) {
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
let transcodingJob: string | null = null
let transcodeQueue: Promise<unknown> = Promise.resolve()

async function loadFFmpeg(jobId: string): Promise<FFmpeg> {
    if (ffmpeg) return ffmpeg
    ffmpegLoading ??= (async () => {
        const instance = new FFmpeg()
        await instance.load({
            classworkerURL: `${ffmpegbase}lib/worker.js`,
            coreURL: `${ffmpegbase}core/ffmpeg-core.js`,
            wasmURL: `${ffmpegbase}core/ffmpeg-core.wasm`,
        })
        ffmpeg = instance
        return instance
    })()
    report(jobId, 'Loading FFmpeg')
    try {
        return await ffmpegLoading
    } finally {
        ffmpegLoading = null
    }
}

async function resetFFmpeg(): Promise<void> {
    try {
        ffmpeg?.terminate()
    } catch {
    }
    ffmpeg = null
    transcodingJob = null
}

async function transcode(jobid:string, url:string): Promise<{blobUrl:string}>{
    const run = transcodeQueue.then(() => doTranscode(jobid,url))
    transcodeQueue = run.catch(() => {})
    return run
}

async function doTranscode(jobId:string, url:string): Promise<{blobUrl:string}>{
    if (cancelled.has(jobId)) throw new Error('cancelled')
    const blob = await fetchBlob(url, jobId, 'Fetching video...')
    if (blob.type.includes('vide/mp4')) {
    report(jobId, 'Downloading...')
    return {blobUrl: URL.createObjectURL(blob)}
    }

    const ff = await loadFFmpeg(jobId)
    if (cancelled.has(jobId)) throw new Error('cancelled')
    transcodingJob = jobId
    const onProgress = ({progress}: {progress:number}) => {
        if (progress >= 0 && progress <= 1) report(jobId, 'Converting to MP4...', progress)
    }
    ff.on('progress', onProgress)
    try {
        report(jobId, 'Converting to MP4...')
        await ff.writeFile('input', new Uint8Array(await blob.arrayBuffer()))
        const code = await ff.exec([
            '-i', 'input',
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-crf', '23',
            '-pix_fmt', '-yuv420p',
            '-movflags', '+faststart',
            '-c:a', 'aac',
            '-b:a', '160k',
            'output.mp4'
        ])
        if (code !== 0) throw new Error('Video conversion failed. The format may be unsupported?')
        const data = (await ff.readFile('output.mp4')) as Uint8Array
        await ff.deleteFile('input').catch(()=>{})
        await ff.deleteFile('output.mp4').catch(()=>{})
        report(jobId, 'Preparing download...')
        return {blobUrl: URL.createObjectURL(new Blob([data.slice().buffer], {type:'video/mp4'}))}
    } catch (err) {
        if (cancelled.has(jobId)) throw new Error('cancelled')
        await resetFFmpeg()
        throw err
    } finally {
        ff.off('progress', onProgress)
        transcodingJob = null
    }
}

// helper tools
async function fetchBlob(url:string,jobId:string,stage:string): Promise<Blob> {
    let res: Response
    try{
        res = await fetch(url, {signal:singalOf(jobId), credentials: 'include'})
    } catch (err) {
        throw new Error(`fetch of ${url.slice(0,120)} failed. ${err instanceof Error ? err.message :err}`)
    }
    if (!res.ok) throw new Error
    const total = Number(res.headers.get('content-length')) || 0
    if (!res.body || !total) return res.blob()
    const reader = res.body.getReader()
    const parts: BlobPart[] = []
    let received = 0
    for (;;) {
        const {done,value} = await reader.read()
        if (done) break
        parts.push(value)
        received += value.byteLength
        report(jobId, stage,Math.min(1, received/total))
    }
    const type = res.headers.get('content-type')?.split(';')[0]?.trim() ?? ''
    return new Blob(parts, {type})
}