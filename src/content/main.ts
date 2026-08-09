import {port_name} from '../shared/protocol'
import type { JobRequest, PortMessageFrom,PortMessageTo } from '../shared/protocol'
import { showMenu, closeMenu, createToast, ICONS, magic_icons } from './ui'
import type { MenuEntry, NavButton, ToastHandle } from './ui'
import {startInpsector} from './inspect'
import { createFilter } from 'vite'

const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)
const hint_more = 'Hold Shift for advanced options'
const hint_expand = isMac? 'Cmd + right-click for default menu' : 'Ctrl + right-click for default menu'
window.addEventListener('contextmenu', oncontextmenu, true)

function oncontextmenu(e: MouseEvent): void {
    if (e.ctrlKey || e.metaKey) return
    const path = e.composedPath()
    for (const node of path) {
        if (node instanceof HTMLElement) {
            if (node.isContentEditable) return
            const tag = node.tagName
            if (tag === 'INPUT' || tag == 'TEXTAREA' || tag === 'SELECT') return
        }
    }
    
    const media = findMedia(e, path)
    const link = (path.find((n) => n instanceof HTMLAnchorElement && n.href) as HTMLAnchorElement | undefined ) ?? null
    const selection = String(getSelection() ?? '').trim()

    e.preventDefault()
    e.stopImmediatePropagation()

    if (media instanceof HTMLImageElement) {
        showMenu(e.clientX, e.clientY, {
            entries: iamageEntries(media),
            more: mediaMoreEntries(link, e.target as Element | null, imageMoreExtras(media)),
            hint: hint_more,
            expandedHint: hint_expand,
            startExpanded: e.shiftKey,
        })
    } else if (media instanceof HTMLVideoElement) {
        showMenu(e.clientX, e.clientY, {
            entries: videoEntries(media),
            more: mediaMoreEntries(link, e.target as Element | null, videoMoreExtras(media)),
            hint: hint_more,
            expandedHint: hint_expand,
            startExpanded: e.shiftKey,
        })
    } else {
        showMenu(e.clientX, e.clientY, {
            nav: navButtons(),
            entries: pageEntries(link, selection),
            more: pageMoreEntries(e.target as Element | null),
            hint: hint_more,
            expandedHint: hint_expand,
            startExpanded: e.shiftKey,
        })
    }
}

// ALL THE FUNCTIONS AND FEATURES AND STUFF BELOW HERE

// core features
function navButtons(): NavButton[] {
    const nav = (window as {navigation?: {canGoBack?: boolean; canGoForward?: boolean} }).navigation
    return [
        {icon: ICONS.back, title: 'Back', disabled: nav?.canGoBack === false, onClick: () => history.back()},
        {icon: ICONS.forward, title: 'Forward', disabled: nav?.canGoForward === false, onClick: () => history.forward()},
    ]
}

function openTab(url: string): void {
    chrome.runtime.sendMessage({type: 'open-tab', url}).catch(() => {
        createToast('Open link').error('Could not open the link. Try reloading the extension.')
    })
}

function linkGroup(link: HTMLAnchorElement): MenuEntry[] {
    const text = (link.textContent ?? '').trim().replace(/\s+/g, ' ')
    return [
        {icon: ICONS.newTab, label: 'Open link in new tab', onClick: () => openTab(link.href)},
        {icon: ICONS.link, label: "Copy link address", sublabel: link.href, onClick: () => copyText(link.href, 'Link address copied')},
        ...(text ? [{icon: ICONS.text, label: 'Copy link text', sublabel: `"${truncate(text,40)}"`, onClick: () => copyText(text, 'Link text copied')} satisfies MenuEntry] : [])
    ]
}

function pageCopyGroup(): MenuEntry[] {
    return [
        {icon: ICONS.link, label: 'Copy page address', sublabel: location.href, onClick: () => copyText(location.href, 'Page address copied')},
        {icon: ICONS.title, label: 'Copy page title', sublabel: truncate(document.title,44), onClick: () => copyText(document.title, 'Page title copied')},
    ]
}

