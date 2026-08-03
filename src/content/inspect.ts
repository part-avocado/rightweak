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

    let curernt: Element | null = null
    const describe = (el: Element): string => {
        const r = el.getBoundingClientRect()
        const id = el.id ? `#${el.id}` : ''
        const cls = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0,2).join('.') : ''
        return `${el.tagName.toLowerCase()}${id}${cls} · ${Math.round(r.width)}x${Math.round(r.height)}`
    }
}