/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import solidSvg from 'vite-plugin-solid-svg'
import tailwindcss from '@tailwindcss/vite'
import typegpu from 'unplugin-typegpu/vite'
import { resolve } from 'path'
import pkg from '../../package.json'

/**
 * The page may run its own scripts and nothing else: no inline script, no remote script, no frames or plugins. Applied to
 * built pages only (the dev server needs inline scripts for hot reload). Network and media sources stay open because
 * the editor loads project media from disk and talks to services the person connects.
 */
const CSP = [
  "default-src 'self' blob: data:",
  "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline' https:",
  "img-src 'self' data: blob: file:",
  "media-src 'self' blob: data: file:",
  "font-src 'self' data: https: file:",
  "connect-src 'self' blob: data: file: https: http://127.0.0.1:* ws://127.0.0.1:*",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')
const csp = (command: string) => ({
  name: 'plusmotion-csp',
  transformIndexHtml: (html: string) => (command === 'build' ? html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`) : html),
})

export default defineConfig(({ command }) => {
  // PlusMotion: no external auth project is required to build. Accounts go through context/plusmotion-account.ts.

  return {
    plugins: [
      csp(command),
      solid(),
      tailwindcss(),
      solidSvg({ defaultAsComponent: true }),
      typegpu(),
    ],
    define: {
      APP_VERSION: JSON.stringify(pkg.version),
    },
    server: {
      port: 5173,
      strictPort: true,
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'credentialless',
      },
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    resolve: {
      alias: {
        "@": resolve(__dirname, "./src"),
        "@desktop": resolve(__dirname, "../desktop/src"),
      }
    }
  }
})