function screenshotGroup(): MenuEntry[] {
    return [
        {icon: ICONS.camera, label: 'Download screenshot as PNG', onClick: () => screenshotSave()},
        {icon: ICONS.camera, label: 'Copy screenshot as PNG', onClick: () => screenshotCopy()},
    ]
}

function pageMoreEntries(target: Element | null): MenuEntry[] {
    const cleaned = cleanUrl(location.href)
    const scrollEl = findScrollable(target)
    return [
        {icon: ICONS.markdown, label: 'Copy as Markdown link', sublabel: `[${truncate(document.title, 24)}](...)`, onClick: () => copyText(`[${document.title}](${location.href})`, 'Markdown link copied')},
        {icon: ICONS.clean, label: 'Copy clean link', sublabel: cleaned !== location.href ? truncate(cleaned, 44) : 'All clean', onClick: () => copyText(cleaned, 'Clean link copied')},
        'divider',
        {pair: [
            {icon: ICONS.toTop, label: 'Scroll to top', onClick: () => scrollEl.scrollTo({ top:0, behavior: 'smooth'})},
            {icon: ICONS.toBottom, label: 'Scroll to bottom', onClick: () => scrollEl.scrollTo({top: scrollEl.scrollHeight, behavior: 'smooth'})},
        ]},
        {icon: ICONS.inspect, label: 'Inspect element', sublabel: 'Hover, click, or copy selector or HTML', onClick: () => startInpsector()},
        {icon: ICONS.hardReload, label: 'Reset cache and reload', onClick: () => {
            chrome.runtime.sendMessage({type: 'reload-hard'}).catch(() => {
                createToast('Reload').error('Could not reach the extension. Try reloading it from chrome://extensions.')
            })
        }},
        {icon: ICONS.print, label: 'Print page', onClick: () => window.print()},
    ]
}

function cleanUrl(href: string): string {
    const tracking = /^(utm_|fbclid$|gclid$|dclid$|msclkid$|mc_eid$|igshid$|si$|ref_src$|ref_url$|vero_|oly_|_hs|hsa_|yclid$|twclid$|ttclid$|wbraid$|gbraid$|s_kwcid$)/i
    try {
        const u = new URL(href)
        for (const key of [...u.searchParams.keys()]) {
            if (tracking.test(key)) u.searchParams.delete(key)
        } 
        return u.href
    } catch {
        return href
    }
}

function findScrollable(start:Element | null): HTMLElement {
    let el: Element | null = start
    while (el && el !== document.body && el !== document.documentElement) {
        if (el instanceof HTMLElement) {
            const cs = getComputedStyle(el)
            if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 4) return el
        }
        el = el.parentElement
    }
    return (document.scrollingElement as HTMLElement) ?? document.documentElement
}

function pageEntries(link: HTMLAnchorElement | null, selection: string): MenuEntry[] {
    const entries: MenuEntry[] = []

    if (selection) {
        entries.push(
            {icon: ICONS.copy, label: 'Copy', sublabel: `"${truncate(selection, 40)}"`, onClick: () => copyText(selection, 'Copied to clipboard')},
            {icon: ICONS.search, label: 'Search with Google', sublabel: `"${truncate(selection, 40)}"`, onClick: () => openTab(`https://www.google.com/search?q=${encodeURIComponent(selection)}`)},
        'divider',
    )
    }

    if (link) entries.push(...linkGroup(link), 'divider')
    return entries
}

function mediaMoreEntries(link: HTMLAnchorElement | null, target: Element | null, extras: MenuEntry[] = []): MenuEntry[] {
    return [
        ...(extras.length ? [...extras, 'divider' as const] : []),
        ...(link ? [...linkGroup(link), 'divider' as const] : []),
        ...pageCopyGroup(),
        ...pageMoreEntries(target),
        'divider',
        ...screenshotGroup(),
    ]
}

function imageMoreExtras(img: HTMLImageElement): MenuEntry[] {
    const url = img.currentSrc || img.src
    if (!/^https?:/.test(url)) return []
    return [
        {icon: ICONS.lens, label: 'Search image with Google Lens', onClick: () => openTab(`https://lens.google.com/uploadbyurl?url=${encodeURIComponent(url)}`)}
    ]
}

