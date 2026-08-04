import {defineManifest} from '@crxjs/vite-plugin'

export default defineManifest({
    name: "rightweak",
    manifest_version: 3,
    version: '1.0.1',
    description: 'A Chrome extension that commandeers the right-click context menu for additional user friendliness.',
    icons: {
        16: 'icons/icon16.png',
        32: 'icons/icon32.png',
        48: 'icons/icon48.png',
        128: 'icons/icon128.png'
    },
    background: {
        service_worker: 'src/background/sw.ts',
        type: 'module'
    },
    content_scripts: [
        {
            matches: ['<all_urls>'],
            js: ['src/content/main.ts'],
            run_at: 'document_start',
            all_frames: true,
        },
    ],
    permissions: ['downloads', 'offscreen', 'clipboardWrite'],
    host_permissions: ['<all_urls>'],
    content_security_policy: {
        extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
        sandbox: "sandbox allow-scripts; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'; object-src 'self'; connect-src 'self' data: blob:;", // fsr I have to include wasm unsafe eval, even though the eval is safe :sobb:
    },
    sandbox: { pages: ['src/sandbox/sandbox.html'] }, 
    web_accessible_resources: [ {resources: ['imgly/*', 'ort/*'], matches: ['<all_urls>']}, ],
} as never)