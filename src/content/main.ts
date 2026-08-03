import {port_name} from '../shared/protocol'
import type { JobRequest, PortMessageFrom,PortMessageTo } from '../shared/protocol'
import { showMenu, closeMenu, createToast, ICONS, magic_icons } from './ui'
import type { MenuEntry, NavButton, ToastHandle } from './ui'
import {startInpsector} from './inspect'

const hint_more = 'Hold Shift for more options'
const hint_expand = 'Shift + right-click forces default menu'

window.addEventListener('contextmenu', oncontextmenu, true)

function oncontextmenu(e: MouseEvent): void {
    // something goes here, but i'm procrasinating
}