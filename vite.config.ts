// ✅ vite.config.ts - Versão final sem erros de TypeScript

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'

export default defineConfig(({ mode }) => {
  // ✅ DETERMINAR QUAL ARQUIVO .env USAR
  const envFile = process.env.VITE_ENV_FILE || '.env';
  const envPath = path.resolve(process.cwd(), envFile);
  
  console.log('🔧 Frontend carregando ENV de:', envFile);
  console.log('📁 Caminho completo:', envPath);
  
  // ✅ CARREGAR ARQUIVO ENV MANUALMENTE
  const defineVars: Record<string, string> = {
    __ENV_FILE__: JSON.stringify(envFile),
  };
  
  if (fs.existsSync(envPath)) {
    console.log('✅ Arquivo encontrado, carregando...');
    const envConfig = dotenv.parse(fs.readFileSync(envPath, 'utf8'));
    
    // ✅ Filtrar apenas variáveis VITE_ e adicionar ao define
    Object.keys(envConfig)
      .filter(key => key.startsWith('VITE_'))
      .forEach(key => {
        defineVars[`import.meta.env.${key}`] = JSON.stringify(envConfig[key]);
      });
      
    console.log('🌍 Variáveis carregadas:', envConfig);
  } else {
    console.log('❌ Arquivo não encontrado:', envPath);
  }

  // ✅ RETORNAR CONFIGURAÇÃO CORRETA
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: defineVars,
    envDir: './',
    envPrefix: 'VITE_',
  };
});