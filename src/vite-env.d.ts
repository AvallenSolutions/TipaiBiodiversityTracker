/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_GEMINI_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Build-time-injected list of bundled species reference photos in
// /public/species-images. See vite.config.ts and src/lib/speciesImages.ts.
declare const __SPECIES_IMAGES__: string[]
