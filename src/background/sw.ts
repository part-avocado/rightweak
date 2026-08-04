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

// helping tools
function throwIfAborted(job: Job): void {
    if (job.ctl.signal.aborted) throw new Error('cancelled')
}