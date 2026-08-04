// The service worker YAYYYY
import { port_name } from "../shared/protocol";
import type { JobRequest, OffscreenEvnt,OffscreenReq, PortMessageFrom, PortMessageTo } from "../shared/protocol";
const offscreenurl = 'src/offscreen/offscreen.html'

// osm
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === 'open-tab' && typeof msg.url === 'string' && /^http?:/.test(msg.url)) {
        void chrome.tabs.create({url: msg.url, index: sender.tab ? sender.tab.index + 1 : undefined})
    } else if (msg?.type === 'reload-hard') {
        if (sender.tab?.id !== undefined) void chrome.tabs.reload(sender.tab.id, {bypassCache:true})
    } else if (msg?.type === 'screenshot' || msg?.type === 'screenshot-save') {
        void handleScreenshot(msg, sender).then(sendResponse)
        return true
    } else if (msg?.target === 'sw') {
        handleOffscreenEvent(msg as OffscreenEvnt)
    }
})

async function handleScreenshot(
    msg: {type: 'screenshot'} | {type: 'screenshot-save'; filename: string},
    sender: chrome.runtime.MessageSender,
): Promise<{ok: boolean; dataUrl?: string; error?: string}> {
    try {
        const windowId = sender.tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT
        const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {format: 'png'})
        if (msg.type === 'screenshot-save') {
            await chrome.downloads.download({url: dataUrl, file:msg.filename, saveAs: true})
            return {ok: true}
        }
        return {ok:true, dataUrl}
    } catch (err) {
        return {ok:false, error: friendlyError(err)}
    }
}

//employment

interface Job {
    id: string
    port: chrome.runtime.Port
    ctl: AbortController
    useOffscreen:boolean
    settled: boolean
}

const jobs = new Map<string, Job>()
interface OffscreenResult {
    dataUrl?: string
    blobUrl?: string
    preview?: string
}

const offscreenPending = new Map<string, {resolve: (r: OffscreenResult) => void; reject: (e:Error) => void}>()

chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== port_name) return
    const job: Job = {
        id: crypto.randomUUID(),
        port,
        ctl: new AbortController(),
        useOffscreen: false,
        settled: false,
    }
    jobs.set(job.id, job)

    port.onMessage.addListener((m: PortMessageFrom) => {
        if (m.type === 'cancel') cancelJob(job)
        else if (m.type === 'run') void executeJob(job, m.job)
    })

    port.onDisconnect.addListener(() =>{
        cancelJob(job)
        jobs.delete(job.id)
    })
})


async function executeJob(job: Job, req: JobRequest): Promise<void> {
    try{
        switch (req.kind) {
            case 'save-original':
                await saveOriginal(job, req)
                break
            case 'save-png':
            case 'copy-png':
                await pngJob(job, req)
                break
            case 'save-png-nobg':
            case 'copy-png-nobg':
                await noBgJob(job, req)
                break
            case 'save-video-mp4':
                await videoJob(job, req)
                break
            default:
                throw new Error(`Job type not recognized. ${(req as JobRequest).kind}`)
        }
    } catch (err) {
        if (!job.settled) {
            job.settled = true
            send(job, {type:'error', message: friendlyError(err)})
        }
    }
}

function send(job: Job, m: PortMessageTo): void {
    try {
        job.port.postMessage(m)
    } catch {
//      content has flown away
    }
}

function progress(job: Job, stage: string, ratio?: number): void {
    send(job, {type:'progress', stage, ratio})
}

function cancelJob(job: Job): void {
    if (job.settled) return
    job.settled = true
    job.ctl.abort()
    if (job.useOffscreen) {
        void chrome.runtime
            .sendMessage({target: 'offscreen', op: 'cancel', jobId: job.id} satisfies OffscreenReq)
            .catch(() => {})
    } 
    OffscreenPadding.get(job.id)?.reject(new Error('cancelled'))
    OffscreenPadding.delete(job)
}

