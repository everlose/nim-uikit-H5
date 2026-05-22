/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 用户中心 API 地址 */
  readonly VITE_USER_CENTER_BASE_URL?: string
  /** 云信 AppKey */
  readonly VITE_NIM_APP_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
