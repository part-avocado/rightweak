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