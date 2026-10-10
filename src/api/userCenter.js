/**
 * 个人中心（Snowy /sys/userCenter）
 */
import { http } from './http.js'
import { doSm2Encrypt } from '@/utils/smCrypto'

export function updateUserInfo(body) {
  return http.post('/sys/userCenter/updateUserInfo', body)
}

/** 旧密码改密；两端口令均 SM2 加密 */
export function updatePasswordByOld({ password, newPassword }) {
  return http.post('/sys/userCenter/updatePasswordByOld', {
    password: doSm2Encrypt(password),
    newPassword: doSm2Encrypt(newPassword),
  })
}

export function loginUnreadMessagePage(params = {}) {
  return http.get('/sys/userCenter/loginUnreadMessagePage', {
    current: params.current ?? 1,
    size: params.size ?? 20,
  })
}

export function loginUnreadMessageDetail(id) {
  return http.get('/sys/userCenter/loginUnreadMessageDetail', { id })
}
