// @ts-check
import { defineConfig } from 'vite'; // ^4.3.9
import react from '@vitejs/plugin-react'; // ^4.0.0
import tsconfigPaths from 'vite-tsconfig-paths'; // ^4.2.0

export default defineConfig({
  // React plugin configuration with Fast Refresh and development optimizations
  plugins: [
    react({
      fastRefresh: true, // Enable Fast Refresh for React components
      development: process.env.NODE_ENV === 'development',
      babel: {
        // Additional Babel plugins can be added here if needed
        plugins: [],
      }
    }),
    // TypeScript path resolution plugin with explicit project file
    tsconfigPaths({
      projects: ['./tsconfig.json']
    })
  ],

  // Development server configuration
  server: {
    port: 3000,
    host: true, // Listen on all addresses
    strictPort: true, // Fail if port is already in use
    cors: true, // Enable CORS for development
    hmr: {
      overlay: true, // Show errors as overlay
    },
    watch: {
      usePolling: false, // Use native file system events
    }
  },

  // Production build configuration
  build: {
    outDir: 'dist',
    sourcemap: true, // Generate source maps for debugging
    minify: 'terser', // Use Terser for minification
    target: [
      'chrome90',
      'firefox88',
      'safari14',
      'edge90'
    ],
    rollupOptions: {
      output: {
        // Chunk splitting configuration
        manualChunks: {
          // Vendor chunk for main dependencies
          vendor: [
            'react',
            'react-dom',
            'react-router-dom',
            '@material-ui/core',
            '@material-ui/icons'
          ],
          // Visualization-specific chunk
          visualization: [
            'react-flow-renderer',
            'd3'
          ],
          // Editor-specific chunk
          editor: [
            'monaco-editor'
          ]
        },
        // Asset file naming pattern
        assetFileNames: 'assets/[name].[hash].[ext]',
        chunkFileNames: 'js/[name].[hash].js',
        entryFileNames: 'js/[name].[hash].js'
      }
    },
    // Additional build optimizations
    cssCodeSplit: true, // Enable CSS code splitting
    assetsInlineLimit: 4096, // Inline assets smaller than 4kb
    modulePreload: true, // Enable module preloading
    reportCompressedSize: false, // Disable compressed size reporting for faster builds
    chunkSizeWarningLimit: 1000 // Set chunk size warning limit to 1000kb
  },

  // Path resolution configuration
  resolve: {
    alias: {
      // Path aliases matching tsconfig.json paths
      '@': '/src',
      '@components': '/src/components',
      '@services': '/src/services',
      '@utils': '/src/utils',
      '@hooks': '/src/hooks',
      '@types': '/src/types',
      '@assets': '/src/assets',
      '@styles': '/src/styles'
    },
    // Enable TypeScript extensions resolution
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json']
  },

  // Environment variable configuration
  envPrefix: 'VITE_', // Only expose env variables prefixed with VITE_

  // Global constants definition
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __DEV__: process.env.NODE_ENV === 'development',
    __PROD__: process.env.NODE_ENV === 'production',
    __TEST__: process.env.NODE_ENV === 'test'
  },

  // Performance optimizations
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@material-ui/core',
      'react-flow-renderer'
    ],
    exclude: [] // Dependencies to exclude from optimization
  },

  // Preview server configuration (for production build testing)
  preview: {
    port: 3000,
    strictPort: true,
    host: true,
    cors: true
  },

  // Enable experimental features
  experimental: {
    renderBuiltUrl: (filename: string, { hostType }: { hostType: 'js' | 'css' | 'html' }) => {
      // Custom URL transformation for built assets
      return filename
    }
  }
});