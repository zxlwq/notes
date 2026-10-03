#!/usr/bin/env node
/* global process, console, fetch, URLSearchParams, AbortSignal */
/*
const $ = new Env('笔记备份')
const $ = cron: 0 1 * * *
笔记备份到 WebDAV / Cloudflare R2 / GitHub Gist
环境变量：
  TOKEN 或 BACKUP_TOKEN  与 Cloudflare Pages 的 TOKEN 相同（必填）
  TG_BOT_TOKEN           Telegram Bot Token（可选，配置后成功才通知）
  TG_USER_ID             Telegram 用户 ID（可选）
  WXPUSH_URL             WXPush 通知地址（可选）
  API_TOKEN              WXPush API Token（可选）
  NOTES_BASE_URL         站点地址，https://项目名.pages.dev
*/

const BASE_URL = (process.env.NOTES_BASE_URL || 'https://项目名.pages.dev').replace(/\/$/, '')
const TOKEN = process.env.BACKUP_TOKEN || process.env.TOKEN || ''
const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || ''
const TG_USER_ID = process.env.TG_USER_ID || ''
const WXPUSH_URL = (process.env.WXPUSH_URL || '').replace(/\/$/, '')
const API_TOKEN = process.env.API_TOKEN || ''

const TARGETS = [
  ['WebDAV', '/api/backup'],
  ['R2', '/api/r2'],
  ['Gist', '/api/gist'],
]

async function backupOne(name, path) {
  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
      body: '{}',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`${name} 备份失败（网络错误：${message}）`)
    return false
  }

  const text = await response.text()
  let data = null
  try {
    data = JSON.parse(text)
  } catch {
    data = null
  }

  if (!response.ok || !data || data.success !== true) {
    console.error(`${name} 备份失败（HTTP=${response.status}）`)
    console.error('响应内容如下：')
    console.error(text)
    return false
  }

  console.log(`${name} 备份成功：${text}`)
  return true
}

async function notifyTelegram() {
  if (!TG_BOT_TOKEN || !TG_USER_ID) {
    console.log('未配置 TG_BOT_TOKEN / TG_USER_ID，跳过 Telegram 通知')
    return
  }

  const time = new Date()
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, ' UTC')
  const host = BASE_URL.replace(/^https?:\/\//, '')
  const text = [
    '✅ *笔记自动备份成功！*',
    `🗂️ 时间：${time}`,
    `🌐 来源：${host}`,
    '📦 WebDAV / Cloudflare R2 / GitHub Gist',
  ].join('\n')

  let response
  try {
    response = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        chat_id: TG_USER_ID,
        text,
        parse_mode: 'Markdown',
      }),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Telegram 通知推送失败（网络错误：${message}）`)
    process.exitCode = 1
    return
  }

  const body = await response.text()
  let data = null
  try {
    data = JSON.parse(body)
  } catch {
    data = null
  }

  if (!response.ok || !data || data.ok !== true) {
    console.error(`Telegram 通知推送失败（HTTP=${response.status}）`)
    console.error(body)
    process.exitCode = 1
    return
  }

  console.log('Telegram 通知推送成功')
}

async function notifyWXPush() {
  if (!WXPUSH_URL || !API_TOKEN) {
    console.log('未配置 WXPUSH_URL / API_TOKEN，跳过 WXPush 通知')
    return
  }

  const time = new Date()
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, ' UTC')
  const host = BASE_URL.replace(/^https?:\/\//, '')
  const title = '笔记自动备份成功'
  const content = [`时间：${time}`, `来源：${host}`, 'WebDAV / Cloudflare R2 / GitHub Gist'].join(
    '\n'
  )

  let response
  try {
    response = await fetch(`${WXPUSH_URL}/wxsend`, {
      method: 'POST',
      headers: {
        Authorization: API_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, content }),
      signal: AbortSignal.timeout(10000),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`WXPush 通知推送失败（网络错误：${message}）`)
    process.exitCode = 1
    return
  }

  const body = await response.text()
  if (!response.ok) {
    console.error(`WXPush 通知推送失败（HTTP=${response.status}）`)
    console.error(body)
    process.exitCode = 1
    return
  }

  console.log('WXPush 通知推送成功')
}

async function main() {
  if (!TOKEN) {
    console.error('缺少环境变量 TOKEN（或 BACKUP_TOKEN）')
    process.exit(1)
  }

  let failed = false
  for (const [name, path] of TARGETS) {
    const ok = await backupOne(name, path)
    if (!ok) failed = true
  }

  if (failed) process.exit(1)
  await notifyTelegram()
  await notifyWXPush()
  if (process.exitCode) process.exit(process.exitCode)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
