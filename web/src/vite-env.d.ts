/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BASE?: string
  readonly VITE_HASH?: string
  readonly VITE_GUIDE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
