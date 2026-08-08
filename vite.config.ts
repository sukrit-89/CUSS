import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

// https://vite.dev/config/
function resolveApiRoute(apiRoot: string, pathname: string): string | null {
  const segments = pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean)

  if (segments.length === 0) return null

  const walk = (currentDir: string, index: number): string | null => {
    const segment = segments[index]
    const isLast = index === segments.length - 1

    if (isLast) {
      const exactFile = path.join(currentDir, `${segment}.ts`)
      if (fs.existsSync(exactFile)) return exactFile

      const jsFile = path.join(currentDir, `${segment}.js`)
      if (fs.existsSync(jsFile)) return jsFile

      const wildcardFile = fs
        .readdirSync(currentDir)
        .find((entry) => /^\[.*\]\.(ts|js)$/.test(entry))

      return wildcardFile ? path.join(currentDir, wildcardFile) : null
    }

    const nextExactDir = path.join(currentDir, segment)
    if (fs.existsSync(nextExactDir) && fs.statSync(nextExactDir).isDirectory()) {
      const resolved = walk(nextExactDir, index + 1)
      if (resolved) return resolved
    }

    const wildcardDir = fs
      .readdirSync(currentDir)
      .find((entry) => /^\[.*\]$/.test(entry) && fs.statSync(path.join(currentDir, entry)).isDirectory())

    if (wildcardDir) {
      return walk(path.join(currentDir, wildcardDir), index + 1)
    }

    return null
  }

  return walk(apiRoot, 0)
}

function extractRouteParams(apiRoot: string, routeFile: string, pathname: string): Record<string, string> {
  const routeSegments = path
    .relative(apiRoot, routeFile)
    .replace(/\.(ts|js)$/, '')
    .split(path.sep)
    .filter(Boolean)
  const pathSegments = pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean)
  const params: Record<string, string> = {}

  for (let index = 0; index < routeSegments.length; index += 1) {
    const routeSegment = routeSegments[index]
    const pathSegment = pathSegments[index]

    if (!pathSegment) continue

    const match = routeSegment.match(/^\[(.+)\]$/)
    if (match) {
      params[match[1]] = pathSegment
    }
  }

  return params
}

async function readRequestBody(req: any): Promise<unknown> {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return undefined
  }

  const chunks: Buffer[] = []

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  const rawBody = Buffer.concat(chunks).toString('utf8')

  if (!rawBody) return {}

  const contentType = String(req.headers?.['content-type'] || '')
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(rawBody)
    } catch {
      return {}
    }
  }

  return rawBody
}

function enhanceResponse(res: any) {
  if (!res.status) {
    res.status = (code: number) => {
      res.statusCode = code
      return res
    }
  }

  if (!res.json) {
    res.json = (payload: unknown) => {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(payload))
      return res
    }
  }

  if (!res.send) {
    res.send = (payload: unknown) => {
      if (typeof payload === 'string' || Buffer.isBuffer(payload)) {
        res.end(payload)
      } else {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(payload))
      }
      return res
    }
  }
}

function devApiRouter() {
  const apiRoot = path.resolve(__dirname, './api')

  const seedApiEnv = (mode: string) => {
    // loadEnv with prefix '' loads ALL variables from .env regardless of prefix
    const env = loadEnv(mode, process.cwd(), '')

    process.env.SUPABASE_URL ||= env.SUPABASE_URL || env.VITE_SUPABASE_URL
    process.env.SUPABASE_ANON_KEY ||= env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY
    // Service role key must NOT fall back to anon key — anon key cannot call
    // service-role-restricted RPCs like begin_gasless_op.
    process.env.SUPABASE_SERVICE_ROLE_KEY ||= env.SUPABASE_SERVICE_ROLE_KEY
    process.env.FEE_PAYER_SECRET ||= env.FEE_PAYER_SECRET
    process.env.STELLAR_HORIZON_URL ||= env.STELLAR_HORIZON_URL || env.VITE_HORIZON_URL
    process.env.STELLAR_NETWORK_PASSPHRASE ||=
      env.STELLAR_NETWORK_PASSPHRASE || env.VITE_NETWORK_PASSPHRASE
    process.env.STELLAR_USDC_ISSUER ||= env.STELLAR_USDC_ISSUER || env.VITE_USDC_ISSUER
    process.env.STELLAR_USDC_CODE ||= env.STELLAR_USDC_CODE || env.VITE_USDC_ASSET_CODE || 'USDC'
    process.env.RERAIL_REGISTRY_CONTRACT_ID ||=
      env.RERAIL_REGISTRY_CONTRACT_ID || env.VITE_RERAIL_REGISTRY_CONTRACT_ID
    process.env.REGISTRY_ADMIN_SECRET ||= env.REGISTRY_ADMIN_SECRET
    process.env.STELLAR_SOROBAN_RPC_URL ||= env.STELLAR_SOROBAN_RPC_URL || env.VITE_SOROBAN_RPC_URL
  }

  return {
    name: 'dev-api-router',
    configureServer(server: any) {
      seedApiEnv(server.config.mode)

      // Warn early if critical server-side secrets are missing so the developer
      // knows before hitting an API route that returns a confusing 500.
      const missing: string[] = []
      if (!process.env.FEE_PAYER_SECRET) missing.push('FEE_PAYER_SECRET')
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
      if (missing.length > 0) {
        console.warn(
          `\n⚠️  [dev-api] Missing server-side env vars: ${missing.join(', ')}\n` +
          `   Gasless API routes will fail. Set them in .env\n`
        )
      }

      server.middlewares.use(async (req: any, res: any, next: any) => {
        const requestUrl = req.url ? new URL(req.url, 'http://localhost') : null

        if (!requestUrl || !requestUrl.pathname.startsWith('/api/')) {
          next()
          return
        }

        const routeFile = resolveApiRoute(apiRoot, requestUrl.pathname)

        if (!routeFile) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'API route not found' }))
          return
        }

        try {
          const routeParams = extractRouteParams(apiRoot, routeFile, requestUrl.pathname)
          req.query = {
            ...Object.fromEntries(requestUrl.searchParams.entries()),
            ...routeParams,
          }
          req.params = routeParams
          req.body = await readRequestBody(req)
          enhanceResponse(res)

          const mod = await server.ssrLoadModule(routeFile)

          if (typeof mod.default !== 'function') {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'API handler missing default export' }))
            return
          }

          await mod.default(req, res)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Dev API route failed'
          const stack = error instanceof Error ? error.stack : undefined
          // Always log to terminal so the developer can see what went wrong
          console.error(`\n[dev-api] ${req.method} ${requestUrl.pathname} → ERROR\n${stack ?? message}\n`)
          if (!res.writableEnded) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: message }))
          }
        }
      })
    },
    configurePreviewServer(server: any) {
      seedApiEnv(server.config.mode)
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    devApiRouter(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    // Required for some Stellar SDK dependencies that reference `global`
    global: 'globalThis',
  },
})
