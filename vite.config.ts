// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { config } from 'dotenv'

// .env.localを読み込み（開発時）
config({ path: '.env.local' })

export default defineConfig(async ({ mode }) => {
    const plugins = [react()]

    // 開発環境でのみdevServerプラグインを使用
    if (mode === 'development') {
        const devServer = await import('@hono/vite-dev-server')
        plugins.push(
            devServer.default({
                entry: 'src/index.ts',
                exclude: [
                    /^(?!\/api\/).*$/,  // /api/以外のすべてを除外
                ],
                injectClientScript: false
            })
        )
    }

    return {
        plugins,
        build: {
            rollupOptions: {
                input: './index.html'
            },
            outDir: 'dist'
        }
    }
})