function videoMoreExtras(video: HTMLVideoElement): MenuEntry[] {
    const nudge = (delta: number) => {
        const rate = Math.min(4, Math.max(0.25, Math.round((video.playbackRate + delta) * 4) / 4))
        video.playbackRate = rate
        createToast('Playback speed').success(`Now playing at ${rate}x`)
    }
    return [
        {
        pair: [
            {icon: ICONS.gauge, label: 'Slower', onClick: () => nudge(-0.25)},
            {icon: ICONS.gauge, label: 'Faster', onClick: () => nudge(+0.25)}
        ]
    }]
}

function findMedia(e: MouseEvent, path: EventTarget[]): HTMLImageElement | HTMLVideoElement | null {
    for (const node of path) {
        if (node instanceof HTMLImageElement && (node.currentSrc || node.src)) return node
        if (node instanceof HTMLVideoElement) return node
    }
    for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
        if (el instanceof HTMLVideoElement) return el
        if (el instanceof HTMLImageElement && (el.currentSrc || el.src)) return el
    }
    return null
}

function iamageEntries(img: HTMLImageElement): MenuEntry[] {
    const rawUrl = img.currentSrc || img.src
    const name = filenameFrom(rawUrl, 'image')
    const httpUrl = /^https?:/.test(rawUrl) ? rawUrl : null
    const job = (kind: JobRequest['kind']) => async () => {
        let url: string
        try {
            url = await resolveImageUrl(img)
        } catch {
            createToast('Image').error("Unable to access this image (does the site block CORS?)")
            return
        }
        const request: JobRequest = {kind, url, filename:name}
        if (kind.startsWith('copy')) {
            copyFlow(request, kind === 'copy-png-nobg' ? 'Remove background and copy as PNG' : 'Copy as PNG')
        } else {
            saveFlow(request, titleFor(kind))
        }
    }

    const fmt = imageFormat(rawUrl)
    return [
        {icon: ICONS.savePng, label: 'Save image as PNG', onClick: job('save-png')},
        {icon: ICONS.copy, label: 'Copy image as PNG', onClick: job('copy-png')},
        {icon: magic_icons.save, label: 'Save PNG without background', magic: true, onClick: job('save-png-nobg')},
        {icon: magic_icons.copy, label: 'Copy PNG without background', magic: true, onClick: job('copy-png-nobg')},
        'divider',
        {
            pair: [
                {icon: ICONS.newTab, label: 'Open image in new tab', disabled: !httpUrl, onClick: () => openTab(httpUrl!)},
                {icon: ICONS.link, label: 'Copy image link', disabled: !httpUrl, onClick: () => copyText(httpUrl!, 'Image link copied')}
            ]
        },
        {icon: ICONS.save, label: 'Save image as...', sublabel: fmt? `Original format · ${fmt}` : 'Original format', onClick: job('save-original')},
        {icon: ICONS.copy, label: 'Copy image', sublabel: fmt ?? undefined, onClick: job('copy-png')}
    ]
}

function imageFormat(url: string): string | null {
    const names: Record<string, string> = {
        jpg: 'JPEG',
        jpeg: 'JPEG',
        png: 'PNG',
        webp: 'WebP',
        gif: 'GIF',
        svg: 'SVG',
        'svg+xml': 'SVG',
        avif: 'AVIF',
        bmp: 'BMP',
        ico: 'ICO',
        'x-icon': 'ICO',
        'vnd.microsoft.icon': 'ICO',
    }

    if (url.startsWith('data:')) {
        const m = url.match(/^data:image\/([a-z0-9.+-]+)/i)
        return m ? (names[m[1].toLowerCase()] ?? m[1].toUpperCase()) : null
    } try {
        const m = new URL(url, location.href).pathname.toLowerCase().match(/\.([a-z0-9]+)$/)
        return m ? (names[m[1]] ?? null) : null
    } catch {
        return null
    }
}

