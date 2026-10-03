import { ACCOUNT_ID, ACCESS_KEY_ID, SECRET_ACCESS_KEY } from '../context.js'
import {
  getR2ConfigFromEnv,
  uploadToR2 as uploadToR2Core,
  downloadFromR2 as downloadFromR2Core,
  createAwsSignatureV4,
} from '../../shared/r2.js'

export { createAwsSignatureV4 }

export function getR2Config() {
  return getR2ConfigFromEnv({ ACCOUNT_ID, ACCESS_KEY_ID, SECRET_ACCESS_KEY })
}

export function uploadToR2(content) {
  return uploadToR2Core(content, getR2Config())
}

export function downloadFromR2() {
  return downloadFromR2Core(getR2Config())
}
