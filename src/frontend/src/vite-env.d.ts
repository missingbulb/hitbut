/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Where /api/v1 lives. The site and the Worker deploy as two artifacts on two hosts,
   * and the site has no server side to proxy through, so the origin is baked in at build
   * time. Empty means same-origin, which is what the requirements harness serves.
   */
  readonly VITE_API_ORIGIN?: string;
}
