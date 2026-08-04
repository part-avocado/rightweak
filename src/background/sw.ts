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

function friendlyError(err: unknown) {
    throw new Error("This function cannot be used at this time.");
}

