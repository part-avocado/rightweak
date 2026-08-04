// The service worker YAYYYY
import { port_name } from "../shared/protocol";
import type { JobRequest, OffscreenEvnt,OffscreenReq, PortMessageFrom, PortMessageTo } from "../shared/protocol";
const offscreenurl = 'src/offscreen/offscreen.html'

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
    const blob = await canvas.convertToBlob({type: 'image/png'})\
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