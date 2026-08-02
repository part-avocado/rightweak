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