const ENC_PREFIX = 'enc:v1:'
const SALT_LENGTH = 16
const IV_LENGTH = 12
const PBKDF2_ITERATIONS = 100_000
const ENC_PASSWORD_KEY = 'notes_enc_password'

function readStoredPassword(): string | null {
  try {
    const raw = sessionStorage.getItem(ENC_PASSWORD_KEY)
    return raw && raw.trim() ? raw : null
  } catch {
    return null
  }
}

function writeStoredPassword(password: string | null): void {
  try {
    if (password) sessionStorage.setItem(ENC_PASSWORD_KEY, password)
    else sessionStorage.removeItem(ENC_PASSWORD_KEY)
  } catch {
    // ignore
  }
}

let encryptionPassword: string | null = readStoredPassword()

export function setEncryptionPassword(password: string): void {
  encryptionPassword = password
  writeStoredPassword(password)
}

export function clearEncryptionPassword(): void {
  encryptionPassword = null
  writeStoredPassword(null)
}

export function hasEncryptionPassword(): boolean {
  return encryptionPassword !== null
}

export function getEncryptionPassword(): string | null {
  return encryptionPassword
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0)
  }
  return btoa(binary)
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const saltBuffer = new Uint8Array(salt)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

async function encryptValue(plaintext: string, password: string): Promise<string> {
  if (!plaintext) return plaintext
  if (isEncryptedContent(plaintext)) return plaintext

  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const key = await deriveKey(password, salt)
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  )

  const payload = new Uint8Array(salt.length + iv.length + encrypted.byteLength)
  payload.set(salt, 0)
  payload.set(iv, salt.length)
  payload.set(new Uint8Array(encrypted), salt.length + iv.length)

  return ENC_PREFIX + toBase64(payload)
}

async function decryptValue(ciphertext: string, password: string): Promise<string> {
  if (!ciphertext) return ciphertext
  if (!isEncryptedContent(ciphertext)) return ciphertext

  const payload = fromBase64(ciphertext.slice(ENC_PREFIX.length))
  const salt = new Uint8Array(payload.slice(0, SALT_LENGTH))
  const iv = new Uint8Array(payload.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH))
  const data = new Uint8Array(payload.slice(SALT_LENGTH + IV_LENGTH))
  const key = await deriveKey(password, salt)
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return new TextDecoder().decode(decrypted)
}

export function isEncryptedContent(value: string): boolean {
  return value.startsWith(ENC_PREFIX)
}

export async function encryptContent(plaintext: string, password: string): Promise<string> {
  return encryptValue(plaintext, password)
}

export async function decryptContent(ciphertext: string, password: string): Promise<string> {
  try {
    return await decryptValue(ciphertext, password)
  } catch {
    throw new Error('无法解密笔记内容，请确认密码正确')
  }
}

export async function encryptField(plaintext: string, password: string): Promise<string> {
  return encryptValue(plaintext, password)
}

export async function decryptField(ciphertext: string, password: string): Promise<string> {
  try {
    return await decryptValue(ciphertext, password)
  } catch {
    return ciphertext
  }
}

export async function encryptTags(tags: string[], password: string): Promise<string> {
  return encryptField(JSON.stringify(tags), password)
}

export async function decryptTags(raw: string, password: string): Promise<string[]> {
  if (!raw) return []
  if (isEncryptedContent(raw)) {
    try {
      const decrypted = await decryptField(raw, password)
      const parsed = JSON.parse(decrypted)
      return Array.isArray(parsed) ? parsed.map(String) : []
    } catch {
      return []
    }
  }
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}
