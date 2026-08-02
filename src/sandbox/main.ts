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
        cancelled.delete(jobid)
    }
}

function singalOf(jobId:string): AbortSignal {
    return aborters.get(jobId)!.signal
}

// removal of things
let sandboxFrame: HTMLIFrameElement | null = null
let sandboxReady: Promise<window> | null = null
const sandboxJobs = new Map<string, {resolve: (b:Blob) => void; reject: (e:Error) => void }>()

