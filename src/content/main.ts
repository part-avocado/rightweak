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