function videoEntries(video: HTMLVideoElement): MenuEntry[] {
    const src = videoSrc(video)
    const downloadble = !!src && /^https?:/.test(src)
    const streaming = !!src && src.startsWith('blob:')
    const name = filenameFrom(src ?? '', 'video')

    return [
        {icon: ICONS.film, label: 'Save video as MP4', disabled: !downloadble, sublabel: downloadble ? undefined : streaming ? 'This video cannot be downloaded.' : 'No video source found', onClick: () => saveFlow({kind: 'save-video-mp4', url: src!, filename: name}, 'Save video as MP4')},
        'divider',
        {icon: video.paused ? ICONS.play : ICONS.pause, label: video.paused ? 'Play' : 'Pause', onClick: () => void (video.paused ? video.play() : video.pause())},
        {icon: video.muted ? ICONS.sound : ICONS.mute, label: video.muted ? 'Unmute' : 'Mute', onClick: () => (video.muted = !video.muted)},
        {icon: ICONS.loop, label: 'Loop', checked: video.loop, onClick: () => (video.loop = !video.loop)},
        {icon: ICONS.pip, label: 'Picture in picture', checked: document.pictureInPictureElement === video, onClick: () => {if (document.pictureInPictureElement === video) void document.exitPictureInPicture()
            else void video.requestPictureInPicture().catch(() => createToast('Video').error('Picture-in-picture is not available for this video.'))
        }},
        'divider',
        {
            pair: [
                {icon: ICONS.newTab, label: 'Open video in new tab', disabled: !downloadble, onClick: () => openTab(src!)},
                {icon: ICONS.link, label: 'Copy video link', disabled: !downloadble, onClick: () => copyText(src!, 'Video link copied')}
            ]
        }
    ]
}

function videoSrc(video:HTMLVideoElement): string | null {
    if (video.currentSrc) return video.currentSrc
    if (video.src) return video.src
    const source = video.querySelector('source[src]')
    return source?.getAttribute('src') ? new URL(source.getAttribute('src')!, location.href).href : null
}

function titleFor(kind: JobRequest['kind']): string {
    switch(kind) {
        case 'save-png':
            return 'Save as PNG'
        case 'save-png-nobg':
            return 'Save PNG without background'
        case 'save-original':
            return 'Save image'
        default:
            return 'Save'
    }
}

// screenshot tools
async function screenshotSave(): Promise<void> {
    const filename = `${filenameSafe(document.title) || 'screenshot'}.png`
    const res = (await chrome.runtime
        .sendMessage({type:'screenshot-save', filename})
        .catch((err: Error) => ({ok: false, error: err.message}))) as {ok:boolean; error?:string}
    const toast = createToast('Save screenshot')
    if (res?.ok) toast.success('Download started')
    else toast.error(res?.error ?? 'Screenshot failed. Try again?')
}

async function screenshotCopy(): Promise<void> {
    const res = (await chrome.runtime
        .sendMessage({ type: 'screenshot'})
        .catch((err: Error) => ({ok:false, error:err.message}))) as {
            ok: boolean
            dataUrl?: string
            error?:string
        }
        const toast = createToast('Copy screenshot')
        if (!res?.ok || !res.dataUrl) {
            toast.error(res?.error ?? 'Screenshot failed. Try again?')
            return
        } try {
            await navigator.clipboard.write([new ClipboardItem({'image/png': dataUrltoBlob(res.dataUrl)})])
            toast.success('Copied to clipboard', res.dataUrl)
        } catch (err) {
            toast.error(`Copy failed: ${(err as Error).message}`)
    }
}

interface RunningJob {
    result: Promise<{dataUrl?: string; preview?: string}>
    toast: ToastHandle
}

