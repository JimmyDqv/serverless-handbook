/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USER_POOL_ID: string
  readonly VITE_USER_POOL_CLIENT_ID: string
  readonly VITE_API_ENDPOINT: string
  readonly VITE_APPSYNC_EVENTS_REALTIME_ENDPOINT: string
  readonly VITE_APPSYNC_EVENTS_API_KEY: string
  readonly VITE_CHAT_API_ENDPOINT: string
  readonly VITE_CHAT_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Build-time constants injected by Vite
declare const __BUILD_ID__: string;
declare const __BUILD_TIME__: string;