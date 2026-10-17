import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// A base '/cardapio/' faz com que após `npm run build`
// todos os assets (JS, CSS) sejam referenciados como /cardapio/assets/...
// Isso permite servir o app dentro de uma subpasta do WordPress.
export default defineConfig({
  plugins: [react()],
  base: '/cardapio/',
})
