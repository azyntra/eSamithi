/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_API_ORIGINS?: string
  readonly VITE_DEV_API?: string
  readonly VITE_BASE?: string
  readonly VITE_PWA?: string
}
