import defineConfig from 'vite'
import crx from '@crxjs/vite-plugin'
import manifest from './manifest.config.ts'
// i know this is bad syntax but i could not be fucked

export default defineConfig({
    plugins: [crx({manifest})],
    resolve: {alias:{'onnxruntime-web': 'onnxruntime-web/wasm'}},
    build: {
        target: 'es2022',
        modulePreload: false, // it would not work with true
        chunkSizeWarningLimit: 1000000000000 // larg number
        rollupOptions: {input:{offscreen:'src/offscreen/offscreen.html', sandbox:'src/sandbox/sandbox.html'},},
    },
})

// again, i cannot be bothered to do better