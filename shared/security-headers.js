/**
 * 静态与 API 响应共用的安全响应头。
 * 同步维护：server/index.js、public/_headers、vercel.json、edgeone.json
 */
export const CSP =
  "default-src 'self'; script-src 'self' https://umami.zxlwq.dpdns.org https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; connect-src 'self' https://umami.zxlwq.dpdns.org https://cloudflareinsights.com; font-src 'self' data: https://fonts.gstatic.com; frame-ancestors 'none'"

export const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
}
