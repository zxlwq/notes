export function toBase64(str: string): string

export function fetchWebDAVBackup(options: {
  baseUrl?: string
  user?: string
  pass?: string
  fileNames?: string[]
}): Promise<{ text: string; fileName: string } | { error: string; status: number | null }>

export function uploadWebDAVBackup(options: {
  baseUrl?: string
  user?: string
  pass?: string
  content: string
  fileName?: string
}): Promise<{ url: string; fileName: string }>
