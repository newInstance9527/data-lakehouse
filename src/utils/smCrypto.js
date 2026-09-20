import smCrypto from 'sm-crypto'

const sm2 = smCrypto.sm2
const cipherMode = 1
/** 与 lakehouse-gov CommonCryptogramUtil.PUBLIC_KEY 对齐 */
const publicKey =
  '04298364ec840088475eae92a591e01284d1abefcda348b47eb324bb521bb03b0b2a5bc393f6b71dabb8f15c99a0050818b56b23f31743b93df9cf8948f15ddb54'

export function doSm2Encrypt(msgString) {
  return sm2.doEncrypt(msgString, publicKey, cipherMode)
}