function runJob(job: JobRequest, title: string): RunningJob {
    let cancelled = false
    const port = chrome.runtime.connect({name: port_name})
    const toast = createToast(title, () => {
        cancelled = true
        try {
            port.postMessage({type: 'cancel'} satisfies PortMessageFrom)
        } catch {
            // atp port is gone, so i dont need anything here
        }
    })

    const result = new Promise<{ dataUrl?: string; preview?:string}>((resolve, reject) => {
        port.onMessage.addListener((m:PortMessageTo) => {
            if (m.type === 'progress') toast.setStage(m.stage, m.ratio)
            else if (m.type === 'done') resolve({dataUrl: m.dataUrl, preview: m.preview})
            else if (m.type === 'error') reject(new Error(m.message))
        })
        port.onDisconnect.addListener(() => {
            reject(new Error(cancelled ? 'cancelled' : 'The extension was reloaded whilst performing an operation. Please try again.'))
        })
    })

    port.postMessage({type:'run', job} satisfies PortMessageFrom)
    return {result, toast}
}


// very important part
// probably shouldnt procrastinate on this

function saveFlow(job: JobRequest, title:string): void {
    const {result, toast} = runJob(job, title)
    result
        .then(({preview}) => toast.success('Download started', preview))
        .catch((err: Error) => {
            if (err.message === 'cancelled') toast.close()
            else toast.error(err.message, () => saveFlow(job,title))
        })
}

async function copyFlow(job: JobRequest, title:string): Promise<void> {
    const {result, toast} = runJob(job, title)
    const blobPromise = result.then(({dataUrl}) => {
        if (!dataUrl) throw new Error('No image data received.')
        return dataUrltoBlob(dataUrl)
    })
    blobPromise.catch(() => {})

    try {
        await navigator.clipboard.write([new ClipboardItem({'image/png': blobPromise})])
        const {dataUrl} = await result
        toast.success('Copied to clipboard', dataUrl)
    } catch {
        let blob: Blob
        let preview: string | undefined
        try{
            blob = await blobPromise
            preview = (await result).dataUrl
        } catch (err) {
            const msg = (err as Error).message
            if (msg === 'cancelled') toast.close()
            else toast.error(msg, () => copyFlow(job, title))
            return
        }

        toast.action('Your image is ready', 'Copy to clipboard', async () => {
            try {
                await navigator.clipboard.write([new ClipboardItem({'image/png': blob})])
                toast.success('Copied to clipboard', preview)
            } catch (copyerr) {
                toast.error(`Copy failed. ${(copyerr as Error).message}`)
            }
        })
    }
}

// text copier
function copyText(text: string, successMessage:string): void {
    const toast = createToast('Copy')
    navigator.clipboard
        .writeText(text)
        .then(() => toast.success(successMessage))
        .catch((err: Error) => toast.error(`Copy failed. ${err.message}`, () => copyText(text, successMessage)))
    }

// helping tools
async function resolveImageUrl(img: HTMLImageElement): Promise<string> {
    const url = img.currentSrc || img.src
    if (!url.startsWith('blob:')) return url
    await img.decode().catch(() => {})
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth || img.width || 1
    canvas.height = img.naturalHeight || img.height || 1
    const ctx = canvas.getContext('2d')
    ctx?.drawImage(img, 0, 0)
    return canvas.toDataURL('image/png')
}

function truncate(s: string, n:number): string {
    return s.length > n ? `${s.slice(0,n-1)}...` : s
}

function filenameSafe(s: string): string {
    return s
        .replace(/[^\w\-. ]+/g, '_')
        .replace(/^[_\-. ]+|[_\-.]+$/g, '')
        .slice(0,80)
}

function filenameFrom(url:string, fallback: string): string {
    try {
        const path = new URL(url, location.href).pathname
        const base = filenameSafe(decodeURIComponent(path.split('/').pop() ?? '').replace(/\.[a-z0-9]{1,5}$/i, ''))
        return base || fallback
    } catch {
        return fallback
    }
}

function dataUrltoBlob(dataUrl: string): Blob {
    const [head, body] = dataUrl.split(',')
    const mime = head.match(/data:([^;]+)/)?.[1] ?? 'image/png'
    const bin = atob(body)
    const bytes = new Uint8Array(bin.length)
    for (let i=0; i<bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new Blob([bytes], {type: mime})
}

window.addEventListener('pagehide', () => closeMenu())