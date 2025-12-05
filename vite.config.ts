// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import devServer from '@hono/vite-dev-server'
import { config } from 'dotenv'

// .env.localを読み込み（開発時）
config({ path: '.env.local' })

export default defineConfig({
    plugins: [
        react(),
        devServer({
            entry: 'src/index.ts',
            exclude: [
                /^(?!\/api\/).*$/,  // /api/以外のすべてを除外
            ],
            injectClientScript: false
        })
    ],
    build: {
        rollupOptions: {
            input: './index.html'
        },
        outDir: 'dist'
    }
})