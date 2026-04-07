/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PMTILES_BASE_URL?: string
  /** Full origin of the mortgage Vercel app, e.g. https://mortgage-analytics.vercel.app (no trailing slash) */
  readonly VITE_MORTGAGE_DASHBOARD_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
