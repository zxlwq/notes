export const R2_BACKUP_FILE: string

export function getR2ConfigFromEnv(env?: {
  ACCOUNT_ID?: string
  ACCESS_KEY_ID?: string
  SECRET_ACCESS_KEY?: string
}): {
  accountId: string
  endpoint: string
  accessKeyId: string
  secretAccessKey: string
  bucketName: string
} | null

export function createAwsSignatureV4(
  method: string,
  url: string,
  headers: Record<string, string>,
  payload: string,
  accessKeyId: string,
  secretAccessKey: string,
  region?: string
): Promise<Record<string, string>>

export function uploadToR2(
  content: string,
  config: NonNullable<ReturnType<typeof getR2ConfigFromEnv>>
): Promise<Response>

export function downloadFromR2(
  config: NonNullable<ReturnType<typeof getR2ConfigFromEnv>>
): Promise<string>
