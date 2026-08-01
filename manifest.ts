import {defineManifest} from '@crxjs/vite-plugin'

export default defineManifest({
    manifest_version: 3,
    version: '0.0.1',
    description: 'A Chrome extension that commandeers the right-click context menu for additional user friendliness.',
    icons: {
        16: 'icons/icon16.png',
        32: 'icons/icon32.png',
        48: 'icons/icon48.png',
        128: 'icons/icon128.png'
    },
    background: {
        service_worker: 'src/background/service.ts',
        type: 'module'
    }
})