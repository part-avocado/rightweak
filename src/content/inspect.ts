import { uiRoot, createToast } from './ui'
let active = false

export function startInpsector(): void {
    if (active) return
    active = true
    const sh = uiRoot()
    const wrap = document.createElement('div')
    wrap.className = 'rightweak'
    wrap.innerHTML = `
    <div class="inspect-box" hidden></div>
    <div class="inspect-tag" hidden></div>
    <div class="inspect-hint"> Click an element to inspect · Press escape to exit</div>
    `

    sh.appendChild(wrap)
    const box = wrap.querySelector('.inspect-box') as HTMLElement
    const tag = wrap.querySelector('.inspect-tag') as HTMLElement
    const prevCursor = document.documentElement.style.cursor
    document.documentElement.style.cursor = 'crosshair'

    let current: Element | null = null
    const describe = (el: Element): string => {
        const r = el.getBoundingClientRect()
        const id = el.id ? `#${el.id}` : ''
        const cls = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0,2).join('.') : ''
        return `${el.tagName.toLowerCase()}${id}${cls} · ${Math.round(r.width)}x${Math.round(r.height)}`
    }

    const highlight = (el: Element | null) => {
        current = el
        if (!el) {
            box.hidden = tag.hidden = true
            return
        }
        const r = el.getBoundingClientRect()
        box.hidden = tag.hidden = false
        box.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`
        tag.textContent = describe(el)
        tag.style.left = `${Math.max(8, Math.min(r.left, innerWidth - 260))}px`
        tag.style.top = r.top > 34 ? `${r.top - 28}px` : `${r.bottom + 6}px`
    }

    const onMove = (ev: PointerEvent) => {
        const el = document.elementFromPoint(ev.clientX, ev.clientY)
        highlight(el && el !== document.documentElement && el !== document.body ? el : null)
    }

    const stop = () => {
        active = false
        document.documentElement.style.cursor = prevCursor
        window.removeEventListener('pointermove', onMove, true)
        window.removeEventListener('pointerdown', onPick, true)
        window.removeEventListener('click', swallow, true)
        window.removeEventListener('contextmenu', swallow, true)
        window.removeEventListener('keydown', onkeydown, true)
        wrap.remove()
    }

    const swallow = (ev: Event) => {
        ev.preventDefault()
        ev.stopImmediatePropagation()
    }

    const onkeydown = (ev: KeyboardEvent) => {
        if (ev.key === 'Escape') {
            swallow(ev)
            stop()
        }
    }

    const onPick = (ev: PointerEvent) => {
        swallow(ev)
        const el = current
        stop()
        if (el) showCard(el, ev.clientX, ev.clientY)
    }

    window.addEventListener('pointermove', onMove, true)
    window.addEventListener('pointerdown', onPick, true)
    window.addEventListener('click', swallow, true)
    window.addEventListener('contextmenu', swallow, true)
    window.addEventListener('keydown', onkeydown, true)
}

function selectorFor(el: Element): string {
    if (el.id) return `#${CSS.escape(el.id)}`
    const parts: string[] = []
    let cur: Element | null = el
    while (cur && cur !== document.body && cur !== document.documentElement && parts.length < 4) {
        if (cur.id) {
            parts.unshift(`#${CSS.escape(cur.id)}`)
            break
        }
        let part = cur.tagName.toLowerCase()
        const classes = [...cur.classList].slice(0,2)
        if (classes.length) {
            part += classes.map((c) => `.${CSS.escape(c)}`).join('')
        } else if (cur.parentElement) {
            const same = [...cur.parentElement.children].filter((n)=> n.tagName === cur!.tagName)
            if (same.length > 1) part += `:nth-of-type(${same.indexOf(cur)+1})`
        }
        parts.unshift(part)
        cur = cur.parentElement
    }
    return parts.join(' > ')
}

function showCard(el: Element, x: number, y:number): void {
    const sh = uiRoot()
    const rect = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    const selector = selectorFor(el)
    const fontFamily = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim()
    const wrap = document.createElement('div')
    wrap.className = 'rightweak'
    const card = document.createElement('div')
    card.className = 'inspect-card'
    card.innerHTML = `
    <div class="ic-head">
        <span class="ic-title"></span>
        <button class="ic-x" type="button" title="Close">x</button>
    </div>
    <div class="ic-selector" title=""></div>
    <div class="ic-rows">
        <span>Size</span><span class="ic-size"></span>
        <span>Font</span><span class="ic-font"></span>
        <span>Color</span><span><i class="ic-swatch ic-c1"></i><span class="ic-color"></span></span>
        <span>Background</span><span><i class="ic-swatch ic-c2"></i><span class="ic-bg"></span></span>
    </div>
    <div class="ic-actions">
        <button type="button" class="toast-btn ghost ic-copy-html">Copy HTML</button>
        <button type="button" class="toast-btn ic-copy-sel">Copy selector</button>
    </div>
    `

    wrap.appendChild(card)
    sh.appendChild(wrap)

    const q = (sel: string) => card.querySelector(sel) as HTMLElement
    q('.ic-title').textContent = `<${el.tagName.toLowerCase()}`
    q('.ic-selector').textContent = selector
    q('.ic-selector').title = selector
    q('.ic-size').textContent = `${Math.round(rect.width)} x ${Math.round(rect.height)} px`
    q('.ic-font').textContent = `${fontFamily} · ${cs.fontSize}`
    q('.ic-color').textContent = cs.color
    q('.ic-bg').textContent = cs.backgroundColor
    q('.ic-c1').style.background = cs.color
    q('.ic-c2').style.background = cs.backgroundColor

    const PAD = 12
    card.style.left = `${Math.max(PAD, Math.min(x, innerWidth - card.offsetWidth - PAD))}px`
    card.style.top = `${Math.max(PAD, Math.min(y+10, innerHeight - card.offsetHeight))}px`

    const close = () => {
        window.removeEventListener('keydown', onKey, true)
        wrap.remove()
    }

    const onKey = (ev: KeyboardEvent) => {
        if (ev.key === "Escape") {
            ev.stopImmediatePropagation()
            close()
        }
    }

    window.addEventListener('keydown', onKey, true)

    q('.ic-x').addEventListener('click', close)
    q('.ic-copy-sel').addEventListener('click', () => {
        void navigator.clipboard.writeText(selector).then(
            () => {
                close()
                createToast('Inspect').success('Selector copied')
            }, 
            () => createToast('Inspect').error('Copy failed')
        )
    })
    q('.ic-copy-html').addEventListener('click', () => {
        void navigator.clipboard.writeText((el as HTMLElement).outerHTML).then(
            () => {
                close()
                createToast('Inspect').success('Element HTML copied.')
            },
            () => createToast('Inspect').error('Copy failed.')
        )
    })
}