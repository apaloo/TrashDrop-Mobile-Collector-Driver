import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(process.env.VITE_GOOGLE_MAPS_API_KEY || '')
  },
  build: {
    // CRITICAL: Aggressive mobile optimization for instant startup
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console for debugging
        drop_debugger: true,
        pure_funcs: ['console.debug', 'console.trace']
      }
    },
    
    // PERFORMANCE: Split chunks to reduce initial bundle size
    rollupOptions: {
      output: {
        // Smaller chunks for faster mobile loading
        manualChunks: {
          // CRITICAL: Core app bundle (loaded first)
          'app-core': ['react', 'react-dom'],
          'app-router': ['react-router-dom'],
          
          // LAZY: Heavy libraries (loaded on demand)
          'vendor-maps': ['leaflet', 'react-leaflet'],
          'vendor-ui': ['framer-motion', 'react-toastify'],
          'vendor-supabase': ['@supabase/supabase-js'],
          
          // LAZY: Pages (loaded on route change)
          'page-map': ['./src/pages/Map.jsx'],
          'page-request': ['./src/pages/Request.jsx'], 
          'page-assign': ['./src/pages/Assign.jsx'],
          'page-profile': ['./src/pages/Profile.jsx'],
          
          // LAZY: Heavy components (loaded when needed)
          'components-maps': [
            './src/components/GoogleMapComponent.jsx',
            './src/components/NavigationQRModal.jsx',
            './src/components/AssignmentNavigationModal.jsx'
          ],
          
          // LAZY: Services (loaded when needed)
          'services': [
            './src/services/requestManagement.js',
            './src/services/supabase.js'
          ]
        },
        
        // Optimize chunk file names for caching
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    
    // CRITICAL: Target modern browsers for smaller bundles
    target: ['es2020', 'chrome80', 'safari13'],
    chunkSizeWarningLimit: 500 // Smaller chunks for mobile
  },
  server: {
    proxy: {
      // Proxy API requests to avoid CORS issues
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      
      // CRITICAL: PWA settings for instant mobile loading
      manifest: {
        name: 'TrashDrop Carter',
        short_name: 'TrashDrop Carter',
        description: 'Mobile app for TrashDrop collectors and drivers',
        theme_color: '#9AE65C',
        background_color: '#f8f9fa',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/?v=2.0.1',
        scope: '/',
        icons: [
          {
            src: 'icons/logo-02.jpg?v=3.0.0',
            sizes: '512x512',
            type: 'image/jpeg',
            purpose: 'any'
          },
          {
            src: 'icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icons/maskable_icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        // CRITICAL: Force cleanup of old caches
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        
        // CRITICAL: Aggressive caching for instant mobile startup
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,jpg,jpeg,webp}'],
        maximumFileSizeToCacheInBytes: 5000000, // 5MB limit
        
        // CRITICAL: Cache additional files
        additionalManifestEntries: [
          { url: '/', revision: null },
          { url: '/manifest.json', revision: null }
        ],
        
        runtimeCaching: [
          // CRITICAL: App shell - cache immediately
          {
            urlPattern: /^\/$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'app-shell',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 60 * 60 * 24 // 1 day
              }
            }
          },
          
          // CRITICAL: App assets - cache aggressively
          {
            urlPattern: /^\/assets\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'app-assets',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },
          
          // External resources
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          },
          
          {
            urlPattern: /^https:\/\/unpkg\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdn-assets',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 1 week
              }
            }
          },
          
          // CRITICAL: Auth endpoints - NEVER cache (always fresh)
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/.*$/i,
            handler: 'NetworkOnly',
            options: {
              cacheName: 'auth-no-cache'
            }
          },
          
          // CRITICAL: Data API calls - background sync for offline
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5 // 5 minutes
              }
            }
          }
        ]
      }
    })
  ],
})
