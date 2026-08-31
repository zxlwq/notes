import { logToD1 } from '../_utils/log'
import { signSessionToken, getSessionTtlSec, buildSessionCookie } from '../_utils/session'
import { getEffectivePassword } from '../_utils/auth'
import { verifyPassword, rehashLegacyPassword } from '../_utils/password'
import { getPasswordVersion } from '../_utils/credentials'
import { createRateLimiter, getFetchRequestIp } from '../_utils/rateLimit'
import type { PagesFunction } from '../types'
import { apiCors, apiPreflight } from '../_utils/cors'

const loginRateLimit = createRateLimiter()

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: apiPreflight(request, env),
    })
  }

  const limit = loginRateLimit(getFetchRequestIp(request))
  if (!limit.allowed) {
    return new Response(JSON.stringify({ error: '请求过于频繁，请稍后再试' }), {
      status: 429,
      headers: apiCors(request, env, { 'Retry-After': String(limit.retryAfterSec) }),
    })
  }

  try {
    const { password } = await request.json()

    if (!password || typeof password !== 'string') {
      await logToD1(env, 'warn', 'login.missing_password')
      return new Response(JSON.stringify({ error: 'Password is required' }), {
        status: 400,
        headers: apiCors(request, env),
      })
    }

    const isProduction = env.NODE_ENV === 'production'
    if (isProduction && !env.JWT_SECRET) {
      return new Response(JSON.stringify({ error: 'JWT_SECRET not configured' }), {
        status: 500,
        headers: apiCors(request, env),
      })
    }

    const storedCredential = await getEffectivePassword(env)
    if (!storedCredential) {
      return new Response(JSON.stringify({ error: 'PASSWORD not configured' }), {
        status: 500,
        headers: apiCors(request, env),
      })
    }

    if (await verifyPassword(password, storedCredential)) {
      if (env.NOTESD) {
        await rehashLegacyPassword(env.NOTESD, password, storedCredential)
      }
      const pwdVer = await getPasswordVersion(env)
      const ip =
        request.headers.get('CF-Connecting-IP') ||
        (request.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        undefined
      const cf = (request as { cf?: { country?: string; city?: string } })?.cf || {}
      const country = cf.country || undefined
      const city = cf.city || undefined

      let location = ''
      if (country && city) {
        location = country
      } else if (country) {
        location = country
      } else if (city) {
        location = city
      }

      await logToD1(env, 'info', 'login.success', {
        ua: request.headers.get('user-agent'),
        ip,
        location,
      })

      const envPassword = env.PASSWORD || ''
      const token = await signSessionToken(
        envPassword,
        env.JWT_SECRET as string | undefined,
        { pwdVer, ttlSec: getSessionTtlSec(env) },
        isProduction
      )
      return Response.json(
        { success: true, token },
        {
          headers: apiCors(request, env, {
            'Set-Cookie': buildSessionCookie(token, isProduction, getSessionTtlSec(env)),
          }),
        }
      )
    }

    await logToD1(env, 'warn', 'login.invalid_password')
    return new Response(JSON.stringify({ error: 'Invalid password' }), {
      status: 401,
      headers: apiCors(request, env),
    })
  } catch (error) {
    console.error('Login error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    await logToD1(env, 'error', 'login.exception', { message: errorMessage })
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: apiCors(request, env),
    })
  }
}
