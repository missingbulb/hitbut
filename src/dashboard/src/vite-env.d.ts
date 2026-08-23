/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Where the Worker answers. Baked in at build time, because the site is static. */
  readonly VITE_API_ORIGIN?: string;
}
