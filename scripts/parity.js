#!/usr/bin/env node
/* global process, console */
/**
 * 检查四后端 API 路由文件是否对齐（仅比对路径存在性，不跑 HTTP）。
 * 用法: node scripts/parity.js
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

/** @type {Record<string, string>} */
const ROUTE_MAP = {
  'api/login.js': 'server/routes/auth.js',
  'api/notes.js': 'server/routes/notes.js',
  'api/notes/[id].js': 'server/routes/notes.js',
  'api/backup.js': 'server/routes/backup.js',
  'api/gist.js': 'server/routes/gist.js',
  'api/r2.js': 'server/routes/r2.js',
  'api/import.js': 'server/routes/notes.js',
  'api/logs.js': 'server/routes/logs.js',
  'api/password.js': 'server/routes/auth.js',
  'api/password/status.js': 'server/routes/auth.js',
  'api/recovery/status.js': 'server/routes/auth.js',
  'api/recovery/setup.js': 'server/routes/auth.js',
  'api/recovery/reset.js': 'server/routes/auth.js',
  'api/session.js': 'server/routes/auth.js',
  'api/logout.js': 'server/routes/auth.js',
  'api/order/[key].js': 'server/routes/order.js',
  'api/cron/logs.js': 'server/context.js',
  'api/ai/status.js': 'server/routes/ai.js',
  'api/ai/complete.js': 'server/routes/ai.js',
}

const CF_MAP = {
  'functions/api/login.ts': 'api/login.js',
  'functions/api/notes.ts': 'api/notes.js',
  'functions/api/notes/[id].ts': 'api/notes/[id].js',
  'functions/api/backup.ts': 'api/backup.js',
  'functions/api/gist.ts': 'api/gist.js',
  'functions/api/r2.ts': 'api/r2.js',
  'functions/api/import.ts': 'api/import.js',
  'functions/api/logs.ts': 'api/logs.js',
  'functions/api/password.ts': 'api/password.js',
  'functions/api/password/status.ts': 'api/password/status.js',
  'functions/api/recovery/status.ts': 'api/recovery/status.js',
  'functions/api/recovery/setup.ts': 'api/recovery/setup.js',
  'functions/api/recovery/reset.ts': 'api/recovery/reset.js',
  'functions/api/session.ts': 'api/session.js',
  'functions/api/logout.ts': 'api/logout.js',
  'functions/api/order/[key].ts': 'api/order/[key].js',
  'functions/api/ai/status.ts': 'api/ai/status.js',
  'functions/api/ai/complete.ts': 'api/ai/complete.js',
  'functions/api/cron/logs.ts': 'api/cron/logs.js',
}

const EDGE_MAP = {
  'edge-functions/api/login.js': 'api/login.js',
  'edge-functions/api/notes.js': 'api/notes.js',
  'edge-functions/api/notes/[id].js': 'api/notes/[id].js',
  'edge-functions/api/backup.js': 'api/backup.js',
  'edge-functions/api/gist.js': 'api/gist.js',
  'edge-functions/api/r2.js': 'api/r2.js',
  'edge-functions/api/import.js': 'api/import.js',
  'edge-functions/api/logs.js': 'api/logs.js',
  'edge-functions/api/password.js': 'api/password.js',
  'edge-functions/api/password/status.js': 'api/password/status.js',
  'edge-functions/api/recovery/status.js': 'api/recovery/status.js',
  'edge-functions/api/recovery/setup.js': 'api/recovery/setup.js',
  'edge-functions/api/recovery/reset.js': 'api/recovery/reset.js',
  'edge-functions/api/session.js': 'api/session.js',
  'edge-functions/api/logout.js': 'api/logout.js',
  'edge-functions/api/order/[key].js': 'api/order/[key].js',
  'edge-functions/api/ai/status.js': 'api/ai/status.js',
  'edge-functions/api/ai/complete.js': 'api/ai/complete.js',
  'edge-functions/api/cron/logs.js': 'api/cron/logs.js',
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel))
}

function checkPairs(label, pairs) {
  const missing = []
  for (const [file, reference] of Object.entries(pairs)) {
    if (!exists(file)) missing.push(`${label}: missing ${file}`)
    if (reference && !exists(reference)) missing.push(`${label}: reference missing ${reference}`)
  }
  return missing
}

const issues = [
  ...checkPairs('vercel', ROUTE_MAP),
  ...checkPairs('cloudflare', CF_MAP),
  ...checkPairs('edgeone', EDGE_MAP),
]

if (issues.length) {
  console.error('API parity check failed:\n' + issues.map((i) => `  - ${i}`).join('\n'))
  process.exit(1)
}

console.warn('API parity check passed (route files present across backends).')
