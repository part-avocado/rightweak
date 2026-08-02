export const port_name = 'rightweak-job'

export type JobKind = 
    | 'save-png'
    | 'copy-png'
    | 'save-png-nobg'
    | 'copy-png-nobg'
    | 'save-original'
    | 'save-video-mp4'

export interface JobRequest {
    kind: JobKind
    url: string
    filename: string
}

export type PortMessageFrom = {type:'run'; job: JobRequest} | {type:'cancel'}
export type PortMessageTo = 
    | {type:'progress'; stage:string; ratio?: number}
    | {type:'done';dataUrl?:string; preview?:string}
    | {type:'error'; message:string}

export type OneShot = 
    | {type:'open-tab'; url:string}
    | {type:'screenshot'}
    | {type:'screenshot-save'; filename: string}
    | {type:'reload-hard'}

export type OffscreenReq =
    | {target:'offscreen'; op: 'removebg'; jobId:string; url:string; deliver: 'dataUrl' | 'blobUrl'}
    | {target:'offscreen'; op: 'topng'; jobId:string; url:string; deliver: 'dataUrl' | 'blobUrl'}
    | {target:'offscreen'; op: 'transcode'; jobId: string; url:string}
    | {target:'offscreen'; op: 'cancel'; jobId:string}

export type OffscreenEvnt =
    | {target:'sw'; ev:'progress'; jobId:string; stage:string; ratio?:number}
    | {target:'sw'; ev:'result'; jobId:string; ok: true; dataUrl?:string; blobUrl?:string; preview?:string}
    | {target:'sw'; ev:'result'; jobId:string; ok: false; error:string}