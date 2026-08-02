import css from './styles.css?inline'

let shadow: ShadowRoot | null = null
let toastStack: HTMLDivElement | null = null

export function uiRoot(): ShadowRoot {
    return root()
}

function root(): ShadowRoot {
    if (shadow && shadow.host.isConnected) return shadow
    const host = document.createElement('rightweak-ui')
    host.style.cssText = 'all:initial;position:fixed;left:0;top:0;width:0;height:0;z-index:2147483647;'
    ;(document.documentElement || document).appendChild(host)
    shadow = host.attachShadow({mode: 'open'})
    const style = document.createElement('style')
    style.textContent = css
    shadow.appendChild(style)
    toastStack = null
    return shadow
}

export const ICONS = {
    savePng: '<svg viewBox="0 0 24 24"><path d="M12 3v11m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"><path d="M5 12H4a2 2 0 0 1-2-2V4a2 2 0 0 1 22-2h9a2 2 0 0 1 2 2v1"/></svg>',
    magic: '<svg viewBox="0 0 24 24"><path d="m5 19 9-9m2.5-2.5L19 5M15 5l.9 2.1L18 8l-2.1.9L15 11l-.9-2.1L12 8l2.1-.9zM19 12l.6 1.4L21 14l-1.4.6L19 16l-.6-1.4L17 14l1.4-.6zM7 3l.6 1.4L9 5l-1.4.6L7 7l-.6-1.4L5 5l1.4-.6z"/></svg>',
    film: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 10h4M3 14h4M17 10h4M17 14h4"/></svg>',
    newTab: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4 11 13M18 13v6a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5H11"/></svg>',
    save: '<svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>',
    link: '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M19 12H5m0 0 6-6m-6 6 6 6"/></svg>',
    forward: '<svg viewBox="0 0 24 24"><path d="M5 12h14m0 0-6-6m6 6-6 6"/></svg>', 
    reload: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-1.2 5.3M20 5v6h-6"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.9-4.9"/></svg>',
    camera: '<svg viewBox="0 0 24 24"><path d="M4 8h2.5L9 5h6l2.5 3H20a1.5 1.5 0 0 1 1.5 1.5V18A1.5 1.5 0 0 1 20 19.5H4A1.5 1.5 0 0 1 2.5 18V9.5A1.5 1.5 0 0 1 4 8z"/><circle cx="12" cy="13.3" r="3.4"/></svg>',
    print: '<svg viewBox="0 0 24 24"><path d="M7 8V3h10v5M7 17H4a1.5 1.5 0 0 1-1.5-1.5v-6A1.5 1.5 0 0 1 4 8h16a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 20 17h-3"/><path d="M7 14h10v7H7z"/></svg>',
    text: '<svg viewBox="0 0 24 24"><path d="M4 7V5h16v2M12 5v14m-3 0h6"/></svg>',
    markdown: '<svg viewBox="0 0 24 24"><rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 15v-6l2.5 3L11 9v6m4-6v6m0 0-2.5-2.5M15 15l2.5-2.5"/></svg>',
    title: '<svg viewBox="0 0 24 24"><path d="M5 5h14M9 5v14m6-14v14M6 19h6m3 0h4"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M7 5.5v13l11-6.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M8 5v14m8-14v14"/></svg>',
    mute: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9zM17 9l4 6m0-6-4 6"/></svg>',
    sound:  '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
    loop: '<svg viewBox="0 0 24 24"><path d="M17 2.5 20 5.5l-3 3"/><path d="M4 11V9.5a4 4 0 0 1 4-4h12M7 21.5l-3-3 3-3"/><path d="M20 13v1.5a4 4 0 0 1-4 4H4"/></svg>',
    pip: '<svg viewBox="0 0 24 24"><rect x="2.5" y="5" width="19" height="14" rx="2"/><rect x="12" y="12" width="7" height="5" rx="1" fill="currentColor" stroke="none"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="m5 13 5 5L20 7"/></svg>',
    inspect: '<svg viewBox="0 0 24 24"><path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3"/><path d="m12 12 8.5 3.2-3.7 1.6-1.6 3.7z"/></svg>',
    clean: '<svg viewBox="0 0 24 24"><path d="M3 5h18l-7 8v5.5L10 21v-8z"/></svg>',
    toTop: '<svg viewBox="0 0 24 24"><path d="M5 4h14M12 20V8m0 0-5 5m5-5 5 5"/></svg>',
    toBottom: '<svg viewBox="0 0 24 24"><path d="M5 20h14M12 4v12m0 0-5-5m5 5 5-5"/></svg>',
    gauge: '<svg viewBox="0 0 24 24"><path d="M5 18a8.5 8.5 0 1 1 14 0M12 14l4-5"/><circle cx="12" cy="15" r="1.4"/></svg>',
    lens: '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.9-4.9M7.5 12l2-2.4 1.7 1.7 2-2.3"/></svg>',
    hardReload: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-1.2 5.3M20 5v6h-6"/><path d="M9 12.5 11 15l4-4.5"/></svg>',
} as const

