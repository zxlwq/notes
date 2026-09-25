#!/usr/bin/env node
/* global process, console, Buffer, TextEncoder */
/**
 * 用 --key 把备份里的 enc:v1 密文解成明文 JSON。
 * 不要用本脚本上传。明文文件请在前端「设置 → 导入」里手动选择。
 *
 * 用法:
 *   node scripts/decrypt.js --file notes.md --key "加密密钥"
 *   node scripts/decrypt.js --file notes.json --key "加密密钥" --out plain.json
 *   node scripts/decrypt.js --self-test
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { formatNotesToMarkdown, parseBackupToNotes } from '../shared/backup.js'

const ENC_PREFIX = 'enc:v1:'
const SALT_LENGTH = 16
const IV_LENGTH = 12
const TAG_LENGTH = 16
const PBKDF2_ITERATIONS = 100_000

function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(ENC_PREFIX)
}

function decryptValue(ciphertext, password) {
  if (!ciphertext) return ciphertext
  if (!isEncrypted(ciphertext)) return ciphertext

  const payload = Buffer.from(ciphertext.slice(ENC_PREFIX.length), 'base64')
  if (payload.length <= SALT_LENGTH + IV_LENGTH + TAG_LENGTH) {
    throw new Error('密文长度无效')
  }

  const salt = payload.subarray(0, SALT_LENGTH)
  const iv = payload.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const data = payload.subarray(SALT_LENGTH + IV_LENGTH)
  const tag = data.subarray(data.length - TAG_LENGTH)
  const encrypted = data.subarray(0, data.length - TAG_LENGTH)
  const key = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha256')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)

  try {
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
  } catch {
    throw new Error('无法解密，请确认 --key 与加密时一致')
  }
}

function decryptTags(tags, password) {
  if (!Array.isArray(tags) || tags.length === 0) return []
  if (tags.length === 1 && isEncrypted(tags[0])) {
    const decrypted = decryptValue(tags[0], password)
    const parsed = JSON.parse(decrypted)
    return Array.isArray(parsed) ? parsed.map(String) : []
  }
  return tags.map((tag) => (isEncrypted(tag) ? decryptValue(tag, password) : String(tag)))
}

function stableId(note, index) {
  if (note.id && !String(note.id).startsWith('imported-')) return String(note.id)
  return crypto
    .createHash('sha256')
    .update(
      [
        note.createdAt || '',
        note.updatedAt || '',
        note.title || '',
        note.content || '',
        String(index),
      ].join('\0')
    )
    .digest('hex')
    .slice(0, 24)
}

function decryptNotes(notes, password) {
  return notes.map((note, index) => {
    const title = decryptValue(note.title || '', password)
    const content = decryptValue(note.content || '', password)
    let tags = []
    try {
      tags = decryptTags(note.tags, password)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`第 ${index + 1} 篇标签解密失败：${message}`)
    }
    if (isEncrypted(title) || isEncrypted(content) || tags.some(isEncrypted)) {
      throw new Error(`第 ${index + 1} 篇仍含密文`)
    }
    return {
      id: stableId(note, index),
      title: title || '无标题',
      content,
      tags,
      createdAt: note.createdAt || new Date().toISOString(),
      updatedAt: note.updatedAt || new Date().toISOString(),
    }
  })
}

function readArg(name, argv) {
  const index = argv.indexOf(name)
  if (index === -1) return ''
  return argv[index + 1] || ''
}

function hasFlag(name, argv) {
  return argv.includes(name)
}

function defaultOutPath(file) {
  const resolved = path.resolve(file)
  const base = path.basename(resolved, path.extname(resolved))
  return path.join(path.dirname(resolved), `${base}.plain.json`)
}

function writePlain(outPath, notes) {
  const ext = path.extname(outPath).toLowerCase()
  const body =
    ext === '.md' || ext === '.markdown'
      ? formatNotesToMarkdown(notes)
      : JSON.stringify(notes, null, 2)
  fs.writeFileSync(outPath, body, 'utf8')
}

async function selfTest() {
  const password = 'self-test-key'
  const plain = '明文笔记\n第二行'
  const salt = crypto.randomBytes(SALT_LENGTH)
  const iv = crypto.randomBytes(IV_LENGTH)
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  const aesKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, new TextEncoder().encode(plain))
  )
  const payload = new Uint8Array(salt.length + iv.length + encrypted.length)
  payload.set(salt, 0)
  payload.set(iv, salt.length)
  payload.set(encrypted, salt.length + iv.length)
  const ciphertext = ENC_PREFIX + Buffer.from(payload).toString('base64')
  const decrypted = decryptValue(ciphertext, password)
  if (decrypted !== plain) {
    throw new Error('自检失败：解密结果与明文不一致')
  }
  const wrong = (() => {
    try {
      decryptValue(ciphertext, 'wrong-key')
      return false
    } catch {
      return true
    }
  })()
  if (!wrong) throw new Error('自检失败：错误密钥也应解密失败')
  console.log('自检通过：与浏览器 AES-GCM 密文兼容')
}

function printHelp() {
  console.log(`用法:
  node scripts/decrypt.js --file <备份.md|备份.json> --key <加密密钥>
  node scripts/decrypt.js --file <备份> --key <加密密钥> --out <明文.json>
  node scripts/decrypt.js --self-test

解密完成后，到前端「设置 → 导入」选择生成的 .json 手动上传。
设置页只把 .json 拆成多篇笔记；.md 会整份当成一篇。

参数:
  --file       备份文件（Markdown 或 JSON，标题/正文/标签可为 enc:v1 密文）
  --key        笔记加密密钥，须与加密时一致
  --out        明文输出路径，默认与备份同目录的 <文件名>.plain.json
  --self-test  用浏览器同款加密做一次往返校验`)
}

async function main() {
  const argv = process.argv.slice(2)
  if (hasFlag('--help', argv) || hasFlag('-h', argv)) {
    printHelp()
    return
  }
  if (hasFlag('--self-test', argv)) {
    await selfTest()
    return
  }

  const file = readArg('--file', argv)
  const key = readArg('--key', argv)
  const out = readArg('--out', argv) || (file ? defaultOutPath(file) : '')

  if (!file || !key) {
    printHelp()
    throw new Error(!file ? '缺少 --file' : '缺少 --key')
  }

  const text = fs.readFileSync(path.resolve(file), 'utf8')
  const parsed = parseBackupToNotes(text)
  if (parsed.length === 0) throw new Error('备份里没有可导入的笔记')

  const notes = decryptNotes(parsed, key).filter((note) => note.title || note.content)
  const outPath = path.resolve(out)
  writePlain(outPath, notes)
  console.log(`已解密 ${notes.length} 篇，明文已写入 ${outPath}`)
  console.log('请在前端「设置 → 导入」中选择该文件手动上传')
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
})
