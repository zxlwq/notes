export const R2_BACKUP_FILE = 'notes.md'

export function getR2ConfigFromEnv(env = {}) {
  const accountId = env.ACCOUNT_ID || ''
  if (!accountId) return null

  return {
    accountId,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    accessKeyId: env.ACCESS_KEY_ID || '',
    secretAccessKey: env.SECRET_ACCESS_KEY || '',
    bucketName: 'notes',
  }
}

export async function createAwsSignatureV4(
  method,
  url,
  headers,
  payload,
  accessKeyId,
  secretAccessKey,
  region = 'auto'
) {
  const urlObj = new URL(url)
  const host = urlObj.hostname
  let path = urlObj.pathname
  if (!path || path === '') path = '/'
  else if (!path.startsWith('/')) path = '/' + path

  const query = urlObj.search.slice(1)
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  const encoder = new TextEncoder()
  const payloadData = encoder.encode(payload || '')
  const payloadHashBuffer = await crypto.subtle.digest('SHA-256', payloadData)
  const payloadHash = Array.from(new Uint8Array(payloadHashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  const canonicalHeaders = {
    host: host.toLowerCase(),
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
  }
  if (headers['Content-Type']) canonicalHeaders['content-type'] = headers['Content-Type']

  const sortedHeaders = Object.keys(canonicalHeaders).sort()
  const canonicalHeadersString =
    sortedHeaders
      .map((key) => `${key}:${canonicalHeaders[key].replace(/\s+/g, ' ').trim()}`)
      .join('\n') + '\n'
  const signedHeaders = sortedHeaders.join(';')
  const canonicalRequest = [
    method,
    path,
    query || '',
    canonicalHeadersString,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const algorithm = 'AWS4-HMAC-SHA256'
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`
  const canonicalRequestHash = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(canonicalRequest)))
  )
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  const stringToSign = [algorithm, amzDate, credentialScope, canonicalRequestHash].join('\n')

  async function hmac(key, data) {
    const keyData = typeof key === 'string' ? encoder.encode(key) : key
    const dataArray = typeof data === 'string' ? encoder.encode(data) : data
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, dataArray))
  }

  const kDate = await hmac(`AWS4${secretAccessKey}`, dateStamp)
  const kRegion = await hmac(kDate, region)
  const kService = await hmac(kRegion, 's3')
  const kSigning = await hmac(kService, 'aws4_request')
  const signature = Array.from(await hmac(kSigning, stringToSign))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return {
    authorization: `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
  }
}

function parseR2Error(status, errorText, action) {
  const errorTextStr = typeof errorText === 'string' ? errorText : String(errorText)
  if (status === 401) {
    return 'R2 认证失败。请检查 ACCESS_KEY_ID 和 SECRET_ACCESS_KEY 是否正确'
  }
  let errorMessage = `R2 ${action}失败 (状态码: ${status})`
  const codeMatch = errorTextStr.match(/<Code>(.*?)<\/Code>/i)
  const messageMatch = errorTextStr.match(/<Message>(.*?)<\/Message>/i)
  if (codeMatch || messageMatch) {
    const code = codeMatch ? codeMatch[1] : ''
    const message = messageMatch ? messageMatch[1] : ''
    if (code || message)
      errorMessage = `R2 ${action}失败: ${code ? code + ' - ' : ''}${message || ''}`
  }
  if (errorTextStr.includes('Unauthorized') || errorTextStr.includes('not authorized')) {
    return 'R2 认证失败。请检查 ACCESS_KEY_ID 和 SECRET_ACCESS_KEY 是否正确'
  }
  return errorMessage
}

function assertR2Config(config) {
  if (!config?.endpoint) {
    throw new Error('R2 未配置。请设置 ACCOUNT_ID、ACCESS_KEY_ID 和 SECRET_ACCESS_KEY 环境变量')
  }
  if (!config.accessKeyId || !config.secretAccessKey) {
    throw new Error('请配置 ACCESS_KEY_ID 和 SECRET_ACCESS_KEY 环境变量')
  }
}

export async function uploadToR2(content, config) {
  assertR2Config(config)
  const url = `${config.endpoint}/${config.bucketName}/${R2_BACKUP_FILE}`
  const headers = { 'Content-Type': 'text/markdown; charset=utf-8' }
  Object.assign(
    headers,
    await createAwsSignatureV4(
      'PUT',
      url,
      headers,
      content,
      config.accessKeyId,
      config.secretAccessKey,
      'auto'
    )
  )
  const response = await fetch(url, { method: 'PUT', headers, body: content })
  if (!response.ok) {
    throw new Error(parseR2Error(response.status, await response.text(), '上传'))
  }
  return response
}

export async function downloadFromR2(config) {
  assertR2Config(config)
  const url = `${config.endpoint}/${config.bucketName}/${R2_BACKUP_FILE}`
  /** @type {Record<string, string>} */
  const headers = {}
  Object.assign(
    headers,
    await createAwsSignatureV4(
      'GET',
      url,
      headers,
      '',
      config.accessKeyId,
      config.secretAccessKey,
      'auto'
    )
  )
  const response = await fetch(url, { headers })
  if (!response.ok) {
    throw new Error(parseR2Error(response.status, await response.text(), '下载'))
  }
  return response.text()
}
