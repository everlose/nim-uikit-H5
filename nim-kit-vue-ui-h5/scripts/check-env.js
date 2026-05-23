/**
 * 检查指定环境文件是否存在
 * local: .env.local
 * production: .env.production
 */
import { existsSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const mode = process.argv[2] || 'local'
const envFileName = mode === 'production' ? '.env.production' : '.env.local'
const envPath = resolve(rootDir, envFileName)
const envExamplePath = resolve(rootDir, '.env.example')

// 检查环境文件是否存在
if (!existsSync(envPath)) {
  console.error(`\n\x1b[31m错误: 缺少 ${envFileName} 文件\x1b[0m\n`)
  console.error('\x1b[33m请按以下步骤创建:\x1b[0m')
  console.error(`  1. 复制模板文件:  \x1b[36mcp .env.example ${envFileName}\x1b[0m`)
  console.error(`  2. 编辑 ${envFileName} 填写你的 VITE_NIM_APP_KEY`)
  console.error('')
  console.error(`\x1b[90m${envFileName} 文件不会被提交到 Git 仓库\x1b[0m\n`)
  process.exit(1)
}

// 检查 VITE_NIM_APP_KEY 是否已配置
const envContent = readFileSync(envPath, 'utf-8')
if (!envContent.includes('VITE_NIM_APP_KEY=') || 
    envContent.includes('VITE_NIM_APP_KEY=your_app_key_here') ||
    envContent.match(/VITE_NIM_APP_KEY=\s*$/m)) {
  console.error('\n\x1b[31m╔════════════════════════════════════════════════════════════╗\x1b[0m')
  console.error('\x1b[31m║  错误: VITE_NIM_APP_KEY 未配置                              ║\x1b[0m')
  console.error('\x1b[31m╚════════════════════════════════════════════════════════════╝\x1b[0m\n')
  console.error(`\x1b[33m请在 ${envFileName} 中配置 VITE_NIM_APP_KEY\x1b[0m\n`)
  process.exit(1)
}

console.log('\x1b[32m✓ 环境配置检查通过\x1b[0m')
