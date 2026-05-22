/**
 * Run Vite with one explicit environment file.
 *
 * Vite normally loads .env.local together with production mode files. This
 * wrapper keeps the project scripts strict:
 * - local -> .env.local
 * - production -> .env.production
 */
import { existsSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const mode = process.argv[2] || 'local'
const args = process.argv.slice(3)
const envFileName = mode === 'production' ? '.env.production' : '.env.local'
const viteMode = mode === 'production' ? 'production' : 'development'
const envPath = resolve(rootDir, envFileName)
const emptyEnvDir = resolve(rootDir, 'scripts')

if (!existsSync(envPath)) {
  console.error(`Missing ${envFileName}`)
  process.exit(1)
}

const parseEnv = (content) => {
  const env = {}
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const index = trimmed.indexOf('=')
    if (index === -1) return
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    env[key] = value
  })
  return env
}

const viteBin = resolve(rootDir, 'node_modules/vite/bin/vite.js')
const viteArgs = [...args, '--mode', viteMode]
const childEnv = { ...process.env }

Object.keys(childEnv).forEach((key) => {
  if (key.startsWith('VITE_')) {
    delete childEnv[key]
  }
})

const child = spawn(process.execPath, [viteBin, ...viteArgs], {
  cwd: rootDir,
  stdio: 'inherit',
  env: {
    ...childEnv,
    ...parseEnv(readFileSync(envPath, 'utf-8')),
    VITE_STRICT_ENV_DIR: emptyEnvDir
  }
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})
