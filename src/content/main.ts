import {port_name} from '../shared/protocol'
import type { JobRequest, PortMessageFrom,PortMessageTo } from '../shared/protocol'
import { showMenu, closeMenu, createToast, ICONS, magic_icons } from './ui'
import type { MenuEntry, NavButton, ToastHandle } from './ui'
import {startInpsector} from './inspect'

const hint_more = 'Hold Shift for more options'
const hint_expand = 'Shift + right-click forces default menu'

window.addEventListener('contextmenu', oncontextmenu, true)

function oncontextmenu(e: MouseEvent): void {
    if (e.shiftKey) return
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
            more: mediaMoreEntries(link, imageMoreExtras(media)),
            hint: hint_more,
            expandedHint: hint_expand,
        })
    } else if (media instanceof HTMLVideoElement) {
        showMenu(e.clientX, e.clientY, {
            entries: videoEntries(media),
            more: mediaMoreEntries(link, videoMoreExtras(media)),
            hint: hint_more,
            expandedHint: hint_expand,
        })
    } else {
        showMenu(e.clientX, e.clientY, {
            nav: navButtons(),
            entries: pageEntries(link, selection),
            more: pageMoreEntries(),
            hint: hint_more,
            expandedHint: hint_expand,
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

function linkGroup(link: HTMLAnchorElement): MenuEntry[] {
    const text = (link.textContent ?? '').trim().replace(/\s+/g, ' ')
    return [
        {icon: ICONS.newTab, label: 'Open link in new tab', onClick: () => void chrome.runtime.sendMessage({type: "open-tab", url: link.href})},
        {icon: ICONS.link, label: "Copy link address", sublabel: link.href, onClick: () => copyText(link.href, 'Link address copied')},
        ...(text ? [{icon: ICONS.text, label: 'Copy link text', sublabel: `"${truncate(text,40)}`, onClick: () => copyText(text, 'Link text copied')} satisfies MenuEntry] : [])
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

function pageMoreEntries(): MenuEntry[] {
    const cleaned = cleanUrl(location.href)
    return [
        {icon: ICONS.markdown, label: 'Copy as Markdown link', sublabel: `[${truncate(document.title, 24)}](...)`, onClick: () => copyText(`[${document.title}](${location.href})`, 'Markdown link copied')},
        {icon: ICONS.clean, label: 'Copy clean link', sublabel: cleaned !== location.href ? truncate(cleaned, 44) : 'All clean', onClick: () => copyText(cleaned, 'Clean link copied')},
        'divider',
        {pair: [
            {icon: ICONS.toTop, label: 'Scroll to top', onClick: () => window.scrollTo({ top:0, behavior: 'smooth'})},
            {icon: ICONS.toBottom, label: 'Scroll to bottom', onClick: () => window.scrollTo({top: document.documentElement.scrollHeight, behavior: 'smooth'})},
        ]},
        {icon: ICONS.inspect, label: 'Inspect element', sublabel: 'Hover, click, or copy selector or HTML', onClick: () => startInpsector()},
        {icon: ICONS.hardReload, label: 'Reset cache and reload', onClick: () => void chrome.runtime.sendMessage({type: 'reload-hard'})},
        {icon: ICONS.print, label: 'Print page', onClick: () => window.print()},
    ]
}

function cleanUrl(href: string): string {
    const tracking = /^(utm_|fbclid$|gclid$|dclid$|msclkid$|mc_eid$|igshid$|si$|ref_src$|ref_url$|vero_|oly_|_hs|hsa_|yclid$|twclid$|ttclid$|wbraid$|gbraid$|s_kwcid$)/i
    try {
        const u = new URL(href)
        for (const key of [...u.searchParams.keys()]) {
            if (tracking.text(key)) u.searchParams.delete(key)
        } 
        return u.href
    } catch {
        return href
    }
}        

function pageEntries(link: HTMLAnchorElement | null, selection: string): MenuEntry[] {
    const entries: MenuEntry[] = []

    if (selection) {
        entries.push(
            {icon: ICONS.copy, label: 'Copy', sublabel: `"${truncate(selection, 40)}"`, onClick: () => copyText(selection, 'Coped to clipboard')},
            {icon: ICONS.search, label: 'Search with Google', sublabel: `"${truncate(selection, 40)}"`, onClick: () => void chrome.runtime.sendMessage({type: 'open-tab', url: `https://www.google.com/search?q=${encodeURIComponent(selection)}`,})
        },
        'divider',
    )
    }

    if (link) entries.push(...linkGroup(link), 'divider')
    return entries
}

function mediaMoreEntries(link: HTMLAnchorElement | null, extras: MenuEntry[] = []): MenuEntry[] {
    return [
        ...(extras.length ? [...extras, 'divider' as const] : []),
        ...(link ? [...linkGroup(link), 'divider' as const] : []),
        ...pageCopyGroup(),
        ...pageMoreEntries(),
        'divider',
        ...screenshotGroup(),
    ]
}

function imageMoreExtras(img: HTMLImageElement): MenuEntry[] {
    const url = img.currentSrc || img.src
    if (!/^https?:/.text(url)) return []
    return [
        {icon: ICONS.lens, label: 'Search image with Google Lens', onClick: () => void chrome.runtime.sendMessage({type: 'open-tab', url: `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(url)}`})}
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