function finish(job: Job, dataUrl?: string, preview?: string): void {
    if (job.settled) return
    job.settled = true
    send(job, {type: 'done', dataUrl, preview})
}

// helping tools
function throwIfAborted(job: Job): void {
    if (job.ctl.signal.aborted) throw new Error('cancelled')
}

async function fetchBytes(
  url: string,
  signal: AbortSignal,
  onProgress: (ratio?: number) => void,
): Promise<{ buf: ArrayBuffer; mime?: string }> {
  onProgress()
  const res = await fetch(url, { signal, credentials: 'include' })
  if (!res.ok) throw new Error(`The server responded with ${res.status} ${res.statusText}.`)
  const mime = res.headers.get('content-type')?.split(';')[0]?.trim()
  const total = Number(res.headers.get('content-length')) || 0
  if (!res.body || !total) return { buf: await res.arrayBuffer(), mime }
  const reader = res.body.getReader()
  const parts: Uint8Array[] = []
  let received = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    parts.push(value)
    received += value.byteLength
    onProgress(Math.min(1, received / total))
  }
  const buf = new Uint8Array(received)
  let offset = 0
  for (const p of parts) {
    buf.set(p, offset)
    offset += p.byteLength
  }
  return { buf: buf.buffer, mime }
}


async function convertToPngUrl(buf: ArrayBuffer): Promise<string> {
    const bitmap = await createImageBitmap(new Blob([buf]))
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
    bitmap.close()
    const blob = await canvas.convertToBlob({type: 'image/png'})
    return `data:image/png;base64, ${bufToBase64(await blob.arrayBuffer())}`
}

function bufToBase64(buf: ArrayBuffer): string {
    const bytes = new Uint8Array(buf)
    let bin = ''
    const CHUNK = 0x8000
    for (let i = 0; i < bytes.length; i += CHUNK) {
        bin += String.fromCharCode(...bytes.subarray(i, i+CHUNK))
    }
}

function friendlyError(err: unknown): string {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === 'cancelled' || /abort/i.test(msg)) return 'cancelled'
    if (/^failed to fetch$/i.test(msg)) return "Couldn't fetch this file. The site may have blocked access."
    return msg
}

// offscreen stuff
let creatingOffscreeen: Promise<void> | null = null

async function ensureOffscreen(): Promise<void> {
    if (await chrome.offscreen.hasDocument()) return
    creatingOffscreeen ??= chrome.offscreen
        .createDocument({
            url: offscreenurl,
            reasons: [chrome.offscreen.Reason.BLOBS, chrome.offscreen.Reason.WORKERS],
            justification: 'Runs on-device magic background removal and video transcoding, and creates blob URLs for downloads.',
        })
        .catch((err) => {
            if (!String(err).toLowerCase().includes('single offscreen')) throw err
        })
        .then(() => undefined)
        .finally(() => {
            creatingOffscreeen = null
        })
    await creatingOffscreeen
}

function handleOffscreenEvent(ev: OffscreenEvnt): void {
    const job = jobs.get(ev.jobId)
    if (ev.ev === 'progress') {
        if (job && !job.settled) progress(job, ev.stage, ev.ratio)
        return
    }
    const pending = offscreenPending.get(ev.jobId)
    if (!pending) return
    offscreenPending.delete(ev.jobId)
    if (ev.ok) pending.resolve({dataUrl: ev.dataUrl, blobUrl: ev.blobUrl, preview: ev.preview})
    else pending.reject(new Error(ev.error))
}

async function rasterizeInOffscreen(job: Job, url: string, mime: string | undefined): Promise<string> {
    job.useOffscreen = true
    await ensureOffscreen()
    const result = await OffscreenCall(job, {
        target: 'offscreen',
        op: 'topng',
        jobId: job.id,
        url,
        deliver: 'dataUrl',
    })
    if (!result.dataUrl) throw new Error(`Unable to decode this image${mime ? `(${mime})` : ''}.`)
    return result.dataUrl
}