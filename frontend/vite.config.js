import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Forward API calls to the FastAPI backend during development.
    proxy: { '/api': 'http://localhost:8000' },
  },
  test: {
    include: ['tests/**/*.test.{js,jsx}'],
    environment: 'node',
  },
})
