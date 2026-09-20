import { http } from './http'
import { clearToken, getToken, setToken } from './token'
import { doSm2Encrypt } from '@/utils/smCrypto'

export { getToken, setToken, clearToken }

/** 账号密码登录；密码 SM2 加密后提交（门户不启图形验证码） */
export async function doLogin({ account, password, device = 'PC' }) {
  const token = await http.post(
    '/auth/b/doLogin',
    {
      account,
      password: doSm2Encrypt(password),
      device,
    },
    { skipAuth: true },
  )
  setToken(token)
  return token
}

export function doLogout() {
  return http.get('/auth/b/doLogout').finally(() => clearToken())
}

export function getLoginUser() {
  return http.get('/auth/b/getLoginUser')
}

export function isLogin() {
  return http.get('/auth/b/isLogin')
}

/** 当前用户已授权菜单树（与 snowy-admin-web loginMenu 同源） */
export function loginMenu() {
  return http.get('/sys/userCenter/loginMenu')
}