const magicGradient = (id:string, body:string) => `<svg viewBox="0 0 24 24"><defs><linearGradient id="${id}" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#4f7cf7"/><stop offset="0.55" stop-color="#8b5cf6"/><stop offset="1" stop-color="#d357d3"/></linearGradient></defs><g stroke="url(#${id})">${body}</g></svg>`

export const magic_icons = {
    save: magicGradient('rightweak-magic-save', '<path d="M12 3v11m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>'),
    copy: magicGradient('rightweak-magic-copy', '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>')
} as const

const svg_spinner = '<svg viewBox="0 0 24 24" class="spin" fill="none" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9" opacity="0.25" stroke="currentColor"/><path d="M21 12a9 9 0 0 0-9-9"/></svg>'
const svg_ok = '<svg viewBox="0 0 24 24" class="ok" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m4.5 12.5 5 5 10-11"/></svg>'
const svg_err = '<svg viewBox="0 0 24 24" class="err" fill="none" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V13M12 16.5v.01"/></svg>'
const svg_x = '<svg viewBox="0 0 24 24" fill="none"><path d="M5 5l14 14M19 5 5 19"/></svg>'

// MENU OPTIONS

export interface NavButton {
    icon:string
    title:string
    disabled?: boolean
    onClick: () => void
}

export interface PairAction {
    label: string
    icon: string
    disabled?: boolean
    onClick: () => void
}

export type MenuEntry = 
    | 'divider'
    | {pair: [PairAction, PairAction]}
    | {
        label: string
        icon: string
        disabled?: boolean
        sublabel?: string
        checked?: boolean
        magic?: boolean
        onClick?: () => void
    }

export interface MenuOptions {
    nav?: NavButton[]
    entries: MenuEntry[]
    more?: MenuEntry[]
    hint?: string
    expandedHint?: string
}

let openMenuCleanup: (() => void) | null = null

export function closeMenu(): void {
    openMenuCleanup?.()
    openMenuCleanup = null
}

// input devouring for context menu open/close

function swallowClickGesture(): void {
    const types = ['mousedown', 'pointerup', 'mouseup', 'click'] as const
    const swallow = (ev: Event) => {
        ev.preventDefault()
        ev.stopImmediatePropagation()
    }
    for (const type of types) window.addEventListener(type,swallow, {capture:true, once:true})
    setTimeout(() => {
        for (const type of types) window.removeEventListener(type, swallow, {capture:true} as EventListenerOptions)
    }, 800)
}

export function showMenu(x:number, y:number, options:MenuOptions): void {
    closeMenu()
    const sh = root()
    const wrap = document.createElement('div')
    wrap.className = 'rightweak'
    const menu = document.createElement('div')
    wrap.appendChild(menu)

    if (options.nav?.length) {
        const nav = document.createElement('div')
        nav.className = 'menu-nav'
        for (const b of options.nav) {
            const btn = document.createElement('button')
            btn.type = 'button'
            btn.title = b.title
            btn.disabled = !!b.disabled
            btn.innerHTML = b.icon
            if (!b.disabled) {
                btn.addEventListener('click', () => {
                    closeMenu()
                    b.onClick()
                })
            }
            nav.appendChild(btn)
        }
        menu.appendChild(nav)
    }
}