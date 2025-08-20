// server.js - VERSÃO ATUALIZADA PARA TIPOS DE COLABORADOR
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const { Resend } = require('resend');
const crypto = require('crypto');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs/promises');
const multer = require('multer');
const puppeteer = require('puppeteer');
const fsSync = require('fs');

const envFile = process.env.ENV_FILE || '.env';
const envPath = path.resolve(__dirname, envFile);

async function handleSocialMediaSites(page, url) {
  const domain = new URL(url).hostname;
  
  if (domain.includes('instagram.com')) {
    console.log('🔍 Detectado Instagram - aplicando configurações específicas');
    
    try {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('🚪 Tentando clicar no botão de fechar específico...');
      
      const modalClosed = await page.evaluate(() => {
        // ✅ MÉTODO 1: Clicar no XPath específico que você forneceu
        const xpath = '/html/body/div[4]/div[2]/div/div/div[1]/div/div[2]/div/div/div/div/div[2]/div/div[1]/div/div';
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const closeButton = result.singleNodeValue;
        
        if (closeButton) {
          console.log('🎯 Encontrado botão de fechar pelo XPath:', closeButton);
          closeButton.click();
          return true;
        }
        
        // ✅ MÉTODO 2: Fallback - procurar em div[4] especificamente
        const div4 = document.querySelector('body > div:nth-child(4)');
        if (div4) {
          // Procurar botões dentro deste div específico
          const buttons = div4.querySelectorAll('div, button, [role="button"]');
          for (const btn of buttons) {
            const rect = btn.getBoundingClientRect();
            // Procurar elementos pequenos no canto superior (botão X)
            if (rect.width < 50 && rect.height < 50 && rect.top < 200) {
              console.log('🎯 Encontrado botão candidato em div[4]:', btn);
              btn.click();
              return true;
            }
          }
        }
        
        // ✅ MÉTODO 3: Procurar padrão similar ao XPath
        const bodyDivs = document.querySelectorAll('body > div');
        if (bodyDivs.length >= 4) {
          const targetDiv = bodyDivs[3]; // div[4] é índice 3
          const deepButtons = targetDiv.querySelectorAll('div[role="button"], button');
          
          for (const btn of deepButtons) {
            // Verificar se está na posição certa (canto superior)
            const rect = btn.getBoundingClientRect();
            if (rect.top < 150 && rect.right > window.innerWidth - 200) {
              console.log('🎯 Encontrado botão na posição esperada:', btn);
              btn.click();
              return true;
            }
          }
        }
        
        return false;
      });
      
      if (modalClosed) {
        console.log('✅ Botão de fechar clicado com sucesso');
        await new Promise(resolve => setTimeout(resolve, 3000)); // Aguardar animação de fechamento
        
        // ✅ VERIFICAR SE MODAL REALMENTE SUMIU
        const stillExists = await page.evaluate(() => {
          const xpath = '/html/body/div[4]/div[2]/div/div/div[1]/div/div[2]/div/div/div/div/div[2]/div/div[1]/div/div';
          const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          return !!result.singleNodeValue;
        });
        
        if (stillExists) {
          console.log('⚠️ Modal ainda existe, tentando remoção forçada...');
          await page.evaluate(() => {
            const xpath = '/html/body/div[4]/div[2]'; // Remover div pai
            const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            const modalContainer = result.singleNodeValue;
            if (modalContainer) {
              modalContainer.remove();
            }
          });
        }
        
      } else {
        console.log('⚠️ Botão específico não encontrado, tentando métodos alternativos...');
        
        // ✅ FALLBACK: ESC + remoção forçada
        await page.keyboard.press('Escape');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Remover div[4] inteiro se ainda existir
        await page.evaluate(() => {
          const bodyDivs = document.querySelectorAll('body > div');
          if (bodyDivs.length >= 4) {
            const suspiciousDiv = bodyDivs[3]; // div[4]
            const style = window.getComputedStyle(suspiciousDiv);
            if (style.position === 'fixed' || parseInt(style.zIndex) > 50) {
              console.log('🗑️ Removendo div[4] suspeito:', suspiciousDiv);
              suspiciousDiv.remove();
            }
          }
        });
      }
      
      // ✅ LIMPEZA FINAL
      await page.evaluate(() => {
        document.body.style.overflow = 'auto';
        document.documentElement.style.overflow = 'auto';
        window.scrollTo({ top: 0, behavior: 'instant' });
      });
      
      console.log('✅ Processo de fechamento do modal concluído');
      
    } catch (error) {
      console.log('⚠️ Erro específico do Instagram:', error.message);
    }
  }
  
  return true;
}

async function forceInstagramDesktopLayout(page) {
  console.log('🖥️ Forçando layout desktop do Instagram...');
  
  // Aguardar carregamento inicial
  await page.waitForSelector('main', { timeout: 15000 });
  
  // Injetar CSS agressivo
  await page.addStyleTag({
    content: `
      /* Reset completo para forçar desktop */
      * {
        max-width: none !important;
      }
      
      /* Container principal */
      main, 
      main > div,
      main section,
      main article {
        max-width: 1200px !important;
        width: 100% !important;
        margin: 0 auto !important;
      }
      
      /* Header do perfil */
      header {
        max-width: 1200px !important;
        width: 100% !important;
        padding: 40px 20px !important;
        margin: 0 auto !important;
      }
      
      /* Grid de posts */
      [style*="grid-template-columns"] {
        grid-template-columns: repeat(3, 1fr) !important;
        max-width: 1200px !important;
        margin: 0 auto !important;
        gap: 20px !important;
      }
      
      /* Remover limitações mobile */
      [style*="max-width: 470px"],
      [style*="max-width: 600px"] {
        max-width: 1200px !important;
      }
      
      /* Container do Instagram */
      #mount_0_0_*,
      [id^="mount"] {
        width: 100% !important;
        max-width: none !important;
      }
      
      /* Forçar largura nos containers pais */
      body > div,
      body > div > div,
      body > div > div > div {
        width: 100% !important;
        max-width: none !important;
      }
    `
  });
  
  // JavaScript para redimensionar forçadamente
  await page.evaluate(() => {
    console.log('🔧 Aplicando JavaScript para layout desktop...');
    
    // Sobrescrever métodos de detecção de tela
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1920
    });
    
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 1080
    });
    
    // Forçar elementos principais
    const main = document.querySelector('main');
    if (main) {
      main.style.maxWidth = '1200px';
      main.style.width = '100%';
      main.style.margin = '0 auto';
    }
    
    // Procurar e ajustar containers
    const containers = document.querySelectorAll('[role="main"], main, section, article');
    containers.forEach(container => {
      container.style.maxWidth = '1200px';
      container.style.width = '100%';
      container.style.margin = '0 auto';
    });
    
    // Forçar grids de posts
    const grids = document.querySelectorAll('[style*="grid"]');
    grids.forEach(grid => {
      grid.style.gridTemplateColumns = 'repeat(3, 1fr)';
      grid.style.maxWidth = '1200px';
      grid.style.margin = '0 auto';
      grid.style.gap = '20px';
    });
    
    // Disparar evento de resize
    window.dispatchEvent(new Event('resize'));
    
    // Force reflow
    document.body.offsetHeight;
  });
  
  // Aguardar layout se ajustar
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('✅ Layout desktop aplicado');
}

// ✅ VERSÃO TAMBÉM CORRIGIDA DA FUNÇÃO AGRESSIVA:
async function forceCloseInstagramModal(page) {
  console.log('🔨 Método agressivo para fechar modal do Instagram');
  
  await page.evaluate(() => {
    // Remover TODOS os elementos suspeitos
    const suspiciousElements = document.querySelectorAll(`
      [role="dialog"],
      [class*="modal"],
      [class*="overlay"],
      [class*="popup"],
      [style*="position: fixed"],
      [style*="z-index: 9"],
      div[style*="background-color: rgba"]
    `);
    
    suspiciousElements.forEach(el => {
      const style = window.getComputedStyle(el);
      if (style.position === 'fixed' || 
          parseInt(style.zIndex) > 50 ||
          el.getAttribute('role') === 'dialog') {
        console.log('Removendo elemento suspeito:', el);
        el.remove();
      }
    });
    
    // Restaurar scroll
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    
    return true;
  });
}

console.log('🔧 Carregando configurações do arquivo:', envPath);

// ✅ CARREGAR O ARQUIVO .env ESPECÍFICO
require('dotenv').config({ path: envPath });

// ✅ DEBUG: Mostrar qual ambiente está sendo usado
console.log('🌍 Ambiente atual:', {
  NODE_ENV: process.env.NODE_ENV,
  ENV_FILE: envFile,
  API_BASE_URL: process.env.VITE_API_BASE_URL,
  DATABASE_URL: process.env.DATABASE_URL ? '***DEFINIDO***' : '❌ NÃO DEFINIDO',
  PORT: process.env.PORT || 3001
});

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }))

function getDocumentsPath() {
  const isProduction = process.env.NODE_ENV === 'production';
  const isRailway = process.env.RAILWAY_VOLUME === 'true'; // ✅ String comparison
  
  let documentsPath;
  
  if (isProduction && isRailway) {
    // ✅ RAILWAY COM VOLUME: Usar o volume persistente
    documentsPath = '/app/storage/documents';
  } else {
    // ✅ PRODUÇÃO SEM RAILWAY: backend/dist/documents
    documentsPath = path.join(__dirname, 'dist', 'documents');
  }
  
  console.log(`📁 Ambiente: ${isProduction ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'}`);
  console.log(`🚂 Railway: ${isRailway ? 'SIM' : 'NÃO'}`);
  console.log(`📂 Caminho dos documentos: ${documentsPath}`);
  
  // ✅ CRIAR DIRETÓRIO SE NÃO EXISTIR
  if (!fsSync.existsSync(documentsPath)) {
    console.log(`📁 Criando diretório: ${documentsPath}`);
    fsSync.mkdirSync(documentsPath, { recursive: true });
  }
  
  return documentsPath;
}

function getThumbnailsPath() {
  const isProduction = process.env.NODE_ENV === 'production';
  const isRailway = process.env.RAILWAY_VOLUME === 'true'; // ✅ String comparison
  
  let thumbnailsPath;
  
  if (isProduction && isRailway) {
    // ✅ RAILWAY COM VOLUME: Usar o volume persistente
    thumbnailsPath = '/app/storage/thumbnails';
  } else if (isProduction) {
    // ✅ PRODUÇÃO SEM RAILWAY: backend/dist/thumbnails
    thumbnailsPath = path.join(__dirname, 'dist', 'thumbnails');
  } else {
    // ✅ DESENVOLVIMENTO: raiz/public/thumbnails
    thumbnailsPath = path.join(__dirname, '..', 'public', 'thumbnails');
  }
  
  console.log(`📷 Caminho das thumbnails: ${thumbnailsPath}`);
  
  // ✅ CRIAR DIRETÓRIO SE NÃO EXISTIR
  if (!fsSync.existsSync(thumbnailsPath)) {
    console.log(`📁 Criando diretório: ${thumbnailsPath}`);
    fsSync.mkdirSync(thumbnailsPath, { recursive: true });
  }
  
  return thumbnailsPath;
}

// ✅ ADICIONE esta função utilitária para organizar melhor
function getStoragePath(type) {
  const isProduction = process.env.NODE_ENV === 'production';
  const isRailway = process.env.RAILWAY_VOLUME === 'true'; // ✅ String comparison
  
  if (isProduction && isRailway) {
    // ✅ RAILWAY: Volume persistente
    return `/app/storage/${type}`;
  } else if (isProduction) {
    // ✅ PRODUÇÃO: backend/dist/
    return path.join(__dirname, 'dist', type);
  } else {
    // ✅ DESENVOLVIMENTO: raiz/public/
    return path.join(__dirname, '..', 'public', type);
  }
}

console.log('🔧 Verificando configuração de ambiente:', {
  NODE_ENV: process.env.NODE_ENV,
  RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT,
  RAILWAY_DETECTED: process.env.RAILWAY_ENVIRONMENT === 'true'
});

// Obter caminhos corretos
const DOCUMENTS_PATH = getDocumentsPath();
const THUMBNAILS_PATH = getThumbnailsPath();

console.log('📁 Caminhos finais configurados:');
console.log(`  📂 Documents: ${DOCUMENTS_PATH}`);
console.log(`  📷 Thumbnails: ${THUMBNAILS_PATH}`);

// ✅ MIDDLEWARE DE ARQUIVOS ESTÁTICOS CORRIGIDO
app.use('/documents', (req, res, next) => {
  console.log(`📂 Requisição de arquivo: ${req.url}`);
  console.log(`📍 Buscando em: ${DOCUMENTS_PATH}`);
  next();
}, express.static(DOCUMENTS_PATH, {
  setHeaders: (res, filePath) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    // 👇 Headers que forçam o navegador a não guardar nada em cache
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  },
  dotfiles: 'ignore',
  etag: false,
  extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'gif'],
  index: false,
  maxAge: '0', // 👈 Desativa cache completamente
  redirect: false
}));

app.use('/thumbnails', express.static(THUMBNAILS_PATH));

// ✅ Corrige MIME types para arquivos estáticos
express.static.mime.define({
  'text/css': ['css'],
  'application/javascript': ['js'],
  'application/json': ['json'],
  'text/html': ['html'],
  'image/png': ['png'],
  'image/jpg': ['jpg'],
  'image/jpeg': ['jpeg'],
  'image/gif': ['gif'],
  'image/svg+xml': ['svg'],
  'image/x-icon': ['ico'],
  'text/plain': ['txt']
});

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    let uploadPath;
    
    if (file.fieldname === 'thumbnail') {
      uploadPath = getThumbnailsPath();
    } else {
      uploadPath = getDocumentsPath();
    }
    
    console.log(`📁 Upload destination para ${file.fieldname}: ${uploadPath}`);
    
    try {
      // ✅ GARANTIR QUE O DIRETÓRIO EXISTE
      await fs.mkdir(uploadPath, { recursive: true });
      console.log(`✅ Diretório confirmado: ${uploadPath}`);
      cb(null, uploadPath);
    } catch (err) {
      console.error(`❌ Erro ao criar diretório ${uploadPath}:`, err);
      cb(err);
    }
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const originalName = file.originalname;
    const nameWithoutExt = path.parse(originalName).name;
    const extension = path.extname(originalName);
    
    // ✅ SANITIZAÇÃO MAIS ROBUSTA
    const cleanName = nameWithoutExt
      .replace(/[^a-zA-Z0-9\-_\s]/g, '_')  // Manter espaços temporariamente
      .replace(/\s+/g, '_')  // Converter espaços para underscore
      .replace(/_+/g, '_')   // Remover underscores múltiplos
      .substring(0, 50);     // Limitar tamanho
    
    const filename = `${cleanName}_${timestamp}${extension}`;
    
    console.log(`📄 MULTER: "${originalName}" -> "${filename}"`);
    console.log(`📁 Salvando em: ${file.fieldname === 'thumbnail' ? getThumbnailsPath() : getDocumentsPath()}`);
    
    cb(null, filename);
  }
});

// ✅ CONFIGURAÇÃO ÚNICA DE UPLOAD
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 2 // Máximo 2 arquivos (file + thumbnail)
  },
  fileFilter: (req, file, cb) => {
    console.log(`📋 Validando arquivo: ${file.fieldname} - ${file.originalname} (${file.mimetype})`);
    
    if (file.fieldname === 'thumbnail') {
      // Para thumbnails, apenas imagens
      const allowedThumbnailMimes = [
        'image/jpeg',
        'image/jpg',
        'image/png', 
        'image/gif',
        'image/webp'
      ];
      
      if (allowedThumbnailMimes.includes(file.mimetype)) {
        console.log(`✅ Thumbnail aceita: ${file.mimetype}`);
        cb(null, true);
      } else {
        console.log(`❌ Thumbnail rejeitada: ${file.mimetype}`);
        cb(new Error(`Tipo de thumbnail não permitido: ${file.mimetype}`));
      }
    } else {
      // Para documentos
      const allowedMimes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp'
      ];

      if (allowedMimes.includes(file.mimetype)) {
        console.log(`✅ Documento aceito: ${file.mimetype}`);
        cb(null, true);
      } else {
        console.log(`❌ Documento rejeitado: ${file.mimetype}`);
        cb(new Error(`Tipo de arquivo não permitido: ${file.mimetype}`));
      }
    }
  }
});

// ✅ MIDDLEWARE DE ERROR MAIS DETALHADO
app.use((error, req, res, next) => {
  console.error('🚨 ERRO CAPTURADO:', error);
  
  if (error instanceof multer.MulterError) {
    console.error('❌ MULTER ERROR:', error.code, error.message);
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          error: 'Arquivo muito grande',
          message: 'O arquivo deve ter no máximo 50MB',
          code: 'FILE_TOO_LARGE',
          details: error.message
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          error: 'Campo de arquivo inesperado',
          message: 'Verifique se está enviando o arquivo no campo correto',
          code: 'UNEXPECTED_FILE',
          details: error.message
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          error: 'Muitos arquivos',
          message: 'Máximo 2 arquivos permitidos',
          code: 'TOO_MANY_FILES'
        });
      default:
        return res.status(400).json({
          error: 'Erro no upload',
          message: error.message,
          code: error.code
        });
    }
  }
  
  // ✅ ERRO DE VALIDAÇÃO DE ARQUIVO
  if (error.message && error.message.includes('não permitido')) {
    return res.status(400).json({
      error: 'Tipo de arquivo inválido',
      message: error.message,
      code: 'INVALID_FILE_TYPE'
    });
  }
  
  // ✅ OUTROS ERROS
  console.error('❌ ERRO GERAL:', error);
  res.status(500).json({
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Erro interno',
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
});

// ✅ VERIFICAR SE O ARQUIVO EXISTE FISICAMENTE:
app.get('/debug/check-file/:filename', async (req, res) => {
  const { filename } = req.params;
  const correctPath = path.join(DOCUMENTS_PATH, filename);
  
  try {
    const stats = await fs.stat(correctPath);
    res.json({
      filename,
      path: correctPath,
      exists: true,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      DOCUMENTS_PATH
    });
  } catch (error) {
    res.json({
      filename,
      path: correctPath,
      exists: false,
      error: error.message,
      DOCUMENTS_PATH
    });
  }
});

// ✅ Serve os arquivos da pasta dist com headers corretos
if (process.env.NODE_ENV === 'production') {
  console.log('🎨 Servindo frontend estático da pasta dist/');

  app.use(express.static(path.join(__dirname, 'dist'), {
    maxAge: '1y',
    etag: false,
    setHeaders: (res, filePath) => {
      const ext = path.extname(filePath).toLowerCase();

      switch (ext) {
        case '.css':
          res.setHeader('Content-Type', 'text/css; charset=utf-8');
          break;
        case '.js':
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          break;
        case '.json':
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          break;
        case '.html':
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          break;
        case '.png':
          res.setHeader('Content-Type', 'image/png');
          break;
        case '.ico':
          res.setHeader('Content-Type', 'image/x-icon');
          break;
        case '.svg':
          res.setHeader('Content-Type', 'image/svg+xml');
          break;
      }

      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
  }));
}

const PORT = process.env.PORT || 3001;

// Configurar trust proxy para Railway
app.set('trust proxy', 1);

// Configuração do banco PostgreSQL com RETRY e TIMEOUT
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  query_timeout: 30000,
  statement_timeout: 30000,
  idle_in_transaction_session_timeout: 30000,
  options: '-c timezone=America/Sao_Paulo'
});

// Event listeners para debug da conexão
pool.on('connect', () => {
  console.log('🔌 Nova conexão estabelecida com PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Erro inesperado no pool de conexões:', err);
});

// Função para testar conexão com retry
async function testarConexao(tentativas = 3) {
  for (let i = 1; i <= tentativas; i++) {
    try {
      console.log(`🔄 Tentativa ${i}/${tentativas} de conexão com PostgreSQL...`);
      const result = await pool.query('SELECT NOW() as hora, version() as versao');
      console.log(`✅ Conectado ao PostgreSQL! Hora: ${result.rows[0].hora}`);
      return true;
    } catch (error) {
      console.error(`❌ Erro na tentativa ${i}:`, error.message);
      if (i < tentativas) {
        console.log('⏳ Aguardando 5 segundos antes da próxima tentativa...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
  throw new Error('Não foi possível conectar ao PostgreSQL após múltiplas tentativas');
}

// Inicializar Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// CORS configurado corretamente
const isProduction = process.env.NODE_ENV === 'production';

let allowedOrigins;

if (isProduction) {
  allowedOrigins = [
    'https://sistema.resendemh.com.br',
  ].filter(Boolean); // Remove valores null/undefined
} else {
  allowedOrigins = [
    'http://localhost:3001',   // ✅ Mesmo domínio do backend
    'http://localhost:5173',   // Vite dev server
    'http://localhost:8080',   // Build local
    'http://127.0.0.1:3001',   // ✅ ADICIONAR VARIAÇÃO IP
    'http://127.0.0.1:5173',   // ✅ ADICIONAR VARIAÇÃO IP
    'http://127.0.0.1:8080'    // ✅ ADICIONAR VARIAÇÃO IP
  ];
}

console.log(`🔒 CORS: Ambiente ${isProduction ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'}`);
console.log(`📍 Origins permitidas:`, allowedOrigins);

app.use(cors({
  origin: (origin, callback) => {
    console.log(`🌐 Request from origin: ${origin || 'same-origin'}`);
    
    // ✅ SEMPRE PERMITIR REQUISIÇÕES SEM ORIGIN (same-origin, Postman, etc.)
    if (!origin) {
      console.log('✅ CORS: Same-origin request permitida');
      return callback(null, true);
    }
    
    // ✅ VERIFICAR SE ORIGIN ESTÁ NA LISTA PERMITIDA
    if (allowedOrigins.includes(origin)) {
      console.log(`✅ CORS: Origin ${origin} permitida`);
      return callback(null, true);
    } 
    
    // ✅ EM DESENVOLVIMENTO, SER MAIS PERMISSIVO
    if (!isProduction && !isRailway) {
      // Permitir qualquer localhost ou 127.0.0.1
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        console.log(`✅ CORS: Origin localhost ${origin} permitida (desenvolvimento)`);
        return callback(null, true);
      }
    }
    
    // ✅ BLOQUEAR APENAS SE REALMENTE NÃO PERMITIDO
    console.log(`❌ CORS BLOCKED: Origin ${origin} não permitida`);
    console.log(`📋 Origins permitidas: ${allowedOrigins.join(', ')}`);
    callback(new Error(`CORS: Origin ${origin} não permitida`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  // ✅ ADICIONAR CONFIGURAÇÕES EXTRAS PARA DEBUGGING
  optionsSuccessStatus: 200, // Para suportar browsers legados
  preflightContinue: false
}));

// Middleware de segurança
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: [
          "'self'",
          process.env.NODE_ENV !== 'production' ? "http://localhost:3001" : null,
          process.env.NODE_ENV !== 'production' ? "http://127.0.0.1:3001" : null,
          "https://*.railway.app",
          "https://api.resend.com",
          "https://app.fabric.microsoft.com",
          "https://sistema.resendemh.com.br",
          "https://docs.google.com",
          "https://drive.google.com",
          "https://*.googleusercontent.com",
          // ✅ ADICIONAR ESTES DOMÍNIOS PARA THUMBNAILS DO GOOGLE DRIVE
          "https://work.fife.usercontent.google.com",
          "https://*.usercontent.google.com"
        ].filter(Boolean), // Remove valores null
        frameSrc: [
          "'self'",
          "https://app.fabric.microsoft.com",
          "https://app.powerbi.com",
          "https://msit.powerbi.com",
          "https://docs.google.com",
          "https://drive.google.com"
        ],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://app.fabric.microsoft.com",
          "https://cdnjs.cloudflare.com"
        ],
        // ✅ WORKER-SRC PARA PDF.js
        workerSrc: [
          "'self'",
          "blob:",
          "https://cdnjs.cloudflare.com"
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com"
        ],
        // ✅ CORRIGIR: ADICIONAR "blob:" PARA SVGs GERADOS
        imgSrc: [
          "'self'", 
          "data:", 
          "https:",
          "blob:"  // ← ESTA É A CORREÇÃO PRINCIPAL
        ],
        fontSrc: ["'self'", "https:", "data:"]
      }
    }
  })
);

// Rate limiting melhorado para Railway
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Muitas tentativas, tente novamente em 15 minutos' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return req.path === '/health' || 
           req.path === '/ping' || 
           req.path === '/' || 
           req.path.startsWith('/assets/') ||
           req.path.includes('.ico') ||
           req.path.includes('.png') ||
           req.path.includes('.css') ||
           req.path.includes('.js');
  },
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  }
});
app.use(limiter);

// Rate limiter específico para autenticação
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas de autenticação, tente novamente em 15 minutos' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  }
});

// Body parser
app.use(express.json({ limit: '10mb' }));

// Middleware de logging
app.use((req, res, next) => {
  const origin = req.get('Origin') || 'undefined';
  const ip = req.ip || req.connection.remoteAddress;
  const auth = req.header('Authorization') ? 'COM TOKEN' : 'SEM TOKEN';
  
  console.log(`🔍 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log(`   📍 Origin: ${origin} | IP: ${ip} | Auth: ${auth}`);
  
  if (req.path.startsWith('/api/')) {
    console.log(`   📝 Body:`, JSON.stringify(req.body, null, 2));
    console.log(`   🎯 Headers:`, {
      'content-type': req.get('Content-Type'),
      'user-agent': req.get('User-Agent')?.substring(0, 50)
    });
  }
  
  next();
});

console.log('🎨 Servindo frontend estático da pasta dist/');
app.use(express.static(path.join(__dirname, 'dist')));

// ===============================================
// SCHEMAS DE VALIDAÇÃO ATUALIZADOS
// ===============================================

const schemaRegistro = Joi.object({
  nome: Joi.string().min(2).max(100).required(),
  email: Joi.when('tipo_colaborador', {
    is: 'clt_associado',
    then: Joi.string().email().regex(/@resendemh\.com\.br$/).required(),
    otherwise: Joi.string().email().optional().allow(null, '')
  }),
  email_pessoal: Joi.string().email().required(),
  senha: Joi.string().min(6).required(),
  setor: Joi.string().required(),
  tipo_colaborador: Joi.string().valid('estagiario', 'clt_associado').required()
});

const schemaLogin = Joi.object({
  email: Joi.string().email().required(),
  senha: Joi.string().required()
});

// Validação personalizada para registro
const validateRegistro = (data) => {
  const { nome, email, email_pessoal, senha, setor, tipo_colaborador } = data;

  // Validações básicas
  if (!nome || nome.trim().length < 2) {
    return { error: 'Nome deve ter pelo menos 2 caracteres' };
  }

  if (!email_pessoal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email_pessoal)) {
    return { error: 'Email pessoal deve ter formato válido' };
  }

  if (!senha || senha.length < 6) {
    return { error: 'Senha deve ter pelo menos 6 caracteres' };
  }

  if (!setor || setor.trim().length === 0) {
    return { error: 'Setor é obrigatório' };
  }

  if (!tipo_colaborador || !['estagiario', 'clt_associado'].includes(tipo_colaborador)) {
    return { error: 'Tipo de colaborador deve ser "estagiario" ou "clt_associado"' };
  }

  // Validação específica para CLT/Associado
  if (tipo_colaborador === 'clt_associado') {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { error: 'Email corporativo é obrigatório para CLT/Associado' };
    }
    if (!email.endsWith('@resendemh.com.br')) {
      return { error: 'Email corporativo deve terminar com @resendemh.com.br' };
    }
  }

  return { value: data };
};

// ===============================================
// MIDDLEWARE DE AUTENTICAÇÃO ATUALIZADO
// ===============================================

const authMiddleware = async (req, res, next) => {
  try {
    console.log('🔒 AUTH MIDDLEWARE: Iniciando verificação');
    
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      console.log('❌ AUTH: Token não encontrado');
      return res.status(401).json({ error: 'Token de acesso negado' });
    }

    console.log('🔑 AUTH: Token presente, verificando...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ AUTH: Token válido para usuário ID:', decoded.id);
    
    // ✅ CORREÇÃO: Query usando LEFT JOIN com usuarios_admin_log
    const result = await pool.query(
      `SELECT 
         u.id, u.nome, u.email, u.email_pessoal, u.setor, u.tipo_usuario, u.tipo_colaborador,
         u.email_verificado, u.is_coordenador,
         COALESCE(ual.ativo, true) as ativo,
         CASE 
           WHEN u.tipo_colaborador = 'estagiario' THEN u.email_pessoal 
           ELSE u.email 
         END as email_login
       FROM usuarios u
       LEFT JOIN usuarios_admin_log ual ON u.id = ual.usuario_id
       WHERE u.id = $1`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      console.log('❌ AUTH: Usuário não encontrado no banco');
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    const user = result.rows[0];

    if (!user.email_verificado) {
      console.log('❌ AUTH: Email não verificado');
      return res.status(401).json({ error: 'Email não verificado' });
    }

    if (!user.ativo) {
      console.log('❌ AUTH: Usuário inativo/revogado');
      return res.status(401).json({ error: 'Acesso revogado. Entre em contato com o administrador.' });
    }

    req.user = user;
    console.log('✅ AUTH: Usuário autenticado:', 
      user.tipo_colaborador === 'estagiario' ? user.email_pessoal : user.email
    );
    next();
  } catch (error) {
    console.error('❌ AUTH: Erro na verificação:', error.message);
    res.status(401).json({ error: 'Token inválido' });
  }
};

// Função para fazer login automático no Google
// Função para verificar se a planilha é pública e gerar thumbnail
async function checkPublicAccessAndGenerate(page, sheetId) {
  console.log(`🔍 Verificando acesso público para: ${sheetId}`);
  
  try {
    // ✅ TENTATIVA 1: Export direto público
    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=png&size=LARGE&gid=0`;
    console.log(`🔗 Testando export público: ${exportUrl}`);
    
    const response = await page.goto(exportUrl, { 
      waitUntil: 'networkidle0', 
      timeout: 15000 
    });
    
    const currentUrl = page.url();
    console.log(`🔍 URL atual: ${currentUrl}`);
    
    // Se foi redirecionado para login = planilha privada
    if (currentUrl.includes('accounts.google.com')) {
      console.log(`🔒 Planilha PRIVADA - redirecionado para login`);
      return { isPublic: false, method: null };
    }
    
    // Se response é OK e não foi redirecionado = export funcionou
    if (response.ok()) {
      console.log(`✅ Export público FUNCIONOU!`);
      return { isPublic: true, method: 'export-direto' };
    }
    
    // ✅ TENTATIVA 2: URL de visualização pública
    const viewUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit#gid=0`;
    console.log(`👁️ Testando visualização pública: ${viewUrl}`);
    
    await page.goto(viewUrl, { 
      waitUntil: 'networkidle2', 
      timeout: 15000 
    });
    
    const viewCurrentUrl = page.url();
    console.log(`🔍 URL após visualização: ${viewCurrentUrl}`);
    
    // Se foi redirecionado para login = planilha privada
    if (viewCurrentUrl.includes('accounts.google.com')) {
      console.log(`🔒 Planilha PRIVADA - requer autenticação`);
      return { isPublic: false, method: null };
    }
    
    // Verificar se elementos da planilha carregaram
    try {
      await page.waitForSelector('.grid-container, .waffle, .docs-sheet-container', { 
        timeout: 10000 
      });
      console.log(`✅ Planilha PÚBLICA carregada com sucesso!`);
      return { isPublic: true, method: 'visualizacao-publica' };
    } catch (waitError) {
      console.log(`⚠️ Elementos não carregaram, mas não foi redirecionado para login`);
      return { isPublic: true, method: 'visualizacao-limitada' };
    }
    
  } catch (error) {
    console.log(`❌ Erro ao verificar acesso:`, error.message);
    return { isPublic: false, method: null, error: error.message };
  }
}

// Função para gerar thumbnail padrão para planilhas privadas
async function generateDefaultThumbnail(imagePath, sheetId, title = 'Planilha Privada') {
  const sharp = require('sharp');
  const path = require('path');
  
  console.log(`🎨 Gerando thumbnail simples...`);
  
  // SVG bem simples - só visual da planilha verde
  const svgImage = `
    <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
      <!-- Background verde claro -->
      <rect width="400" height="300" fill="#d4f7d4"/>
      
      <!-- Grid da planilha -->
      <g stroke="#28a745" stroke-width="1" fill="none">
        <line x1="50" y1="60" x2="350" y2="60"/>
        <line x1="50" y1="90" x2="350" y2="90"/>
        <line x1="50" y1="120" x2="350" y2="120"/>
        <line x1="50" y1="150" x2="350" y2="150"/>
        <line x1="50" y1="180" x2="350" y2="180"/>
        <line x1="50" y1="210" x2="350" y2="210"/>
        <line x1="50" y1="240" x2="350" y2="240"/>
        
        <line x1="50" y1="60" x2="50" y2="240"/>
        <line x1="100" y1="60" x2="100" y2="240"/>
        <line x1="150" y1="60" x2="150" y2="240"/>
        <line x1="200" y1="60" x2="200" y2="240"/>
        <line x1="250" y1="60" x2="250" y2="240"/>
        <line x1="300" y1="60" x2="300" y2="240"/>
        <line x1="350" y1="60" x2="350" y2="240"/>
      </g>
    </svg>
  `;

  // Criar a base verde com grid
  const baseImage = await sharp(Buffer.from(svgImage))
    .png()
    .toBuffer();

  // Caminho para o cadeado
  const cadeadoPath = path.join(__dirname, '..', 'public', 'cadeado.png');
  console.log(`Cadeado localizado em: ${cadeadoPath}`);
  
  try {
  // Redimensionar o cadeado para 20x20 pixels bem pequeno
    const cadeadoResized = await sharp(cadeadoPath)
      .resize(20, 20)
      .png()
      .toBuffer();
    
    // Compor a imagem base com o cadeado bem pequeno no canto superior direito
    await sharp(baseImage)
      .composite([
        {
          input: cadeadoResized,
          top: 5,
          left: 375,
        }
      ])
      .png()
      .toFile(imagePath);
      
    console.log(`✅ Thumbnail criado com cadeado sobreposto`);
    
  } catch (error) {
    console.log(`⚠️ Erro ao sobrepor cadeado, salvando só o grid:`, error.message);
    
    // Fallback: salvar só a imagem base se der erro com o cadeado
    await sharp(baseImage)
      .toFile(imagePath);
      
    console.log(`✅ Thumbnail simples criado (sem cadeado)`);
  }
}

// ✅ ADICIONAR ESTA FUNÇÃO APÓS generateDefaultThumbnail no seu server.js:
async function generateDefaultPresentationThumbnail(imagePath, presentationId, title = 'Apresentação Privada') {
  const sharp = require('sharp');
  const path = require('path');
  
  console.log(`🎨 Gerando thumbnail padrão para presentation...`);
  
  // ✅ MESMA ESTRUTURA - CORES AMARELAS
  const svgImage = `
    <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
      <!-- Background gradient amarelo -->
      <defs>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#fbbf24;stop-opacity:0.1" />
          <stop offset="100%" style="stop-color:#fbbf24;stop-opacity:0.3" />
        </linearGradient>
      </defs>
      
      <!-- Background -->
      <rect width="400" height="300" fill="url(#bgGradient)"/>
      
      <!-- Slide principal (centro) -->
      <rect x="80" y="60" width="240" height="180" rx="8" fill="white" stroke="#fbbf24" stroke-width="2"/>
      
      <!-- Linhas de conteúdo simulando texto -->
      <rect x="90" y="70" width="220" height="8" rx="4" fill="#d1d5db"/>
      <rect x="90" y="85" width="220" height="8" rx="4" fill="#d1d5db"/>
      <rect x="90" y="100" width="220" height="8" rx="4" fill="#d1d5db"/>
      <rect x="90" y="115" width="220" height="8" rx="4" fill="#d1d5db"/>
      <rect x="90" y="130" width="140" height="8" rx="4" fill="#d1d5db"/>
      <rect x="90" y="145" width="220" height="8" rx="4" fill="#d1d5db"/>
      <rect x="90" y="160" width="220" height="8" rx="4" fill="#d1d5db"/>
      <rect x="90" y="175" width="220" height="8" rx="4" fill="#d1d5db"/>
      <rect x="90" y="190" width="220" height="8" rx="4" fill="#d1d5db"/>
      <rect x="90" y="205" width="220" height="8" rx="4" fill="#d1d5db"/>
      <rect x="90" y="220" width="160" height="8" rx="4" fill="#d1d5db"/>

      <!-- Slides em miniatura (lateral) -->
      <rect x="30" y="80" width="40" height="30" rx="3" fill="white" stroke="#9ca3af"/>
      <rect x="30" y="120" width="40" height="30" rx="3" fill="#fbbf24" opacity="0.3" stroke="#fbbf24"/>
      <rect x="30" y="160" width="40" height="30" rx="3" fill="white" stroke="#9ca3af"/>
      <rect x="30" y="200" width="40" height="30" rx="3" fill="white" stroke="#9ca3af"/>
  
    </svg>
  `;

  // Criar a imagem base com sharp
  const baseImage = await sharp(Buffer.from(svgImage))
    .png()
    .toBuffer();

  // Caminho para o cadeado (reutilizar o mesmo do sheets)
  const cadeadoPath = path.join(__dirname, '..', 'public', 'cadeado.png');
  console.log(`Cadeado localizado em: ${cadeadoPath}`);
  
  try {
    // Redimensionar o cadeado para 20x20 pixels bem pequeno
    const cadeadoResized = await sharp(cadeadoPath)
      .resize(20, 20)
      .png()
      .toBuffer();
    
    // Compor a imagem base com o cadeado bem pequeno no canto superior direito
    await sharp(baseImage)
      .composite([
        {
          input: cadeadoResized,
          top: 5,
          left: 375,
        }
      ])
      .png()
      .toFile(imagePath);
      
    console.log(`✅ Thumbnail de presentation criado com cadeado sobreposto`);
    
  } catch (error) {
    console.log(`⚠️ Erro ao sobrepor cadeado, salvando só o design:`, error.message);
    
    // Fallback: salvar só a imagem base se der erro com o cadeado
    await sharp(baseImage)
      .toFile(imagePath);
      
    console.log(`✅ Thumbnail simples de presentation criado (sem cadeado)`);
  }
}

// ✅ 2. ADICIONAR FUNÇÃO PARA GERAR THUMBNAIL DE PRESENTATION:
async function generateThumbnailForPresentation(presentationId, documentId, title) {
  console.log(`🎬 generateThumbnailForPresentation iniciado - Presentation: ${presentationId}, Doc: ${documentId}, Title: ${title}`);
  
  try {
    const thumbnailsPath = getThumbnailsPath();
    const timestamp = Date.now();
    const imageName = `auto_${timestamp}_${presentationId}.png`;
    const imagePath = path.join(thumbnailsPath, imageName);
    
    console.log(`📁 Caminho da thumbnail: ${imagePath}`);
    
    // ✅ VERIFICAR SE DIRETÓRIO EXISTE
    await fs.mkdir(thumbnailsPath, { recursive: true });
    
    // ✅ TENTAR CAPTURAR COM PUPPETEER PRIMEIRO
    let browser = null;
    let useDefaultThumbnail = false;
    
    try {
      console.log(`🌐 Iniciando Puppeteer para Google Presentation...`);
      
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--no-first-run'
        ]
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 720 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      
      // URL do Google Presentation
      const presentationUrl = `https://docs.google.com/presentation/d/${presentationId}/edit#slide=id.p`;
      
      const response = await page.goto(presentationUrl, { 
        waitUntil: 'domcontentloaded', 
        timeout: 15000 
      });
      
      // Verificar se é público (não redirecionou para login)
      const currentUrl = page.url();
      const isPublic = !currentUrl.includes('accounts.google.com') && response.ok();
      
      if (isPublic) {
        console.log(`📸 Presentation público detectado - capturando screenshot`);
        
        // Aguardar carregar o conteúdo
        await page.waitForTimeout(3000);
        
        // Tentar aguardar elementos específicos do Google Slides carregarem
        try {
          await page.waitForSelector('[data-test-id="presentation-canvas"], .punch-filmstrip, .punch-viewer-container', { timeout: 5000 });
        } catch (selectorError) {
          console.log('⚠️ Seletores específicos não encontrados, prosseguindo...');
        }
        
        // Capturar screenshot
        await page.screenshot({
          path: imagePath,
          fullPage: false,
          clip: {
            x: 0,
            y: 0,
            width: 1280,
            height: 720
          }
        });
        
        console.log(`✅ Screenshot de presentation capturado: ${imageName}`);
      } else {
        console.log(`🔒 Presentation privado detectado - gerando thumbnail padrão`);
        useDefaultThumbnail = true;
      }
      
      if (browser) {
        await browser.close();
      }
      
    } catch (puppeteerError) {
      console.error(`❌ Erro no Puppeteer para presentation:`, puppeteerError.message);
      
      if (browser) {
        await browser.close();
      }
      
      useDefaultThumbnail = true;
    }
    
    // ✅ USAR THUMBNAIL PADRÃO SE NECESSÁRIO
    if (useDefaultThumbnail) {
      await generateDefaultPresentationThumbnail(imagePath, presentationId, title);
    }
    
    // Atualizar banco de dados
    const thumbnailUrl = `/thumbnails/${imageName}`;
    const success = await updateThumbnailInDatabase(documentId, thumbnailUrl);
    
    if (success) {
      console.log(`✅ Thumbnail de presentation criada e salva no banco: ${thumbnailUrl}`);
      return {
        success: true,
        thumbnailUrl,
        status: useDefaultThumbnail ? 'default_generated' : 'screenshot_captured'
      };
    } else {
      throw new Error('Falha ao atualizar banco de dados');
    }
    
  } catch (error) {
    console.error(`❌ Erro em generateThumbnailForPresentation:`, error);
    
    // ✅ FALLBACK: Tentar criar pelo menos um arquivo básico
    try {
      const thumbnailsPath = getThumbnailsPath();
      const timestamp = Date.now();
      const imageName = `error_${timestamp}_${presentationId}.png`;
      const imagePath = path.join(thumbnailsPath, imageName);
      
      await generateDefaultPresentationThumbnail(imagePath, presentationId, 'Erro ao Gerar');
      
      const thumbnailUrl = `/thumbnails/${imageName}`;
      await updateThumbnailInDatabase(documentId, thumbnailUrl);
      
      console.log(`⚠️ Thumbnail de fallback para presentation criada: ${thumbnailUrl}`);
      
      return {
        success: true,
        thumbnailUrl,
        status: 'error_fallback'
      };
      
    } catch (fallbackError) {
      console.error(`❌ Erro crítico no fallback de presentation:`, fallbackError);
      return {
        success: false,
        status: 'critical_error',
        error: fallbackError.message
      };
    }
  }
}

app.get('/api/thumbnail', async (req, res) => {
  const sheetId = req.query.sheetId;
  const presentationId = req.query.presentationId;
  const url = req.query.url;
  const documentId = req.query.documentId;
  
  // ✅ VALIDAR PARÂMETROS
  if (!sheetId && !presentationId && !url) {
    return res.status(400).send('Faltando sheetId, presentationId ou url');
  }

  let browser = null;

  try {
    const thumbnailDir = getThumbnailsPath();
    await fs.mkdir(thumbnailDir, { recursive: true });

    // ✅ PROCESSAMENTO PARA GOOGLE SHEETS
    if (sheetId) {
      console.log(`🎯 Gerando thumbnail para Google Sheet: ${sheetId}`);
      
      const imagePath = path.join(thumbnailDir, `${sheetId}.png`);
      
      // Verificar cache primeiro
      try {
        const stats = await fs.stat(imagePath);
        if (stats.size > 0) {
          console.log(`♻️ Cache encontrado: ${sheetId}.png`);
          const thumbnailUrl = `/thumbnails/${sheetId}.png`;
          
          if (documentId) {
            await updateThumbnailInDatabase(documentId, thumbnailUrl);
          }
          
          return res.json({ thumbnailUrl, cached: true });
        }
      } catch (error) {
        console.log(`📸 Gerando novo thumbnail...`);
      }

      console.log(`🌐 Iniciando Puppeteer para Google Sheet...`);
      
      browser = await puppeteer.launch({
        headless: true, // ✅ Headless true para produção
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--no-first-run',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-blink-features=AutomationControlled',
          '--disable-component-extensions-with-background-pages',
          '--disable-default-apps',
          '--mute-audio',
          '--no-zygote',
          '--disable-background-networking'
        ]
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 720 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      
      // Verificar se é pública
      const accessResult = await checkPublicAccessAndGenerate(page, sheetId);
      
      if (!accessResult.isPublic) {
        console.log(`🔒 Planilha privada detectada - gerando thumbnail padrão`);
        
        await browser.close(); // ✅ FECHAR BROWSER
        await generateDefaultThumbnail(imagePath, sheetId);
        
        const thumbnailUrl = `/thumbnails/${sheetId}.png`;
        
        if (documentId) {
          await updateThumbnailInDatabase(documentId, thumbnailUrl);
        }
        
        return res.json({ 
          thumbnailUrl,
          isPublic: false,
          method: 'thumbnail-padrao',
          message: 'Planilha privada - thumbnail padrão gerado'
        });
      }
      
      // ✅ Tentar fechar avisos automaticamente
      console.log(`🔓 Planilha pública - tentando fechar avisos...`);
      
      try {
        await page.evaluate(() => {
          // Tentar fechar avisos de upgrade/compatibilidade
          const closeSelectors = [
            '[aria-label*="Close"]',
            '[aria-label*="Dismiss"]',
            '[aria-label*="Fechar"]',
            '[data-testid*="close"]',
            '.close-button',
            '[title*="Close"]',
            'button[aria-label*="Close"]',
            '[class*="dismiss"]',
            '[class*="close"]',
            // ✅ Novos seletores baseados em estrutura comum do Google
            '.docs-butterbar [role="button"]',
            '.docs-butterbar button',
            '[jsname][role="button"]',
            '[data-tooltip*="Close"]',
            '[data-tooltip*="Dismiss"]'
          ];
          
          closeSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
              const text = el.textContent || '';
              const ariaLabel = el.getAttribute('aria-label') || '';
              
              if (text.includes('×') || 
                  ariaLabel.includes('Close') ||
                  ariaLabel.includes('Fechar') ||
                  ariaLabel.includes('Dismiss') ||
                  el.getAttribute('data-tooltip')?.includes('Close')) {
                console.log('🎯 Tentando clicar para fechar aviso');
                el.click();
              }
            });
          });
          
          // Remover banners diretamente
          const bannerSelectors = [
            '[class*="upgrade"]',
            '[class*="banner"]',
            '[class*="notification"]',
            '.docs-butterbar-container',
            '.docs-butterbar',
            '[role="banner"]',
            // ✅ Seletores específicos do Google
            '.docs-omnibox-upgrade-tip',
            '.docs-butterbar-wrap',
            '[jsname="butterBarContent"]'
          ];
          
          bannerSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
              const text = el.textContent || '';
              if (text.includes('compatível') || 
                  text.includes('upgrade') ||
                  text.includes('navegador') ||
                  text.includes('browser') ||
                  text.includes('versão') ||
                  text.includes('atualiz')) {
                console.log('🗑️ Removendo banner de aviso');
                el.style.display = 'none';
                el.remove();
              }
            });
          });
        });
        
        console.log(`✅ Tentativa de fechar avisos concluída`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (closeError) {
        console.log(`⚠️ Erro ao tentar fechar avisos:`, closeError.message);
      }
      
      // Capturar screenshot
      console.log(`📸 Capturando screenshot via ${accessResult.method}`);
      await page.screenshot({ 
        path: imagePath, 
        fullPage: accessResult.method === 'export-direto',
        type: 'png'
      });
      
      // ✅ SEMPRE FECHAR BROWSER
      await browser.close();

      const stats = await fs.stat(imagePath);
      console.log(`📏 Screenshot capturado: ${stats.size} bytes`);
      
      if (stats.size === 0) {
        console.log(`⚠️ Screenshot vazio - gerando thumbnail padrão`);
        await generateDefaultThumbnail(imagePath, sheetId, 'Erro na Captura');
      }
      
      const thumbnailUrl = `/thumbnails/${sheetId}.png`;
      
      if (documentId) {
        await updateThumbnailInDatabase(documentId, thumbnailUrl);
      }
      
      return res.json({ 
        thumbnailUrl,
        isPublic: true,
        method: accessResult.method,
        message: 'Thumbnail gerado com sucesso'
      });
    }

    // ✅ PROCESSAMENTO PARA GOOGLE PRESENTATIONS
    if (presentationId) {
      console.log(`🎬 Gerando thumbnail para Google Presentation: ${presentationId}`);
      
      const timestamp = Date.now();
      const imageName = `auto_${timestamp}_${presentationId}.png`;
      const imagePath = path.join(thumbnailDir, imageName);
      
      // Verificar cache primeiro
      try {
        const existingFiles = await fs.readdir(thumbnailDir);
        const cachedFile = existingFiles.find(file => file.includes(presentationId) && file.endsWith('.png'));
        
        if (cachedFile) {
          const cachedPath = path.join(thumbnailDir, cachedFile);
          const stats = await fs.stat(cachedPath);
          
          if (stats.size > 0) {
            console.log(`♻️ Cache encontrado: ${cachedFile}`);
            const thumbnailUrl = `/thumbnails/${cachedFile}`;
            
            if (documentId) {
              await updateThumbnailInDatabase(documentId, thumbnailUrl);
            }
            
            return res.json({ thumbnailUrl, cached: true });
          }
        }
      } catch (error) {
        console.log(`📸 Gerando novo thumbnail para presentation...`);
      }

      console.log(`🌐 Iniciando Puppeteer para Google Presentation...`);
      
      let useDefaultThumbnail = false;
      
      try {
        browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '--no-first-run',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-blink-features=AutomationControlled',
            '--disable-component-extensions-with-background-pages',
            '--disable-default-apps',
            '--mute-audio',
            '--no-zygote',
            '--disable-background-networking'
          ]
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        // URL do Google Presentation
        const presentationUrl = `https://docs.google.com/presentation/d/${presentationId}/edit#slide=id.p`;
        
        const response = await page.goto(presentationUrl, { 
          waitUntil: 'domcontentloaded', 
          timeout: 15000 
        });
        
        // Verificar se é público (não redirecionou para login)
        const currentUrl = page.url();
        const isPublic = !currentUrl.includes('accounts.google.com') && response.ok();
        
        if (isPublic) {
          console.log(`📸 Presentation público detectado - capturando screenshot`);
          
          // Aguardar carregar o conteúdo
          await page.waitForTimeout(3000);
          
          // Tentar aguardar elementos específicos do Google Slides carregarem
          try {
            await page.waitForSelector('[data-test-id="presentation-canvas"], .punch-filmstrip, .punch-viewer-container', { timeout: 5000 });
          } catch (selectorError) {
            console.log('⚠️ Seletores específicos não encontrados, prosseguindo...');
          }
          
          // Tentar fechar avisos como no Sheets
          try {
            await page.evaluate(() => {
              const closeSelectors = [
                '[aria-label*="Close"]',
                '[aria-label*="Dismiss"]',
                '[aria-label*="Fechar"]',
                '[data-testid*="close"]',
                '.close-button',
                '[title*="Close"]',
                'button[aria-label*="Close"]',
                '[class*="dismiss"]',
                '[class*="close"]',
                '.docs-butterbar [role="button"]',
                '.docs-butterbar button',
                '[jsname][role="button"]',
                '[data-tooltip*="Close"]',
                '[data-tooltip*="Dismiss"]'
              ];
              
              closeSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                  const text = el.textContent || '';
                  const ariaLabel = el.getAttribute('aria-label') || '';
                  
                  if (text.includes('×') || 
                      ariaLabel.includes('Close') ||
                      ariaLabel.includes('Fechar') ||
                      ariaLabel.includes('Dismiss') ||
                      el.getAttribute('data-tooltip')?.includes('Close')) {
                    console.log('🎯 Tentando clicar para fechar aviso');
                    el.click();
                  }
                });
              });
              
              // Remover banners diretamente
              const bannerSelectors = [
                '[class*="upgrade"]',
                '[class*="banner"]',
                '[class*="notification"]',
                '.docs-butterbar-container',
                '.docs-butterbar',
                '[role="banner"]',
                '.docs-omnibox-upgrade-tip',
                '.docs-butterbar-wrap',
                '[jsname="butterBarContent"]'
              ];
              
              bannerSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                  const text = el.textContent || '';
                  if (text.includes('compatível') || 
                      text.includes('upgrade') ||
                      text.includes('navegador') ||
                      text.includes('browser') ||
                      text.includes('versão') ||
                      text.includes('atualiz')) {
                    console.log('🗑️ Removendo banner de aviso');
                    el.style.display = 'none';
                    el.remove();
                  }
                });
              });
            });
            
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (closeError) {
            console.log(`⚠️ Erro ao tentar fechar avisos:`, closeError.message);
          }
          
          // Capturar screenshot
          await page.screenshot({
            path: imagePath,
            fullPage: false,
            clip: {
              x: 0,
              y: 0,
              width: 1280,
              height: 720
            }
          });
          
          console.log(`✅ Screenshot de presentation capturado: ${imageName}`);
        } else {
          console.log(`🔒 Presentation privado detectado - gerando thumbnail padrão`);
          useDefaultThumbnail = true;
        }
        
        await browser.close();
        browser = null;
        
      } catch (puppeteerError) {
        console.error(`❌ Erro no Puppeteer para presentation:`, puppeteerError.message);
        
        if (browser) {
          await browser.close();
          browser = null;
        }
        
        useDefaultThumbnail = true;
      }
      
      // ✅ USAR THUMBNAIL PADRÃO SE NECESSÁRIO
      if (useDefaultThumbnail) {
        await generateDefaultPresentationThumbnail(imagePath, presentationId, 'Apresentação');
      }
      
      // Verificar se arquivo foi criado
      const stats = await fs.stat(imagePath);
      console.log(`📏 Thumbnail de presentation: ${stats.size} bytes`);
      
      if (stats.size === 0) {
        console.log(`⚠️ Thumbnail vazio - gerando padrão`);
        await generateDefaultPresentationThumbnail(imagePath, presentationId, 'Erro na Captura');
      }
      
      const thumbnailUrl = `/thumbnails/${imageName}`;
      
      if (documentId) {
        await updateThumbnailInDatabase(documentId, thumbnailUrl);
      }
      
      return res.json({ 
        thumbnailUrl,
        isPublic: !useDefaultThumbnail,
        method: useDefaultThumbnail ? 'thumbnail-padrao' : 'screenshot-captured',
        message: 'Thumbnail de presentation gerado com sucesso'
      });
    }

    // ✅ PROCESSAMENTO PARA SITES COMUNS
    if (url) {
      console.log(`🌐 Gerando screenshot para site: ${url}`);
      
      const domain = new URL(url).hostname.replace(/[^a-zA-Z0-9]/g, '-');
      const imagePath = path.join(thumbnailDir, `website-${domain}.png`);
      
      // Verificar cache primeiro
      try {
        const stats = await fs.stat(imagePath);
        if (stats.size > 0) {
          console.log(`♻️ Screenshot em cache encontrado para: ${domain}`);
          const thumbnailUrl = `/thumbnails/website-${domain}.png`;
          
          if (documentId) {
            await updateThumbnailInDatabase(documentId, thumbnailUrl);
          }
          
          return res.json({ thumbnailUrl, cached: true, domain });
        }
      } catch (error) {
        console.log(`📸 Gerando novo screenshot para site...`);
      }

      browser = await puppeteer.launch({
        headless: true, // ✅ Headless true para produção
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--no-first-run',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      });

      const page = await browser.newPage();
      
      await page.setViewport({ 
        width: 1200, 
        height: 800,
        deviceScaleFactor: 2
      });
      
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

      await page.setDefaultNavigationTimeout(30000);
      await page.setDefaultTimeout(30000);
      
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['font', 'media'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      try {
        console.log(`🔗 Navegando para: ${url}`);
        await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 25000 
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Remover overlays e banners
        await page.evaluate(() => {
          const overlays = document.querySelectorAll(
            '[class*="popup"], [class*="modal"], [class*="overlay"], ' +
            '[class*="cookie"], [class*="banner"], [id*="cookie"], ' +
            '[class*="consent"], [class*="gdpr"]'
          );
          overlays.forEach(el => el.remove());
          window.scrollTo(0, 0);
        });

        await new Promise(resolve => setTimeout(resolve, 500));

        console.log(`📸 Capturando screenshot...`);
        await page.screenshot({ 
          path: imagePath,
          type: 'png',
          fullPage: false,
          clip: {
            x: 0,
            y: 0,
            width: 1200,
            height: 800
          }
        });

        // ✅ SEMPRE FECHAR BROWSER
        await browser.close();

        const stats = await fs.stat(imagePath);
        console.log(`✅ Screenshot capturado: ${stats.size} bytes`);
        
        if (stats.size === 0) {
          throw new Error('Screenshot vazio gerado');
        }
        
        const thumbnailUrl = `/thumbnails/website-${domain}.png`;
        
        if (documentId) {
          await updateThumbnailInDatabase(documentId, thumbnailUrl);
        }
        
        return res.json({ 
          thumbnailUrl,
          domain,
          message: 'Screenshot gerado com sucesso'
        });

      } catch (navigationError) {
        console.error(`❌ Erro ao acessar ${url}:`, navigationError.message);
        
        // ✅ FECHAR BROWSER MESMO COM ERRO
        await browser.close();
        
        await generateWebsiteFallbackThumbnail(imagePath, url);
        
        const thumbnailUrl = `/thumbnails/website-${domain}.png`;
        
        if (documentId) {
          await updateThumbnailInDatabase(documentId, thumbnailUrl);
        }
        
        return res.json({ 
          thumbnailUrl,
          domain,
          message: 'Site inacessível - thumbnail padrão gerado',
          error: navigationError.message
        });
      }
    }

  } catch (error) {
    console.error('❌ Erro ao gerar thumbnail:', {
      message: error.message,
      sheetId: sheetId,
      presentationId: presentationId,
      url: url,
      timestamp: new Date().toISOString()
    });
    
    // Fallback final
    try {
      const thumbnailDir = getThumbnailsPath();
      let imagePath, thumbnailUrl;
      
      if (sheetId) {
        imagePath = path.join(thumbnailDir, `${sheetId}.png`);
        await generateDefaultThumbnail(imagePath, sheetId, 'Erro Técnico');
        thumbnailUrl = `/thumbnails/${sheetId}.png`;
      } else if (presentationId) {
        const timestamp = Date.now();
        const imageName = `error_${timestamp}_${presentationId}.png`;
        imagePath = path.join(thumbnailDir, imageName);
        await generateDefaultPresentationThumbnail(imagePath, presentationId, 'Erro Técnico');
        thumbnailUrl = `/thumbnails/${imageName}`;
      } else if (url) {
        const domain = new URL(url).hostname.replace(/[^a-zA-Z0-9]/g, '-');
        imagePath = path.join(thumbnailDir, `website-${domain}.png`);
        await generateWebsiteFallbackThumbnail(imagePath, url);
        thumbnailUrl = `/thumbnails/website-${domain}.png`;
      }
      
      res.json({ 
        thumbnailUrl,
        method: 'thumbnail-erro',
        message: 'Erro técnico - thumbnail padrão gerado',
        error: error.message
      });
      
    } catch (fallbackError) {
      res.status(500).json({ 
        error: 'Erro ao gerar thumbnail',
        details: error.message,
        sheetId: sheetId,
        presentationId: presentationId,
        url: url
      });
    }
  } finally {
    // ✅ GARANTIR QUE BROWSER SEMPRE SEJA FECHADO
    if (browser) {
      try {
        await browser.close();
        console.log(`🔒 Browser fechado com segurança`);
      } catch (closeError) {
        console.error(`❌ Erro ao fechar browser:`, closeError.message);
        
        // Force kill se necessário
        try {
          const pages = await browser.pages();
          await Promise.all(pages.map(page => page.close()));
          await browser.close();
        } catch (forceError) {
          console.error(`❌ Erro ao forçar fechamento:`, forceError.message);
        }
      }
    }
  }
});

app.get('/api/website-screenshot', async (req, res) => {
  const { url, documentId } = req.query;
  
  if (!url) return res.status(400).send('URL é obrigatória');

  console.log(`🌐 Gerando screenshot para site: ${url}`);

  try {
    const domain = new URL(url).hostname.replace(/[^a-zA-Z0-9]/g, '-');
    const thumbnailDir = getThumbnailsPath();
    const imagePath = path.join(thumbnailDir, `website-${domain}.png`);
    
    await fs.mkdir(thumbnailDir, { recursive: true });

    // Verificar cache primeiro
    try {
      const stats = await fs.stat(imagePath);
      if (stats.size > 0) {
        console.log(`♻️ Screenshot em cache encontrado para: ${domain}`);
        const thumbnailUrl = `/thumbnails/website-${domain}.png`;
        
        if (documentId) {
          await updateThumbnailInDatabase(documentId, thumbnailUrl);
        }
        
        return res.json({ thumbnailUrl, cached: true, domain });
      }
    } catch (error) {
      console.log(`📸 Gerando novo screenshot...`);
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--no-first-run',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--start-maximized',
        '--disable-features=VizDisplayCompositor',
        '--force-device-scale-factor=1',
        '--disable-extensions',
        '--no-default-browser-check'
      ]
    });

    const page = await browser.newPage();
    
    // ✅ CONFIGURAÇÃO ESPECÍFICA PARA INSTAGRAM
    if (url.includes('instagram.com')) {
      await page.setViewport({ 
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
        isLandscape: true
      });
      
      // ✅ CONFIGURAÇÕES EXTRAS PARA FORÇAR VERSÃO DESKTOP
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'platform', {
          get: () => 'Win32'
        });
        
        Object.defineProperty(navigator, 'maxTouchPoints', {
          get: () => 0
        });
        
        Object.defineProperty(screen, 'width', {
          get: () => 1920
        });
        
        Object.defineProperty(screen, 'height', {
          get: () => 1080
        });
      });
    } else {
      await page.setViewport({ 
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
        isLandscape: true
      });
    }
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    page.setDefaultNavigationTimeout(60000);
    page.setDefaultTimeout(60000);
    
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      const reqUrl = req.url();
      
      if (resourceType === 'font' || 
          (resourceType === 'image' && reqUrl.includes('.gif')) ||
          resourceType === 'media') {
        req.abort();
      } else {
        req.continue();
      }
    });

    try {
      console.log(`🔗 Navegando para: ${url}`);
      
      await page.goto(url, { 
        waitUntil: 'networkidle0',
        timeout: 30000 
      });
      
      console.log(`⏳ Aguardando renderização completa...`);
      await handleSocialMediaSites(page, url);

      if (url.includes('instagram.com')) {
        console.log(`⏰ Aguardando 3 segundos após fechar modal do Instagram...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Verificação dupla do modal
        const stillHasModal = await page.evaluate(() => {
          const modals = document.querySelectorAll('[role="dialog"]');
          return modals.length > 0;
        });
        
        if (stillHasModal) {
          console.log(`⚠️ Modal ainda presente, removendo forçadamente...`);
          await forceCloseInstagramModal(page);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // ✅ APLICAR LAYOUT DESKTOP AQUI
        await forceInstagramDesktopLayout(page);
        
        // Limpeza final específica para Instagram
        await page.evaluate(() => {
          const overlays = document.querySelectorAll(`
            [style*="position: fixed"],
            [style*="z-index"],
            [class*="modal"],
            [class*="overlay"],
            [class*="popup"]
          `);
          
          overlays.forEach(el => {
            const style = window.getComputedStyle(el);
            if (style.position === 'fixed' && parseInt(style.zIndex) > 10) {
              el.style.display = 'none';
            }
          });
          
          document.body.style.overflow = 'auto';
          document.documentElement.style.overflow = 'auto';
          window.scrollTo({ top: 0, behavior: 'instant' });
        });
        
        console.log(`✅ Instagram preparado para screenshot`);
      }
      
      await page.waitForFunction(() => {
        return document.readyState === 'complete';
      }, { timeout: 10000 });
      
      // Tempo diferenciado por site
      const waitTime = url.includes('instagram.com') ? 2000 : 5000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      const hasStyles = await page.evaluate(() => {
        const body = document.body;
        const computedStyle = window.getComputedStyle(body);
        const hasBackground = computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' && 
                            computedStyle.backgroundColor !== 'transparent';
        const hasColor = computedStyle.color !== 'rgb(0, 0, 0)';
        
        return hasBackground || hasColor || computedStyle.fontFamily !== 'Times';
      });
      
      console.log(`🎨 Estilos detectados: ${hasStyles}`);
      
      if (!hasStyles && !url.includes('instagram.com')) {
        console.log(`⏳ Aguardando mais tempo para CSS...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      // Limpeza geral para outros sites
      if (!url.includes('instagram.com')) {
        await page.evaluate(() => {
          try {
            const overlays = document.querySelectorAll([
              '[class*="popup"]',
              '[class*="modal"]', 
              '[class*="overlay"]',
              '[class*="cookie"]',
              '[class*="banner"]',
              '[id*="cookie"]',
              '[class*="consent"]',
              '[class*="gdpr"]',
              '[class*="notification"]',
              '[class*="toast"]'
            ].join(', '));
            
            overlays.forEach(el => {
              if (el && el.parentNode) {
                el.style.display = 'none';
              }
            });
            
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            const images = document.querySelectorAll('img[loading="lazy"]');
            images.forEach(img => {
              img.removeAttribute('loading');
            });
            
          } catch (e) {
            console.log('Erro ao limpar página:', e);
          }
        });

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`📸 Capturando screenshot final...`);
      
      // ✅ SCREENSHOT DIFERENCIADO POR SITE
      if (url.includes('instagram.com')) {
        await page.screenshot({ 
          path: imagePath,
          type: 'png',
          fullPage: false,
          clip: { 
            x: 0, 
            y: 0, 
            width: 1600,  // ✅ Mais largo para Instagram
            height: 1000  // ✅ Mais alto para Instagram
          },
          omitBackground: false
        });
      } else {
        await page.screenshot({ 
          path: imagePath,
          type: 'png',
          fullPage: false,
          clip: { 
            x: 0, 
            y: 0, 
            width: 1200, 
            height: 800 
          },
          omitBackground: false
        });
      }

      await browser.close();

      const stats = await fs.stat(imagePath);
      console.log(`✅ Screenshot capturado: ${stats.size} bytes`);
      
      if (stats.size < 1000) {
        throw new Error('Screenshot muito pequeno, provavelmente inválido');
      }
      
      const thumbnailUrl = `/thumbnails/website-${domain}.png`;
      
      if (documentId) {
        await updateThumbnailInDatabase(documentId, thumbnailUrl);
      }
      
      res.json({ 
        thumbnailUrl,
        domain,
        hasStyles,
        message: 'Screenshot gerado com sucesso'
      });

    } catch (navigationError) {
      console.error(`❌ Erro ao capturar ${url}:`, navigationError.message);
      await browser.close();
      
      console.log(`🎨 Gerando thumbnail de fallback para ${url}`);
      await generateWebsiteFallbackThumbnail(imagePath, url);
      
      const thumbnailUrl = `/thumbnails/website-${domain}.png`;
      
      if (documentId) {
        await updateThumbnailInDatabase(documentId, thumbnailUrl);
      }
      
      res.json({ 
        thumbnailUrl,
        domain,
        message: 'Site inacessível - thumbnail padrão gerado',
        error: navigationError.message
      });
    }

  } catch (error) {
    console.error('❌ Erro ao gerar screenshot:', error);
    
    try {
      const domain = new URL(url).hostname.replace(/[^a-zA-Z0-9]/g, '-');
      const thumbnailDir = getThumbnailsPath();
      const imagePath = path.join(thumbnailDir, `website-${domain}.png`);
      
      await generateWebsiteFallbackThumbnail(imagePath, url);
      
      const thumbnailUrl = `/thumbnails/website-${domain}.png`;
      
      res.json({ 
        thumbnailUrl,
        domain,
        message: 'Erro técnico - thumbnail padrão gerado',
        error: error.message
      });
      
    } catch (fallbackError) {
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        message: error.message 
      });
    }
  }
});

// ✅ FUNÇÃO DE FALLBACK CORRIGIDA:
async function generateWebsiteFallbackThumbnail(imagePath, url) {
  try {
    console.log(`🎨 Criando thumbnail de fallback para: ${url}`);
    
    const domain = new URL(url).hostname.replace('www.', '');
    
    // ✅ VERIFICAR SE SHARP ESTÁ DISPONÍVEL
    if (typeof sharp === 'undefined') {
      console.error('❌ Sharp não está disponível, usando método alternativo');
      
      // Criar um arquivo SVG simples como fallback
      const svgContent = `
        <svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg">
          <rect width="1200" height="800" fill="#4FACFE"/>
          <circle cx="600" cy="300" r="80" fill="rgba(255,255,255,0.2)" stroke="white" stroke-width="3"/>
          <text x="600" y="320" text-anchor="middle" fill="white" font-family="Arial" font-size="60">🌐</text>
          <text x="600" y="450" text-anchor="middle" fill="white" font-family="Arial" font-size="48" font-weight="bold">${domain}</text>
          <text x="600" y="500" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-family="Arial" font-size="24">Site não disponível</text>
        </svg>
      `;
      
      await fs.writeFile(imagePath.replace('.png', '.svg'), svgContent);
      console.log(`✅ SVG de fallback criado para ${domain}`);
      return;
    }
    
    const image = sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 4,
        background: { r: 79, g: 172, b: 254, alpha: 1 }
      }
    });
    
    const textSvg = `
      <svg width="1200" height="800">
        <style>
          .domain-text { 
            font-family: Arial, sans-serif; 
            font-size: 48px; 
            font-weight: bold; 
            fill: white; 
            text-anchor: middle; 
          }
          .url-text { 
            font-family: Arial, sans-serif; 
            font-size: 24px; 
            fill: rgba(255,255,255,0.8); 
            text-anchor: middle; 
          }
        </style>
        <text x="600" y="400" class="domain-text">${domain}</text>
        <text x="600" y="450" class="url-text">Site não disponível</text>
        <circle cx="600" cy="300" r="80" fill="rgba(255,255,255,0.2)" stroke="white" stroke-width="3"/>
        <text x="600" y="320" style="font-family: Arial; font-size: 60px; fill: white; text-anchor: middle;">🌐</text>
      </svg>
    `;
    
    await image
      .composite([{ input: Buffer.from(textSvg), top: 0, left: 0 }])
      .png()
      .toFile(imagePath);
      
    console.log(`✅ Thumbnail de fallback criado para ${domain}`);
    
  } catch (error) {
    console.error('❌ Erro ao criar thumbnail de fallback:', error);
    
    // ✅ ÚLTIMO RECURSO: criar arquivo vazio para evitar erro 404
    try {
      await fs.writeFile(imagePath, Buffer.alloc(0));
      console.log(`⚠️ Arquivo vazio criado como último recurso`);
    } catch (finalError) {
      console.error('❌ Erro crítico ao criar arquivo:', finalError);
    }
  }
}

// ✅ NOVA FUNÇÃO PARA ATUALIZAR THUMBNAIL NO BANCO
async function updateThumbnailInDatabase(documentId, thumbnailUrl) {
  try {
    console.log(`💾 Atualizando thumbnail no banco - Doc ID: ${documentId}, URL: ${thumbnailUrl}`);
    
    const result = await pool.query(`
      UPDATE documentos 
      SET thumbnail_url = $1, atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, titulo, thumbnail_url
    `, [thumbnailUrl, documentId]);
    
    if (result.rowCount > 0) {
      console.log(`✅ Thumbnail atualizado no banco:`, result.rows[0]);
    } else {
      console.log(`⚠️ Documento não encontrado para atualizar: ${documentId}`);
    }
    
    return result.rowCount > 0;
  } catch (error) {
    console.error(`❌ Erro ao atualizar thumbnail no banco:`, error);
    return false;
  }
}

// ✅ FUNÇÃO PRINCIPAL PARA GERAR THUMBNAIL DE DOCUMENTO
async function generateThumbnailForDocument(sheetId, documentId, title) {
  console.log(`🎯 generateThumbnailForDocument iniciado - Sheet: ${sheetId}, Doc: ${documentId}, Title: ${title}`);
  
  try {
    const thumbnailsPath = getThumbnailsPath();
    const timestamp = Date.now();
    const imageName = `auto_${timestamp}_${sheetId}.png`;
    const imagePath = path.join(thumbnailsPath, imageName);
    
    console.log(`📁 Caminho da thumbnail: ${imagePath}`);
    
    // ✅ VERIFICAR SE DIRETÓRIO EXISTE
    await fs.mkdir(thumbnailsPath, { recursive: true });
    
    // ✅ POR ENQUANTO, USAR APENAS THUMBNAIL PADRÃO (sem Puppeteer)
    // Isso evita problemas de memória e dependências
    await generateDefaultThumbnail(imagePath, sheetId, title);
    
    const thumbnailUrl = `/thumbnails/${imageName}`;
    const success = await updateThumbnailInDatabase(documentId, thumbnailUrl);
    
    if (success) {
      console.log(`✅ Thumbnail automática criada e salva no banco: ${thumbnailUrl}`);
      return {
        success: true,
        thumbnailUrl,
        status: 'default_generated'
      };
    } else {
      throw new Error('Falha ao atualizar banco de dados');
    }
    
  } catch (error) {
    console.error(`❌ Erro em generateThumbnailForDocument:`, error);
    
    // ✅ FALLBACK: Tentar criar pelo menos um arquivo básico
    try {
      const thumbnailsPath = getThumbnailsPath();
      const timestamp = Date.now();
      const imageName = `error_${timestamp}_${sheetId}.png`;
      const imagePath = path.join(thumbnailsPath, imageName);
      
      await generateDefaultThumbnail(imagePath, sheetId, 'Erro ao Gerar');
      
      const thumbnailUrl = `/thumbnails/${imageName}`;
      await updateThumbnailInDatabase(documentId, thumbnailUrl);
      
      console.log(`⚠️ Thumbnail de fallback criada: ${thumbnailUrl}`);
      
      return {
        success: true,
        thumbnailUrl,
        status: 'error_fallback'
      };
      
    } catch (fallbackError) {
      console.error(`❌ Erro crítico no fallback:`, fallbackError);
      return {
        success: false,
        status: 'critical_error',
        error: fallbackError.message
      };
    }
  }
}

app.listen(3001, () => {
  console.log('Servidor rodando em http://localhost:3001');
});

app.get('/api/documents', authMiddleware, async (req, res) => {
  try {
    const userType = req.user.tipo_usuario;
    const tipoColaborador = req.user.tipo_colaborador;
    
    console.log(`📄 GET /api/documents - Usuário: ${req.user.email_login} (${userType}/${tipoColaborador})`);

    // ✅ QUERY PARA BUSCAR TODOS OS DOCUMENTOS ATIVOS
    const result = await pool.query(`
      SELECT 
        d.id, d.titulo, d.descricao, d.categoria, d.nome_arquivo, 
        d.url_arquivo, d.tamanho_arquivo, d.tipo_mime, d.qtd_downloads,
        d.enviado_por, d.enviado_em, d.ativo, d.criado_em, d.atualizado_em,
        d.visibilidade, d.thumbnail_url,
        u.nome as enviado_por_nome
      FROM documentos d
      LEFT JOIN usuarios u ON d.enviado_por = u.id
      WHERE d.ativo = true 
      ORDER BY d.criado_em ASC
    `);

    console.log(`📄 Query executada - encontrados ${result.rows.length} documentos`);

    // ✅ MAPEAR DOCUMENTOS PARA O FORMATO ESPERADO PELO FRONTEND
    const documentos = result.rows.map(doc => {
      console.log(`📄 Mapeando documento: ${doc.id} - ${doc.titulo}`);
      
      return {
        id: doc.id,
        titulo: doc.titulo,
        descricao: doc.descricao || '',
        categoria: doc.categoria,
        nomeArquivo: doc.nome_arquivo,
        urlArquivo: doc.url_arquivo,
        tamanhoArquivo: doc.tamanho_arquivo,
        tipoMime: doc.tipo_mime,
        qtdDownloads: doc.qtd_downloads || 0,
        enviadoPor: doc.enviado_por,
        enviadoPorNome: doc.enviado_por_nome,
        enviadoEm: doc.enviado_em,
        ativo: doc.ativo,
        criadoEm: doc.criado_em,
        atualizadoEm: doc.atualizado_em,
        thumbnailUrl: doc.thumbnail_url,
        visibilidade: doc.visibilidade || 'todos'
      };
    });

    // ✅ EXTRAIR CATEGORIAS ÚNICAS
    const categorias = [...new Set(documentos.map(d => d.categoria).filter(Boolean))];
    
    console.log(`📄 Enviando resposta: ${documentos.length} documentos, ${categorias.length} categorias`);
    console.log(`📄 Categorias encontradas:`, categorias);

    // ✅ GARANTIR RESPOSTA JSON
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
      success: true,
      documentos,
      total: documentos.length,
      categorias
    });
    
  } catch (error) {
    console.error('❌ Erro na rota GET /api/documents:', error);
    
    // ✅ RESPOSTA DE ERRO TAMBÉM EM JSON
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ 
      success: false,
      error: 'Erro interno do servidor', 
      documentos: [],
      categorias: [],
      message: error.message 
    });
  }
});

// ======================= LISTAGEM DE DOCUMENTOS =======================
app.post('/api/documents', authMiddleware, upload.single('thumbnail'), async (req, res) => {
  try {
    const { title, description, category, fileName, fileUrl, visibilidade = 'todos' } = req.body;
    const thumbnailFile = req.file;

    // Validar visibilidade
    const visibilidadesValidas = ['todos', 'estagiarios', 'clt_associados'];
    if (!visibilidadesValidas.includes(visibilidade)) {
      return res.status(400).json({ error: 'Visibilidade inválida' });
    }

    // ✅ PROCESSAR THUMBNAIL SE FORNECIDA
    let thumbnailUrl = null;
    if (thumbnailFile) {
      thumbnailUrl = `/thumbnails/${thumbnailFile.filename}`;
      console.log(`📸 Thumbnail customizada salva: ${thumbnailUrl}`);
    }

    // ✅ INSERIR NO BANCO COM THUMBNAIL_URL
    const result = await pool.query(`
      INSERT INTO documentos (
        titulo, descricao, categoria, nome_arquivo, url_arquivo,
        thumbnail_url, enviado_por, ativo, visibilidade
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
      RETURNING *
    `, [
      title, 
      description || '', 
      category, 
      fileName || 'Documento via URL',
      fileUrl, 
      thumbnailUrl, // ✅ SALVAR THUMBNAIL URL NO BANCO
      req.user.id,
      visibilidade
    ]);

    const documento = result.rows[0];

    // ✅ CORRIGIDO: Verificar se JÁ TEM thumbnail salva (thumbnailUrl, não thumbnailFile)
    const jaTemThumbnail = documento.thumbnail_url !== null;
    const ehGoogleSheets = fileUrl && fileUrl.includes('docs.google.com/spreadsheets');

    if (!jaTemThumbnail && ehGoogleSheets) {
      console.log('📋 Gerando thumbnail automática para Google Sheets (sem thumbnail customizada)...');
      
      const sheetId = fileUrl.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
      if (sheetId) {
        // Trigger assíncrono - não bloquear resposta
        setTimeout(async () => {
          try {
            await generateThumbnailForDocument(sheetId, documento.id, title);
            console.log(`✅ Thumbnail automática gerada para documento ${documento.id}`);
          } catch (error) {
            console.error('❌ Erro ao gerar thumbnail automática:', error);
          }
        }, 100);
      }
    } else if (jaTemThumbnail) {
      console.log('✅ Thumbnail customizada detectada - pulando geração automática');
    }

    console.log(`✅ Documento via URL criado:`, {
      id: documento.id,
      titulo: documento.titulo,
      thumbnail_url: documento.thumbnail_url,
      tem_thumbnail_customizada: !!thumbnailFile,
      vai_gerar_automatica: !jaTemThumbnail && ehGoogleSheets
    });

    // ✅ RESPOSTA PADRONIZADA
    res.status(201).json({ 
      success: true, 
      documento,
      message: thumbnailFile ? 
        'Documento criado com thumbnail customizada!' : 
        'Documento criado com sucesso!',
      tem_thumbnail_customizada: !!thumbnailFile,
      vai_gerar_automatica: !jaTemThumbnail && ehGoogleSheets
    });

  } catch (error) {
    console.error('❌ Erro ao criar documento:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erro interno do servidor',
      details: error.message 
    });
  }
});

app.post('/api/documents/upload', authMiddleware, upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]), async (req, res) => {
  const { title, description, category, visibilidade } = req.body;
  const uploadedFile = req.files?.file?.[0];
  const uploadedThumbnail = req.files?.thumbnail?.[0];

  try {
    if (!uploadedFile) {
      return res.status(400).json({ 
        success: false,
        error: 'Arquivo principal não enviado' 
      });
    }

    console.log(`📄 Upload recebido:`, {
      file: uploadedFile?.originalname,
      thumbnail: uploadedThumbnail?.originalname,
      title,
      category,
      fileSize: uploadedFile?.size,
      mimeType: uploadedFile?.mimetype
    });

    // ✅ VERIFICAR SE O ARQUIVO FOI REALMENTE SALVO FISICAMENTE
    const finalFilePath = path.join(getDocumentsPath(), uploadedFile.filename);
    
    try {
      await fs.access(finalFilePath);
      const fileStats = await fs.stat(finalFilePath);
      
      // Verificar se o arquivo não está vazio
      if (fileStats.size === 0) {
        console.error(`❌ Arquivo salvo está vazio: ${uploadedFile.filename}`);
        return res.status(500).json({ 
          success: false,
          error: 'Falha ao salvar arquivo - arquivo vazio' 
        });
      }
      
      // Verificar se o tamanho bate com o esperado
      if (fileStats.size !== uploadedFile.size) {
        console.error(`❌ Tamanho incorreto: esperado ${uploadedFile.size}, obtido ${fileStats.size}`);
        return res.status(500).json({ 
          success: false,
          error: 'Falha na integridade do arquivo - tamanho incorreto' 
        });
      }
      
      console.log(`✅ Arquivo verificado: ${uploadedFile.filename} (${fileStats.size} bytes)`);
    } catch (fileError) {
      console.error(`❌ Arquivo não foi salvo corretamente: ${fileError.message}`);
      return res.status(500).json({ 
        success: false,
        error: 'Falha ao salvar arquivo fisicamente',
        details: fileError.message 
      });
    }

    // ✅ PROCESSAR THUMBNAIL SE FORNECIDA
    let thumbnailUrl = null;
    if (uploadedThumbnail) {
      const thumbnailDir = getThumbnailsPath();
      const timestamp = Date.now();
      const thumbnailName = `${timestamp}_${uploadedThumbnail.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const thumbnailPath = path.join(thumbnailDir, thumbnailName);
      
      try {
        // Garantir que o diretório existe
        await fs.mkdir(thumbnailDir, { recursive: true });
        
        // Mover arquivo para diretório de thumbnails
        await fs.rename(uploadedThumbnail.path, thumbnailPath);
        
        // Verificar se a thumbnail foi salva
        await fs.access(thumbnailPath);
        const thumbnailStats = await fs.stat(thumbnailPath);
        
        if (thumbnailStats.size === 0) {
          console.error(`❌ Thumbnail salva está vazia: ${thumbnailName}`);
        } else {
          thumbnailUrl = `/thumbnails/${thumbnailName}`;
          console.log(`🖼️ Thumbnail salva: ${thumbnailUrl} (${thumbnailStats.size} bytes)`);
        }
      } catch (thumbnailError) {
        console.error(`❌ Erro ao processar thumbnail: ${thumbnailError.message}`);
        // Não falhar o upload por causa da thumbnail
        console.log(`⚠️ Continuando upload sem thumbnail`);
      }
    }

    // ✅ SALVAR NO BANCO DE DADOS
    const result = await pool.query(`
      INSERT INTO documentos (
        titulo, descricao, categoria, nome_arquivo, url_arquivo,
        tamanho_arquivo, tipo_mime, enviado_por, thumbnail_url, visibilidade
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      title,
      description, 
      category,
      uploadedFile.filename,
      `/documents/${uploadedFile.filename}`,
      uploadedFile.size,
      uploadedFile.mimetype,
      req.user.id,
      thumbnailUrl,
      visibilidade || 'todos'
    ]);

    if (result.rows.length === 0) {
      console.error(`❌ Falha ao inserir no banco de dados`);
      return res.status(500).json({ 
        success: false,
        error: 'Falha ao salvar informações no banco de dados' 
      });
    }

    const documento = result.rows[0];
    console.log(`✅ Documento criado com sucesso:`, {
      id: documento.id,
      titulo: documento.titulo,
      nome_arquivo: documento.nome_arquivo,
      tamanho_arquivo: documento.tamanho_arquivo,
      thumbnail_url: documento.thumbnail_url
    });

    // ✅ RESPOSTA PADRONIZADA COM INFORMAÇÕES DETALHADAS
    res.json({
      success: true,
      documento: documento,
      message: uploadedThumbnail ? 
        'Documento e thumbnail enviados com sucesso!' : 
        'Documento enviado com sucesso!',
      arquivo_info: {
        nome_original: uploadedFile.originalname,
        nome_salvo: uploadedFile.filename,
        tamanho: uploadedFile.size,
        tipo_mime: uploadedFile.mimetype,
        integridade_verificada: true
      },
      thumbnail_info: thumbnailUrl ? {
        url: thumbnailUrl,
        salva_com_sucesso: true
      } : null
    });

  } catch (error) {
    console.error('❌ Erro no upload:', error);
    
    // ✅ LIMPEZA EM CASO DE ERRO
    if (uploadedFile) {
      const filePath = path.join(getDocumentsPath(), uploadedFile.filename);
      try {
        await fs.unlink(filePath);
        console.log(`🗑️ Arquivo removido após erro: ${uploadedFile.filename}`);
      } catch (cleanupError) {
        console.error(`⚠️ Erro ao limpar arquivo: ${cleanupError.message}`);
      }
    }
    
    if (uploadedThumbnail) {
      try {
        await fs.unlink(uploadedThumbnail.path);
        console.log(`🗑️ Thumbnail temporária removida após erro`);
      } catch (cleanupError) {
        console.error(`⚠️ Erro ao limpar thumbnail: ${cleanupError.message}`);
      }
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ✅ FUNÇÃO AUXILIAR PARA VERIFICAR INTEGRIDADE DE ARQUIVOS
async function verifyFileIntegrity(filePath, expectedSize, filename) {
  try {
    console.log(`🔍 Verificando integridade: ${filename}`);
    
    // Verificar se arquivo existe
    await fs.access(filePath, fs.constants.F_OK);
    
    // Verificar se pode ser lido
    await fs.access(filePath, fs.constants.R_OK);
    
    // Verificar tamanho
    const stats = await fs.stat(filePath);
    
    if (stats.size !== expectedSize) {
      throw new Error(`Tamanho incorreto: esperado ${expectedSize}, obtido ${stats.size}`);
    }
    
    if (stats.size === 0) {
      throw new Error('Arquivo está vazio');
    }
    
    console.log(`✅ Integridade verificada: ${filename} (${stats.size} bytes)`);
    return { 
      success: true, 
      size: stats.size,
      readable: true,
      exists: true
    };
    
  } catch (error) {
    console.error(`❌ Falha na verificação de integridade: ${error.message}`);
    return { 
      success: false, 
      error: error.message,
      readable: false,
      exists: false
    };
  }
}

// ✅ ROTA ADICIONAL PARA VERIFICAR INTEGRIDADE DE DOCUMENTOS EXISTENTES
app.get('/api/documents/:id/verify', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('SELECT * FROM documentos WHERE id = $1 AND ativo = true', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Documento não encontrado no banco' });
    }
    
    const documento = result.rows[0];
    const filePath = path.join(getDocumentsPath(), documento.nome_arquivo);
    
    const verification = await verifyFileIntegrity(filePath, documento.tamanho_arquivo, documento.nome_arquivo);
    
    res.json({
      documento_id: id,
      titulo: documento.titulo,
      nome_arquivo: documento.nome_arquivo,
      verificacao: verification,
      banco_dados: {
        tamanho_esperado: documento.tamanho_arquivo,
        tipo_mime: documento.tipo_mime,
        url_arquivo: documento.url_arquivo
      }
    });
    
  } catch (error) {
    console.error('❌ Erro na verificação:', error);
    res.status(500).json({ error: 'Erro ao verificar arquivo' });
  }
});

// ======================= ATUALIZAR DOCUMENTO =======================
app.put('/api/documents/:id', authMiddleware, upload.single('thumbnail'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category, fileName, fileUrl, visibilidade } = req.body;
    const thumbnailFile = req.file;

    // Validar visibilidade se fornecida
    if (visibilidade && !['todos', 'estagiarios', 'clt_associados'].includes(visibilidade)) {
      return res.status(400).json({ error: 'Visibilidade inválida' });
    }

    // ✅ BUSCAR DOCUMENTO ATUAL PRIMEIRO
    const currentDoc = await pool.query(`
      SELECT * FROM documentos WHERE id = $1 AND ativo = true
    `, [id]);

    if (currentDoc.rows.length === 0) {
      return res.status(404).json({ error: 'Documento não encontrado ou inativo' });
    }

    const documento = currentDoc.rows[0];
    const finalFileUrl = fileUrl || (fileName ? `/documents/${fileName}` : documento.url_arquivo);
    
    // ✅ PROCESSAR THUMBNAIL SE FORNECIDA
    let thumbnailUrl = documento.thumbnail_url; // Manter atual por padrão
    if (thumbnailFile) {
      thumbnailUrl = `/thumbnails/${thumbnailFile.filename}`;
      console.log(`📸 Nova thumbnail customizada: ${thumbnailUrl}`);
    }

    // ✅ ATUALIZAR NO BANCO
    const result = await pool.query(`
      UPDATE documentos SET
        titulo = COALESCE($1, titulo),
        descricao = COALESCE($2, descricao),
        categoria = COALESCE($3, categoria),
        nome_arquivo = COALESCE($4, nome_arquivo),
        url_arquivo = COALESCE($5, url_arquivo),
        thumbnail_url = $6,
        visibilidade = COALESCE($7, visibilidade),
        atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $8 AND ativo = true
      RETURNING *
    `, [title, description, category, fileName, finalFileUrl, thumbnailUrl, visibilidade, id]);

    console.log(`📝 Documento atualizado:`, {
      id: result.rows[0].id,
      titulo: result.rows[0].titulo,
      thumbnail_url: result.rows[0].thumbnail_url,
      nova_thumbnail: !!thumbnailFile
    });

    // ✅ RESPOSTA PADRONIZADA
    res.json({ 
      success: true, 
      documento: result.rows[0],
      message: thumbnailFile ? 
        'Documento e thumbnail atualizados!' : 
        'Documento atualizado com sucesso!',
      nova_thumbnail: !!thumbnailFile
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar documento:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erro interno do servidor',
      details: error.message 
    });
  }
});

// ======================= ATUALIZAR ARQUIVO EXISTENTE =======================
app.put('/api/documents/:id/upload', authMiddleware, upload.single('file'), async (req, res) => {
  const docId = req.params.id;
  const { title, description, category, visibilidade } = req.body; // ✅ ADICIONADO
  const file = req.file;

  try {
    if (!file) {
      return res.status(400).json({ error: 'Arquivo não enviado' });
    }

    // ✅ Validar visibilidade se fornecida
    if (visibilidade && !['todos', 'estagiarios', 'clt_associados'].includes(visibilidade)) {
      return res.status(400).json({ error: 'Visibilidade inválida' });
    }

    const fileUrl = `/documents/${file.filename}`;
    
    const result = await pool.query(`
      UPDATE documentos
      SET 
        titulo = $1,
        descricao = $2,
        categoria = $3,
        nome_arquivo = $4,
        url_arquivo = $5,
        tamanho_arquivo = $6,
        tipo_mime = $7,
        thumbnail_url = NULL,
        visibilidade = COALESCE($8, visibilidade),  -- ✅ ADICIONADO
        atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `, [
      title, description, category, file.filename,
      fileUrl, file.size, file.mimetype, visibilidade, docId  // ✅ ADICIONADO
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Documento não encontrado' });
    }

    res.status(200).json({
      documento: result.rows[0],
      fileName: file.filename,
      fileUrl,
      tamanhoArquivo: file.size,
      tipoMime: file.mimetype
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar arquivo:', error);
    res.status(500).json({ error: 'Erro ao atualizar documento' });
  }
});

app.post('/api/documents/:id/thumbnail', authMiddleware, upload.single('thumbnail'), async (req, res) => {
  try {
    const { id } = req.params;
    const thumbnailFile = req.file;

    if (!thumbnailFile) {
      return res.status(400).json({ error: 'Nenhum arquivo de thumbnail enviado' });
    }

    const thumbnailUrl = `/thumbnails/${thumbnailFile.filename}`;
    
    // ✅ ATUALIZAR APENAS A THUMBNAIL_URL NO BANCO
    const result = await pool.query(`
      UPDATE documentos 
      SET thumbnail_url = $1, 
          atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $2 AND ativo = true
      RETURNING id, titulo, thumbnail_url
    `, [thumbnailUrl, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Documento não encontrado' });
    }

    console.log(`📸 Thumbnail customizada adicionada:`, {
      documento_id: result.rows[0].id,
      titulo: result.rows[0].titulo,
      thumbnail_url: result.rows[0].thumbnail_url,
      arquivo_original: thumbnailFile.originalname,
      arquivo_salvo: thumbnailFile.filename
    });

    res.json({
      success: true,
      message: 'Thumbnail customizada enviada com sucesso',
      thumbnailUrl,
      documento: result.rows[0],
      arquivo_info: {
        original: thumbnailFile.originalname,
        salvo: thumbnailFile.filename,
        tamanho: thumbnailFile.size,
        tipo: thumbnailFile.mimetype
      }
    });

  } catch (error) {
    console.error('❌ Erro ao enviar thumbnail:', error);
    res.status(500).json({
      error: 'Erro ao enviar thumbnail',
      details: error.message
    });
  }
});

app.delete('/api/documents/:id/thumbnail', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar documento atual
    const docResult = await pool.query(`
      SELECT thumbnail_url, url_arquivo, titulo 
      FROM documentos 
      WHERE id = $1 AND ativo = true
    `, [id]);
    
    if (docResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Documento não encontrado' 
      });
    }
    
    const documento = docResult.rows[0];
    
    // ✅ Deletar arquivo físico se for thumbnail customizada
    if (documento.thumbnail_url && documento.thumbnail_url.startsWith('/thumbnails/')) {
      // ✅ MELHORADO: Verificar se não é thumbnail automática
      const isAutoGenerated = documento.thumbnail_url.includes('auto_') || 
                             documento.thumbnail_url.includes('gen_') ||
                             /\d{13}_[a-zA-Z0-9-_]+\.png$/.test(documento.thumbnail_url); // Timestamp pattern
      
      if (!isAutoGenerated) {
        const thumbnailPath = path.join(getThumbnailsPath(), path.basename(documento.thumbnail_url));
        try {
          await fs.unlink(thumbnailPath);
          console.log(`🗑️ Thumbnail customizada removida: ${thumbnailPath}`);
        } catch (error) {
          console.error('⚠️ Erro ao remover arquivo físico:', error);
        }
      }
    }
    
    // ✅ REMOVER THUMBNAIL_URL DO BANCO
    await pool.query(`
      UPDATE documentos 
      SET thumbnail_url = NULL, 
          atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [id]);
    
    // ✅ Se for Google Sheets, gerar thumbnail automática
    const vaiGerarAutomatica = documento.url_arquivo && documento.url_arquivo.includes('docs.google.com/spreadsheets');
    
    if (vaiGerarAutomatica) {
      console.log('📋 Gerando thumbnail automática após remoção...');
      
      const sheetId = documento.url_arquivo.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
      if (sheetId) {
        setTimeout(async () => {
          try {
            await generateThumbnailForDocument(sheetId, id, documento.titulo);
            console.log(`✅ Thumbnail automática regenerada para documento ${id}`);
          } catch (error) {
            console.error('❌ Erro ao gerar thumbnail automática:', error);
          }
        }, 100);
      }
    }
    
    console.log(`🗑️ Thumbnail customizada removida:`, {
      documento_id: id,
      titulo: documento.titulo,
      thumbnail_removida: documento.thumbnail_url,
      vai_gerar_automatica: vaiGerarAutomatica
    });
    
    // ✅ RESPOSTA PADRONIZADA
    res.json({
      success: true,
      message: 'Thumbnail customizada removida com sucesso',
      vai_gerar_automatica: vaiGerarAutomatica
    });
    
  } catch (error) {
    console.error('❌ Erro ao remover thumbnail:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao remover thumbnail',
      details: error.message
    });
  }
});

// ======================= DELETAR DOCUMENTO =======================
app.delete('/api/documents/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // ✅ MELHORADO: Verificar se documento existe antes de deletar
    const checkResult = await pool.query(`
      SELECT id FROM documentos WHERE id = $1 AND ativo = true
    `, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Documento não encontrado ou já foi removido' });
    }

    await pool.query(`
      UPDATE documentos SET 
        ativo = false, 
        atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [id]);
    
    res.json({ success: true, message: 'Documento removido com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao deletar documento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

function getContentType(extension) {
  const mimeTypes = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.txt': 'text/plain',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.csv': 'text/csv'
  };
  
  return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
}

function getFileExtension(mimeType) {
  const extensions = {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'text/plain': 'txt',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'application/zip': 'zip',
    'application/x-rar-compressed': 'rar',
    'text/csv': 'csv'
  };
  
  return extensions[mimeType] || 'bin';
}

// ======================= DOWNLOAD COM CONTADOR =======================
app.get('/api/documents/:id/download', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`📥 DOWNLOAD: Solicitado para documento ${id} por usuário ${req.user.nome}`);
    
    // Buscar documento
    const result = await pool.query(
      'SELECT * FROM documentos WHERE id = $1 AND ativo = true',
      [id]
    );
    
    if (result.rows.length === 0) {
      console.log(`❌ DOWNLOAD: Documento ${id} não encontrado`);
      return res.status(404).json({ error: 'Documento não encontrado' });
    }
    
    const documento = result.rows[0];
    console.log(`📄 DOWNLOAD: Processando "${documento.titulo}"`);
    
    // ✅ DEBUG: Log completo do documento
    console.log('🔍 DEBUG DOCUMENTO:', {
      titulo: documento.titulo,
      nome_arquivo: documento.nome_arquivo,
      url_arquivo: documento.url_arquivo,
      tipo_mime: documento.tipo_mime
    });
    
    // Verificar se é URL externa ou arquivo local
    const isExternalUrl = documento.url_arquivo.startsWith('http://') || 
                         documento.url_arquivo.startsWith('https://');
    
    if (isExternalUrl) {
      // URLs externas - fazer redirect
      console.log(`🌐 DOWNLOAD: URL externa, redirecionando para: ${documento.url_arquivo}`);
      return res.redirect(documento.url_arquivo);
    } else {
      // Arquivo local - servir com headers corretos
      const relativePath = documento.url_arquivo.replace(/^\/documents\//, '');
      const filePath = path.join(DOCUMENTS_PATH, relativePath);
      
      console.log(`📁 DOWNLOAD: Tentando servir arquivo local:`);
      console.log(`   - URL no banco: ${documento.url_arquivo}`);
      console.log(`   - Caminho completo: ${filePath}`);
      
      // Verificar se arquivo existe
      try {
        await fs.access(filePath);
        console.log(`✅ DOWNLOAD: Arquivo encontrado!`);
      } catch (error) {
        console.log(`❌ DOWNLOAD: Arquivo não encontrado: ${filePath}`);
        return res.status(404).json({ 
          error: 'Arquivo não encontrado no servidor'
        });
      }
      
      // ✅ HEADERS CORRIGIDOS PARA DOWNLOAD
      const fileName = documento.nome_arquivo || documento.titulo;
      const fileExt = path.extname(fileName) || path.extname(filePath);
      const finalFileName = fileExt ? fileName : `${fileName}.${getFileExtension(documento.tipo_mime || 'application/octet-stream')}`;
      
      // ✅ DEBUG: Log detalhado dos nomes e extensões
      console.log('🔍 DEBUG NOMES:', {
        nome_arquivo_banco: documento.nome_arquivo,
        titulo: documento.titulo,
        fileName_escolhido: fileName,
        extensao_detectada: fileExt,
        extensao_do_path: path.extname(filePath),
        finalFileName: finalFileName,
        tipo_mime: documento.tipo_mime
      });
      
      // Determinar Content-Type baseado na extensão ou mime type
      const contentType = documento.tipo_mime || getContentType(fileExt) || 'application/octet-stream';
      
      console.log(`📋 DOWNLOAD: Configurando headers:`);
      console.log(`   - Nome final: ${finalFileName}`);
      console.log(`   - Content-Type: ${contentType}`);
      console.log(`   - Content-Disposition: attachment; filename*=UTF-8''${encodeURIComponent(finalFileName)}`);
      
      // ✅ CONFIGURAR HEADERS CORRETAMENTE
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(finalFileName)}`);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Pragma', 'no-cache');
      
      // ✅ DEBUG: Verificar se os headers foram definidos
      console.log('🔍 DEBUG HEADERS DEFINIDOS:', {
        'Content-Disposition': res.getHeader('Content-Disposition'),
        'Content-Type': res.getHeader('Content-Type')
      });
      
      // Adicionar informações de tamanho se disponível
      try {
        const stats = await fs.stat(filePath);
        res.setHeader('Content-Length', stats.size);
        console.log(`📊 DOWNLOAD: Tamanho do arquivo: ${stats.size} bytes`);
      } catch (error) {
        console.warn(`⚠️ Não foi possível obter estatísticas do arquivo: ${error.message}`);
      }
      
      // Servir arquivo
      return res.sendFile(filePath, (err) => {
        if (err) {
          console.error(`❌ Erro ao enviar arquivo: ${err.message}`);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Erro ao enviar arquivo' });
          }
        } else {
          console.log(`✅ Arquivo "${finalFileName}" enviado com sucesso`);
          console.log('🎯 DOWNLOAD FINALIZADO - Headers enviados ao browser');
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Erro no download:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

app.get('/debug/files', async (req, res) => {
  try {
    console.log('🔍 Debug: Verificando estrutura de arquivos');
    
    const documentsPath = getDocumentsPath();
    const thumbnailsPath = getThumbnailsPath();
    
    console.log('📂 Caminhos configurados:');
    console.log('   - Documents:', documentsPath);
    console.log('   - Thumbnails:', thumbnailsPath);
    
    // Verificar se os diretórios existem
    const documentsExists = fsSync.existsSync(documentsPath);
    const thumbnailsExists = fsSync.existsSync(thumbnailsPath);
    
    console.log('📁 Diretórios existem?');
    console.log('   - Documents:', documentsExists);
    console.log('   - Thumbnails:', thumbnailsExists);
    
    let documentsFiles = [];
    let thumbnailsFiles = [];
    
    // Listar arquivos se os diretórios existirem
    if (documentsExists) {
      try {
        documentsFiles = await fs.readdir(documentsPath);
        console.log(`📄 Encontrados ${documentsFiles.length} arquivos em documents`);
      } catch (error) {
        console.error('❌ Erro ao ler documents:', error.message);
      }
    }
    
    if (thumbnailsExists) {
      try {
        thumbnailsFiles = await fs.readdir(thumbnailsPath);
        console.log(`🖼️ Encontrados ${thumbnailsFiles.length} arquivos em thumbnails`);
      } catch (error) {
        console.error('❌ Erro ao ler thumbnails:', error.message);
      }
    }
    
    // Verificar arquivo específico
    const targetFile = '1752587921077_feriados_e_emendas_2025__1_.pdf';
    const targetFilePath = path.join(documentsPath, targetFile);
    const targetFileExists = fsSync.existsSync(targetFilePath);
    
    console.log(`🎯 Arquivo específico "${targetFile}":`, targetFileExists ? 'EXISTE' : 'NÃO EXISTE');
    
    const response = {
      environment: process.env.NODE_ENV || 'development',
      paths: {
        documents: documentsPath,
        thumbnails: thumbnailsPath,
        cwd: process.cwd(),
        dirname: __dirname
      },
      exists: {
        documents: documentsExists,
        thumbnails: thumbnailsExists
      },
      files: {
        documents: documentsFiles.slice(0, 20), // Primeiros 20 arquivos
        thumbnails: thumbnailsFiles.slice(0, 20),
        totalDocuments: documentsFiles.length,
        totalThumbnails: thumbnailsFiles.length
      },
      targetFile: {
        name: targetFile,
        path: targetFilePath,
        exists: targetFileExists
      }
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ Erro na rota de debug:', error);
    res.status(500).json({ 
      error: 'Erro interno',
      message: error.message,
      stack: error.stack
    });
  }
});

// ======================= ESTATÍSTICAS =======================
app.get('/api/documents/stats', authMiddleware, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_documentos,
        COUNT(DISTINCT categoria) as total_categorias,
        SUM(COALESCE(qtd_downloads, 0)) as total_downloads,
        AVG(tamanho_arquivo) as media_tamanho
      FROM documentos WHERE ativo = true
    `);

    const porCategoria = await pool.query(`
      SELECT categoria, COUNT(*) as quantidade, SUM(COALESCE(qtd_downloads, 0)) as downloads
      FROM documentos WHERE ativo = true GROUP BY categoria ORDER BY quantidade DESC
    `);

    res.json({ stats: stats.rows[0], categorias: porCategoria.rows });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===============================================
// TEMPLATE DE EMAIL ATUALIZADO
// ===============================================

async function gerarTemplateVerificacao(nome, codigo, email, tipo_colaborador) {
  const tipoTexto = tipo_colaborador === 'estagiario' ? 'Estagiário' : 'CLT/Associado';
  const emailInfo = tipo_colaborador === 'estagiario' 
    ? 'Este é seu email de login para a plataforma.'
    : 'Este email será usado para login corporativo.';

  return `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Confirmação de Email - RMH</title>
    <link href="https://fonts.googleapis.com/css2?family=Raleway:wght@400;600&family=Ruda:wght@900&display=swap" rel="stylesheet">
    <style>
      body {
        margin: 0;
        font-family: 'Raleway', sans-serif;
        background-color: #DADADA;
        color: #0d3638;
        padding: 20px;
      }
      .container {
        max-width: 600px;
        margin: auto;
        background-color: #f9f9f9;
        border-radius: 16px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.08);
        overflow: hidden;
      }
      .header {
        background-color: #165A5D;
        padding: 20px 0px;
        text-align: center;
      }
      .header img {
        height: 60px;
      }
      .header h1 {
        font-family: 'Ruda', sans-serif;
        font-size: 22px;
        color: #ffffff;
        margin: 0;
        letter-spacing: 0.5px;
      }
      .content {
        padding: 20px 30px 30px 30px;
        text-align: center;
        font-family: 'Cooper Hewitt', sans-serif;
      }
      .content h2 {
        font-size: 20px;
        color: #0d3638;
        margin-bottom: 8px;
      }
      .content p {
        font-size: 17px;
        color: #555;
        margin-top: 0;
      }
      .tipo-badge {
        display: inline-block;
        padding: 6px 12px;
        background-color: ${tipo_colaborador === 'estagiario' ? '#165A5D' : '#165A5D'};
        color: white;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 600;
        margin: 10px 0;
      }
      .code-box {
        margin: 30px auto;
        background-color: #f8f8f8;
        border: 2px dashed #165A5D;
        border-radius: 12px;
        padding: 20px;
        font-size: 32px;
        font-weight: bold;
        color: #165A5D;
        letter-spacing: 10px;
        font-family: 'Courier New', monospace;
        max-width: 300px;
      }
      .note {
        font-size: 13px;
        color: #8b848b;
        background-color: #EFEFEF;
        padding: 15px;
        border-radius: 10px;
        margin-top: 20px;
      }
      .footer {
        font-size: 12px;
        color: #9ca2a3;
        text-align: center;
        padding: 18px;
        border-top: 1px solid #eee;
        background-color: #f9f9f9;
      }
      @media (max-width: 600px) {
        .content {
          padding: 30px 20px;
        }
        .code-box {
          font-size: 26px;
          letter-spacing: 6px;
        }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <img src="https://sistema.resendemh.com.br/logo-rmh.ico" alt="Logo RMH" style="height: 100px; margin-bottom: 10px;" />
        <h1>Confirme seu email</h1>
      </div>
      <div class="content">
        <h2>Olá, ${nome}!</h2>
        <div class="tipo-badge">${tipoTexto}</div>
        <p>Insira o código abaixo para confirmar seu email e ativar seu acesso ao site da RMH:</p>
        <div class="code-box">${codigo}</div>
        <p>${emailInfo}</p>
        <p class="note">Este código expira em 24 horas. Se você não solicitou este cadastro, ignore este e-mail.</p>
      </div>
    </div>
  </body>
  </html>
  `;
}

// TEMPLATE DE EMAIL PARA VALIDAÇÃO DE ESTAGIÁRIO - PADRÃO RMH
async function gerarTemplateValidacaoEstagiario(nome, linkValidacao, email) {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Cadastro Aprovado - RMH</title>
      <link href="https://fonts.googleapis.com/css2?family=Raleway:wght@400;600&family=Ruda:wght@900&display=swap" rel="stylesheet">
      <style>
        body {
          margin: 0;
          font-family: 'Raleway', sans-serif;
          background-color: #DADADA;
          color: #0d3638;
          padding: 20px;
        }
        .container {
          max-width: 600px;
          margin: auto;
          background-color: #f9f9f9;
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.08);
          overflow: hidden;
        }
        .header {
          background-color: #165A5D;
          padding: 20px 0px;
          text-align: center;
        }
        .header img {
          height: 60px;
        }
        .header h1 {
          font-family: 'Ruda', sans-serif;
          font-size: 22px;
          color: #ffffff;
          margin: 0;
          letter-spacing: 0.5px;
        }
        .content {
          padding: 20px 30px 30px 30px;
          text-align: center;
          font-family: 'Cooper Hewitt', sans-serif;
        }
        .content h2 {
          font-size: 20px;
          color: #0d3638;
          margin-bottom: 8px;
        }
        .content p {
          font-size: 17px;
          color: #555;
          margin-top: 0;
        }
        .tipo-badge {
          display: inline-block;
          padding: 6px 12px;
          background-color: #165A5D;
          color: white;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          margin: 10px 0;
        }
        .link-box {
          margin: 30px auto;
          background-color: #f8f8f8;
          border: 2px dashed #165A5D;
          border-radius: 12px;
          padding: 30px 20px;
          max-width: 400px;
        }
        .action-button {
          background: #165A5D;
          color: white;
          padding: 15px 30px;
          text-decoration: none;
          border-radius: 8px;
          display: inline-block;
          font-weight: bold;
          font-size: 16px;
          margin: 10px 0;
          transition: background-color 0.3s;
        }
        .action-button:hover {
          background: #0d3638;
        }
        .note {
          font-size: 13px;
          color: #8b848b;
          background-color: #EFEFEF;
          padding: 15px;
          border-radius: 10px;
          margin-top: 20px;
        }
        .footer {
          font-size: 12px;
          color: #9ca2a3;
          text-align: center;
          padding: 18px;
          border-top: 1px solid #eee;
          background-color: #f9f9f9;
        }
        @media (max-width: 600px) {
          .content {
            padding: 30px 20px;
          }
          .link-box {
            padding: 20px 15px;
          }
          .action-button {
            padding: 12px 24px;
            font-size: 14px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://sistema.resendemh.com.br/logo-rmh.ico" alt="Logo RMH" style="height: 100px; margin-bottom: 10px;" />
          <h1>Cadastro Aprovado</h1>
        </div>
        <div class="content">
          <h2>Olá, ${nome}!</h2>
          <div class="tipo-badge">Estagiário</div>
          <p>Seu cadastro foi aprovado pelo administrador! Clique no botão abaixo para ativar automaticamente seu acesso:</p>
          
          <div class="link-box">
            <a href="${linkValidacao}" class="action-button" style="color: #ffffff;">
              Ativar Conta Automaticamente
            </a>
          </div>
          <p class="note">Este link expira em 24 horas. Após ativar, você poderá fazer login na plataforma com seu email pessoal e senha. Se você não solicitou este cadastro, ignore este e-mail.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

async function gerarTemplateEstagiarioAdicionadoPorAdmin(nome, linkValidacao, email) {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Conta Criada - RMH</title>
      <link href="https://fonts.googleapis.com/css2?family=Raleway:wght@400;600&family=Ruda:wght@900&display=swap" rel="stylesheet">
      <style>
        body {
          margin: 0;
          font-family: 'Raleway', sans-serif;
          background-color: #DADADA;
          color: #0d3638;
          padding: 20px;
        }
        .container {
          max-width: 600px;
          margin: auto;
          background-color: #f9f9f9;
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.08);
          overflow: hidden;
        }
        .header {
          background-color: #165A5D;
          padding: 20px 0px;
          text-align: center;
        }
        .header img {
          height: 60px;
        }
        .header h1 {
          font-family: 'Ruda', sans-serif;
          font-size: 22px;
          color: #ffffff;
          margin: 0;
          letter-spacing: 0.5px;
        }
        .content {
          padding: 20px 30px 30px 30px;
          text-align: center;
          font-family: 'Cooper Hewitt', sans-serif;
        }
        .content h2 {
          font-size: 20px;
          color: #0d3638;
          margin-bottom: 8px;
        }
        .content p {
          font-size: 17px;
          color: #555;
          margin-top: 0;
        }
        .tipo-badge {
          display: inline-block;
          padding: 6px 12px;
          background-color: #165A5D;
          color: white;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          margin: 10px 0;
        }
        .link-box {
          margin: 30px auto;
          background-color: #f8f8f8;
          border: 2px dashed #165A5D;
          border-radius: 12px;
          padding: 30px 20px;
          max-width: 400px;
        }
        .action-button {
          background: #165A5D;
          color: white;
          padding: 15px 30px;
          text-decoration: none;
          border-radius: 8px;
          display: inline-block;
          font-weight: bold;
          font-size: 16px;
          margin: 10px 0;
          transition: background-color 0.3s;
        }
        .action-button:hover {
          background: #0d3638;
        }
        .info-box {
          background: #e3f2fd;
          padding: 15px;
          border-radius: 8px;
          margin: 20px 0;
          text-align: left;
          border-left: 4px solid #165A5D;
        }

        .note {
          font-size: 13px;
          color: #8b848b;
          background-color: #EFEFEF;
          padding: 15px;
          border-radius: 10px;
          margin-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://sistema.resendemh.com.br/logo-rmh.ico" alt="Logo RMH" style="height: 100px; margin-bottom: 10px;" />
          <h1>🎉 Conta Criada</h1>
        </div>
        <div class="content">
          <h2>Olá, ${nome}!</h2>
          <div class="tipo-badge">Estagiário</div>
          <p>Você foi adicionado à plataforma de dashboards da RMH por um administrador!</p>
          
          <div class="link-box">
            <a href="${linkValidacao}" class="action-button" style="color: #ffffff;">
              🚀 Ativar Conta Automaticamente
            </a>
            <p style="font-size: 14px; color: #666; margin: 15px 0 0 0;">
              Clique no botão para ativar sua conta instantaneamente
            </p>
          </div>
          
          <div class="info-box">
            <p style="margin: 0;"><strong>📧 Seu email de login:</strong> ${email}</p>
            <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Use este email para fazer login após ativar a conta.</p>
          </div>
          
          <p><strong>📋 Próximos passos:</strong></p>
          <ol style="text-align: left; margin: 0 auto; display: inline-block;">
            <li>Clique no botão "Ativar Conta Automaticamente"</li>
            <li>Sua conta será ativada instantaneamente</li>
            <li>Faça login na plataforma com suas credenciais</li>
          </ol>
          
          <p class="note">Este link expira em 7 dias. Sua senha foi gerada automaticamente - você pode alterá-la após o primeiro login.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// TEMPLATE: Email de configuração de conta
async function gerarTemplateConfiguracaoConta(nome, linkAtivacao, emailLogin, tipoColaborador) {
  const tipoTexto = tipoColaborador === 'estagiario' ? 'Estagiário' : 'CLT/Associado';
  
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Configure sua Conta - RMH</title>
      <link href="https://fonts.googleapis.com/css2?family=Raleway:wght@400;600&family=Ruda:wght@900&display=swap" rel="stylesheet">
      <style>
        body {
          margin: 0;
          font-family: 'Raleway', sans-serif;
          background-color: #DADADA;
          color: #0d3638;
          padding: 20px;
        }
        .container {
          max-width: 600px;
          margin: auto;
          background-color: #f9f9f9;
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.08);
          overflow: hidden;
        }
        .header {
          background-color: #165A5D;
          padding: 20px 0px;
          text-align: center;
        }
        .header img {
          height: 60px;
        }
        .header h1 {
          font-family: 'Ruda', sans-serif;
          font-size: 22px;
          color: #ffffff;
          margin: 0;
          letter-spacing: 0.5px;
        }
        .content {
          padding: 20px 30px 30px 30px;
          text-align: center;
          font-family: 'Cooper Hewitt', sans-serif;
        }
        .content h2 {
          font-size: 20px;
          color: #0d3638;
          margin-bottom: 8px;
        }
        .content p {
          font-size: 17px;
          color: #555;
          margin-top: 0;
        }
        .tipo-badge {
          display: inline-block;
          padding: 6px 12px;
          background-color: #165A5D;
          color: white;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          margin: 10px 0;
        }
        .link-box {
          margin: 30px auto;
          background-color: #f8f8f8;
          border: 2px dashed #165A5D;
          border-radius: 12px;
          padding: 30px 20px;
          max-width: 400px;
        }
        .action-button {
          background: #165A5D;
          color: white;
          padding: 15px 30px;
          text-decoration: none;
          border-radius: 8px;
          display: inline-block;
          font-weight: bold;
          font-size: 16px;
          margin: 10px 0;
          transition: background-color 0.3s;
        }
        .action-button:hover {
          background: #0d3638;
        }
        .info-box {
          background: #e3f2fd;
          padding: 15px;
          border-radius: 8px;
          margin: 20px 0;
          text-align: left;
          border-left: 4px solid #165A5D;
        }
        .note {
          font-size: 13px;
          color: #8b848b;
          background-color: #EFEFEF;
          padding: 15px;
          border-radius: 10px;
          margin-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://sistema.resendemh.com.br/logo-rmh.ico" alt="Logo RMH" style="height: 100px; margin-bottom: 10px;" />
          <h1>Configure sua Conta</h1>
        </div>
        <div class="content">
          <h2>Olá, ${nome}!</h2>
          <div class="tipo-badge">${tipoTexto}</div>
          <p>Você foi adicionado à plataforma de dashboards da RMH por um administrador!</p>
          
          <div class="link-box">
            <a href="${linkAtivacao}" class="action-button">
              🔐 Configurar Minha Senha
            </a>
            <p style="font-size: 14px; color: #666; margin: 15px 0 0 0;">
              Clique no botão para definir sua senha
            </p>
          </div>
          
          <div class="info-box">
            <p style="margin: 0;"><strong>📧 Seu email de login:</strong> ${emailLogin}</p>
            <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Use este email para acessar a plataforma após configurar sua senha.</p>
          </div>
          
          <p><strong>📋 Próximos passos:</strong></p>
          <ol style="text-align: left; margin: 0 auto; display: inline-block;">
            <li>Clique no botão "Configurar Minha Senha"</li>
            <li>Defina uma senha segura para sua conta</li>
            <li>Acesse a plataforma com suas credenciais</li>
          </ol>
          
          <p class="note">Este link expira em 7 dias. Se precisar de ajuda, entre em contato com o administrador.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

async function gerarTemplateConfigurarSenha(nome, linkConfiguracao, email) {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Configure sua Senha - RMH</title>
      <link href="https://fonts.googleapis.com/css2?family=Raleway:wght@400;600&family=Ruda:wght@900&display=swap" rel="stylesheet">
      <style>
        body {
          margin: 0;
          font-family: 'Raleway', sans-serif;
          background-color: #DADADA;
          color: #0d3638;
          padding: 20px;
        }
        .container {
          max-width: 600px;
          margin: auto;
          background-color: #f9f9f9;
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.08);
          overflow: hidden;
        }
        .header {
          background-color: #165A5D;
          padding: 20px 0px;
          text-align: center;
        }
        .header h1 {
          font-family: 'Ruda', sans-serif;
          font-size: 22px;
          color: #ffffff;
          margin: 0;
          letter-spacing: 0.5px;
        }
        .content {
          padding: 20px 30px 30px 30px;
          text-align: center;
          font-family: 'Cooper Hewitt', sans-serif;
        }
        .content h2 {
          font-size: 20px;
          color: #0d3638;
          margin-bottom: 8px;
        }
        .content p {
          font-size: 17px;
          color: #555;
          margin-top: 0;
        }
        .tipo-badge {
          display: inline-block;
          padding: 6px 12px;
          background-color: #165A5D;
          color: white;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          margin: 10px 0;
        }
        .link-box {
          margin: 30px auto;
          background-color: #f8f8f8;
          border: 2px dashed #165A5D;
          border-radius: 12px;
          padding: 30px 20px;
          max-width: 400px;
        }
        .action-button {
          background: #165A5D;
          color: white;
          padding: 15px 30px;
          text-decoration: none;
          border-radius: 8px;
          display: inline-block;
          font-weight: bold;
          font-size: 16px;
          margin: 10px 0;
          transition: background-color 0.3s;
        }
        .action-button:hover {
          background: #0d3638;
        }
        .info-box {
          background: #e3f2fd;
          padding: 15px;
          border-radius: 8px;
          margin: 20px 0;
          text-align: left;
          border-left: 4px solid #165A5D;
        }
        .steps {
          background: #f0f9ff;
          padding: 20px;
          border-radius: 10px;
          margin: 20px 0;
          text-align: left;
        }
        .note {
          font-size: 13px;
          color: #8b848b;
          background-color: #EFEFEF;
          padding: 15px;
          border-radius: 10px;
          margin-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://sistema.resendemh.com.br/logo-rmh.ico" alt="Logo RMH" style="height: 100px; margin-bottom: 10px;" />
          <h1>Configure sua Senha</h1>
        </div>
        <div class="content">
          <h2>Olá, ${nome}!</h2>
          <div class="tipo-badge">Estagiário</div>
          <p>Você foi adicionado à plataforma de dashboards da RMH! Agora precisa definir sua senha para acessar a plataforma.</p>
          
          <div class="link-box">
            <a href="${linkConfiguracao}" class="action-button" style="color: #ffffff;">
              🔑 Definir Minha Senha
            </a>
            <p style="font-size: 14px; color: #666; margin: 15px 0 0 0;">
              Clique no botão para escolher sua senha
            </p>
          </div>
          <p class="note">Este link expira em 7 dias. Se precisar de ajuda, entre em contato com o administrador.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ===============================================
// ROTAS DE HEALTH CHECK E KEEP-ALIVE
// ===============================================

app.get('/', (req, res) => {
  res.json({
    message: '🚀 RMH Dashboards API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      auth: '/api/auth',
      dashboards: '/api/dashboards',
      health: '/health',
      ping: '/ping'
    },
    status: 'online',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    frontend: process.env.NODE_ENV === 'production' ? 'served' : 'separate'
  });
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
      memory: process.memoryUsage(),
      version: '1.0.0'
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy', 
      timestamp: new Date().toISOString(),
      error: error.message 
    });
  }
});

app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// ===============================================
// ROTAS PARA PROCESSOS - ESTRUTURA CORRIGIDA
// ===============================================

async function moverProcessoParaEnviados({ numeroProcesso, idProcessoPlanilha, dataEnvio }) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log(`📋 INICIANDO transferência do processo ${numeroProcesso} (ID: ${idProcessoPlanilha}) para tabela de enviados`);
    
    // 1. Buscar o processo na tabela de pendentes
    const resultadoBusca = await client.query(
      `SELECT * FROM processo_emails_pendentes WHERE id_processo = $1`,
      [idProcessoPlanilha]
    );
    
    if (resultadoBusca.rows.length === 0) {
      throw new Error(`Processo com ID ${idProcessoPlanilha} não encontrado em pendentes`);
    }
    
    const dados = resultadoBusca.rows[0];
    
    // 1.5. ✅ VERIFICAR SE EMAIL É VÁLIDO (nova verificação)
    if (!dados.email_valido) {
      throw new Error(`Processo ${numeroProcesso} não pode ser movido: email não é válido`);
    }
    
    // 2. ✅ VERIFICAR SE JÁ EXISTE NA TABELA DE ENVIADOS (evitar duplicatas)
    const jaEnviado = await client.query(
      `SELECT id_processo FROM processo_emails_enviados WHERE id_processo = $1`,
      [dados.id_processo]
    );
    
    if (jaEnviado.rows.length > 0) {
      throw new Error(`Processo ${numeroProcesso} já existe na tabela de enviados`);
    }
    
    // 3. Inserir na tabela de enviados (com nova coluna de data_envio)
    await client.query(
        `INSERT INTO processo_emails_enviados (
          id_processo, numero_unico, cpf_assistido, nome_assistido, emails, telefones,
          id_atendimento_vinculado, tipo_atendimento, natureza_processo, data_autuacao,
          ex_adverso, instancia, objeto_atendimento, valor_causa, data_envio
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        )`,
      [
        dados.id_processo, dados.numero_unico, dados.cpf_assistido, dados.nome_assistido,
        dados.emails, dados.telefones, dados.id_atendimento_vinculado, dados.tipo_atendimento,
        dados.natureza_processo, dados.data_autuacao, dados.ex_adverso, dados.instancia,
        dados.objeto_atendimento, dados.valor_causa, dataEnvio
      ]
    );
    
    // 4. Remover da tabela de pendentes
    await client.query(
      `DELETE FROM processo_emails_pendentes WHERE id_processo = $1`,
      [idProcessoPlanilha]
    );
    
    await client.query('COMMIT');
    console.log(`✅ SUCESSO: Processo ${numeroProcesso} (ID: ${idProcessoPlanilha}) movido para "processo_emails_enviados"`);
    
    return {
      success: true,
      numeroProcesso,
      id: idProcessoPlanilha,
      dataEnvio,
      status: 'movido com sucesso'
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ ERRO ao mover processo:', error);
    return {
      success: false,
      numeroProcesso,
      id: idProcessoPlanilha,
      erro: error.message
    };
  } finally {
    client.release();
  }
}

// Buscar dados da planilha com mapeamento correto - VERSÃO CORRIGIDA
app.get('/api/processos', authMiddleware, async (req, res) => {
  try {
    const query = `
      SELECT * FROM (
        SELECT 
          id_processo AS idProcessoPlanilha,
          numero_unico AS numeroProcesso,
          cpf_assistido AS cpfAssistido,
          nome_assistido AS cliente,
          emails AS emailCliente,
          telefones,
          id_atendimento_vinculado AS idAtendimento,
          tipo_atendimento AS tipoProcesso,
          natureza_processo,
          data_autuacao AS dataAjuizamento,
          ex_adverso AS exAdverso,
          instancia,
          objeto_atendimento AS objetoAtendimento,
          valor_causa AS valorCausa,
          false AS emailEnviado,
          null AS dataUltimoEmail,
          'Pendente' AS statusEmail
        FROM processo_emails_pendentes

        UNION ALL

        SELECT 
          id_processo AS idProcessoPlanilha,
          numero_unico AS numeroProcesso,
          cpf_assistido AS cpfAssistido,
          nome_assistido AS cliente,
          emails AS emailCliente,
          telefones,
          id_atendimento_vinculado AS idAtendimento,
          tipo_atendimento AS tipoProcesso,
          natureza_processo,
          data_autuacao AS dataAjuizamento,
          ex_adverso AS exAdverso,
          instancia,
          objeto_atendimento AS objetoAtendimento,
          valor_causa AS valorCausa,
          true AS emailEnviado,
          data_envio AS dataUltimoEmail,
          'Enviado' AS statusEmail
        FROM processo_emails_enviados
      ) AS todos
      ORDER BY dataAjuizamento DESC;
    `;

    const result = await pool.query(query);

    const processos = result.rows.map((row, index) => ({
      id: row.idprocessoplanilha || index + 1,
      idProcessoPlanilha: row.idprocessoplanilha,
      numeroProcesso: row.numeroprocesso,
      cpfAssistido: row.cpfassistido,
      cliente: row.cliente,
      emailCliente: row.emailcliente,
      telefones: row.telefones,
      idAtendimento: row.idatendimento,
      tipoProcesso: row.tipoprocesso,
      naturezaProcesso: row.natureza_processo,
      dataAjuizamento: row.dataajuizamento,
      exAdverso: row.exadverso,
      instancia: row.instancia,
      objetoAtendimento: row.objetoatendimento,
      emailEnviado: row.emailenviado,
      dataUltimoEmail: row.dataultimoemail,
      statusEmail: row.statusemail,
      origem: 'banco',
      status: row.tipoprocesso 
        ? `${row.tipoprocesso} - ${row.dataajuizamento || 'Sem data'}`
        : 'Aguardando análise',
      ultimoAndamento: row.dataajuizamento || '',
      responsavel: row.exadverso || 'Não informado',
      valorCausa: row.valorcausa,
      observacoes: ''
    }));

    res.json({
      processos,
      total: processos.length,
      origem: 'banco_de_dados',
      ultimaAtualizacao: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Erro ao buscar processos do banco:', error.message, error.stack);
    res.status(500).json({ error: 'Erro ao buscar dados do banco de dados' });
  }
});

// ROTA: Atualizar dados de um processo específico
app.put('/api/processos/:id', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const {
      cliente,
      emailCliente,
      telefones,
      idAtendimento,
      tipoProcesso,
      exAdverso,
      instancia,
      objetoAtendimento,
      valorCausa,
      observacoes
    } = req.body;

    console.log(`📝 PROCESSOS: Atualizando processo ID ${id} por ${req.user.nome}`);
    console.log(`📋 Dados recebidos:`, {
      cliente,
      emailCliente,
      telefones,
      idAtendimento,
      tipoProcesso,
      exAdverso,
      instancia,
      objetoAtendimento,
      valorCausa,
      observacoes
    });

    // Primeiro, identificar qual é a tabela base - assumindo que seja uma tabela chamada 'processos'
    // ou algo similar baseado nas views que você tem
    
    // Verificar em qual tabela o processo está (pendentes ou enviados)
    let tabelaBase = null;
    let processoExiste = null;
    
    // Primeiro tentar na tabela de pendentes
    try {
      processoExiste = await client.query(
        'SELECT id_processo FROM processo_emails_pendentes WHERE id_processo = $1',
        [id]
      );
      if (processoExiste.rows.length > 0) {
        tabelaBase = 'processo_emails_pendentes';
        console.log(`✅ Processo encontrado em: processo_emails_pendentes`);
      }
    } catch (err) {
      console.log(`❌ Erro ao verificar processo_emails_pendentes:`, err.message);
    }

    // Se não encontrou nos pendentes, tentar nos enviados
    if (!tabelaBase) {
      try {
        processoExiste = await client.query(
          'SELECT id_processo FROM processo_emails_enviados WHERE id_processo = $1',
          [id]
        );
        if (processoExiste.rows.length > 0) {
          tabelaBase = 'processo_emails_enviados';
          console.log(`✅ Processo encontrado em: processo_emails_enviados`);
        }
      } catch (err) {
        console.log(`❌ Erro ao verificar processo_emails_enviados:`, err.message);
      }
    }

    if (!tabelaBase || processoExiste.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Processo não encontrado em nenhuma das tabelas (pendentes ou enviados)' });
    }

    // Atualizar os dados do processo na tabela encontrada
    const updateQuery = `
      UPDATE ${tabelaBase} 
      SET 
        nome_assistido = $1,
        emails = $2,
        telefones = $3,
        id_atendimento_vinculado = $4,
        tipo_atendimento = $5,
        ex_adverso = $6,
        instancia = $7,
        objeto_atendimento = $8,
        valor_causa = $9,
        updated_at = CURRENT_TIMESTAMP
      WHERE id_processo = $10
      RETURNING *
    `;

    const result = await client.query(updateQuery, [
      cliente,
      emailCliente,
      telefones,
      idAtendimento,
      tipoProcesso,
      exAdverso,
      instancia,
      objetoAtendimento,
      valorCausa || null, // Se valorCausa for string vazia, converte para null
      id
    ]);

    await client.query('COMMIT');

    console.log(`✅ PROCESSOS: Processo ${id} atualizado com sucesso`);

    // Retornar os dados atualizados no formato esperado pelo frontend
    const processoAtualizado = {
      id: result.rows[0].id_processo,
      idProcessoPlanilha: result.rows[0].id_processo,
      numeroProcesso: result.rows[0].numero_unico,
      cpfAssistido: result.rows[0].cpf_assistido,
      cliente: result.rows[0].nome_assistido,
      emailCliente: result.rows[0].emails,
      telefones: result.rows[0].telefones,
      idAtendimento: result.rows[0].id_atendimento_vinculado,
      tipoProcesso: result.rows[0].tipo_atendimento,
      dataAjuizamento: result.rows[0].data_autuacao,
      exAdverso: result.rows[0].ex_adverso,
      instancia: result.rows[0].instancia,
      objetoAtendimento: result.rows[0].objeto_atendimento,
      valorCausa: result.rows[0].valor_causa,
      observacoes: observacoes || ''
    };

    res.json({
      success: true,
      message: 'Processo atualizado com sucesso',
      processo: processoAtualizado
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao atualizar processo:', error);
    
    // Retornar erro mais específico baseado no tipo de erro
    if (error.code === '23505') { // Violação de constraint unique
      return res.status(400).json({ 
        error: 'Dados duplicados encontrados',
        details: 'Um processo com estes dados já existe'
      });
    }
    
    if (error.code === '23503') { // Violação de foreign key
      return res.status(400).json({ 
        error: 'Referência inválida',
        details: 'Um dos campos referencia um valor que não existe'
      });
    }

    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error.message
    });
  } finally {
    client.release();
  }
});

// backend/routes/upload.js
app.post('/api/upload-document', upload.single('file'), (req, res) => {
  const file = req.file;
  const destinationPath = `public/documents/${file.originalname}`;
  
  // Mover arquivo para public/documents/
  fs.moveSync(file.path, destinationPath);
  
  res.json({ 
    success: true, 
    fileUrl: `/documents/${file.originalname}` 
  });
});

async function atualizarEmailInvalido(id) {
  try {
    console.log(`🔄 Marcando email como inválido para processo ID: ${id}`);
    
    const result = await pool.query(
      'UPDATE processos SET email_valido = false, atualizado_em = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rowCount > 0) {
      console.log(`✅ Email marcado como inválido para processo ${id}`);
      return true;
    } else {
      console.log(`⚠️ Processo ${id} não encontrado para atualizar email_valido`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Erro ao marcar email como inválido para processo ${id}:`, error);
    return false;
  }
}

// Enviar email individual com template adaptado
app.post('/api/emails/processo/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      idProcessoPlanilha, 
      numeroProcesso, 
      cliente, 
      emailCliente, 
      tipoProcesso, 
      status, 
      ultimoAndamento, 
      responsavel, 
      cpfAssistido, 
      instancia,
      exAdverso,
      objetoAtendimento,
      valorCausa,
      proveito
    } = req.body;

    console.log(`📧 EMAIL: Enviando para processo ${numeroProcesso} - ${cliente}`);

    // Validar email
    if (!emailCliente || !emailCliente.includes('@')) {
      return res.status(400).json({
        error: 'Email inválido',
        details: 'O endereço de email fornecido não é válido',
        errorType: 'INVALID_EMAIL'
      });
    }

    // Validar email com regex mais rigoroso
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailCliente)) {
      return res.status(400).json({
        error: 'Formato de email inválido',
        details: 'O formato do email não atende aos padrões',
        errorType: 'INVALID_EMAIL_FORMAT'
      });
    }

    const formatarData = (dataISO) => {
      if (!dataISO) return 'Não informado';
      try {
        const data = new Date(dataISO);
        return data.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      } catch (error) {
        return dataISO;
      }
    };

    // Template do email (mantém o mesmo)
    const emailTemplate = `
      <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Atualização do Processo Jurídico</title>
          <style>
            body { 
              font-family: 'Arial', sans-serif; 
              line-height: 1.6; 
              color: #333; 
              margin: 0; 
              padding: 0; 
              background-color: #f5f5f5;
            }
            .container { 
              max-width: 600px; 
              margin: 0 auto; 
              padding: 20px; 
              background-color: #ffffff; 
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              border-radius: 8px;
            }
            .header { 
              background: linear-gradient(135deg, #165A5D 0%, #1a6b6f 100%);
              color: white; 
              padding: 25px; 
              text-align: center; 
              border-radius: 8px 8px 0 0; 
            }
            .header h1 { 
              margin: 0; 
              font-size: 24px; 
              font-weight: bold; 
            }
            .content { 
              padding: 30px; 
              background-color: #f9f9f9; 
              border-radius: 0 0 8px 8px; 
            }
            .texto-inicial{
              color: #000000;
              text-align: justify;
            }
            .info-box { 
              background-color: #e3f2fd; 
              padding: 20px; 
              margin: 20px 0; 
              border-left: 4px solid #165A5D; 
              border-radius: 4px; 
            }
            .info-box p { 
              margin: 8px 0; 
            }

            .info-box p{
              color: #000000;
            }

            .info-box strong {
              color: #000000;
            }

            .highlight { 
              color: #165A5D; 
              font-weight: bold; 
            }
            .valor-box {
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              color: white;
              padding: 20px;
              border-radius: 8px;
              text-align: center;
              margin: 20px 0;
              font-size: 18px;
              font-weight: bold;
            }
            .valor-box .valor-label {
              font-size: 14px;
              opacity: 0.9;
              margin-bottom: 5px;
            }
            .anti-golpe {
              background-color: #dc2626;
              color: white;
              padding: 20px;
              border-radius: 8px;
              margin: 25px 0;
              border: 3px solid #b91c1c;
            }
            .anti-golpe h3 {
              margin: 0 0 10px 0;
              font-size: 18px;
              text-align: center;
            }
            .anti-golpe ul {
              margin: 10px 0;
              padding-left: 20px;
            }
            .anti-golpe li {
              margin: 5px 0;
            }

            .anti-golpe p {
              text-align: justify;
            }
            .contact-info { 
              background-color: #fff3cd; 
              padding: 20px; 
              border: 1px solid #ffeaa7; 
              border-radius: 8px; 
              margin: 20px 0; 
            }
            .whatsapp-btn {
              display: inline-block;
              background-color: #25d366;
              color: white;
              padding: 12px 20px;
              text-decoration: none;
              border-radius: 25px;
              font-weight: bold;
              margin: 10px 5px;
              text-align: center;
            }
            .social-links {
              text-align: center;
              padding: 20px;
              background-color: #f8f9fa;
              border-radius: 8px;
              margin: 20px 0;
            }
            .social-links p {
              margin-bottom: 25px;
            }
            .social-links a {
              display: inline-block;
              margin: 0 10px;
              color: #165A5D;
              text-decoration: none;
              font-weight: bold;
            }
            .footer { 
              text-align: center; 
              padding: 20px; 
              font-size: 14px;
              color: #222222; 
              background-color: #f5f5f5; 
              margin-top: 20px; 
              border-radius: 4px; 
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="https://sistema.resendemh.com.br/logo-rmh.png" alt="Logo RMH" style="height: 55px; margin-bottom: 20px;" />
              <h1>ATUALIZAÇÃO DO PROCESSO</h1>
            </div>
            
            <div class="content">
              <p class="texto-inicial">Prezado(a) <strong>${cliente}</strong>,</p>
              
              <p class="texto-inicial">Entramos em contato para informar sobre a situação atual do seu processo jurídico:</p>
              
              <div class="info-box">
                <p><strong>Número do processo:</strong> ${numeroProcesso}</p>
                <p><strong>🎯 Objeto da Ação:</strong> ${objetoAtendimento}</p>
                <p><strong>📅 Data de protocolo do processo:</strong> ${formatarData(ultimoAndamento)}</p>
                ${instancia ? `<p><strong>🏛️ Instância:</strong> ${instancia}</p>` : ''}
                <p><strong>👨‍💼 Parte Contrária:</strong> ${responsavel}</p>
                ${valorCausa ? `<p><strong>💲 Previsão de Proveito Econômico:</strong> R$ ${parseFloat(valorCausa).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>` : ''}
              </div>

              ${valorCausa ? `
                <p class="texto-inicial">
                  O valor inicial que está sendo requerido na ação descrito acima representa uma expectativa de recebimento a depender da sentença,<strong> APÓS A TRAMITAÇÃO COMPLETA DA AÇÃO</strong>, pois nesse momento <strong>NÃO HÁ PREVISÃO DE RECEBIMENTO DE VALORES</strong>.
                </p>
              ` : ''}

              <!-- AVISO ANTI-GOLPE -->
              <div class="anti-golpe">
                <h3>⚠️ CUIDADO COM OS GOLPES</h3>
                <p>A Resende Mori Hutchison <strong>NUNCA SOLICITA</strong> informações ou pagamentos para liberação de créditos de processos e não entra em contato por outros números além do oficial.</p>
                <p>Caso receba qualquer mensagem ou ligação de outro número além do nosso canal oficial, entre em contato conosco para confirmar a veracidade.</p>
                <p>Estamos disponíveis exclusivamente no whatsapp pelo (61) 3031-4400.</p>
              </div>
              
              <div class="contact-info">
                <p><strong>💬 Precisa tirar dúvidas?</strong></p>
                <p>Entre em contato conosco através do nosso Whatsapp clicando no botão abaixo:</p>
                <div style="text-align: center;">
                  <a href="https://wa.me/556130314400" class="whatsapp-btn">
                    <img src="https://sistema.resendemh.com.br/whatsapp.png" alt="WhatsApp" style="height: 30px; margin: 0 5px; vertical-align: middle;">
                    WhatsApp
                  </a>
                </div>
              </div>

              <!-- Redes Sociais -->
              <div class="social-links">
                <p><strong>🌐 Nos acompanhe nas redes sociais:</strong></p>
                <a href="https://www.resendemh.com.br">
                  <img src="https://sistema.resendemh.com.br/resendemh-logo.png" alt="Site RMH" style="height: 30px; margin: 0 5px; vertical-align: middle;">
                  Site Oficial
                </a>
                <a href="https://www.instagram.com/advocaciarmh">
                  <img src="https://sistema.resendemh.com.br/instagram.png" alt="Instagram" style="height: 30px; margin: 0 5px; vertical-align: middle;">
                  Instagram
                </a>
                <a href="https://www.youtube.com/@ResendeMoriHutchison">
                  <img src="https://sistema.resendemh.com.br/youtube.png" alt="YouTube" style="height: 30px; margin: 0 5px; vertical-align: middle;">
                  YouTube
                </a>
              </div>
            </div>
            <div class="footer">
              <p><strong>ATENÇÃO: ESTE É UM E-MAIL AUTOMÁTICO, FAVOR NÃO RESPONDER.</strong></p>
            </div>
          </div>
        </body>
        </html>
      `;

    // ✅ MELHOR TRATAMENTO DE ERRO DO RESEND
    let emailResult;
    try {
      emailResult = await resend.emails.send({
        from: 'processos@resendemh.com.br',
        to: [emailCliente],
        subject: `📋 Atualização - Processo ${numeroProcesso}`,
        html: emailTemplate
      });

      // ✅ VERIFICAR SE O RESEND RETORNOU ERRO
      if (!emailResult || (!emailResult.id && !emailResult.data?.id)) {
        console.error('❌ RESEND: Resposta inválida:', emailResult);
        throw new Error('Serviço de email retornou resposta inválida');
      }

      // ✅ VERIFICAR SE HÁ ERRO NA RESPOSTA DO RESEND
      if (emailResult.error) {
        console.error('❌ RESEND: Erro na resposta:', emailResult.error);
        throw new Error(`Erro do serviço de email: ${emailResult.error.message || emailResult.error}`);
      }

      const emailId = emailResult.id || emailResult.data?.id;
      console.log(`✅ EMAIL: Enviado com sucesso - ID: ${emailId}`);
    } catch (emailError) {
      console.error('❌ RESEND: Falha ao enviar email:', emailError);
      await atualizarEmailInvalido(id);
      // ✅ DETERMINAR TIPO DE ERRO ESPECÍFICO
      let errorType = 'EMAIL_SEND_FAILED';
      let errorMessage = 'Falha ao enviar email';
      let statusCode = 500;

      if (emailError.message?.includes('invalid email')) {
        errorType = 'INVALID_EMAIL';
        errorMessage = 'Email inválido ou não aceito pelo provedor';
        statusCode = 400;
      } else if (emailError.message?.includes('bounced')) {
        errorType = 'EMAIL_BOUNCED';
        errorMessage = 'Email rejeitado pelo destinatário';
        statusCode = 422;
      } else if (emailError.message?.includes('rate limit')) {
        errorType = 'RATE_LIMIT';
        errorMessage = 'Limite de envio excedido';
        statusCode = 429;
      } else if (emailError.message?.includes('quota')) {
        errorType = 'QUOTA_EXCEEDED';
        errorMessage = 'Cota de emails excedida';
        statusCode = 429;
      } else if (emailError.code === 'ENOTFOUND' || emailError.code === 'ECONNREFUSED') {
        errorType = 'SERVICE_UNAVAILABLE';
        errorMessage = 'Serviço de email temporariamente indisponível';
        statusCode = 503;
      }

      return res.status(statusCode).json({
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? emailError.message : undefined,
        errorType: errorType,
        cliente: cliente,
        numeroProcesso: numeroProcesso,
        emailCliente: emailCliente
      });
    }

    // ✅ SE CHEGOU ATÉ AQUI, EMAIL FOI ENVIADO COM SUCESSO
    try {
      const dadosProcesso = {
        numeroProcesso, cliente, emailCliente, tipoProcesso, status,
        ultimoAndamento, responsavel, cpfAssistido,
        instancia, exAdverso, objetoAtendimento, valorCausa, proveito
      };
      
      await moverProcessoParaEnviados({
        numeroProcesso: numeroProcesso,
        idProcessoPlanilha: idProcessoPlanilha, 
        dataEnvio: new Date().toISOString()
      });
      
      console.log(`📋 MOVIMENTAÇÃO: ${numeroProcesso} movido para aba enviados`);
      
    } catch (movimentacaoError) {
      console.error('⚠️ Erro na movimentação (email foi enviado):', movimentacaoError);
      // Não falhar a API se o email foi enviado com sucesso
    }

    // ✅ RESPOSTA DE SUCESSO
    res.json({
      success: true,
      emailId: emailId,
      processoId: id,
      cliente,
      numeroProcesso,
      emailEnviado: true,
      dataEnvio: new Date().toISOString(),
      movidoParaEnviados: true
    });

  } catch (error) {
    console.error('❌ Erro geral na API:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      errorType: 'INTERNAL_ERROR'
    });
  }
});

// Enviar emails em massa (mantém a lógica anterior)
app.post('/api/emails/massa', authMiddleware, async (req, res) => {
  try {
    const { processos } = req.body;

    console.log(`📧 EMAIL MASSA: Enviando para ${processos.length} processos`);
    console.log('📋 DEBUG: Dados recebidos:', JSON.stringify(processos, null, 2));

    let enviados = 0;
    let erros = 0;
    let movimentacoes = 0;
    const resultados = [];

    const processosValidos = processos.filter(p => p.emailCliente && p.emailCliente.includes('@'));
    
    if (processosValidos.length === 0) {
      return res.status(400).json({
        error: 'Nenhum processo tem email válido',
        total: processos.length,
        validos: 0
      });
    }

    console.log(`📊 DEBUG: ${processosValidos.length} processos com email válido de ${processos.length} total`);

    // ✅ FUNÇÃO PARA FORMATAR DATA
    const formatarData = (dataISO) => {
      if (!dataISO) return 'Não informado';
      try {
        const data = new Date(dataISO);
        return data.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      } catch (error) {
        return dataISO; // Retorna original se não conseguir formatar
      }
    };

    // ✅ FUNÇÃO PARA GERAR TEMPLATE DO EMAIL
    const gerarTemplateEmail = (processo) => {
      return `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Atualização do Processo Jurídico</title>
          <style>
            body { 
              font-family: 'Arial', sans-serif; 
              line-height: 1.6; 
              color: #333; 
              margin: 0; 
              padding: 0; 
              background-color: #f5f5f5;
            }
            .container { 
              max-width: 600px; 
              margin: 0 auto; 
              padding: 20px; 
              background-color: #ffffff; 
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              border-radius: 8px;
            }
            .header { 
              background: linear-gradient(135deg, #165A5D 0%, #1a6b6f 100%);
              color: white; 
              padding: 25px; 
              text-align: center; 
              border-radius: 8px 8px 0 0; 
            }
            .header h1 { 
              margin: 0; 
              font-size: 24px; 
              font-weight: bold; 
            }
            .content { 
              padding: 30px; 
              background-color: #f9f9f9; 
              border-radius: 0 0 8px 8px; 
            }
            .texto-inicial{
              color: #000000;
              text-align: justify;
            }
            .info-box { 
              background-color: #e3f2fd; 
              padding: 20px; 
              margin: 20px 0; 
              border-left: 4px solid #165A5D; 
              border-radius: 4px; 
            }
            .info-box p { 
              margin: 8px 0; 
            }
            .info-box p{
              color: #000000;
            }
            .info-box strong {
              color: #000000;
            }
            .highlight { 
              color: #165A5D; 
              font-weight: bold; 
            }
            .anti-golpe {
              background-color: #dc2626;
              color: white;
              padding: 20px;
              border-radius: 8px;
              margin: 25px 0;
              border: 3px solid #b91c1c;
            }
            .anti-golpe h3 {
              margin: 0 0 10px 0;
              font-size: 18px;
              text-align: center;
            }
            .anti-golpe p {
              text-align: justify;
            }
            .contact-info { 
              background-color: #fff3cd; 
              padding: 20px; 
              border: 1px solid #ffeaa7; 
              border-radius: 8px; 
              margin: 20px 0; 
            }
            .whatsapp-btn {
              display: inline-block;
              background-color: #25d366;
              color: white;
              padding: 12px 20px;
              text-decoration: none;
              border-radius: 25px;
              font-weight: bold;
              margin: 10px 5px;
              text-align: center;
            }
            .social-links {
              text-align: center;
              padding: 20px;
              background-color: #f8f9fa;
              border-radius: 8px;
              margin: 20px 0;
            }
            .social-links p {
              margin-bottom: 25px;
            }
            .social-links a {
              display: inline-block;
              margin: 0 10px;
              color: #165A5D;
              text-decoration: none;
              font-weight: bold;
            }
            .footer { 
              text-align: center; 
              padding: 20px; 
              font-size: 14px;
              color: #222222; 
              background-color: #f5f5f5; 
              margin-top: 20px; 
              border-radius: 4px; 
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="https://sistema.resendemh.com.br/logo-rmh.png" alt="Logo RMH" style="height: 55px; margin-bottom: 20px;" />
              <h1>ATUALIZAÇÃO DO PROCESSO</h1>
            </div>
            
            <div class="content">
              <p class="texto-inicial">Prezado(a) <strong>${processo.cliente}</strong>,</p>
              
              <p class="texto-inicial">Entramos em contato para informar sobre a situação atual do seu processo jurídico:</p>
              
              <div class="info-box">
                <p><strong>Número do processo:</strong> ${processo.numeroProcesso}</p>
                <p><strong>🎯 Objeto da Ação:</strong> ${processo.objetoAtendimento || 'Não informado'}</p>
                <p><strong>📅 Data de protocolo do processo:</strong> ${formatarData(processo.ultimoAndamento)}</p>
                ${processo.instancia ? `<p><strong>🏛️ Instância:</strong> ${processo.instancia}</p>` : ''}
                <p><strong>👨‍💼 Parte Contrária:</strong> ${processo.responsavel || processo.exAdverso || 'Não informado'}</p>
                ${processo.valorCausa ? `<p><strong>💲 Previsão de Proveito Econômico:</strong> R$ ${parseFloat(processo.valorCausa).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>` : ''}
              </div>

              ${processo.valorCausa ? `
                <p class="texto-inicial">
                  O valor inicial que está sendo requerido na ação descrito acima representa uma expectativa de recebimento a depender da sentença,<strong> APÓS A TRAMITAÇÃO COMPLETA DA AÇÃO</strong>, pois nesse momento <strong>NÃO HÁ PREVISÃO DE RECEBIMENTO DE VALORES</strong>.
                </p>
              ` : ''}

              <!-- AVISO ANTI-GOLPE -->
              <div class="anti-golpe">
                <h3>⚠️ CUIDADO COM OS GOLPES</h3>
                <p>A Resende Mori Hutchison <strong>NUNCA SOLICITA</strong> informações ou pagamentos para liberação de créditos de processos e não entra em contato por outros números além do oficial.</p>
                <p>Caso receba qualquer mensagem ou ligação de outro número além do nosso canal oficial, entre em contato conosco para confirmar a veracidade.</p>
                <p>Estamos disponíveis exclusivamente no whatsapp pelo (61) 3031-4400.</p>
              </div>
              
              <div class="contact-info">
                <p><strong>💬 Precisa tirar dúvidas?</strong></p>
                <p>Entre em contato conosco através do nosso Whatsapp, clicando no botão abaixo:</p>
                <div style="text-align: center;">
                  <a href="https://wa.me/556130314400" class="whatsapp-btn">
                    <img src="https://sistema.resendemh.com.br/whatsapp.png" alt="WhatsApp" style="height: 30px; margin: 0 5px; vertical-align: middle;">
                    WhatsApp
                  </a>
                </div>
              </div>

              <!-- Redes Sociais -->
              <div class="social-links">
                <p><strong>🌐 Nos acompanhe nas redes sociais:</strong></p>
                <a href="https://www.resendemh.com.br">
                  <img src="https://sistema.resendemh.com.br/resendemh-logo.png" alt="Site RMH" style="height: 30px; margin: 0 5px; vertical-align: middle;">
                  Site Oficial
                </a>
                <a href="https://www.instagram.com/advocaciarmh">
                  <img src="https://sistema.resendemh.com.br/instagram.png" alt="Instagram" style="height: 30px; margin: 0 5px; vertical-align: middle;">
                  Instagram
                </a>
                <a href="https://www.youtube.com/@ResendeMoriHutchison">
                  <img src="https://sistema.resendemh.com.br/youtube.png" alt="YouTube" style="height: 30px; margin: 0 5px; vertical-align: middle;">
                  YouTube
                </a>
              </div>
            </div>
            <div class="footer">
              <p><strong>ATENÇÃO: ESTE É UM E-MAIL AUTOMÁTICO, FAVOR NÃO RESPONDER.</strong></p>
            </div>
          </div>
        </body>
        </html>
      `;
    };

    // ✅ PROCESSAMENTO 100% SEQUENCIAL - UM POR VEZ
    for (let i = 0; i < processosValidos.length; i++) {
      const processo = processosValidos[i];
      
      try {
        console.log(`\n=== PROCESSANDO ${i + 1}/${processosValidos.length} ===`);
        console.log(`📧 MASSA: Processando ${processo.cliente} (${processo.emailCliente})`);
        console.log(`🆔 MASSA: idProcessoPlanilha = "${processo.idProcessoPlanilha}"`);

        // Validar campos obrigatórios
        if (!processo.cliente) {
          throw new Error('Campo cliente é obrigatório');
        }
        if (!processo.emailCliente) {
          throw new Error('Campo emailCliente é obrigatório');
        }
        if (!processo.numeroProcesso) {
          throw new Error('Campo numeroProcesso é obrigatório');
        }

        // Verificar se tem idProcessoPlanilha
        if (!processo.idProcessoPlanilha || processo.idProcessoPlanilha.trim() === '') {
          console.log(`⚠️ MASSA: Processo ${processo.numeroProcesso} sem idProcessoPlanilha - apenas enviando email`);
          
          // Enviar email sem mover
          const emailTemplate = gerarTemplateEmail(processo);
          const emailResult = await resend.emails.send({
            from: 'processos@resendemh.com.br',
            to: [processo.emailCliente],
            subject: `📋 Atualização - Processo ${processo.numeroProcesso} | RMH Advogados`,
            html: emailTemplate
          });

          console.log(`✅ MASSA: Email enviado - ID: ${emailResult.id}`);
          enviados++;
          
          resultados.push({
            id: processo.id,
            cliente: processo.cliente,
            numeroProcesso: processo.numeroProcesso,
            success: true,
            emailId: emailResult.id,
            movido: false,
            motivo: 'Sem idProcessoPlanilha'
          });
          
          // Pausa antes do próximo
          if (i < processosValidos.length - 1) {
            console.log(`⏳ MASSA: Aguardando 2 segundos antes do próximo processo...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          continue;
        }

        // 1. ENVIAR EMAIL PRIMEIRO
        console.log(`📧 MASSA: Enviando email para ${processo.emailCliente}`);
        const emailTemplate = gerarTemplateEmail(processo);
        
        const emailResult = await resend.emails.send({
          from: 'processos@resendemh.com.br',
          to: [processo.emailCliente],
          subject: `📋 Atualização - Processo ${processo.numeroProcesso} | RMH Advogados`,
          html: emailTemplate
        });

        console.log(`✅ MASSA: Email enviado - ID: ${emailResult.id}`);

        // 2. DEPOIS MOVER PARA ABA ENVIADOS
        try {
          console.log(`📋 MASSA: Tentando mover processo ID ${processo.idProcessoPlanilha} para enviados`);
          
          const resultadoMovimentacao = await moverProcessoParaEnviados(
            processo.numeroProcesso,
            processo.idProcessoPlanilha,
            new Date().toISOString()
          );
          
          console.log(`✅ MASSA: Processo ID ${processo.idProcessoPlanilha} movido para enviados`);
          movimentacoes++;
          
          resultados.push({
            id: processo.id,
            cliente: processo.cliente,
            numeroProcesso: processo.numeroProcesso,
            success: true,
            emailId: emailResult.id,
            movido: true,
            linhaOriginal: resultadoMovimentacao.linhaOriginal,
            linhaFinal: resultadoMovimentacao.linhaFinal,
            status: resultadoMovimentacao.status
          });

        } catch (movError) {
          console.error(`⚠️ MASSA: Erro ao mover processo ${processo.numeroProcesso}:`, movError.message);
          
          resultados.push({
            id: processo.id,
            cliente: processo.cliente,
            numeroProcesso: processo.numeroProcesso,
            success: true,
            emailId: emailResult.id,
            movido: false,
            erro: movError.message
          });
        }

        enviados++;

        // ✅ PAUSA OBRIGATÓRIA entre cada processo (evita conflitos)
        if (i < processosValidos.length - 1) {
          console.log(`⏳ MASSA: Aguardando 3 segundos antes do próximo processo...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }

      } catch (error) {
        console.error(`❌ MASSA: Erro ao processar ${processo.cliente}:`, error);
        erros++;
        
        resultados.push({
          id: processo.id,
          cliente: processo.cliente || 'N/A',
          numeroProcesso: processo.numeroProcesso || 'N/A',
          success: false,
          error: error.message,
          movido: false
        });

        // Pausa mesmo em caso de erro
        if (i < processosValidos.length - 1) {
          console.log(`⏳ MASSA: Aguardando 2 segundos após erro...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    console.log(`\n✅ EMAIL MASSA FINALIZADO: ${enviados} enviados, ${movimentacoes} movidos, ${erros} erros`);

    // Log detalhado dos erros
    const errosDetalhados = resultados.filter(r => !r.success);
    if (errosDetalhados.length > 0) {
      console.log(`❌ ERROS DETALHADOS:`, errosDetalhados);
    }

    res.json({
      success: true,
      enviados,
      erros,
      movimentacoes,
      total: processos.length,
      processosValidos: processosValidos.length,
      resultados,
      errosDetalhados: errosDetalhados.map(e => ({
        cliente: e.cliente,
        erro: e.error
      }))
    });

  } catch (error) {
    console.error('❌ Erro geral no envio em massa:', error);
    res.status(500).json({
      error: 'Erro no envio em massa',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Rate limiting para envio de emails
const emailRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 30, // Reduzido para 30 emails por 15 minutos (mais conservador)
  message: {
    error: 'Muitos emails enviados. Tente novamente em 15 minutos.',
    limite: '30 emails por 15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Aplicar rate limiting
app.use('/api/emails', emailRateLimit);

// Middleware de logs
app.use('/api/processos', (req, res, next) => {
  console.log(`📊 PROCESSOS API: ${req.method} ${req.path} - User: ${req.user?.nome || 'Unknown'}`);
  next();
});

app.use('/api/emails', (req, res, next) => {
  console.log(`📧 EMAIL API: ${req.method} ${req.path} - User: ${req.user?.nome || 'Unknown'}`);
  next();
});

// Função de teste
app.get('/api/processos/test-connection', authMiddleware, async (req, res) => {
  try {
    console.log('🧪 TESTE: Verificando conexão com Google Sheets...');

    const sheets = getGoogleSheetsInstance();
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEETS_CONFIG.SPREADSHEET_ID,
      range: 'Processos Pendentes!A1:L1', // Testar primeira linha completa
    });

    res.json({
      success: true,
      message: 'Conexão com Google Sheets funcionando',
      cabecalhos: response.data.values?.[0] || [],
      planilhaId: SHEETS_CONFIG.SPREADSHEET_ID,
      temCredenciais: !!SHEETS_CONFIG.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      estruturaDetectada: {
        totalColunas: response.data.values?.[0]?.length || 0,
        colunasPrincipais: [
          'A: ID Processo',
          'B: Número Único', 
          'C: CPF',
          'D: Nome Cliente',
          'E: Email',
          'F: Telefones',
          'G: ID Atendimento',
          'H: Natureza',
          'I: Data Autuação',
          'J: Ex-adverso',
          'K: Instância',
          'L: Objeto'
        ]
      }
    });

  } catch (error) {
    console.error('❌ Erro no teste de conexão:', error);
    res.status(500).json({
      success: false,
      error: 'Erro na conexão com Google Sheets',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      dicas: [
        'Verifique se as credenciais do Google estão corretas',
        'Confirme se a planilha foi compartilhada com a Service Account',
        'Verifique se a Google Sheets API está ativada no projeto'
      ]
    });
  }
});

// ===============================================
// ROTAS DE AUTENTICAÇÃO ATUALIZADAS
// ===============================================

// REGISTRO COM VERIFICAÇÃO DE EMAIL
app.post('/api/auth/request-reset-code', authLimiter, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    console.log('🔄 TRANSAÇÃO: Iniciada - Reset de senha');

    const { email } = req.body;

    if (!email) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'Email é obrigatório' });
    }

    console.log(`🔍 RESET: Email: ${email}`);

    // Verificar se o usuário existe e está verificado
    const userExists = await client.query(
      'SELECT id, nome, email, email_verificado FROM usuarios WHERE email = $1',
      [email]
    );

    if (userExists.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ 
        error: 'Não encontramos uma conta associada a este email' 
      });
    }

    const user = userExists.rows[0];

    if (!user.email_verificado) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ 
        error: 'Esta conta ainda não foi verificada. Verifique seu email primeiro.' 
      });
    }

    console.log(`🔍 RESET: Usuário encontrado: ${user.nome} (ID: ${user.id})`);

    // Invalidar códigos anteriores de reset
    await client.query(
      'UPDATE verificacoes_email SET usado_em = NOW() WHERE usuario_id = $1 AND tipo_token = $2 AND usado_em IS NULL',
      [user.id, 'reset_senha']
    );

    // Gerar código de verificação
    const codigoVerificacao = Math.floor(100000 + Math.random() * 900000).toString();
    const expiraEm = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos para reset

    // Salvar token na tabela de verificações
    await client.query(
      `INSERT INTO verificacoes_email (usuario_id, token, tipo_token, expira_em) 
      VALUES ($1, $2, $3, $4)`,
      [user.id, codigoVerificacao, 'reset_senha', expiraEm]
    );

    await client.query('COMMIT');
    console.log('✅ TRANSAÇÃO: Commitada com sucesso - Reset');

    console.log(`
    🔐 ========== CÓDIGO DE RESET ==========
    📧 Email: ${email}
    🔢 Código: ${codigoVerificacao}
    ⏰ Expira em: ${expiraEm}
    =====================================
    `);

    // Enviar email automaticamente
    try {
      const emailResult = await resend.emails.send({
        from: 'admin@resendemh.com.br',
        to: [email],
        subject: 'Código para redefinir sua senha - Andifes RMH',
        html: await gerarTemplateResetSenha(user.nome, codigoVerificacao, email)
      });

      console.log(`✅ Email de reset enviado para: ${email}`, emailResult);
    } catch (emailError) {
      console.error('❌ ERRO no email de reset (não crítico):', emailError);
    }

    res.json({
      message: 'Código de verificação enviado para seu email',
      token: codigoVerificacao // Retorna o código como token para usar nas próximas etapas
    });

  } catch (error) {
    console.error('❌ Erro no reset de senha:', error);
    
    try {
      await client.query('ROLLBACK');
      console.log('🔄 TRANSAÇÃO: Rollback executado - Reset');
    } catch (rollbackError) {
      console.error('❌ Erro no rollback:', rollbackError);
    }
    
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    client.release();
    console.log('🔌 CONEXÃO: Liberada - Reset');
  }
});

// ROTA: Verificar código de reset
app.post('/api/auth/verify-reset-code', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { token, code } = req.body;

    if (!token || !code) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'Token e código são obrigatórios' });
    }

    console.log(`🔍 VERIFICAÇÃO RESET: Código: ${code}`);

    // Buscar token de verificação - MESMO PADRÃO DA VERIFICAÇÃO DE EMAIL
    const tokenResult = await client.query(
      `SELECT v.*, u.nome, u.email 
       FROM verificacoes_email v
       JOIN usuarios u ON v.usuario_id = u.id
       WHERE v.token = $1 
         AND v.tipo_token = 'reset_senha'
         AND v.usado_em IS NULL 
         AND v.expira_em > NOW()`,
      [code] // Usa o code como token (mesmo padrão do sistema existente)
    );

    if (tokenResult.rows.length === 0) {
      console.log(`❌ VERIFICAÇÃO RESET: Código inválido ou expirado`);
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ 
        error: 'Código inválido ou expirado. Solicite um novo código.' 
      });
    }

    const verification = tokenResult.rows[0];
    console.log(`✅ VERIFICAÇÃO RESET: Código válido encontrado!`);

    // Marcar como verificado (mas não usado ainda)
    console.log(`✅ Código verificado - prosseguindo para próxima etapa`);

    await client.query('COMMIT');

    console.log(`🎉 VERIFICAÇÃO RESET: Código verificado para usuário ${verification.usuario_id}!`);

    res.json({
      message: 'Código verificado com sucesso',
      verified: true
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro na verificação do reset:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    client.release();
  }
});

// SOLUÇÃO 1: Usar flag para controlar release
app.post('/api/auth/reset-password-with-code', async (req, res) => {
  const client = await pool.connect();
  let clientReleased = false;
  
  try {
    await client.query('BEGIN');
    
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      await client.query('ROLLBACK');
      client.release();
      clientReleased = true; // ← Marca como liberado
      return res.status(400).json({ error: 'Token e nova senha são obrigatórios' });
    }
    
    if (newPassword.length < 6) {
      await client.query('ROLLBACK');
      client.release();
      clientReleased = true; // ← Marca como liberado
      return res.status(400).json({ error: 'Nova senha deve ter pelo menos 6 caracteres' });
    }
    
    // ... resto do código ...
    
    await client.query('COMMIT');
    client.release();
    clientReleased = true; // ← Marca como liberado
    
    res.json({
      message: 'Senha redefinida com sucesso!',
      success: true
    });
    
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('❌ Erro no rollback:', rollbackError);
    }
    
    console.error('❌ Erro ao redefinir senha:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    // ✅ Só libera se ainda não foi liberado
    if (!clientReleased) {
      try {
        client.release();
      } catch (releaseError) {
        console.error('❌ Erro ao liberar conexão:', releaseError);
      }
    }
  }
});

// SOLUÇÃO 2: Função helper para gerenciar conexões
class DatabaseManager {
  static async executeTransaction(callback) {
    const client = await pool.connect();
    let clientReleased = false;
    
    try {
      await client.query('BEGIN');
      
      const result = await callback(client);
      
      await client.query('COMMIT');
      client.release();
      clientReleased = true;
      
      return result;
      
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('❌ Erro no rollback:', rollbackError);
      }
      
      throw error;
      
    } finally {
      if (!clientReleased) {
        try {
          client.release();
        } catch (releaseError) {
          console.error('❌ Erro ao liberar conexão:', releaseError);
        }
      }
    }
  }
}

// USO DA FUNÇÃO HELPER:
app.post('/api/auth/reset-password-with-code', async (req, res) => {
  try {
    const result = await DatabaseManager.executeTransaction(async (client) => {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        throw new Error('Token e nova senha são obrigatórios');
      }
      
      if (newPassword.length < 6) {
        throw new Error('Nova senha deve ter pelo menos 6 caracteres');
      }
      
      // ... lógica do banco ...
      
      return {
        message: 'Senha redefinida com sucesso!',
        success: true
      };
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ Erro ao redefinir senha:', error);
    
    if (error.message.includes('Token e nova senha') || 
        error.message.includes('Nova senha deve')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// SOLUÇÃO 3: Global error handler para prevenir crashes
process.on('uncaughtException', (error) => {
  console.error('❌ ERRO NÃO CAPTURADO:', error);
  
  // Log do erro para monitoramento
  // Aqui você pode enviar para um serviço como Sentry, Datadog, etc.
  
  // Graceful shutdown
  server.close(() => {
    pool.end(() => {
      process.exit(1);
    });
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ PROMISE REJEITADA NÃO TRATADA:', reason);
  
  // Log do erro para monitoramento
  
  // Graceful shutdown
  server.close(() => {
    pool.end(() => {
      process.exit(1);
    });
  });
});

const gerarTemplateResetSenha = async (nome, codigo, email) => {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Redefinir Senha - RMH</title>
      <link href="https://fonts.googleapis.com/css2?family=Raleway:wght@400;600&family=Ruda:wght@900&display=swap" rel="stylesheet">
      <style>
        body {
          margin: 0;
          font-family: 'Raleway', sans-serif;
          background-color: #DADADA;
          color: #0d3638;
          padding: 20px;
        }
        .container {
          max-width: 600px;
          margin: auto;
          background-color: #f9f9f9;
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.08);
          overflow: hidden;
        }
        .header {
          background-color: #165A5D;
          padding: 20px 0px;
          text-align: center;
        }
        .header img {
          height: 60px;
        }
        .header h1 {
          font-family: 'Ruda', sans-serif;
          font-size: 22px;
          color: #ffffff;
          margin: 0;
          letter-spacing: 0.5px;
        }
        .content {
          padding: 20px 30px 30px 30px;
          text-align: center;
          font-family: 'Cooper Hewitt', sans-serif;
        }
        .content h2 {
          font-size: 20px;
          color: #0d3638;
          margin-bottom: 8px;
        }
        .content p {
          font-size: 17px;
          color: #555;
          margin-top: 0;
        }
        .tipo-badge {
          display: inline-block;
          padding: 6px 12px;
          background-color: #165A5D;
          color: white;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          margin: 10px 0;
        }
        .code-box {
          margin: 30px auto;
          background-color: #f8f8f8;
          border: 2px dashed #165A5D;
          border-radius: 12px;
          padding: 20px;
          font-size: 32px;
          font-weight: bold;
          color: #165A5D;
          letter-spacing: 10px;
          font-family: 'Courier New', monospace;
          max-width: 300px;
        }
        .note {
          font-size: 13px;
          color: #8b848b;
          background-color: #EFEFEF;
          padding: 15px;
          border-radius: 10px;
          margin-top: 20px;
        }
        .footer {
          font-size: 12px;
          color: #9ca2a3;
          text-align: center;
          padding: 18px;
          border-top: 1px solid #eee;
          background-color: #f9f9f9;
        }
        @media (max-width: 600px) {
          .content {
            padding: 30px 20px;
          }
          .code-box {
            font-size: 26px;
            letter-spacing: 6px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://sistema.resendemh.com.br/logo-rmh.ico" alt="Logo RMH" style="height: 100px; margin-bottom: 10px;" />
          <h1>Redefinir sua senha</h1>
        </div>
        <div class="content">
          <h2>Olá, ${nome}!</h2>
          <p>Insira o código abaixo para redefinir sua senha:</p>
          <div class="code-box">${codigo}</div>
          <p class="note">Este código expira em 15 minutos. Se você não solicitou esta redefinição, ignore este e-mail.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

app.post('/api/auth/register', authLimiter, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    console.log('🔄 TRANSAÇÃO: Iniciada');

    // Usar validação manual em vez do Joi para compatibilidade
    const validation = validateRegistro(req.body);
    if (validation.error) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: validation.error });
    }

    const { nome, email, email_pessoal, senha, setor, tipo_colaborador } = validation.value;

    // Determinar qual email usar para verificação de duplicata
    const emailLogin = tipo_colaborador === 'estagiario' ? email_pessoal : email;

    console.log(`🔍 REGISTRO: Tipo ${tipo_colaborador}, Email login: ${emailLogin}`);

    // Verificar se o usuário já existe
    const userExists = await client.query(
      `SELECT id, email_verificado, tipo_colaborador 
       FROM usuarios 
       WHERE (tipo_colaborador = 'estagiario' AND email_pessoal = $1) 
          OR (tipo_colaborador = 'clt_associado' AND email = $1)`,
      [emailLogin]
    );

    if (userExists.rows.length > 0) {
      const existingUser = userExists.rows[0];
      await client.query('ROLLBACK');
      client.release();
      
      if (existingUser.email_verificado) {
        return res.status(400).json({ error: 'Email já cadastrado e verificado' });
      } else {
        return res.status(400).json({ 
          error: 'Email já cadastrado. Verifique sua caixa de entrada ou solicite um novo código.',
          user_id: existingUser.id,
          verification_required: true
        });
      }
    }

    // Criptografar senha
    const saltRounds = 10;
    const senhaHash = await bcrypt.hash(senha, saltRounds);

    console.log(`🔐 REGISTRO: Inserindo usuário - Tipo: ${tipo_colaborador}`);

    // Inserir usuário com os novos campos
    const result = await client.query(
      `INSERT INTO usuarios (nome, email, email_pessoal, senha, setor, tipo_usuario, tipo_colaborador, email_verificado, aprovado_admin) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING id, nome, email, email_pessoal, setor, tipo_usuario, tipo_colaborador`,
      [
        nome, 
        email || null, 
        email_pessoal, 
        senhaHash, 
        setor, 
        'usuario', 
        tipo_colaborador, 
        false,
        tipo_colaborador === 'clt_associado' ? true : null // CLT aprovado automaticamente, estagiário aguarda
      ]
    );

    const newUser = result.rows[0];
    console.log(`✅ REGISTRO: Usuário criado com ID: ${newUser.id}`);

    // LÓGICA DIFERENCIADA POR TIPO DE COLABORADOR
    if (tipo_colaborador === 'clt_associado') {
  // ✅ ADICIONAR: Invalidar códigos anteriores se usuário já existir
      await client.query(
        'UPDATE verificacoes_email SET usado_em = NOW() WHERE usuario_id = $1 AND usado_em IS NULL',
        [newUser.id]
      );

      // Gerar código de verificação
      const codigoVerificacao = Math.floor(100000 + Math.random() * 900000).toString();
      const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Salvar token na tabela de verificações
      await client.query(
        `INSERT INTO verificacoes_email (usuario_id, token, tipo_token, expira_em) 
        VALUES ($1, $2, $3, $4)`,
        [newUser.id, codigoVerificacao, 'verificacao_email', expiraEm]
      );

      await client.query('COMMIT');
      console.log('✅ TRANSAÇÃO: Commitada com sucesso (CLT)');

      console.log(`
      🔐 ========== CÓDIGO DE VERIFICAÇÃO (CLT) ==========
      👤 Tipo: ${tipo_colaborador}
      📧 Email: ${emailLogin}
      🔢 Código: ${codigoVerificacao}
      ⏰ Expira em: ${expiraEm}
      =================================================
      `);

      // Enviar email automaticamente para CLT
      try {
        const emailResult = await resend.emails.send({
          from: 'andre.macedo@resendemh.com.br',
          to: [emailLogin],
          subject: 'Confirme seu email - Site RMH',
          html: await gerarTemplateVerificacao(nome, codigoVerificacao, emailLogin, tipo_colaborador)
        });

        console.log(`✅ Email enviado automaticamente para CLT: ${emailLogin}`, emailResult);
      } catch (emailError) {
        console.error('❌ ERRO no email (não crítico):', emailError);
      }

      res.status(201).json({
        message: 'Usuário cadastrado! Verifique seu email e digite o código de 6 dígitos.',
        user_id: newUser.id,
        verification_required: true,
        email_enviado_para: emailLogin,
        tipo_colaborador: tipo_colaborador,
        aprovado_automaticamente: true
      });

    } else {
      // ========== ESTAGIÁRIO: AGUARDAR APROVAÇÃO DO ADMIN ==========
      
      await client.query('COMMIT');
      console.log('✅ TRANSAÇÃO: Commitada com sucesso (Estagiário)');

      console.log(`
      ⏳ ========== ESTAGIÁRIO AGUARDANDO APROVAÇÃO ==========
      👤 Nome: ${nome}
      📧 Email: ${emailLogin}
      🏢 Setor: ${setor}
      🆔 ID: ${newUser.id}
      📝 Status: Aguardando aprovação do administrador
      =====================================================
      `);

      res.status(201).json({
        message: 'Cadastro realizado com sucesso! Seu acesso será liberado após aprovação do administrador.',
        user_id: newUser.id,
        verification_required: false,
        awaiting_admin_approval: true,
        tipo_colaborador: tipo_colaborador,
        info: 'Você receberá um email quando seu cadastro for aprovado por um administrador.'
      });
    }

  } catch (error) {
    console.error('❌ Erro no registro:', error);
    
    // Rollback em caso de erro
    try {
      await client.query('ROLLBACK');
      console.log('🔄 TRANSAÇÃO: Rollback executado');
    } catch (rollbackError) {
      console.error('❌ Erro no rollback:', rollbackError);
    }
    
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    // Sempre liberar a conexão
    client.release();
    console.log('🔌 CONEXÃO: Liberada');
  }
});

// VERIFICAR CÓDIGO DE EMAIL ATUALIZADO (CORRIGIDO!)
app.post('/api/auth/verify-email', async (req, res) => {
  const client = await pool.connect(); // ✅ ADICIONADO: client definido
  
  try {
    await client.query('BEGIN');
    
    const { email, codigo } = req.body;

    if (!email || !codigo) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'Email e código são obrigatórios' });
    }

    console.log(`🔍 VERIFICAÇÃO: Email: ${email}, Código: ${codigo}`);

    // Buscar usuário (por email corporativo ou pessoal)
    const userResult = await client.query(
      `SELECT id, nome, email, email_pessoal, tipo_colaborador, email_verificado 
       FROM usuarios 
       WHERE (tipo_colaborador = 'estagiario' AND email_pessoal = $1) 
          OR (tipo_colaborador = 'clt_associado' AND email = $1)`,
      [email]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = userResult.rows[0];

    if (user.email_verificado) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'Email já verificado' });
    }

    // ✅ CORRIGIDO: Usar client em vez de pool
    const tokenResult = await client.query(
      `SELECT v.*, u.nome, u.email, u.email_pessoal, u.tipo_colaborador 
       FROM verificacoes_email v
       JOIN usuarios u ON v.usuario_id = u.id
       WHERE v.token = $1 
         AND v.tipo_token = 'verificacao_email'
         AND v.usado_em IS NULL 
         AND v.expira_em > NOW()`,
      [codigo] // ✅ CORRIGIDO: usar 'codigo' em vez de 'token'
    );

    if (tokenResult.rows.length === 0) {
      console.log(`❌ VERIFICAÇÃO: Código inválido ou expirado para usuário ${user.id}`);
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ 
        error: 'Código inválido ou expirado. Solicite um novo código.' 
      });
    }

    const verification = tokenResult.rows[0];
    console.log(`✅ VERIFICAÇÃO: Código válido encontrado!`);

    // Marcar usuário como verificado
    await client.query(
      'UPDATE usuarios SET email_verificado = TRUE, verificado_em = NOW() WHERE id = $1',
      [user.id]
    );

    // Marcar token como usado
    await client.query(
      'UPDATE verificacoes_email SET usado_em = NOW() WHERE id = $1',
      [verification.id]
    );

    await client.query('COMMIT');

    // Gerar JWT para login automático após verificação
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.tipo_colaborador === 'estagiario' ? user.email_pessoal : user.email,
        tipo_usuario: 'usuario'
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    console.log(`🎉 VERIFICAÇÃO: Usuário ${user.id} verificado com sucesso!`);

    res.json({
      message: 'Email verificado com sucesso! Você foi logado automaticamente.',
      token,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        email_pessoal: user.email_pessoal,
        tipo_colaborador: user.tipo_colaborador,
        email_verificado: true
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro na verificação:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    client.release(); // ✅ ADICIONADO: sempre liberar conexão
  }
});

// NOVA ROTA: Validar email por token direto
app.get('/api/auth/validar-email/:token', async (req, res) => {
  try {
    const { token } = req.params;

    console.log(`🔍 VALIDAÇÃO: Processando token: ${token}`);

    // Buscar token (incluindo os expirados e usados para diagnóstico)
    const tokenResult = await pool.query(
      `SELECT v.*, u.nome, u.email_pessoal, u.tipo_colaborador, u.email_verificado
       FROM verificacoes_email v
       JOIN usuarios u ON v.usuario_id = u.id
       WHERE v.token = $1 AND v.tipo_token = 'verificacao_email'`,
      [token]
    );

    // Função para gerar o template HTML padrão
    const gerarTemplate = (titulo, icone, conteudo, botaoTexto = '🏠 Voltar ao Início', botaoUrl = null) => {
      const urlBotao = botaoUrl || `${process.env.API_BASE_URL || 'http://localhost:3001'}`;
      
      return `
        <html>
        <head>
          <meta charset="UTF-8">
          <title>${titulo} - RMH</title>
          <link href="https://fonts.googleapis.com/css2?family=Raleway:wght@400;600&family=Ruda:wght@900&display=swap" rel="stylesheet">
          <link rel="icon" type="image/png" href="/logo.png" sizes="32x32">
          <style>
            body { 
              font-family: 'Raleway', sans-serif; 
              background-color: #DADADA;
              color: #0d3638;
              margin: 0; padding: 20px; min-height: 100vh;
              display: flex; align-items: center; justify-content: center;
            }
            .container { 
              background: #f9f9f9; padding: 40px; border-radius: 16px; 
              box-shadow: 0 10px 30px rgba(0,0,0,0.08); text-align: center; 
              max-width: 500px; margin: 20px;
              animation: slideIn 0.5s ease-out;
            }
            @keyframes slideIn {
              from { opacity: 0; transform: translateY(-20px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .header {
              background-color: #165A5D;
              margin: -40px -40px 30px -40px;
              padding: 30px 40px;
              border-radius: 16px 16px 0 0;
              color: white;
            }
            .header h1 {
              font-family: 'Ruda', sans-serif;
              font-size: 24px;
              margin: 0;
              letter-spacing: 0.5px;
            }
            .icon { 
              font-size: 48px; 
              margin-bottom: 10px; 
              animation: bounce 1s;
            }
            @keyframes bounce {
              0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
              40% { transform: translateY(-10px); }
              60% { transform: translateY(-5px); }
            }
            h2 { 
              color: #0d3638; 
              margin: 20px 0; 
              font-family: 'Ruda', sans-serif; 
            }
            p { 
              color: #555; 
              line-height: 1.6; 
              margin: 15px 0; 
            }
            .info-box { 
              background: #EFEFEF; 
              padding: 15px; 
              border-radius: 10px; 
              border-left: 4px solid #165A5D; 
              margin: 20px 0; 
              text-align: left;
            }
            .success-box {
              background: #e8f5e8; 
              padding: 15px; 
              border-radius: 10px; 
              border-left: 4px solid #27ae60; 
              margin: 20px 0;
            }
            .warning-box {
              background: #fff3cd; 
              padding: 15px; 
              border-radius: 10px; 
              border-left: 4px solid #f39c12; 
              margin: 20px 0;
            }
            .error-box {
              background: #fdf2f2; 
              padding: 15px; 
              border-radius: 10px; 
              border-left: 4px solid #e74c3c; 
              margin: 20px 0;
            }
            .contact { 
              background: #e3f2fd; 
              padding: 15px; 
              border-radius: 10px; 
              margin: 20px 0; 
              border-left: 4px solid #165A5D;
            }
            .button {
              background: #165A5D; 
              color: white; 
              padding: 15px 30px;
              text-decoration: none; 
              border-radius: 8px; 
              display: inline-block;
              margin: 20px 10px; 
              transition: all 0.3s; 
              font-weight: 600;
            }
            .button:hover { 
              background: #0d3638; 
              transform: translateY(-2px);
            }
            .badge {
              display: inline-block;
              padding: 6px 12px;
              background-color: #165A5D;
              color: white;
              border-radius: 20px;
              font-size: 14px;
              font-weight: 600;
              margin: 10px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="icon">${icone}</div>
              <h1>${titulo}</h1>
            </div>
            ${conteudo}
            <a href="${urlBotao}" class="button">
              ${botaoTexto}
            </a>
          </div>
        </body>
        </html>
      `;
    };

    if (tokenResult.rows.length === 0) {
      const conteudo = `
        <h2>Link de Validação Inválido</h2>
        <p>Este link de validação não foi encontrado em nossa base de dados.</p>
        
        <div class="error-box">
          <strong>❌ Motivo:</strong> Token inexistente ou inválido
        </div>
        
        <div class="contact">
          <strong>💡 O que fazer:</strong><br>
          • Verifique se copiou o link completo<br>
          • Solicite um novo link de verificação<br>
          • Entre em contato com o administrador
        </div>
      `;
      
      return res.status(400).send(gerarTemplate('Token Não Encontrado', '🔍', conteudo));
    }

    const verification = tokenResult.rows[0];
    const agora = new Date();
    const expirou = new Date(verification.expira_em) < agora;
    const jaUsado = verification.usado_em !== null;
    const usuarioJaVerificado = verification.email_verificado;

    console.log(`📊 DIAGNÓSTICO:`, {
      token_encontrado: true,
      expirou: expirou,
      ja_usado: jaUsado,
      usuario_ja_verificado: usuarioJaVerificado,
      expira_em: verification.expira_em,
      usado_em: verification.usado_em,
      criado_em: verification.criado_em
    });

    // VERIFICAR CONDIÇÕES DE ERRO
    if (usuarioJaVerificado) {
      const conteudo = `
        <h2>Olá, ${verification.nome}!</h2>
        <div class="badge">${verification.tipo_colaborador === 'estagiario' ? 'Estagiário' : 'CLT/Associado'}</div>
        <p>Sua conta já foi verificada anteriormente e está ativa.</p>
        
        <div class="success-box">
          <strong>Status:</strong> Email já verificado<br>
          <strong>Email:</strong> ${verification.email_pessoal}<br>
          <strong>Tipo:</strong> ${verification.tipo_colaborador === 'estagiario' ? 'Estagiário' : 'CLT/Associado'}
        </div>
        
        <p>Você já pode fazer login na plataforma!</p>
      `;
      
      return res.status(400).send(gerarTemplate('Conta Já Ativada', '✅', conteudo, '🚀 Acessar Plataforma'));
    }

    if (jaUsado) {
      const dataUso = new Date(verification.usado_em).toLocaleString('pt-BR');
      
      const conteudo = `
        <h2>Olá, ${verification.nome}!</h2>
        <div class="badge">${verification.tipo_colaborador === 'estagiario' ? 'Estagiário' : 'CLT/Associado'}</div>
        <p>Este link de validação já foi usado anteriormente.</p>
        
        <div class="warning-box">
          <strong>Motivo:</strong> Link já utilizado<br>
          <strong>Usado em:</strong> ${dataUso}<br>
          <strong>Usuário:</strong> ${verification.nome}
        </div>
        
        <div class="contact">
          <strong>O que fazer:</strong><br>
          • Tente fazer login normalmente<br>
          • Se não conseguir, solicite um novo link<br>
          • Entre em contato com o administrador se precisar
        </div>
      `;
      
      return res.status(400).send(gerarTemplate('Link Já Utilizado', '🔒', conteudo, '🚀 Tentar Login'));
    }

    if (expirou) {
      const dataExpiracao = new Date(verification.expira_em).toLocaleString('pt-BR');
      const horasAtrasado = Math.floor((agora - new Date(verification.expira_em)) / (1000 * 60 * 60));
      
      const conteudo = `
        <h2>Olá, ${verification.nome}!</h2>
        <div class="badge">${verification.tipo_colaborador === 'estagiario' ? 'Estagiário' : 'CLT/Associado'}</div>
        <p>Este link de validação expirou e não pode mais ser usado.</p>
        
        <div class="error-box">
          <strong>Motivo:</strong> Link expirado<br>
          <strong>Expirou em:</strong> ${dataExpiracao}<br>
          <strong>Há:</strong> ${horasAtrasado} hora(s) atrás<br>
          <strong>Usuário:</strong> ${verification.nome}
        </div>
        
        <div class="contact">
          <strong>O que fazer:</strong><br>
          • Solicite um novo link de verificação<br>
          • Entre em contato com o administrador<br>
          • Use a opção "Reenviar código" no login
        </div>
      `;
      
      return res.status(400).send(gerarTemplate('Link Expirado', '⏰', conteudo, '🔄 Solicitar Novo Link'));
    }

    // SE CHEGOU ATÉ AQUI, O TOKEN É VÁLIDO - PROCESSAR VERIFICAÇÃO
    await pool.query('BEGIN');
    
    await pool.query(
      'UPDATE usuarios SET email_verificado = true WHERE id = $1',
      [verification.usuario_id]
    );

    await pool.query(
      'UPDATE verificacoes_email SET usado_em = NOW() WHERE token = $1',
      [token]
    );

    await pool.query('COMMIT');

    console.log(`✅ Email validado automaticamente para: ${verification.email_pessoal}`);

    // PÁGINA DE SUCESSO
    const conteudoSucesso = `
      <h2>Parabéns, ${verification.nome}!</h2>
      <div class="badge">${verification.tipo_colaborador === 'estagiario' ? 'Estagiário' : 'CLT/Associado'}</div>
      <p>Seu email foi verificado automaticamente e sua conta está ativa.</p>
      <p>Agora você pode fazer login na plataforma com suas credenciais!</p>
    `;

    res.send(gerarTemplate('Email Verificado com Sucesso!', '🎉', conteudoSucesso, 'Acessar Plataforma'));

  } catch (error) {
    console.error('❌ Erro na validação automática:', error);
    
    const conteudoErro = `
      <h2>Erro Interno do Servidor</h2>
      <p>Ocorreu um erro inesperado ao processar sua solicitação.</p>
      
      <div class="error-box">
        <strong>🔧 Situação:</strong> Erro interno do sistema<br>
        <strong>💡 Recomendação:</strong> Tente novamente em alguns instantes
      </div>
      
      <p>Se o problema persistir, entre em contato com o administrador.</p>
    `;
    
    res.status(500).send(gerarTemplate('Erro Interno', '⚠️', conteudoErro));
  }
});

// LOGIN ATUALIZADO
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { error, value } = schemaLogin.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, senha } = value;

    console.log(`🔑 LOGIN: Tentativa com email: ${email}`);

    // Buscar usuário por email (corporativo ou pessoal dependendo do tipo)
    const result = await pool.query(
      `SELECT id, nome, email, email_pessoal, senha, setor, tipo_usuario, tipo_colaborador, 
              email_verificado, COALESCE(is_coordenador, false) as is_coordenador
       FROM usuarios 
       WHERE (tipo_colaborador = 'estagiario' AND email_pessoal = $1) 
          OR (tipo_colaborador = 'clt_associado' AND email = $1)`,
      [email]
    );

    if (result.rows.length === 0) {
      console.log(`❌ LOGIN: Usuário não encontrado para email: ${email}`);
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    const user = result.rows[0];
    console.log(`🔍 LOGIN: Usuário encontrado - Tipo: ${user.tipo_colaborador}, Coordenador: ${user.is_coordenador}`);

    // Verificar senha
    const senhaValida = await bcrypt.compare(senha, user.senha);
    if (!senhaValida) {
      console.log(`❌ LOGIN: Senha inválida para: ${email}`);
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    // Verificar se email foi verificado
    if (!user.email_verificado) {
      const emailLogin = user.tipo_colaborador === 'estagiario' ? user.email_pessoal : user.email;
      console.log(`⚠️ LOGIN: Email não verificado: ${emailLogin}`);
      return res.status(401).json({ 
        error: 'Email não verificado. Verifique sua caixa de entrada.',
        verification_required: true,
        user_email: emailLogin,
        tipo_colaborador: user.tipo_colaborador
      });
    }

    // Atualizar último login
    await pool.query(
      'UPDATE usuarios SET ultimo_login = NOW() WHERE id = $1',
      [user.id]
    );

    // Gerar JWT
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.tipo_colaborador === 'estagiario' ? user.email_pessoal : user.email,
        tipo_usuario: user.tipo_usuario 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    console.log(`✅ LOGIN: Sucesso para usuário ID: ${user.id}`);

    res.json({
      message: 'Login realizado com sucesso',
      token,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        email_pessoal: user.email_pessoal,
        setor: user.setor,
        tipo_usuario: user.tipo_usuario,
        tipo_colaborador: user.tipo_colaborador,
        is_coordenador: user.is_coordenador // ✅ ADICIONADO
      }
    });

  } catch (error) {
    console.error('❌ Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ROTA PARA REENVIAR CÓDIGO DE VERIFICAÇÃO ATUALIZADA
const resendLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutos
  max: 3, // máximo 3 tentativas por 2 minutos
  message: { error: 'Muitas tentativas de reenvio. Aguarde 2 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit por email, não por IP
    return req.body.email || req.ip;
  }
});

// ===============================================
// ROTAS PROTEGIDAS - PERFIL E DASHBOARDS
// ===============================================

// PERFIL DO USUÁRIO ATUALIZADO
app.get('/api/auth/profile', authMiddleware, (req, res) => {
 console.log('🔐 PERFIL: Acesso autorizado para usuário:', req.user.id);
 
 res.json({
   user: {
     id: req.user.id,
     nome: req.user.nome,
     email: req.user.email,
     email_pessoal: req.user.email_pessoal,
     setor: req.user.setor,
     tipo_usuario: req.user.tipo_usuario,
     tipo_colaborador: req.user.tipo_colaborador,
     email_verificado: req.user.email_verificado,
     is_coordenador: req.user.is_coordenador // ✅ ADICIONADO
   }
 });
});

// LOGOUT (opcional - apenas limpa token no frontend)
app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  try {
    // Atualizar último logout no banco (opcional)
    await pool.query(
      'UPDATE usuarios SET ultimo_logout = NOW() WHERE id = $1',
      [req.user.id]
    );

    console.log(`👋 LOGOUT: Usuário ${req.user.id} saiu do sistema`);
    
    res.json({ 
      message: 'Logout realizado com sucesso',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Erro no logout:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.get('/api/auth/validar-token-configuracao-senha/:token', async (req, res) => {
  try {
    const { token } = req.params;

    console.log(`🔍 VALIDAR TOKEN: ${token.substring(0, 8)}...`);

    // Buscar token válido
    const tokenResult = await pool.query(
      `SELECT v.*, u.nome, u.email, u.email_pessoal, u.tipo_colaborador, u.email_verificado
       FROM verificacoes_email v
       JOIN usuarios u ON v.usuario_id = u.id
       WHERE v.token = $1 
         AND v.tipo_token = 'configuracao_senha' 
         AND v.usado_em IS NULL 
         AND v.expira_em > NOW()`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'Token inválido ou expirado' });
    }

    const verification = tokenResult.rows[0];

    if (verification.email_verificado) {
      return res.status(400).json({ error: 'Esta conta já foi configurada' });
    }

    res.json({
      valido: true,
      usuario: {
        nome: verification.nome,
        email_login: verification.tipo_colaborador === 'estagiario' ? verification.email_pessoal : verification.email,
        tipo_colaborador: verification.tipo_colaborador
      }
    });

  } catch (error) {
    console.error('❌ Erro ao validar token:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===============================================
// ROTAS DE DASHBOARDS (PROTEGIDAS)
// ===============================================

app.get('/api/dashboards', authMiddleware, async (req, res) => {
  try {
    console.log(`📊 DASHBOARDS: Listando para usuário ${req.user.id} (${req.user.tipo_colaborador}, ${req.user.tipo_usuario})`);
    console.log(`🔍 DEBUG: is_coordenador = ${req.user.is_coordenador}`);
    
    let query;
    let params = [];

    // ADMINS veem TODOS os dashboards
    if (req.user.tipo_usuario === 'admin') {
      console.log('🔧 ADMIN: Buscando todos os dashboards');
      query = `
        SELECT 
          d.id, d.titulo, d.descricao, d.setor, d.url_iframe, 
          d.ativo, d.largura, d.altura, d.criado_por, 
          d.criado_em, d.atualizado_em,
          d.tipo_visibilidade, d.powerbi_report_id, d.powerbi_group_id, d.embed_type,
          u.nome as criado_por_nome
        FROM dashboards d
        LEFT JOIN usuarios u ON d.criado_por = u.id
        WHERE d.ativo = true
        ORDER BY d.criado_em DESC
      `;
    } else {
      // USUÁRIOS NORMAIS: baseado no tipo_visibilidade
      console.log(`👤 USUÁRIO: Buscando dashboards para setor: ${req.user.setor}`);
      console.log(`👑 COORDENADOR: ${req.user.is_coordenador ? 'SIM' : 'NÃO'}`);
      
      query = `
        SELECT 
          d.id, d.titulo, d.descricao, d.setor, d.url_iframe, 
          d.ativo, d.largura, d.altura, d.criado_por, 
          d.criado_em, d.atualizado_em,
          d.tipo_visibilidade, d.powerbi_report_id, d.powerbi_group_id, d.embed_type,
          u.nome as criado_por_nome
        FROM dashboards d
        LEFT JOIN usuarios u ON d.criado_por = u.id
        WHERE d.ativo = true 
          AND d.setor = $1
          AND (
            d.tipo_visibilidade = 'geral'
            OR (d.tipo_visibilidade = 'coordenadores' AND $2 = true)
          )
        ORDER BY d.criado_em DESC
      `;
      params = [req.user.setor, req.user.is_coordenador];
    }

    const result = await pool.query(query, params);
    const dashboards = result.rows;

    console.log(`📊 DASHBOARDS: Encontrados ${dashboards.length} dashboards para setor ${req.user.setor}`);
    console.log(`🔍 DASHBOARDS DEBUG:`, dashboards.map(d => ({
      titulo: d.titulo,
      setor: d.setor,
      tipo_visibilidade: d.tipo_visibilidade
    })));
    
    // ✅ DEBUG: Log de dashboards com Power BI
    const dashboardsComPowerBI = dashboards.filter(d => d.powerbi_report_id && d.powerbi_group_id);
    console.log(`🔐 DASHBOARDS SEGUROS: ${dashboardsComPowerBI.length} dashboards com Power BI configurado`);
    
    if (dashboardsComPowerBI.length > 0) {
      console.log('📋 Dashboards seguros:', dashboardsComPowerBI.map(d => ({
        titulo: d.titulo,
        setor: d.setor,
        tipo_visibilidade: d.tipo_visibilidade,
        embed_type: d.embed_type,
        reportId: d.powerbi_report_id?.substring(0, 8) + '...',
        groupId: d.powerbi_group_id?.substring(0, 8) + '...'
      })));
    }

    res.json({
      dashboards: dashboards || [],
      user_info: {
        id: req.user.id,
        nome: req.user.nome,
        tipo_colaborador: req.user.tipo_colaborador,
        tipo_usuario: req.user.tipo_usuario,
        setor: req.user.setor,
        is_coordenador: req.user.is_coordenador, // ✅ ADICIONAR PARA DEBUG
        total_dashboards: dashboards.length,
        dashboards_seguros: dashboardsComPowerBI.length,
        is_admin: req.user.tipo_usuario === 'admin'
      }
    });

  } catch (error) {
    console.error('❌ Erro ao listar dashboards:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      dashboards: [] // Fallback vazio
    });
  }
});

// CRIAR NOVO DASHBOARD (só para admins)
const extractPowerBIReportId = (url) => {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    // Padrões de regex para diferentes formatos de URL do Power BI
    
    // Formato 1: reportEmbed?reportId=xxx
    const embedPattern = /reportId=([a-f0-9-]{36})/i;
    
    // Formato 2: /groups/xxx/reports/xxx/
    const groupsPattern = /\/groups\/[a-f0-9-]{36}\/reports\/([a-f0-9-]{36})/i;
    
    // Formato 3: /reports/xxx/
    const reportPattern = /\/reports\/([a-f0-9-]{36})/i;

    // Tentar diferentes padrões
    let match = embedPattern.exec(url);
    if (match) {
      console.log('🔍 Report ID encontrado via embedPattern:', match[1]);
      return match[1];
    }
    
    match = groupsPattern.exec(url);
    if (match) {
      console.log('🔍 Report ID encontrado via groupsPattern:', match[1]);
      return match[1];
    }
    
    match = reportPattern.exec(url);
    if (match) {
      console.log('🔍 Report ID encontrado via reportPattern:', match[1]);
      return match[1];
    }

    console.log('⚠️ Nenhum Report ID encontrado na URL:', url.substring(0, 100));
    return null;

  } catch (error) {
    console.error('❌ Erro ao extrair Report ID:', error);
    return null;
  }
};

// ✅ ROTA ATUALIZADA COM EXTRAÇÃO AUTOMÁTICA
app.post('/api/dashboards', authMiddleware, async (req, res) => {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ 
        error: 'Apenas administradores podem criar dashboards' 
      });
    }

    const { titulo, descricao, setor, url_iframe, largura, altura, tipo_visibilidade } = req.body;

    if (!titulo || !setor || !url_iframe) {
      return res.status(400).json({
        error: 'Título, setor e URL são obrigatórios'
      });
    }

    // ✅ EXTRAÇÃO AUTOMÁTICA DO POWER BI REPORT ID
    const powerbi_report_id = extractPowerBIReportId(url_iframe);
    
    // ✅ GROUP ID PADRÃO FIXO
    const powerbi_group_id = '24735d42-c43d-423c-83d4-f2cd4e8cdb29';
    
    // ✅ DETERMINAR TIPO DE EMBED
    const embed_type = powerbi_report_id ? 'secure' : 'public';

    console.log('📊 Criando dashboard:', {
      titulo,
      setor,
      powerbi_report_id: powerbi_report_id || 'não encontrado',
      powerbi_group_id,
      embed_type,
      tipo_visibilidade
    });

    // ✅ QUERY ATUALIZADA COM NOVOS CAMPOS
    const result = await pool.query(`
      INSERT INTO dashboards (
        titulo, descricao, setor, url_iframe, largura, altura, 
        criado_por, ativo, tipo_visibilidade,
        powerbi_report_id, powerbi_group_id, embed_type
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      titulo,
      descricao,
      setor,
      url_iframe,
      largura || 800,
      altura || 600,
      req.user.id,
      true,
      tipo_visibilidade || 'geral',
      powerbi_report_id,      // ✅ NOVO
      powerbi_group_id,       // ✅ NOVO (sempre o mesmo)
      embed_type              // ✅ NOVO
    ]);

    const newDashboard = result.rows[0];

    console.log(`✅ DASHBOARD CRIADO: ${titulo} por ${req.user.nome}`);
    console.log(`   📋 Visibilidade: ${tipo_visibilidade}`);
    console.log(`   🔐 Embed Type: ${embed_type}`);
    console.log(`   📊 Report ID: ${powerbi_report_id || 'N/A'}`);

    res.status(201).json({
      message: 'Dashboard criado com sucesso',
      dashboard: {
        ...newDashboard,
        // ✅ INCLUIR INFORMAÇÕES SOBRE A EXTRAÇÃO NA RESPOSTA
        extraction_info: {
          powerbi_report_id_extracted: !!powerbi_report_id,
          embed_type_determined: embed_type,
          using_default_group_id: true
        }
      }
    });

  } catch (error) {
    console.error('❌ Erro ao criar dashboard:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ✅ TAMBÉM ATUALIZAR A ROTA DE UPDATE (SE EXISTIR)
app.put('/api/dashboards/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ 
        error: 'Apenas administradores podem editar dashboards' 
      });
    }

    const { id } = req.params;
    const { titulo, descricao, setor, url_iframe, largura, altura, tipo_visibilidade } = req.body;

    if (!titulo || !setor || !url_iframe) {
      return res.status(400).json({
        error: 'Título, setor e URL são obrigatórios'
      });
    }

    // ✅ EXTRAÇÃO AUTOMÁTICA DO POWER BI REPORT ID
    const powerbi_report_id = extractPowerBIReportId(url_iframe);
    
    // ✅ GROUP ID PADRÃO FIXO
    const powerbi_group_id = '24735d42-c43d-423c-83d4-f2cd4e8cdb29';
    
    // ✅ DETERMINAR TIPO DE EMBED
    const embed_type = powerbi_report_id ? 'secure' : 'public';

    console.log('📊 Atualizando dashboard:', {
      id,
      titulo,
      powerbi_report_id: powerbi_report_id || 'não encontrado',
      embed_type
    });

    const result = await pool.query(`
      UPDATE dashboards 
      SET titulo = $1, descricao = $2, setor = $3, url_iframe = $4, 
          largura = $5, altura = $6, tipo_visibilidade = $7,
          powerbi_report_id = $8, powerbi_group_id = $9, embed_type = $10,
          atualizado_em = NOW()
      WHERE id = $11 AND ativo = true
      RETURNING *
    `, [
      titulo,
      descricao,
      setor,
      url_iframe,
      largura || 800,
      altura || 600,
      tipo_visibilidade || 'geral',
      powerbi_report_id,      // ✅ NOVO
      powerbi_group_id,       // ✅ NOVO
      embed_type,             // ✅ NOVO
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dashboard não encontrado' });
    }

    const updatedDashboard = result.rows[0];

    console.log(`✅ DASHBOARD ATUALIZADO: ${titulo}`);
    console.log(`   🔐 Embed Type: ${embed_type}`);
    console.log(`   📊 Report ID: ${powerbi_report_id || 'N/A'}`);

    res.json({
      message: 'Dashboard atualizado com sucesso',
      dashboard: {
        ...updatedDashboard,
        extraction_info: {
          powerbi_report_id_extracted: !!powerbi_report_id,
          embed_type_determined: embed_type,
          using_default_group_id: true
        }
      }
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar dashboard:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETAR DASHBOARD
app.delete('/api/dashboards/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se o dashboard existe
    const checkResult = await pool.query(
      'SELECT * FROM dashboards WHERE id = $1', 
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dashboard não encontrado' });
    }

    const dashboard = checkResult.rows[0];

    // Verificar permissões
    if (req.user.tipo_usuario !== 'admin' && dashboard.criado_por !== req.user.id) {
      return res.status(403).json({
        error: 'Você não tem permissão para deletar este dashboard'
      });
    }

    // Soft delete (marcar como inativo)
    await pool.query(
      'UPDATE dashboards SET ativo = false, atualizado_em = NOW() WHERE id = $1',
      [id]
    );

    console.log(`🗑️ DASHBOARD: ${dashboard.titulo} deletado por ${req.user.nome}`);

    res.json({
      message: 'Dashboard deletado com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao deletar dashboard:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

const axios = require('axios');

// ✅ CONFIGURAÇÕES DO AZURE AD (com validação)
const POWERBI_CONFIG = {
  clientId: process.env.POWERBI_CLIENT_ID || '7eab07c0-eae6-422b-a44a-1030d96e7eab',
  clientSecret: process.env.POWERBI_CLIENT_SECRET,
  tenantId: process.env.AZURE_TENANT_ID,
  scope: 'https://analysis.windows.net/powerbi/api/.default',
  authorityHost: 'https://login.microsoftonline.com'
};

// ✅ VALIDAÇÃO DE CONFIGURAÇÃO NO STARTUP
const validatePowerBIConfig = () => {
  const missing = [];
  if (!POWERBI_CONFIG.clientSecret) missing.push('POWERBI_CLIENT_SECRET');
  if (!POWERBI_CONFIG.tenantId) missing.push('AZURE_TENANT_ID');
  
  if (missing.length > 0) {
    console.warn(`⚠️ Power BI: Configurações ausentes: ${missing.join(', ')}`);
    console.warn('📝 Embed seguro será desabilitado. Configure as variáveis no .env');
    return false;
  }
  
  console.log('✅ Power BI: Configurações validadas com sucesso');
  return true;
};

// Cache de tokens para otimização
const tokenCache = new Map();
const TOKEN_CACHE_DURATION = 50 * 60 * 1000; // 50 minutos

// ✅ FUNÇÃO OTIMIZADA PARA OBTER TOKEN DE ACESSO
async function getPowerBIAccessToken() {
  const cacheKey = 'powerbi_access_token';
  const cached = tokenCache.get(cacheKey);
  
  // Verificar cache válido
  if (cached && Date.now() < cached.expires) {
    console.log('🔄 Usando token de acesso em cache');
    return cached.token;
  }

  try {
    console.log('🔐 Obtendo novo token de acesso do Azure AD (CLIENT CREDENTIALS)...');
    
    const tokenUrl = `${POWERBI_CONFIG.authorityHost}/${POWERBI_CONFIG.tenantId}/oauth2/v2.0/token`;
    
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: POWERBI_CONFIG.clientId,
      client_secret: POWERBI_CONFIG.clientSecret,
      scope: POWERBI_CONFIG.scope
    });

    // ✅ DEBUG CRÍTICO: Verificar configurações
    console.log('🎯 Token request details:', {
      url: tokenUrl,
      grant_type: 'client_credentials',
      client_id: POWERBI_CONFIG.clientId,
      tenant_id: POWERBI_CONFIG.tenantId,
      has_client_secret: !!POWERBI_CONFIG.clientSecret,
      client_secret_length: POWERBI_CONFIG.clientSecret?.length,
      scope: POWERBI_CONFIG.scope
    });

    const response = await axios.post(tokenUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000
    });

    const token = response.data.access_token;
    const expiresIn = response.data.expires_in || 3600;
    
    // Cache do token
    tokenCache.set(cacheKey, {
      token,
      expires: Date.now() + (expiresIn - 600) * 1000
    });

    // ✅ DEBUG CRÍTICO: Verificar resposta
    console.log('✅ Token CLIENT CREDENTIALS obtido com sucesso');
    console.log('🔑 Token details:', {
      token_type: response.data.token_type,
      expires_in: expiresIn,
      scope: response.data.scope,
      token_prefix: token.substring(0, 50) + '...',
      token_length: token.length
    });
    
    return token;
    
  } catch (error) {
    console.error('❌ Erro ao obter token CLIENT CREDENTIALS:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: error.config?.url,
      method: error.config?.method
    });
    
    // ✅ DEBUG ESPECÍFICO PARA AZURE AD
    if (error.response?.status === 400) {
      console.error('🔐 ERRO 400 - Parâmetros inválidos:', {
        possible_causes: [
          'Client Secret incorreto',
          'Client ID incorreto', 
          'Tenant ID incorreto',
          'Scope inválido'
        ],
        current_config: {
          clientId: POWERBI_CONFIG.clientId,
          tenantId: POWERBI_CONFIG.tenantId,
          scope: POWERBI_CONFIG.scope,
          hasSecret: !!POWERBI_CONFIG.clientSecret
        }
      });
    }
    
    tokenCache.delete(cacheKey);
    throw new Error('Falha na autenticação CLIENT CREDENTIALS com Azure AD');
  }
}

// ✅ FUNÇÃO OTIMIZADA PARA GERAR TOKEN DE EMBED
async function generateEmbedToken(accessToken, groupId, reportId, userIdentity = null) {
  try {
    console.log(`🎯 Gerando token de embed para report: ${reportId.substring(0, 8)}...`);
    
    const embedUrl = `https://api.powerbi.com/v1.0/myorg/groups/${groupId}/reports/${reportId}/GenerateToken`;
    
    const embedData = {
      accessLevel: 'View',
      allowSaveAs: false,
      identities: userIdentity ? [userIdentity] : [] // Para RLS se necessário
    };

    const response = await axios.post(embedUrl, embedData, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 segundos timeout
    });

    console.log('✅ Token de embed gerado com sucesso');
    return response.data;
    
  } catch (error) {
    console.error('❌ Erro ao gerar token de embed:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      reportId: reportId.substring(0, 8) + '...'
    });
    
    // Diferentes tipos de erro
    if (error.response?.status === 404) {
      throw new Error('Relatório não encontrado no workspace especificado');
    } else if (error.response?.status === 403) {
      throw new Error('Sem permissão para acessar este relatório');
    } else {
      throw new Error('Falha ao gerar token de embed');
    }
  }
}

// ✅ FUNÇÃO MELHORADA PARA VERIFICAR ACESSO
async function checkUserDashboardAccess(userId, dashboardId) {
  try {
    const result = await pool.query(`
      SELECT 
        d.id,
        d.titulo,
        d.setor,
        d.tipo_visibilidade,
        d.powerbi_report_id,
        d.powerbi_group_id,
        u.tipo_usuario,
        u.setor as user_setor,
        u.is_coordenador
      FROM dashboards d
      CROSS JOIN usuarios u
      WHERE d.id = $1 
        AND u.id = $2
        AND d.ativo = true
        AND (
          -- Admin pode ver tudo
          u.tipo_usuario = 'admin'
          
          -- Dashboard com visibilidade 'geral' - TODOS podem ver
          OR d.tipo_visibilidade = 'geral'
          
          -- Dashboard com visibilidade 'coordenadores' - apenas coordenadores e admins
          OR (d.tipo_visibilidade = 'coordenadores' AND (u.is_coordenador = true OR u.tipo_usuario = 'admin'))
          
          -- Dashboard com visibilidade 'admin' - apenas admins
          OR (d.tipo_visibilidade = 'admin' AND u.tipo_usuario = 'admin')
          
          -- Mesmo setor (para compatibilidade com dashboards antigos)
          OR d.setor = u.setor
          
          -- Dashboards legados com setor 'Geral' ou 'Todos'
          OR d.setor = 'Geral'
          OR d.setor = 'Todos'
        )
    `, [dashboardId, userId]);

    const hasAccess = result.rows.length > 0;
    
    if (hasAccess) {
      const dashboard = result.rows[0];
      console.log(`✅ Usuário ${userId} tem acesso ao dashboard "${dashboard.titulo}"`);
      console.log(`📊 Dashboard: setor="${dashboard.setor}", visibilidade="${dashboard.tipo_visibilidade}"`);
      return dashboard;
    } else {
      console.log(`❌ Usuário ${userId} não tem acesso ao dashboard ${dashboardId}`);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar acesso:', error);
    return null;
  }
}

app.post('/api/powerbi/embed-token', authMiddleware, async (req, res) => {
  const debugInfo = {
    timestamp: new Date().toISOString(),
    requestId: Math.random().toString(36).substring(7),
    user: req.user ? { id: req.user.id, nome: req.user.nome, setor: req.user.setor } : 'undefined'
  };

  try {
    console.log(`\n🔐 ========== POWER BI EMBED TOKEN REQUEST (${debugInfo.requestId}) ==========`);
    console.log(`👤 Usuário: ${req.user.nome} (ID: ${req.user.id})`);
    console.log(`📧 Email: ${req.user.email}`);
    console.log(`🏢 Setor: ${req.user.setor}`);
    console.log(`⏰ Timestamp: ${debugInfo.timestamp}`);
    
    const { reportId, groupId, dashboardId } = req.body;
    console.log(`📥 Request Body:`, {
      reportId: reportId || 'não fornecido',
      groupId: groupId || 'não fornecido', 
      dashboardId: dashboardId || 'não fornecido'
    });

    // ✅ VALIDAÇÃO 1: Dashboard ID
    if (!dashboardId) {
      console.log(`❌ VALIDAÇÃO FALHOU: dashboardId ausente`);
      return res.status(400).json({ 
        error: 'dashboardId é obrigatório',
        code: 'MISSING_DASHBOARD_ID',
        debugInfo
      });
    }
    console.log(`✅ VALIDAÇÃO 1: dashboardId presente: ${dashboardId}`);

    // ✅ VALIDAÇÃO 2: Configuração Power BI
    const configValid = validatePowerBIConfig();
    console.log(`🔧 VALIDAÇÃO 2: Configuração Power BI:`, {
      valid: configValid,
      clientId: POWERBI_CONFIG.clientId,
      hasClientSecret: !!POWERBI_CONFIG.clientSecret,
      hasTenantId: !!POWERBI_CONFIG.tenantId,
      scope: POWERBI_CONFIG.scope
    });

    if (!configValid) {
      console.log(`❌ CONFIGURAÇÃO INVÁLIDA: Power BI não configurado`);
      return res.status(503).json({ 
        error: 'Serviço de embed seguro não está configurado',
        code: 'POWERBI_NOT_CONFIGURED',
        fallback: true,
        debugInfo
      });
    }

    // ✅ VALIDAÇÃO 3: Permissões do usuário
    console.log(`🔍 VALIDAÇÃO 3: Verificando acesso do usuário ao dashboard...`);
    const dashboardAccess = await checkUserDashboardAccess(req.user.id, dashboardId);
    
    console.log(`📊 Dashboard Access Result:`, {
      hasAccess: !!dashboardAccess,
      dashboard: dashboardAccess ? {
        id: dashboardAccess.id,
        titulo: dashboardAccess.titulo,
        setor: dashboardAccess.setor,
        powerbi_report_id: dashboardAccess.powerbi_report_id,
        powerbi_group_id: dashboardAccess.powerbi_group_id,
        user_setor: dashboardAccess.user_setor,
        user_tipo: dashboardAccess.tipo_usuario
      } : null
    });

    if (!dashboardAccess) {
      console.log(`❌ ACESSO NEGADO: Usuário não tem permissão para dashboard ${dashboardId}`);
      return res.status(403).json({ 
        error: 'Usuário não tem permissão para acessar este dashboard',
        code: 'ACCESS_DENIED',
        debugInfo
      });
    }

    // ✅ VALIDAÇÃO 4: IDs do Power BI
    const finalReportId = reportId || dashboardAccess.powerbi_report_id;
    const finalGroupId = groupId || dashboardAccess.powerbi_group_id;

    console.log(`🎯 VALIDAÇÃO 4: IDs finais do Power BI:`, {
      finalReportId: finalReportId || 'AUSENTE',
      finalGroupId: finalGroupId || 'AUSENTE',
      source: {
        reportId_from: reportId ? 'request' : 'database',
        groupId_from: groupId ? 'request' : 'database'
      }
    });

    if (!finalReportId || !finalGroupId) {
      console.log(`❌ CONFIGURAÇÃO INCOMPLETA: Faltam IDs do Power BI`);
      return res.status(400).json({ 
        error: 'Dashboard não está configurado para embed seguro',
        code: 'MISSING_POWERBI_CONFIG',
        missing: {
          reportId: !finalReportId,
          groupId: !finalGroupId
        },
        debugInfo
      });
    }

    // ✅ ETAPA 5: Obter Access Token
    console.log(`\n🔑 ETAPA 5: Obtendo Access Token do Azure AD...`);
    const accessTokenStart = Date.now();
    const accessToken = await getPowerBIAccessToken();
    const accessTokenTime = Date.now() - accessTokenStart;
    
    console.log(`✅ Access Token obtido:`, {
      time_ms: accessTokenTime,
      token_prefix: accessToken.substring(0, 30) + '...',
      token_length: accessToken.length,
      cached: accessTokenTime < 100 // Se foi muito rápido, provavelmente veio do cache
    });

    // ✅ ETAPA 6: Gerar Embed Token
    console.log(`\n🎫 ETAPA 6: Gerando Embed Token...`);
    console.log(`📍 Power BI API Request:`, {
      url: `https://api.powerbi.com/v1.0/myorg/groups/${finalGroupId}/reports/${finalReportId}/GenerateToken`,
      method: 'POST',
      reportId: finalReportId,
      groupId: finalGroupId,
      hasAccessToken: !!accessToken
    });

    const embedTokenStart = Date.now();
    const embedToken = await generateEmbedToken(accessToken, finalGroupId, finalReportId);
    const embedTokenTime = Date.now() - embedTokenStart;
    
    console.log(`✅ Embed Token gerado com sucesso:`, {
      time_ms: embedTokenTime,
      token_prefix: embedToken.token.substring(0, 30) + '...',
      expiration: embedToken.expiration,
      tokenId: embedToken.tokenId || 'não fornecido'
    });
    
    // ✅ RESPOSTA FINAL
    const response = {
      accessToken: embedToken.token,
      tokenType: 'Bearer',
      expiration: embedToken.expiration,
      reportId: finalReportId,
      groupId: finalGroupId,
      embedUrl: `https://app.powerbi.com/reportEmbed?reportId=${finalReportId}&groupId=${finalGroupId}`,
      generatedAt: new Date().toISOString(),
      validFor: 60, // minutos
      user: {
        id: req.user.id,
        nome: req.user.nome,
        setor: req.user.setor
      },
      dashboard: {
        id: dashboardAccess.id,
        titulo: dashboardAccess.titulo,
        setor: dashboardAccess.setor
      },
      debug: {
        requestId: debugInfo.requestId,
        totalTime_ms: Date.now() - new Date(debugInfo.timestamp).getTime(),
        accessTokenTime_ms: accessTokenTime,
        embedTokenTime_ms: embedTokenTime
      }
    };

    const totalTime = Date.now() - new Date(debugInfo.timestamp).getTime();
    console.log(`\n🎉 SUCESSO COMPLETO (${debugInfo.requestId}):`, {
      dashboard: dashboardAccess.titulo,
      usuario: req.user.nome,
      totalTime_ms: totalTime,
      embedUrl: response.embedUrl
    });
    console.log(`========== FIM REQUEST ${debugInfo.requestId} ==========\n`);

    res.json(response);

  } catch (error) {
    const totalTime = Date.now() - new Date(debugInfo.timestamp).getTime();
    
    console.log(`\n❌ ========== ERRO COMPLETO (${debugInfo.requestId}) ==========`);
    console.log(`🕐 Tempo até erro: ${totalTime}ms`);
    console.log(`📍 Erro na rota de embed token:`, {
      message: error.message,
      name: error.name,
      user: req.user?.id,
      stack: process.env.NODE_ENV === 'development' ? error.stack : 'hidden'
    });

    // ✅ DEBUG ESPECÍFICO PARA ERROS DE AXIOS/HTTP
    if (error.response) {
      console.log(`🌐 HTTP Error Details:`, {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers ? {
          'content-type': error.response.headers['content-type'],
          'x-request-id': error.response.headers['x-request-id']
        } : 'not available'
      });
    }

    // ✅ DEBUG ESPECÍFICO PARA ERROS DE POWER BI
    if (error.message.includes('401')) {
      console.log(`🔐 DIAGNÓSTICO 401 (Unauthorized):`, {
        possible_causes: [
          'Service Principal não tem permissão no workspace',
          'Access token inválido ou expirado',
          'Report ID ou Group ID incorretos',
          'Tenant ID incorreto'
        ],
        next_steps: [
          'Verificar permissões do Service Principal no workspace',
          'Confirmar IDs no banco de dados',
          'Testar access token manualmente'
        ]
      });
    }

    if (error.message.includes('404')) {
      console.log(`📍 DIAGNÓSTICO 404 (Not Found):`, {
        possible_causes: [
          'Report ID não existe',
          'Group ID (workspace) não existe',
          'Report não está no workspace especificado'
        ],
        current_ids: {
          reportId: req.body.reportId || 'from database',
          groupId: req.body.groupId || 'from database'
        }
      });
    }

    console.log(`========== FIM ERRO ${debugInfo.requestId} ==========\n`);
    
    // Resposta de erro padronizada
    const errorResponse = {
      error: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
      requestId: debugInfo.requestId,
      debugInfo
    };

    if (process.env.NODE_ENV === 'development') {
      errorResponse.details = error.message;
      errorResponse.httpStatus = error.response?.status;
      errorResponse.httpData = error.response?.data;
    }
    
    res.status(500).json(errorResponse);
  }
});

app.get('/api/main-dashboard', authMiddleware, async (req, res) => {
  try {
    console.log(`🏠 DASHBOARD PRINCIPAL: Buscando para usuário ${req.user.id}`);
    
    // Buscar O dashboard com tipo_visibilidade = 'geral' (deve ser único)
    const query = `
      SELECT 
        d.id, d.titulo, d.descricao, d.url_iframe,
        d.embed_type, d.powerbi_report_id, d.powerbi_group_id,
        d.criado_em, d.atualizado_em, d.setor
      FROM dashboards d
      WHERE d.ativo = true 
        AND d.tipo_visibilidade = 'geral'
    `;

    const result = await pool.query(query);

    if (result.rows.length === 0) {
      console.log('❌ DASHBOARD PRINCIPAL: Nenhum dashboard geral encontrado');
      return res.status(404).json({ 
        error: 'Nenhum dashboard principal configurado',
        suggestion: 'Configure um dashboard com visibilidade "geral" para exibir na página inicial'
      });
    }

    const dashboard = result.rows[0];
    
    console.log(`✅ DASHBOARD PRINCIPAL: "${dashboard.titulo}" encontrado (${dashboard.embed_type || 'public'})`);

    res.json({
      dashboard: {
        id: dashboard.id,
        titulo: dashboard.titulo,
        descricao: dashboard.descricao,
        url_iframe: dashboard.url_iframe,
        embed_type: dashboard.embed_type || 'public',
        powerbi_report_id: dashboard.powerbi_report_id,
        powerbi_group_id: dashboard.powerbi_group_id,
        setor: dashboard.setor
      },
      meta: {
        carregado_em: new Date().toISOString(),
        usuario: {
          id: req.user.id,
          nome: req.user.nome,
          setor: req.user.setor
        }
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar dashboard principal:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ===============================================
// ROTAS DE ADMINISTRAÇÃO (FUTURO)
// ===============================================

app.get('/api/debug/token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    console.log(`🔍 DEBUG TOKEN: ${token}`);
    
    // Buscar token com informações detalhadas
    const result = await pool.query(`
      SELECT 
        v.*,
        u.nome,
        u.email,
        u.email_pessoal,
        u.tipo_colaborador,
        u.email_verificado,
        NOW() as agora,
        (v.expira_em > NOW()) as token_valido,
        EXTRACT(EPOCH FROM (v.expira_em - NOW())) as segundos_restantes
      FROM verificacoes_email v
      JOIN usuarios u ON v.usuario_id = u.id
      WHERE v.token = $1
    `, [token]);
    
    if (result.rows.length === 0) {
      return res.json({
        erro: 'Token não encontrado no banco',
        token_procurado: token
      });
    }
    
    const tokenData = result.rows[0];
    
    const debug = {
      token_encontrado: true,
      token: token,
      tipo_token: tokenData.tipo_token,
      usuario: {
        nome: tokenData.nome,
        email_verificado: tokenData.email_verificado,
        tipo_colaborador: tokenData.tipo_colaborador
      },
      datas: {
        criado_em: tokenData.criado_em,
        expira_em: tokenData.expira_em,
        usado_em: tokenData.usado_em,
        agora_servidor: tokenData.agora
      },
      validacao: {
        token_valido: tokenData.token_valido,
        ja_usado: tokenData.usado_em !== null,
        usuario_ja_verificado: tokenData.email_verificado,
        segundos_restantes: tokenData.segundos_restantes
      },
      status: (() => {
        if (tokenData.usado_em) return 'JA_USADO';
        if (tokenData.email_verificado) return 'USUARIO_JA_VERIFICADO';
        if (!tokenData.token_valido) return 'EXPIRADO';
        return 'VALIDO';
      })()
    };
    
    res.json(debug);
    
  } catch (error) {
    console.error('❌ Erro no debug:', error);
    res.status(500).json({ 
      erro: 'Erro interno',
      detalhes: error.message 
    });
  }
});

// Rota para listar usuários (apenas para admins futuros)
// ===============================================
// 1. ROTAS DO SERVIDOR (adicionar ao server.js)
// ===============================================

// MIDDLEWARE PARA VERIFICAR SE É ADMIN
// ===============================================
// MIDDLEWARE DE ADMIN CORRIGIDO
// ===============================================

const adminMiddleware = async (req, res, next) => {
  try {
    console.log('🔧 ADMIN MIDDLEWARE: Iniciando verificação');
    
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      console.log('❌ ADMIN: Token não encontrado');
      return res.status(401).json({ error: 'Token de acesso negado' });
    }

    console.log('🔑 ADMIN: Token presente, verificando JWT...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ ADMIN: Token válido para usuário ID:', decoded.id);
    
    // ✅ CORREÇÃO: Query usando LEFT JOIN com usuarios_admin_log
    const result = await pool.query(
      `SELECT 
         u.id, u.nome, u.email, u.email_pessoal, u.setor, u.tipo_usuario, u.tipo_colaborador,
         u.email_verificado, u.is_coordenador,
         COALESCE(ual.ativo, true) as ativo,
         CASE 
           WHEN u.tipo_colaborador = 'estagiario' THEN u.email_pessoal 
           ELSE u.email 
         END as email_login
       FROM usuarios u
       LEFT JOIN usuarios_admin_log ual ON u.id = ual.usuario_id
       WHERE u.id = $1`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      console.log('❌ ADMIN: Usuário não encontrado no banco');
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    const user = result.rows[0];

    if (!user.email_verificado) {
      console.log('❌ ADMIN: Email não verificado');
      return res.status(401).json({ error: 'Email não verificado' });
    }

    if (!user.ativo) {
      console.log('❌ ADMIN: Usuário inativo/revogado');
      return res.status(401).json({ error: 'Acesso revogado' });
    }

    if (user.tipo_usuario !== 'admin') {
      console.log(`❌ ADMIN: Acesso negado para usuário ${user.id} (${user.tipo_usuario})`);
      return res.status(403).json({ 
        error: 'Acesso negado. Apenas administradores podem acessar esta funcionalidade.'
      });
    }
    
    req.user = user;
    console.log(`🔧 ADMIN: Acesso autorizado para ${user.nome}`);
    next();
    
  } catch (error) {
    console.error('❌ ADMIN: Erro na verificação:', error.message);
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};

// ✅ ROTA PARA VALIDAR STATUS DO POWER BI
app.get('/api/powerbi/status', authMiddleware, async (req, res) => {
  try {
    const configured = validatePowerBIConfig();
    
    let serviceStatus = 'unknown';
    if (configured) {
      try {
        await getPowerBIAccessToken();
        serviceStatus = 'online';
      } catch (error) {
        serviceStatus = 'error';
      }
    } else {
      serviceStatus = 'not_configured';
    }

    res.json({
      configured,
      serviceStatus,
      embedSupported: configured && serviceStatus === 'online',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Erro ao verificar status',
      serviceStatus: 'error' 
    });
  }
});

// ✅ ROTA PARA INVALIDAR CACHE (ADMIN)
app.delete('/api/powerbi/cache', adminMiddleware, (req, res) => {
  tokenCache.clear();
  console.log('🗑️ Cache de tokens Power BI limpo por admin');
  res.json({ message: 'Cache limpo com sucesso' });
});

// LISTAR USUÁRIOS PENDENTES DE APROVAÇÃO
app.get('/api/admin/usuarios-pendentes', adminMiddleware, async (req, res) => {
  try {
    console.log('📋 ADMIN: Listando usuários pendentes de aprovação');

    const result = await pool.query(`
      SELECT 
        u.id,
        u.nome,
        u.email,
        u.email_pessoal,
        u.setor,
        u.tipo_colaborador,
        u.email_verificado,
        u.aprovado_admin,
        u.criado_em,
        v.token as codigo_verificacao,
        v.expira_em as codigo_expira_em,
        v.criado_em as codigo_criado_em,
        -- Status detalhado do token
        CASE 
          WHEN v.token IS NULL THEN 'sem_codigo'
          WHEN v.expira_em < NOW() THEN 'codigo_expirado' 
          WHEN v.usado_em IS NOT NULL THEN 'codigo_usado'
          ELSE 'codigo_ativo'
        END as status_token,
        -- Tempo desde criação
        EXTRACT(EPOCH FROM (NOW() - u.criado_em))/3600 as horas_desde_criacao,
        -- Tempo até/desde expiração
        CASE 
          WHEN v.expira_em IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (v.expira_em - NOW()))/3600
          ELSE NULL
        END as horas_para_expiracao
      FROM usuarios u
      LEFT JOIN verificacoes_email v ON u.id = v.usuario_id 
        AND v.tipo_token = 'verificacao_email' 
        AND v.usado_em IS NULL
      WHERE 
        (u.tipo_colaborador = 'estagiario' AND u.aprovado_admin IS NULL)
        OR (u.email_verificado = false)
      ORDER BY 
        CASE 
          WHEN u.tipo_colaborador = 'estagiario' AND u.aprovado_admin IS NULL THEN 1
          WHEN v.expira_em < NOW() THEN 2
          WHEN v.token IS NULL THEN 3
          ELSE 4
        END,
        u.criado_em DESC
    `);

    const usuarios = result.rows.map(user => ({
      ...user,
      email_login: user.tipo_colaborador === 'estagiario' ? user.email_pessoal : user.email,
      status: user.tipo_colaborador === 'estagiario' 
        ? (user.aprovado_admin === null ? 'pendente_aprovacao' : 'aprovado')
        : 'corporativo',
      codigo_ativo: user.codigo_verificacao && user.codigo_expira_em > new Date(),
      pode_reenviar: user.email_verificado === false && (
        user.tipo_colaborador === 'clt_associado' || 
        (user.tipo_colaborador === 'estagiario' && user.aprovado_admin === true)
      ),
      tempo_expirado_horas: user.horas_para_expiracao < 0 ? Math.abs(user.horas_para_expiracao) : 0
    }));

    // Separar por categorias
    const pendentes_aprovacao = usuarios.filter(u => u.status === 'pendente_aprovacao');
    const tokens_expirados = usuarios.filter(u => u.status_token === 'codigo_expirado');
    const sem_codigo = usuarios.filter(u => u.status_token === 'sem_codigo' && u.status !== 'pendente_aprovacao');
    const aguardando_verificacao = usuarios.filter(u => u.status_token === 'codigo_ativo');

    res.json({
      usuarios,
      total: usuarios.length,
      categorias: {
        pendentes_aprovacao: pendentes_aprovacao.length,
        tokens_expirados: tokens_expirados.length,
        sem_codigo: sem_codigo.length,
        aguardando_verificacao: aguardando_verificacao.length
      },
      usuarios_por_categoria: {
        pendentes_aprovacao,
        tokens_expirados,
        sem_codigo,
        aguardando_verificacao
      }
    });

  } catch (error) {
    console.error('❌ Erro ao listar usuários pendentes:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// APROVAR CADASTRO DE ESTAGIÁRIO - CORRIGIDO
app.post('/api/admin/aprovar-usuario/:userId', adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { userId } = req.params;
    const { enviar_codigo = true } = req.body;

    console.log(`✅ ADMIN: Aprovando usuário ${userId}, enviar código: ${enviar_codigo}`);

    // Buscar usuário - ESTA LINHA ESTAVA FALTANDO!
    const userResult = await client.query(
      'SELECT * FROM usuarios WHERE id = $1 AND tipo_colaborador = $2',
      [userId, 'estagiario']
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Usuário estagiário não encontrado' });
    }

    const user = userResult.rows[0];

    if (user.email_verificado) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'Usuário já verificado' });
    }

    // Marcar como aprovado pelo admin
    await client.query(
      'UPDATE usuarios SET aprovado_admin = true, aprovado_em = NOW(), aprovado_por = $1 WHERE id = $2',
      [req.user.id, userId]
    );

    if (enviar_codigo) {
      // Gerar TOKEN único para validação direta (ao invés de código)
      const tokenValidacao = crypto.randomBytes(32).toString('hex');
      const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Invalidar códigos anteriores
      await client.query(
        'UPDATE verificacoes_email SET usado_em = NOW() WHERE usuario_id = $1 AND usado_em IS NULL',
        [userId]
      );

      // Salvar token
      await client.query(
        `INSERT INTO verificacoes_email (usuario_id, token, tipo_token, expira_em) 
         VALUES ($1, $2, $3, $4)`,
        [userId, tokenValidacao, 'verificacao_email', expiraEm]
      );

      await client.query('COMMIT');

      // Criar link de validação
      const linkValidacao = `${process.env.API_BASE_URL}/api/auth/validar-email/${tokenValidacao}`;

      console.log(`🔗 ADMIN: Link de validação gerado: ${linkValidacao}`);

      // Enviar email com LINK (não código)
      try {
        const emailResult = await resend.emails.send({
          from: 'andre.macedo@resendemh.com.br',
          to: [user.email_pessoal],
          subject: 'Cadastro aprovado - Site RMH',
          html: await gerarTemplateValidacaoEstagiario(user.nome, linkValidacao, user.email_pessoal)
        });

        console.log(`✅ Email de aprovação enviado para ${user.email_pessoal}`);
      } catch (emailError) {
        console.error('❌ Erro ao enviar email de aprovação:', emailError);
      }

      res.json({
        message: 'Usuário aprovado e link de validação enviado',
        link_enviado: true,
        email_enviado_para: user.email_pessoal,
        link_validacao: linkValidacao // Para debug (remover em produção)
      });
    } else {
      await client.query('COMMIT');
      
      res.json({
        message: 'Usuário aprovado. Link não foi enviado.',
        codigo_enviado: false
      });
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao aprovar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    client.release();
  }
});

// REJEITAR CADASTRO DE ESTAGIÁRIO
app.delete('/api/admin/rejeitar-usuario/:userId', adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { userId } = req.params;

    console.log(`❌ ADMIN: Rejeitando usuário ${userId}`);

    // Verificar se é estagiário
    const userResult = await client.query(
      'SELECT nome, email_pessoal FROM usuarios WHERE id = $1 AND tipo_colaborador = $2',
      [userId, 'estagiario']
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Usuário estagiário não encontrado' });
    }

    const user = userResult.rows[0];

    // Deletar verificações de email
    await client.query('DELETE FROM verificacoes_email WHERE usuario_id = $1', [userId]);
    
    // Deletar usuário
    await client.query('DELETE FROM usuarios WHERE id = $1', [userId]);

    await client.query('COMMIT');

    console.log(`🗑️ ADMIN: Usuário ${user.nome} (${user.email_pessoal}) removido do sistema`);

    res.json({
      message: `Cadastro de ${user.nome} foi rejeitado e removido do sistema`,
      usuario_removido: user.nome
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao rejeitar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    client.release();
  }
});

// LISTAR TODOS OS USUÁRIOS (PARA ADMINISTRAÇÃO GERAL)
app.get('/api/admin/usuarios', adminMiddleware, async (req, res) => {
  try {
    console.log('📋 ADMIN: Listando todos os usuários');
    
    const { status, tipo } = req.query;
    
    let whereConditions = [];
    let params = [];
    
    if (status === 'verificados') {
      whereConditions.push('u.email_verificado = true');
    } else if (status === 'nao_verificados') {
      whereConditions.push('u.email_verificado = false');
    }
    
    if (tipo && ['estagiario', 'clt_associado'].includes(tipo)) {
      whereConditions.push(`u.tipo_colaborador = ${params.length + 1}`);
      params.push(tipo);
    }
    
    const whereClause = whereConditions.length > 0 ?
      `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // ✅ CORREÇÃO: Query usando LEFT JOIN com usuarios_admin_log
    const result = await pool.query(`
      SELECT 
        u.id,
        u.nome,
        u.setor,
        u.email,
        u.email_pessoal,
        CASE 
          WHEN u.tipo_colaborador = 'estagiario' THEN u.email_pessoal 
          ELSE u.email 
        END as email_login,
        u.tipo_colaborador,
        u.tipo_usuario,
        u.email_verificado,
        u.criado_em,
        u.verificado_em,
        u.atualizado_em,
        u.ultimo_login,
        u.aprovado_admin,
        u.aprovado_em,
        u.aprovado_por,
        COALESCE(u.is_coordenador, false) as is_coordenador,
        COALESCE(ual.ativo, true) as ativo,
        ual.criado_por_admin,
        ual.criado_por_admin_em,
        ual.revogado_por,
        ual.revogado_em,
        ual.reativado_por,
        ual.reativado_em,
        -- Nome do admin criador
        admin_criador.nome as criado_por_admin_nome,
        -- Status calculado
        CASE 
          WHEN COALESCE(ual.ativo, true) = false THEN 'revogado'
          WHEN u.tipo_colaborador = 'estagiario' 
               AND u.aprovado_admin IS NULL 
               AND ual.criado_por_admin IS NULL
               THEN 'pendente_aprovacao'
          WHEN u.email_verificado = false THEN 'pendente_verificacao'
          WHEN u.email_verificado = true 
               AND (u.aprovado_admin = true OR u.tipo_colaborador = 'clt_associado') 
               THEN 'ativo'
          ELSE 'indefinido'
        END as status
      FROM usuarios u
      LEFT JOIN usuarios_admin_log ual ON u.id = ual.usuario_id
      LEFT JOIN usuarios admin_criador ON ual.criado_por_admin = admin_criador.id
      ${whereClause}
      ORDER BY u.criado_em DESC
    `, params);

    const usuarios = result.rows;
    
    // Buscar lista de setores únicos
    const setoresResult = await pool.query(
      'SELECT DISTINCT setor FROM usuarios WHERE setor IS NOT NULL ORDER BY setor'
    );
    const setores = setoresResult.rows.map(row => row.setor);

    console.log(`📋 ADMIN: Encontrados ${usuarios.length} usuários`);

    res.json({
      usuarios,
      setores,
      total: usuarios.length,
      stats: {
        total: usuarios.length,
        // ✅ CORREÇÃO: Apenas estagiários que se cadastraram sozinhos (sem criado_por_admin)
        pendentes_aprovacao: usuarios.filter(u => 
          u.tipo_colaborador === 'estagiario' && 
          !u.aprovado_admin && 
          !u.criado_por_admin
        ).length,
        nao_verificados: usuarios.filter(u => !u.email_verificado).length,
        admins: usuarios.filter(u => u.tipo_usuario === 'admin').length,
        coordenadores: usuarios.filter(u => u.is_coordenador === true).length,
        clt_associados: usuarios.filter(u => 
          u.tipo_colaborador === 'clt_associado' && u.email_verificado === true
        ).length,
        estagiarios: usuarios.filter(u => 
          u.tipo_colaborador === 'estagiario' && 
          u.aprovado_admin === true && 
          u.email_verificado === true
        ).length,
        revogados: usuarios.filter(u => u.ativo === false).length
      }
    });

  } catch (error) {
    console.error('❌ Erro ao listar usuários:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.get('/api/organograma/colaboradores', authMiddleware, async (req, res) => {
  try {
    console.log('📊 ORGANOGRAMA: Buscando dados da view vw_colaboradores...');
    
    // Query para buscar todos os colaboradores da view vw_colaboradores
    // ✅ CORRIGIDO: Status é "ATIVO" (maiúsculo) baseado nos dados reais
    const result = await pool.query(`
      SELECT 
        id,
        nome,
        cargo,
        setor,
        sub_setor,
        email,
        telefone,
        status,
        cpf,
        genero,
        nascimento,
        endereco
      FROM vw_colaboradores
      WHERE status = 'ATIVO'
      ORDER BY 
        CASE 
          -- Coordenadores (cargo contém COORD.)
          WHEN UPPER(cargo) LIKE '%COORD%' THEN 1
          -- Advogados
          WHEN UPPER(cargo) LIKE '%ADVOGADO%' THEN 2
          -- Analistas
          WHEN UPPER(cargo) LIKE '%ANALISTA%' THEN 3
          -- Assistentes
          WHEN UPPER(cargo) LIKE '%ASSISTENTE%' THEN 4
          -- Auxiliares
          WHEN UPPER(cargo) LIKE '%AUX%' THEN 5
          -- Técnicos
          WHEN UPPER(cargo) LIKE '%TECNICO%' OR UPPER(cargo) LIKE '%TÉCNICO%' THEN 6
          -- Estagiários
          WHEN UPPER(cargo) LIKE '%ESTAGIARIO%' OR UPPER(cargo) LIKE '%ESTAGIÁRIO%' THEN 7
          -- Menores aprendizes
          WHEN UPPER(cargo) LIKE '%MENOR%' OR UPPER(cargo) LIKE '%APRENDIZ%' THEN 8
          ELSE 9
        END,
        setor,
        nome
    `);

    const colaboradores = result.rows;
    
    // Processar dados para compatibilidade com o frontend
    const colaboradoresProcessados = colaboradores.map(c => ({
      id: c.id,
      nome: c.nome,
      setor: c.setor || 'Sem Setor',
      cargo: c.cargo || 'Não informado',
      sub_setor: c.sub_setor,
      email: c.email,
      telefone: c.telefone,
      status: c.status,
      cpf: c.cpf,
      genero: c.genero,
      nascimento: c.nascimento,
      endereco: c.endereco,
      // Mapear para compatibilidade com interface existente
      tipo_usuario: (c.cargo && (
        c.cargo.toUpperCase().includes('DIRETOR') || 
        c.cargo.toUpperCase().includes('ADMIN') ||
        c.cargo.toUpperCase().includes('COORD')
      )) ? 'admin' : 'usuario',
      tipo_colaborador: (c.cargo && (
        c.cargo.toUpperCase().includes('ESTAGIARIO') || 
        c.cargo.toUpperCase().includes('ESTAGIÁRIO') ||
        c.cargo.toUpperCase().includes('MENOR') ||
        c.cargo.toUpperCase().includes('APRENDIZ')
      )) ? 'estagiario' : 'clt_associado',
      is_coordenador: c.cargo && c.cargo.toUpperCase().includes('COORD'),
      email_verificado: true, // Assumindo que estão ativos
      ativo: c.status === 'ATIVO'
    }));
    
    // Estatísticas calculadas
    const stats = {
      total: colaboradoresProcessados.length,
      setores: [...new Set(colaboradoresProcessados.map(c => c.setor))].length,
      admins: colaboradoresProcessados.filter(c => c.tipo_usuario === 'admin').length,
      coordenadores: colaboradoresProcessados.filter(c => c.is_coordenador === true).length,
      estagiarios: colaboradoresProcessados.filter(c => c.tipo_colaborador === 'estagiario').length,
      clt_associados: colaboradoresProcessados.filter(c => c.tipo_colaborador === 'clt_associado').length,
      // Estatísticas por cargo
      advogados: colaboradores.filter(c => c.cargo && c.cargo.toUpperCase().includes('ADVOGADO')).length,
      auxiliares: colaboradores.filter(c => c.cargo && c.cargo.toUpperCase().includes('AUX')).length,
      assistentes: colaboradores.filter(c => c.cargo && c.cargo.toUpperCase().includes('ASSISTENTE')).length,
      analistas: colaboradores.filter(c => c.cargo && c.cargo.toUpperCase().includes('ANALISTA')).length
    };

    console.log(`✅ ORGANOGRAMA: ${colaboradores.length} colaboradores encontrados`);
    console.log('📈 STATS:', stats);
    console.log('🔍 SETORES:', [...new Set(colaboradores.map(c => c.setor))]);
    console.log('💼 CARGOS:', [...new Set(colaboradores.map(c => c.cargo))].slice(0, 10));

    res.json({
      success: true,
      colaboradores: colaboradoresProcessados,
      stats,
      total: colaboradores.length,
      raw_data_sample: colaboradores.slice(0, 3) // Para debug
    });

  } catch (error) {
    console.error('❌ ORGANOGRAMA: Erro ao buscar colaboradores:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      message: 'Não foi possível carregar os dados do organograma',
      details: error.message
    });
  }
});

// REENVIAR CÓDIGO PARA QUALQUER USUÁRIO (ADMIN)
app.post('/api/admin/reenviar-codigo/:userId', adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { userId } = req.params;

    console.log(`🔄 ADMIN: Reenviando código para usuário ${userId} por ${req.user.nome}`);

    // Buscar usuário
    const userResult = await client.query(
      'SELECT * FROM usuarios WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = userResult.rows[0];

    if (user.email_verificado) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'Usuário já verificado' });
    }

    // Determinar email de destino
    const emailLogin = user.tipo_colaborador === 'estagiario' ? 
      user.email_pessoal : user.email;

    if (!emailLogin) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'Email não encontrado para este usuário' });
    }

    // Para estagiários, verificar se foi aprovado
    if (user.tipo_colaborador === 'estagiario' && !user.aprovado_admin) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'Estagiário ainda não foi aprovado. Aprove primeiro.' });
    }

    // Gerar novo token/código dependendo do tipo
    let novoToken, tipoToken, templateHtml;
    const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000);

    if (user.tipo_colaborador === 'estagiario') {
      // Para estagiários: gerar LINK de validação
      novoToken = crypto.randomBytes(32).toString('hex');
      tipoToken = 'verificacao_email';
      const linkValidacao = `${process.env.API_BASE_URL}/api/auth/validar-email/${novoToken}`;
      templateHtml = await gerarTemplateValidacaoEstagiario(user.nome, linkValidacao, emailLogin);
    } else {
      // Para CLT: gerar CÓDIGO
      novoToken = Math.floor(100000 + Math.random() * 900000).toString();
      tipoToken = 'verificacao_email';
      templateHtml = await gerarTemplateVerificacao(user.nome, novoToken, emailLogin, user.tipo_colaborador);
    }

    // Invalidar tokens/códigos anteriores
    await client.query(
      'UPDATE verificacoes_email SET usado_em = NOW() WHERE usuario_id = $1 AND usado_em IS NULL',
      [userId]
    );

    // Criar novo token/código
    await client.query(
      `INSERT INTO verificacoes_email (usuario_id, token, tipo_token, expira_em) 
       VALUES ($1, $2, $3, $4)`,
      [userId, novoToken, tipoToken, expiraEm]
    );

    await client.query('COMMIT');

    // Enviar email
    try {
      const emailResult = await resend.emails.send({
        from: 'andre.macedo@resendemh.com.br',
        to: [emailLogin],
        subject: user.tipo_colaborador === 'estagiario' 
          ? 'Novo link de validação - Site RMH'
          : 'Novo código de verificação - Site RMH',
        html: templateHtml
      });

      console.log(`📧 ADMIN: ${user.tipo_colaborador === 'estagiario' ? 'Link' : 'Código'} reenviado para ${emailLogin} pelo admin ${req.user.nome}`);

      // Log da ação admin
      await pool.query(
        `INSERT INTO logs_email (usuario_id, email_para, tipo_email, status) 
         VALUES ($1, $2, $3, $4)`,
        [userId, emailLogin, 'reenvio_admin', 'enviado']
      );

    } catch (emailError) {
      console.error('❌ Erro ao enviar email:', emailError);
      return res.status(500).json({ error: 'Erro ao enviar email' });
    }

    res.json({
      message: user.tipo_colaborador === 'estagiario' 
        ? 'Novo link de validação enviado com sucesso'
        : 'Novo código de verificação enviado com sucesso',
      email_enviado_para: emailLogin,
      tipo_colaborador: user.tipo_colaborador,
      tipo_envio: user.tipo_colaborador === 'estagiario' ? 'link' : 'codigo'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao reenviar código:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    client.release();
  }
});

app.post('/api/admin/reenviar-codigo-problema/:userId', adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { userId } = req.params;

    console.log(`📧 ADMIN: Reenviando código para usuário com problema ${userId}`);

    // Buscar usuário
    const userResult = await client.query(
      'SELECT * FROM usuarios WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = userResult.rows[0];

    if (user.email_verificado) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Usuário já está verificado' });
    }

    // Verificar se pode reenviar
    if (user.tipo_colaborador === 'estagiario' && !user.aprovado_admin) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Estagiário ainda não foi aprovado pelo admin' });
    }

    // Contar tentativas de reenvio nas últimas 24h
    const tentativasRecentes = await client.query(
      `SELECT COUNT(*) as total 
       FROM verificacoes_email 
       WHERE usuario_id = $1 
         AND tipo_token = 'verificacao_email'
         AND criado_em > NOW() - INTERVAL '24 hours'`,
      [userId]
    );

    if (parseInt(tentativasRecentes.rows[0].total) >= 5) {
      await client.query('ROLLBACK');
      return res.status(429).json({ 
        error: 'Limite de reenvios atingido (5 por dia). Aguarde 24 horas.' 
      });
    }

    // Invalidar tokens anteriores
    await client.query(
      'UPDATE verificacoes_email SET usado_em = NOW() WHERE usuario_id = $1 AND usado_em IS NULL',
      [userId]
    );

    // Gerar novo token/código baseado no tipo
    const emailDestino = user.tipo_colaborador === 'estagiario' ? user.email_pessoal : user.email;
    let novoToken, tipoToken, assunto, templateHtml;
    const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias

    if (user.tipo_colaborador === 'estagiario') {
      // Estagiários: gerar link de validação
      novoToken = require('crypto').randomBytes(32).toString('hex');
      tipoToken = 'verificacao_email';
      assunto = '🔗 Novo link de verificação - Dashboards RMH';
      const linkValidacao = `${process.env.API_BASE_URL}/api/auth/validar-email/${novoToken}`;
      templateHtml = await gerarTemplateValidacaoEstagiario(user.nome, linkValidacao, emailDestino);
    } else {
      // CLT: gerar código numérico
      novoToken = Math.floor(100000 + Math.random() * 900000).toString();
      tipoToken = 'verificacao_email';
      assunto = '🔐 Novo código de verificação - Dashboards RMH';
      templateHtml = await gerarTemplateVerificacao(user.nome, novoToken, emailDestino, user.tipo_colaborador);
    }

    // Criar novo token/código
    await client.query(
      `INSERT INTO verificacoes_email (usuario_id, token, tipo_token, expira_em) 
       VALUES ($1, $2, $3, $4)`,
      [userId, novoToken, tipoToken, expiraEm]
    );

    // Atualizar log administrativo se existir
    const logResult = await client.query(
      'SELECT id FROM usuarios_admin_log WHERE usuario_id = $1',
      [userId]
    );

    if (logResult.rows.length > 0) {
      await client.query(
        `UPDATE usuarios_admin_log 
         SET observacoes = $1, atualizado_em = NOW()
         WHERE usuario_id = $2`,
        [
          `Novo ${user.tipo_colaborador === 'estagiario' ? 'link' : 'código'} reenviado pelo admin ${req.user.nome} em ${new Date().toLocaleString('pt-BR')}`,
          userId
        ]
      );
    } else {
      await client.query(
        `INSERT INTO usuarios_admin_log (usuario_id, ativo, observacoes, criado_em, atualizado_em) 
         VALUES ($1, true, $2, NOW(), NOW())`,
        [
          userId,
          `Primeiro reenvio pelo admin ${req.user.nome} em ${new Date().toLocaleString('pt-BR')}`
        ]
      );
    }

    await client.query('COMMIT');

    // Enviar email
    try {
      const { Resend } = require('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);

      await resend.emails.send({
        from: 'andre.macedo@resendemh.com.br',
        to: [emailDestino],
        subject: assunto,
        html: templateHtml
      });

      console.log(`✅ ADMIN: ${user.tipo_colaborador === 'estagiario' ? 'Link' : 'Código'} reenviado para ${emailDestino} pelo admin ${req.user.nome}`);

    } catch (emailError) {
      console.error('❌ Erro ao enviar email:', emailError);
      return res.status(500).json({ error: 'Erro ao enviar email' });
    }

    res.json({
      message: user.tipo_colaborador === 'estagiario' 
        ? 'Novo link de verificação enviado com sucesso'
        : 'Novo código de verificação enviado com sucesso',
      email_enviado_para: emailDestino,
      tipo_colaborador: user.tipo_colaborador,
      tipo_envio: user.tipo_colaborador === 'estagiario' ? 'link' : 'codigo',
      tentativas_hoje: parseInt(tentativasRecentes.rows[0].total) + 1
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao reenviar código:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    client.release();
  }
});

app.get('/api/admin/usuarios-tokens-expirados', adminMiddleware, async (req, res) => {
  try {
    console.log('📋 ADMIN: Listando usuários com problemas de token');

    const result = await pool.query(`
      SELECT 
        u.id,
        u.nome,
        u.email,
        u.email_pessoal,
        u.setor,
        u.tipo_colaborador,
        u.email_verificado,
        u.aprovado_admin,
        u.criado_em,
        
        -- Email de login
        CASE 
          WHEN u.tipo_colaborador = 'estagiario' THEN u.email_pessoal 
          ELSE u.email 
        END as email_login,
        
        -- Informações do token ativo (se existir)
        v.token as codigo_verificacao,
        v.expira_em as codigo_expira_em,
        v.criado_em as codigo_criado_em,
        
        -- Status detalhado do token
        CASE 
          WHEN v.token IS NULL THEN 'sem_codigo'
          WHEN v.expira_em < NOW() THEN 'codigo_expirado' 
          WHEN v.usado_em IS NOT NULL THEN 'codigo_usado'
          ELSE 'codigo_ativo'
        END as status_token,
        
        -- Tempo desde criação do usuário
        EXTRACT(DAYS FROM (NOW() - u.criado_em)) as dias_desde_criacao,
        
        -- Tempo desde/até expiração do token
        CASE 
          WHEN v.expira_em IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (NOW() - v.expira_em))/3600
          ELSE NULL
        END as horas_desde_expiracao,
        
        -- Observações do log administrativo
        ual.observacoes,
        ual.ativo as usuario_ativo,
        
        -- Classificação do problema
        CASE 
          WHEN u.criado_em < NOW() - INTERVAL '45 days' AND u.email_verificado = false THEN 'muito_antigo'
          WHEN u.criado_em < NOW() - INTERVAL '30 days' AND u.email_verificado = false THEN 'antigo'
          WHEN u.criado_em < NOW() - INTERVAL '7 days' AND u.email_verificado = false AND v.token IS NULL THEN 'sem_token'
          WHEN v.expira_em < NOW() THEN 'token_expirado'
          ELSE 'normal'
        END as categoria_problema
        
      FROM usuarios u
      LEFT JOIN verificacoes_email v ON u.id = v.usuario_id 
        AND v.tipo_token = 'verificacao_email' 
        AND v.usado_em IS NULL
      LEFT JOIN usuarios_admin_log ual ON u.id = ual.usuario_id
      WHERE 
        u.email_verificado = false
        AND (
          -- CLT não verificado há mais de 1 dia
          (u.tipo_colaborador = 'clt_associado' AND u.criado_em < NOW() - INTERVAL '1 day')
          OR
          -- Estagiário aprovado não verificado há mais de 1 dia
          (u.tipo_colaborador = 'estagiario' AND u.aprovado_admin = true AND u.criado_em < NOW() - INTERVAL '1 day')
          OR
          -- Qualquer usuário com token expirado
          (v.expira_em < NOW())
          OR
          -- Usuários antigos sem token
          (v.token IS NULL AND u.criado_em < NOW() - INTERVAL '2 days')
        )
      ORDER BY 
        CASE 
          WHEN u.criado_em < NOW() - INTERVAL '45 days' THEN 1  -- Muito antigos primeiro
          WHEN v.expira_em < NOW() THEN 2                        -- Tokens expirados
          WHEN v.token IS NULL THEN 3                            -- Sem token
          ELSE 4                                                 -- Outros
        END,
        u.criado_em ASC
    `);

    const usuarios = result.rows.map(user => ({
      ...user,
      dias_expirado: user.horas_desde_expiracao > 0 ? Math.floor(user.horas_desde_expiracao / 24) : 0,
      pode_reenviar: user.tipo_colaborador === 'clt_associado' || 
                     (user.tipo_colaborador === 'estagiario' && user.aprovado_admin),
      prioridade: (() => {
        if (user.categoria_problema === 'muito_antigo') return 'alta';
        if (user.categoria_problema === 'antigo') return 'media';
        if (user.categoria_problema === 'token_expirado') return 'media';
        return 'baixa';
      })()
    }));

    // Agrupar por categoria
    const categorias = {
      muito_antigos: usuarios.filter(u => u.categoria_problema === 'muito_antigo'),
      antigos: usuarios.filter(u => u.categoria_problema === 'antigo'),
      tokens_expirados: usuarios.filter(u => u.categoria_problema === 'token_expirado'),
      sem_token: usuarios.filter(u => u.categoria_problema === 'sem_token'),
      outros: usuarios.filter(u => !['muito_antigo', 'antigo', 'token_expirado', 'sem_token'].includes(u.categoria_problema))
    };

    res.json({
      usuarios,
      total: usuarios.length,
      categorias,
      estatisticas: {
        total_com_problemas: usuarios.length,
        muito_antigos: categorias.muito_antigos.length,
        antigos: categorias.antigos.length,
        tokens_expirados: categorias.tokens_expirados.length,
        sem_token: categorias.sem_token.length,
        alta_prioridade: usuarios.filter(u => u.prioridade === 'alta').length,
        media_prioridade: usuarios.filter(u => u.prioridade === 'media').length,
        baixa_prioridade: usuarios.filter(u => u.prioridade === 'baixa').length
      }
    });

  } catch (error) {
    console.error('❌ Erro ao listar usuários com problemas de token:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PROMOVER USUÁRIO A COORDENADOR
app.patch('/api/admin/usuarios/:userId/promover', adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { userId } = req.params;

    // Buscar dados do usuário que será promovido
    const userResult = await client.query(
      'SELECT id, nome, setor FROM v_usuarios_completo WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = userResult.rows[0];

    // Verificar se já existe coordenador no setor
    const coordenadorExistente = await client.query(
      'SELECT id, nome FROM v_usuarios_completo WHERE setor = $1 AND is_coordenador = true AND id != $2',
      [user.setor, userId]
    );

    let coordenadorSubstituido = null;

    // Se existe coordenador, remover coordenação dele primeiro
    if (coordenadorExistente.rows.length > 0) {
      coordenadorSubstituido = coordenadorExistente.rows[0];
      
      await client.query(
        'UPDATE usuarios SET is_coordenador = FALSE WHERE id = $1',
        [coordenadorSubstituido.id]
      );
      
      console.log(`👤 ADMIN: Coordenação removida de ${coordenadorSubstituido.nome} (${user.setor})`);
    }

    // Promover o novo coordenador
    const result = await client.query(
      'UPDATE usuarios SET is_coordenador = TRUE WHERE id = $1 RETURNING id, nome, is_coordenador',
      [userId]
    );

    await client.query('COMMIT');

    console.log(`👑 ADMIN: ${user.nome} promovido a coordenador do setor ${user.setor}`);

    res.json({
      message: 'Usuário promovido a coordenador com sucesso',
      usuario: result.rows[0],
      coordenador_substituido: coordenadorSubstituido?.nome || null,
      setor: user.setor
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao promover coordenador:', error);
    res.status(500).json({ error: 'Erro ao promover coordenador' });
  } finally {
    client.release();
  }
});

// REBAIXAR COORDENADOR
app.patch('/api/admin/usuarios/:userId/rebaixar', adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      'UPDATE usuarios SET is_coordenador = FALSE WHERE id = $1 RETURNING id, nome, is_coordenador',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json({
      message: 'Usuário rebaixado com sucesso',
      usuario: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Erro ao rebaixar coordenador:', error);
    res.status(500).json({ error: 'Erro ao rebaixar coordenador' });
  }
});

// ROTA: Adicionar novo usuário com senha temporária
app.post('/api/admin/adicionar-usuario', adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { nome, email } = req.body;

    console.log(`👤 ADMIN ADD: Adicionando usuário - ${nome} (${email})`);

    // Validações básicas
    if (!nome || !email) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'Nome e email são obrigatórios' });
    }

    // Verificar se email já existe
    const emailExists = await client.query(
      'SELECT id FROM usuarios WHERE email = $1',
      [email.trim().toLowerCase()]
    );

    if (emailExists.rows.length > 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'Este email já está cadastrado no sistema' });
    }

    // ✅ GERAR SENHA TEMPORÁRIA (8 caracteres - fácil de digitar)
    const senhaTemporaria = Math.random().toString(36).slice(-8).toUpperCase();
    const senhaHash = await bcrypt.hash(senhaTemporaria, 10);

    console.log(`🔑 ADMIN: Senha temporária gerada: ${senhaTemporaria}`);

    // Inserir usuário na tabela principal
    const result = await client.query(`
      INSERT INTO usuarios (
        nome, email, senha, tipo_usuario, email_verificado, criado_em, atualizado_em
      ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING id, nome, email, tipo_usuario, criado_em
    `, [
      nome.trim(),
      email.trim().toLowerCase(),
      senhaHash,
      'usuario', // tipo_usuario padrão
      true       // ✅ JÁ VERIFICADO (criado pelo admin)
    ]);

    const newUser = result.rows[0];
    console.log(`✅ ADMIN: Usuário criado com ID: ${newUser.id}`);

    // ✅ REGISTRAR NO LOG ADMINISTRATIVO COMO ATIVO
    await client.query(
      `INSERT INTO usuarios_admin_log (
        usuario_id, 
        ativo, 
        criado_por_admin, 
        criado_por_admin_em, 
        ultima_alteracao_por,
        observacoes,
        criado_em,
        atualizado_em
      ) VALUES ($1, $2, $3, NOW(), $4, $5, NOW(), NOW())`,
      [
        newUser.id, 
        true, // ✅ ATIVO = TRUE
        req.user.id, 
        req.user.id,
        `Usuário criado pelo admin ${req.user.nome} com senha temporária em ${new Date().toLocaleString('pt-BR')}`
      ]
    );

    // ✅ GERAR TOKEN PARA ALTERAÇÃO DE SENHA (OPCIONAL)
    const tokenAlterarSenha = crypto.randomBytes(32).toString('hex');
    const expiraEm = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 dias

    await client.query(
      `INSERT INTO verificacoes_email (usuario_id, token, tipo_token, expira_em) 
       VALUES ($1, $2, $3, $4)`,
      [newUser.id, tokenAlterarSenha, 'configuracao_senha', expiraEm]
    );

    await client.query('COMMIT');
    console.log('✅ ADMIN: Transação commitada com sucesso');

    // ✅ ENVIAR EMAIL COM SENHA TEMPORÁRIA E LINK DE ALTERAÇÃO
    const linkAlterarSenha = `${process.env.API_BASE_URL || 'http://localhost:3002'}/alterar-senha/${tokenAlterarSenha}`;
    
    try {
      const emailResult = await resend.emails.send({
        from: 'admin@resendemh.com.br',
        to: [email],
        subject: 'Bem-vindo à Plataforma - Credenciais de Acesso',
        html: await gerarTemplateBoasVindasComSenha(nome, email, senhaTemporaria, linkAlterarSenha)
      });

      console.log(`✅ ADMIN: Email de boas-vindas enviado para ${email} - ID: ${emailResult.id}`);

      res.status(201).json({
        message: 'Usuário criado com sucesso! Email com credenciais enviado.',
        usuario: {
          ...newUser,
          ativo: true,
          email_login: email,
          senha_temporaria: senhaTemporaria // ⚠️ Apenas para debug - remover em produção
        },
        email_enviado: true,
        email_enviado_para: email
      });

    } catch (emailError) {
      console.error('❌ ADMIN: Erro ao enviar email:', emailError);
      
      // Mesmo com erro no email, usuário foi criado
      res.status(201).json({
        message: 'Usuário criado, mas houve erro no envio do email.',
        usuario: {
          ...newUser,
          ativo: true,
          email_login: email,
          senha_temporaria: senhaTemporaria // Para o admin informar manualmente
        },
        email_enviado: false,
        senha_temporaria: senhaTemporaria // Para o admin copiar
      });
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ ADMIN: Erro ao criar usuário:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor'
    });
  } finally {
    client.release();
  }
});

// TEMPLATE DE EMAIL DE BOAS-VINDAS COM SENHA

async function gerarTemplateBoasVindasComSenha(nome, email, senhaTemporaria, linkAlterarSenha) {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Configure sua Senha</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f4f4f4;
        }
        .container {
          background: white;
          border-radius: 16px;
          max-width: 500px;
          overflow: hidden;
          margin: 0 auto;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #2c6975 0%, #165A5D 100%);
          padding: 30px;
          text-align: center;
          color: white;
          position: relative;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
        }
        .content {
          background: #f8f9fa;
          padding: 40px;
          text-align: center;
        }
        .greeting {
          font-size: 20px;
          font-weight: 600;
          color: #2c6975;
          margin-bottom: 15px;
        }
        .description {
          color: #666;
          margin-bottom: 30px;
          font-size: 16px;
        }
        .credentials-section {
          background: #f8f9fa;
          border: 2px dashed #165A5D;
          border-radius: 12px;
          width: 70%;
          margin: 30px auto;
          text-align: center;
        }
        .credential-row {
          flex-direction: row;
          justify-content: space-between;
          align-items: center;
          margin: 15px 0;
          padding: 12px;
          background: white;
          border-radius: 8px;
          border-left: 4px solid #165A5D;
          border-top: 1px solid rgba(0, 0, 0, 0.2);
          border-right: 1px solid rgba(0, 0, 0, 0.2);
          border-bottom: 1px solid rgba(0, 0, 0, 0.2);
        }
        .credential-label {
          font-weight: 600;
          color: #666;
          font-size: 14px;
        }
        .credential-value a[href] {
          color: #FFFFFF !important;
          text-decoration: none !important;
        }
        .credential-value {
          font-family: 'Courier New', monospace;
          font-size: 16px;
          color: #165A5D;
          font-weight: bold;
          background: #e8f4f8;
          padding: 8px 12px;
          border-radius: 6px;
        }
        .btn-container {
          margin: 35px 0;
        }
        .btn {
          display: inline-block;
          background: #165A5D;
          color: white;
          padding: 16px 32px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          margin: 8px;
          transition: all 0.3s ease;
        }
        .btn:hover {
          background: #0d3638;
          transform: translateY(-2px);
        }
        .footer-note {
          background: #f8f9fa;
          padding: 20px;
          margin-top: 30px;
          border-radius: 8px;
          font-size: 14px;
          color: #666;
          text-align: center;
        }
        .expire-notice {
          color: #dc3545;
          font-size: 13px;
          margin-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
            <img src="https://sistema.resendemh.com.br/logo-rmh.ico" alt="Logo RMH" style="height: 100px; margin-bottom: 10px;" />
            <h1>Configure sua Senha</h1>
        </div>
        
        <div class="content">
          <div class="greeting">Olá, ${nome}!</div>
          
          <div class="description">
            Você foi adicionado à plataforma! Agora precisa definir sua senha para acessar a plataforma.
          </div>
          
          <div class="credential-row">
              <span class="credential-label">Email:</span>
              <span class="credential-value">${email}</span>
            </div>
            
            <div class="credential-row">
              <span class="credential-label">Senha Temporária:</span>
              <span class="credential-value">${senhaTemporaria}</span>
            </div>

          <div class="credentials-section">
            <div class="btn-container" style="color: #ffffff;">
            <a href="${linkAlterarSenha}" class="btn" style="color: #ffffff;">
              Definir Minha Senha
            </a>
          </div>
          
          <div style="text-align: center; margin-top: 20px;">
            <p style="color: #666; font-size: 14px;">
              Clique no botão para escolher sua senha
            </p>
          </div>
          </div>
          <div class="expire-notice">
            Este link expira em 7 dias. Se precisar de ajuda, entre em contato com o administrador.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

// PÁGINA DE ALTERAÇÃO DE SENHA
app.get('/alterar-senha/:token', async (req, res) => {
  try {
    const { token } = req.params;

    console.log(`🔧 PÁGINA ALTERAR SENHA: Carregando para token: ${token.substring(0, 8)}...`);

    // Validar token
    const tokenResult = await pool.query(
      `SELECT 
         v.*,
         u.nome, 
         u.email, 
         u.email_verificado,
         NOW() as agora_servidor,
         (v.expira_em > NOW()) as token_ainda_valido
       FROM verificacoes_email v
       JOIN usuarios u ON v.usuario_id = u.id
       WHERE v.token = $1 
         AND v.tipo_token = 'configuracao_senha'`,
      [token]
    );

    // Template base
    const gerarTemplate = (titulo, conteudo) => {
      return `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${titulo} - RMH</title>
          <link href="https://fonts.googleapis.com/css2?family=Raleway:wght@400;600&family=Ruda:wght@900&display=swap" rel="stylesheet">
          <link rel="icon" type="image/png" href="public/logo.png" sizes="32x32">
          <style>
            body { 
              font-family: 'Raleway', sans-serif; 
              background-color: #DADADA;
              color: #0d3638;
              margin: 0; padding: 20px; min-height: 90vh;
              display: flex; align-items: center; justify-content: center;
            }
            .container { 
              background: #f9f9f9; padding: 40px; border-radius: 16px; 
              box-shadow: 0 10px 30px rgba(0,0,0,0.08); 
              max-width: 500px; margin: 20px; width: 90%;
            }
            .header {
              background-color: #165A5D;
              margin: -40px -40px 30px -40px;
              padding: 30px 40px;
              border-radius: 16px 16px 0 0;
              color: white;
              text-align: center;
            }
            .header h1 {
              font-family: 'Ruda', sans-serif;
              font-size: 24px;
              margin: 10px 0 0 0;
            }
            .form-group {
              margin-bottom: 20px;
            }
            label {
              display: block;
              margin-bottom: 5px;
              font-weight: 600;
              color: #0d3638;
            }
            input[type="password"] {
              width: 100%;
              padding: 12px;
              border: 2px solid #ddd;
              border-radius: 8px;
              font-size: 16px;
              box-sizing: border-box;
            }
            input[type="password"]:focus {
              outline: none;
              border-color: #165A5D;
            }
            .button {
              background: #165A5D; 
              color: white; 
              padding: 15px 30px;
              border: none;
              border-radius: 8px; 
              font-size: 16px;
              font-weight: 600;
              cursor: pointer;
              width: 100%;
              margin: 10px 0;
            }
            .button:hover { 
              background: #0d3638; 
            }
            .button:disabled {
              background: #ccc;
              cursor: not-allowed;
            }
            .message {
              margin: 15px 0;
              padding: 10px;
              border-radius: 5px;
              text-align: center;
            }
            .message.error {
              background: #fdf2f2;
              color: #e74c3c;
              border: 1px solid #e74c3c;
            }
            .message.success {
              background: #e8f5e8;
              color: #27ae60;
              border: 1px solid #27ae60;
            }
            .link {
              color: #165A5D;
              text-decoration: none;
              font-weight: 600;
            }
            .link:hover {
              text-decoration: underline;
            }
            .error-box {
              background: #fdf2f2; 
              padding: 15px; 
              border-radius: 10px; 
              border-left: 4px solid #e74c3c; 
              margin: 30px 0;
              margin-top: 50px;
              font-size: 18px
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="https://sistema.resendemh.com.br/logo-rmh.ico" alt="Logo RMH" style="height: 120px; margin-bottom: 10px;" />
              <h1>${titulo}</h1>
            </div>
            ${conteudo}
          </div>
          
          <script>
            function alterarSenha() {
              const novaSenha = document.getElementById('novaSenha').value;
              const confirmarSenha = document.getElementById('confirmarSenha').value;
              const submitBtn = document.getElementById('submitBtn');
              
              if (novaSenha.length < 6) {
                showMessage('A nova senha deve ter pelo menos 6 caracteres', 'error');
                return;
              }
              
              if (novaSenha !== confirmarSenha) {
                showMessage('As senhas não coincidem', 'error');
                return;
              }
              
              // Desabilitar botão
              submitBtn.disabled = true;
              submitBtn.textContent = 'Alterando...';
              
              fetch('/api/auth/configurar-conta/${token}', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  novaSenha: novaSenha
                })
              })
              .then(response => response.json())
              .then(data => {
                if (data.success) {
                  showMessage('✅ Senha alterada com sucesso! Redirecionando...', 'success');
                  setTimeout(() => {
                    window.location.href = '/';
                  }, 2000);
                } else {
                  showMessage(data.error || 'Erro ao alterar senha', 'error');
                  submitBtn.disabled = false;
                  submitBtn.textContent = 'Alterar Senha';
                }
              })
              .catch(error => {
                showMessage('Erro de conexão. Tente novamente.', 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Alterar Senha';
              });
            }
            
            function showMessage(text, type) {
              const messageDiv = document.getElementById('message');
              messageDiv.textContent = text;
              messageDiv.className = 'message ' + type;
              messageDiv.style.display = 'block';
            }
            
            document.getElementById('submitBtn').addEventListener('click', alterarSenha);
            
            document.addEventListener('keypress', function(e) {
              if (e.key === 'Enter') {
                alterarSenha();
              }
            });
          </script>
        </body>
        </html>
      `;
    };

    // Verificar token
    if (tokenResult.rows.length === 0) {
      const conteudo = `
        <div>
          <div class="error-box">
            <strong>Token não encontrado</strong><br>
            Este link não é válido ou já foi utilizado.
          </div>
        </div>
      `;
      return res.status(400).send(gerarTemplate('Link Inválido', conteudo));
    }

    const verification = tokenResult.rows[0];

    // Verificar expiração (30 dias de prazo)
    const agora = new Date();
    const expiracao = new Date(verification.expira_em);
    
    if (agora > expiracao) {
      const conteudo = `
        <div>
          <div class="error-box">
            <strong>Token expirado</strong><br>
            Este link expirou. Entre em contato com o administrador.
          </div>
        </div>
      `;
      return res.status(400).send(gerarTemplate('Link Expirado', conteudo));
    }

    // Formulário de alteração
    const conteudo = `
      <div>
        <h2>Olá, ${verification.nome}!</h2>
        <p>Altere sua senha temporária para uma mais segura.</p>
        
        <div id="message" class="message" style="display: none;"></div>                               
        
        <div class="form-group">
        <label for="novaSenha">Nova Senha:</label>
        <input type="password" id="novaSenha" placeholder="Mínimo 6 caracteres" required>
        </div>
        
        <div class="form-group">
        <label for="confirmarSenha">Confirmar Nova Senha:</label>
        <input type="password" id="confirmarSenha" placeholder="Digite a nova senha novamente" required>
        </div>
        
        <button type="button" class="button" id="submitBtn">
        Alterar Senha
        </button>
      </div>
    `;

    res.send(gerarTemplate('Alterar Senha', conteudo));

  } catch (error) {
    console.error('❌ Erro ao carregar página de alteração:', error);
    res.status(500).send('Erro interno do servidor');
  }
});

// ROTA PARA PROCESSAR ALTERAÇÃO DE SENHA
app.post('/api/auth/alterar-senha/:token', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { token } = req.params;
    const { senhaAtual, novaSenha } = req.body;

    if (!senhaAtual || !novaSenha) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
    }

    if (novaSenha.length < 6) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Nova senha deve ter pelo menos 6 caracteres' });
    }

    // Validar token
    const tokenResult = await client.query(
      `SELECT v.*, u.senha 
       FROM verificacoes_email v
       JOIN usuarios u ON v.usuario_id = u.id
       WHERE v.token = $1 AND v.tipo_token = 'configuracao_senha' AND v.usado_em IS NULL`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Token inválido ou já utilizado' });
    }

    const verification = tokenResult.rows[0];

    // Verificar senha atual
    const senhaCorreta = await bcrypt.compare(senhaAtual, verification.senha);
    if (!senhaCorreta) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Senha atual incorreta' });
    }

    // Criptografar nova senha
    const novaSenhaHash = await bcrypt.hash(novaSenha, 10);

    // Atualizar senha
    await client.query(
      'UPDATE usuarios SET senha = $1, atualizado_em = NOW() WHERE id = $2',
      [novaSenhaHash, verification.usuario_id]
    );

    // Marcar token como usado
    await client.query(
      'UPDATE verificacoes_email SET usado_em = NOW() WHERE token = $1',
      [token]
    );

    await client.query('COMMIT');

    console.log(`✅ Senha alterada com sucesso para usuário ID: ${verification.usuario_id}`);

    res.json({
      success: true,
      message: 'Senha alterada com sucesso!'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao alterar senha:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    client.release();
  }
});

app.post('/api/auth/configurar-conta/:token', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { token } = req.params;
    const { novaSenha } = req.body; // ✅ SÓ NOVA SENHA

    if (!novaSenha || novaSenha.length < 6) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Nova senha deve ter pelo menos 6 caracteres' });
    }

    // Validar token
    const tokenResult = await client.query(
      `SELECT v.*, u.senha 
       FROM verificacoes_email v
       JOIN usuarios u ON v.usuario_id = u.id
       WHERE v.token = $1 AND v.tipo_token = 'configuracao_senha' AND v.usado_em IS NULL`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Token inválido ou já utilizado' });
    }

    const verification = tokenResult.rows[0];

    // ✅ NÃO VERIFICAR SENHA ATUAL (é temporária)

    // Criptografar nova senha
    const novaSenhaHash = await bcrypt.hash(novaSenha, 10);

    // Atualizar senha
    await client.query(
      'UPDATE usuarios SET senha = $1, atualizado_em = NOW() WHERE id = $2',
      [novaSenhaHash, verification.usuario_id]
    );

    // Marcar token como usado
    await client.query(
      'UPDATE verificacoes_email SET usado_em = NOW() WHERE token = $1',
      [token]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Senha configurada com sucesso!'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao configurar senha:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    client.release();
  }
});

// ✅ TEMPLATE SIMPLES E DIRETO
async function gerarTemplateUnificado(nome, email, senha, linkLogin, linkConfiguracao, tipoFluxo) {
  const isTemporaria = tipoFluxo === 'configuracao';
  
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Bem-vindo à Plataforma - RMH</title>
      <link href="https://fonts.googleapis.com/css2?family=Raleway:wght@400;600&family=Ruda:wght@900&display=swap" rel="stylesheet">
      <style>
        body {
          margin: 0;
          font-family: 'Raleway', sans-serif;
          background-color: #f5f5f5;
          color: #333;
          padding: 20px;
          line-height: 1.6;
        }
        .container {
          max-width: 500px;
          margin: auto;
          background-color: white;
          border-radius: 10px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        .header {
          background-color: #165A5D;
          padding: 30px 20px;
          text-align: center;
        }
        .header h1 {
          font-family: 'Ruda', sans-serif;
          font-size: 24px;
          color: white;
          margin: 0;
        }
        .content {
          padding: 30px;
          text-align: center;
        }
        .content h2 {
          color: #165A5D;
          margin-bottom: 20px;
        }
        .content p {
          font-size: 16px;
          margin: 15px 0;
        }
        .senha-box {
          background-color: #f8f9fa;
          border: 2px solid #165A5D;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
          font-size: 18px;
        }
        .senha-code {
          font-family: 'Courier New', monospace;
          font-size: 24px;
          font-weight: bold;
          color: #165A5D;
          background-color: #e9ecef;
          padding: 10px 15px;
          border-radius: 5px;
          display: inline-block;
          margin: 10px 0;
        }
        .action-button {
          background-color: #165A5D;
          color: white;
          padding: 15px 30px;
          text-decoration: none;
          border-radius: 8px;
          display: inline-block;
          font-weight: bold;
          font-size: 16px;
          margin: 20px 0;
          transition: background-color 0.3s;
        }
        .action-button:hover {
          background-color: #0d3638;
        }
        .login-link {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #dee2e6;
        }
        .login-link a {
          color: #165A5D;
          text-decoration: none;
          font-weight: 500;
        }
        .login-link a:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Bem-vindo à Plataforma</h1>
        </div>
        <div class="content">
          <h2>Olá, ${nome}!</h2>
          
          <p>O administrador ${isTemporaria ? 'gerou uma senha temporária' : 'configurou sua senha'}:</p>
          
          <div class="senha-box">
            <strong>Senha:</strong>
            <div class="senha-code">${senha}</div>
          </div>
          
          <p>Caso queira mudá-la, aperte no botão abaixo:</p>
          
          <a href="${linkConfiguracao}" class="action-button">
            🔧 Alterar Senha
          </a>
          
          <div class="login-link">
            <p>Ou <a href="${linkLogin}">faça login diretamente</a> com a senha atual</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ROTA: Editar usuário (Admin)
app.put('/api/admin/editar-usuario/:userId', adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { nome, setor, email_pessoal, email, nova_senha } = req.body;

    // Validação dos campos obrigatórios
    if (!nome || !setor || !email_pessoal) {
      return res.status(400).json({ error: 'Campos obrigatórios: nome, setor, email_pessoal' });
    }

    // Verificar se o usuário existe
    const userExists = await pool.query(
      'SELECT id, nome, email, email_pessoal, setor, tipo_usuario FROM usuarios WHERE id = $1', 
      [userId]
    );
    
    if (userExists.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = userExists.rows[0];

    // Preparar campos para atualização dinâmica
    let updateFields = ['nome = $1', 'setor = $2', 'email_pessoal = $3'];
    let updateValues = [nome, setor, email_pessoal];
    let paramCount = 3;

    // Atualizar email corporativo se fornecido
    if (email !== undefined && email !== user.email) {
      // Verificar se o novo email já está em uso
      const emailExists = await pool.query(
        'SELECT id FROM usuarios WHERE email = $1 AND id != $2', 
        [email, userId]
      );
      
      if (emailExists.rows.length > 0) {
        return res.status(400).json({ error: 'Este email corporativo já está sendo usado por outro usuário' });
      }

      paramCount++;
      updateFields.push(`email = $${paramCount}`);
      updateValues.push(email);
      
      // Se alterar email corporativo, resetar verificação (se campo existir)
      paramCount++;
      updateFields.push(`email_verificado = $${paramCount}`);
      updateValues.push(false);
    }

    // Atualizar senha se fornecida
    let senhaAlterada = false;
    if (nova_senha && nova_senha.trim() !== '') {
      // Validar senha (mínimo 6 caracteres)
      if (nova_senha.length < 6) {
        return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres' });
      }

      // Criptografar nova senha
      const bcrypt = require('bcrypt');
      const saltRounds = 10;
      const senhaHash = await bcrypt.hash(nova_senha, saltRounds);

      paramCount++;
      updateFields.push(`senha = $${paramCount}`);
      updateValues.push(senhaHash);
      senhaAlterada = true;
    }

    // Sempre atualizar o campo atualizado_em
    paramCount++;
    updateFields.push(`atualizado_em = $${paramCount}`);
    updateValues.push(new Date());

    // Adicionar WHERE clause
    paramCount++;
    updateValues.push(userId);

    // Executar atualização
    const result = await pool.query(
      `UPDATE usuarios 
       SET ${updateFields.join(', ')} 
       WHERE id = $${paramCount} 
       RETURNING id, nome, email, email_pessoal, setor, tipo_usuario, email_verificado, atualizado_em`,
      updateValues
    );

    console.log(`✅ ADMIN: Usuário ${userId} (${user.nome}) editado por ${req.user.nome}`);
    
    if (senhaAlterada) {
      console.log(`🔐 ADMIN: Senha alterada para usuário ${user.nome}`);
    }

    if (email !== undefined && email !== user.email) {
      console.log(`📧 ADMIN: Email corporativo alterado para usuário ${user.nome}: ${user.email} → ${email}`);
    }

    // Preparar resposta detalhada
    const usuarioAtualizado = result.rows[0];
    const response = {
      message: 'Usuário editado com sucesso',
      usuario: usuarioAtualizado,
      alteracoes: {
        nome_alterado: nome !== user.nome,
        setor_alterado: setor !== user.setor,
        email_pessoal_alterado: email_pessoal !== user.email_pessoal,
        email_corporativo_alterado: email !== undefined && email !== user.email,
        senha_alterada: senhaAlterada
      }
    };

    // Avisos importantes
    const avisos = [];
    
    if (email !== undefined && email !== user.email) {
      avisos.push('Email corporativo alterado. O usuário precisará verificar o novo email no próximo login.');
    }
    
    if (senhaAlterada) {
      avisos.push('Nova senha definida. O usuário deve ser informado sobre a alteração.');
    }

    if (avisos.length > 0) {
      response.avisos = avisos;
    }

    res.json(response);

  } catch (error) {
    console.error('❌ Erro ao editar usuário:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ROTA: Revogar acesso (Admin)
app.patch('/api/admin/revogar-acesso/:userId', adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { userId } = req.params;

    // Verificar se usuário existe
    const userResult = await client.query(
      'SELECT nome FROM usuarios WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = userResult.rows[0];

    // ✅ CORREÇÃO: Verificar se já existe registro no usuarios_admin_log
    const logResult = await client.query(
      'SELECT id FROM usuarios_admin_log WHERE usuario_id = $1',
      [userId]
    );

    if (logResult.rows.length === 0) {
      // Criar registro inicial no usuarios_admin_log
      await client.query(
        `INSERT INTO usuarios_admin_log (usuario_id, ativo, revogado_por, revogado_em, motivo_revogacao, ultima_alteracao_por) 
         VALUES ($1, $2, $3, NOW(), $4, $5)`,
        [userId, false, req.user.id, 'Acesso revogado pelo administrador', req.user.id]
      );
    } else {
      // Atualizar registro existente
      await client.query(
        `UPDATE usuarios_admin_log 
         SET ativo = false, revogado_por = $1, revogado_em = NOW(), 
             motivo_revogacao = $2, ultima_alteracao_por = $3, atualizado_em = NOW()
         WHERE usuario_id = $4`,
        [req.user.id, 'Acesso revogado pelo administrador', req.user.id, userId]
      );
    }

    await client.query('COMMIT');
    console.log(`🚫 ADMIN: Acesso revogado para ${user.nome} por ${req.user.nome}`);

    res.json({
      message: 'Acesso revogado com sucesso',
      usuario_revogado: user.nome
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao revogar acesso:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    client.release();
  }
});

// ROTA: Reativar usuário (Admin)
app.patch('/api/admin/reativar-usuario/:userId', adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verificar se usuário existe e está revogado
    const userResult = await pool.query(
      'SELECT nome FROM usuarios WHERE id = $1 AND ativo = false',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado ou não está revogado' });
    }

    const user = userResult.rows[0];

    // Reativar usuário
    await pool.query(
      'UPDATE usuarios SET ativo = true, reativado_em = NOW(), reativado_por = $1 WHERE id = $2',
      [req.user.id, userId]
    );

    console.log(`✅ ADMIN: Usuário ${user.nome} reativado por ${req.user.nome}`);

    res.json({
      message: 'Usuário reativado com sucesso',
      usuario_reativado: user.nome
    });

  } catch (error) {
    console.error('❌ Erro ao reativar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ROTA: Buscar detalhes de usuário específico (Admin)
app.get('/api/admin/usuario/:userId', adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(`
      SELECT 
        u.*,
        CASE 
          WHEN u.tipo_colaborador = 'estagiario' THEN u.email_pessoal 
          ELSE u.email 
        END as email_login,
        admin_criador.nome as criado_por_nome,
        admin_aprovador.nome as aprovado_por_nome,
        admin_revogador.nome as revogado_por_nome
      FROM usuarios u
      LEFT JOIN usuarios admin_criador ON u.criado_por_admin = admin_criador.id
      LEFT JOIN usuarios admin_aprovador ON u.aprovado_por = admin_aprovador.id
      LEFT JOIN usuarios admin_revogador ON u.revogado_por = admin_revogador.id
      WHERE u.id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json({
      usuario: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Erro ao buscar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.delete('/api/admin/excluir-usuario-problema/:userId', adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { userId } = req.params;
    const { motivo = 'Token expirado há muito tempo' } = req.body;

    console.log(`🗑️ ADMIN: Excluindo usuário ${userId} com problema de token`);

    // Verificar se usuário existe e tem problemas
    const userResult = await client.query(
      `SELECT 
         u.nome, 
         u.email, 
         u.email_pessoal, 
         u.tipo_colaborador,
         u.email_verificado,
         EXTRACT(DAYS FROM (NOW() - u.criado_em)) as dias_desde_criacao
       FROM usuarios u 
       WHERE u.id = $1 AND u.email_verificado = false`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Usuário não encontrado ou já verificado' });
    }

    const user = userResult.rows[0];
    const emailLogin = user.tipo_colaborador === 'estagiario' ? user.email_pessoal : user.email;

    // Log da exclusão
    console.log(`🗑️ Excluindo usuário: ${user.nome} (${emailLogin}) - ${Math.floor(user.dias_desde_criacao)} dias de conta`);

    // Remover tokens relacionados
    await client.query('DELETE FROM verificacoes_email WHERE usuario_id = $1', [userId]);

    // Remover logs administrativos
    await client.query('DELETE FROM usuarios_admin_log WHERE usuario_id = $1', [userId]);

    // Remover usuário
    await client.query('DELETE FROM usuarios WHERE id = $1', [userId]);

    await client.query('COMMIT');

    console.log(`✅ ADMIN: Usuário ${user.nome} excluído definitivamente por ${req.user.nome}`);

    res.json({
      message: 'Usuário excluído com sucesso',
      usuario_excluido: {
        nome: user.nome,
        email: emailLogin,
        tipo_colaborador: user.tipo_colaborador,
        dias_desde_criacao: Math.floor(user.dias_desde_criacao)
      },
      motivo
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao excluir usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    client.release();
  }
});

// AÇÃO EM LOTE: REENVIAR PARA MÚLTIPLOS USUÁRIOS
app.post('/api/admin/reenviar-lote-problemas', adminMiddleware, async (req, res) => {
  const { userIds } = req.body;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'Lista de IDs de usuários inválida' });
  }

  if (userIds.length > 10) {
    return res.status(400).json({ error: 'Máximo de 10 usuários por vez' });
  }

  const resultados = {
    sucessos: [],
    erros: [],
    total_processados: 0
  };

  console.log(`📧 ADMIN: Reenvio em lote para ${userIds.length} usuários por ${req.user.nome}`);

  for (const userId of userIds) {
    try {
      const response = await fetch(`${process.env.API_BASE_URL}/api/admin/reenviar-codigo-problema/${userId}`, {
        method: 'POST',
        headers: {
          'Authorization': req.headers.authorization,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        resultados.sucessos.push({
          userId,
          email: data.email_enviado_para,
          tipo: data.tipo_envio
        });
      } else {
        resultados.erros.push({
          userId,
          erro: data.error || 'Erro desconhecido'
        });
      }

    } catch (error) {
      resultados.erros.push({
        userId,
        erro: 'Erro de conexão'
      });
    }

    resultados.total_processados++;
  }

  console.log(`✅ ADMIN: Reenvio em lote finalizado - ${resultados.sucessos.length} sucessos, ${resultados.erros.length} erros`);

  res.json({
    message: `Processamento concluído: ${resultados.sucessos.length} sucessos, ${resultados.erros.length} erros`,
    resultados
  });
});

// AÇÃO EM LOTE: EXCLUIR MÚLTIPLOS USUÁRIOS
app.post('/api/admin/excluir-lote-problemas', adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { userIds, motivo = 'Limpeza administrativa de usuários com problemas de token' } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Lista de IDs de usuários inválida' });
    }

    if (userIds.length > 20) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Máximo de 20 usuários por vez' });
    }

    console.log(`🗑️ ADMIN: Exclusão em lote de ${userIds.length} usuários por ${req.user.nome}`);

    // Verificar usuários válidos
    const usersResult = await client.query(
      'SELECT id, nome, email, email_pessoal, tipo_colaborador FROM usuarios WHERE id = ANY($1) AND email_verificado = false',
      [userIds]
    );

    if (usersResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Nenhum usuário válido encontrado' });
    }

    const validUserIds = usersResult.rows.map(u => u.id);
    const usuariosParaExcluir = usersResult.rows;

    // Remover tokens
    const tokensResult = await client.query(
      'DELETE FROM verificacoes_email WHERE usuario_id = ANY($1) RETURNING id',
      [validUserIds]
    );

    // Remover logs
    const logsResult = await client.query(
      'DELETE FROM usuarios_admin_log WHERE usuario_id = ANY($1) RETURNING id',
      [validUserIds]
    );

    // Remover usuários
    const usuariosResult = await client.query(
      'DELETE FROM usuarios WHERE id = ANY($1) RETURNING nome',
      [validUserIds]
    );

    await client.query('COMMIT');

    console.log(`✅ ADMIN: ${usuariosResult.rowCount} usuários excluídos em lote por ${req.user.nome}`);

    res.json({
      message: 'Usuários excluídos com sucesso',
      usuarios_excluidos: usuariosResult.rowCount,
      tokens_removidos: tokensResult.rowCount,
      logs_removidos: logsResult.rowCount,
      detalhes: usuariosParaExcluir.map(u => ({
        nome: u.nome,
        email: u.tipo_colaborador === 'estagiario' ? u.email_pessoal : u.email,
        tipo: u.tipo_colaborador
      })),
      motivo
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro na exclusão em lote:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    client.release();
  }
});

// ESTATÍSTICAS DETALHADAS DE PROBLEMAS DE TOKEN
app.get('/api/admin/estatisticas-tokens', adminMiddleware, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        -- Usuários com problemas por tempo
        COUNT(*) FILTER (
          WHERE email_verificado = false 
          AND criado_em < NOW() - INTERVAL '45 days'
        ) as muito_antigos,
        
        COUNT(*) FILTER (
          WHERE email_verificado = false 
          AND criado_em < NOW() - INTERVAL '30 days'
          AND criado_em >= NOW() - INTERVAL '45 days'
        ) as antigos,
        
        COUNT(*) FILTER (
          WHERE email_verificado = false 
          AND criado_em < NOW() - INTERVAL '7 days'
          AND criado_em >= NOW() - INTERVAL '30 days'
        ) as moderados,
        
        -- Usuários por tipo
        COUNT(*) FILTER (
          WHERE email_verificado = false 
          AND tipo_colaborador = 'clt_associado'
          AND criado_em < NOW() - INTERVAL '1 day'
        ) as clt_nao_verificados,
        
        COUNT(*) FILTER (
          WHERE email_verificado = false 
          AND tipo_colaborador = 'estagiario'
          AND aprovado_admin = true
          AND criado_em < NOW() - INTERVAL '1 day'
        ) as estagiarios_nao_verificados,
        
        -- Total geral
        COUNT(*) FILTER (WHERE email_verificado = false) as total_nao_verificados
      FROM usuarios
    `);

    const tokenStats = await pool.query(`
      SELECT 
        COUNT(*) as total_tokens,
        COUNT(*) FILTER (WHERE expira_em < NOW()) as tokens_expirados,
        COUNT(*) FILTER (WHERE expira_em > NOW() AND usado_em IS NULL) as tokens_ativos,
        COUNT(*) FILTER (WHERE usado_em IS NOT NULL) as tokens_usados,
        COUNT(DISTINCT usuario_id) as usuarios_com_tokens
      FROM verificacoes_email 
      WHERE tipo_token = 'verificacao_email'
    `);

    res.json({
      usuarios: stats.rows[0],
      tokens: tokenStats.rows[0],
      recomendacoes: {
        acao_necessaria: parseInt(stats.rows[0].muito_antigos) > 0,
        usuarios_criticos: parseInt(stats.rows[0].muito_antigos),
        usuarios_atenção: parseInt(stats.rows[0].antigos)
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas de tokens:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ROTA: Estatísticas detalhadas do sistema (Admin)
// backend/server.js - CORREÇÃO DAS ESTATÍSTICAS

app.get('/api/admin/estatisticas', adminMiddleware, async (req, res) => {
  try {
    // Usar a view v_usuarios_completo que já tem as informações consolidadas
    const stats = await pool.query(`
      SELECT 
        -- Total de usuários ativos (excluindo revogados)
        COUNT(*) FILTER (WHERE ativo = true) as total_usuarios,
        
        -- Estagiários ativos e aprovados
        COUNT(*) FILTER (
          WHERE tipo_colaborador = 'estagiario' 
          AND ativo = true
          AND aprovado_admin = true 
          AND email_verificado = true
        ) as total_estagiarios,
        
        -- CLT/Associados ativos e verificados
        COUNT(*) FILTER (
          WHERE tipo_colaborador = 'clt_associado' 
          AND ativo = true
          AND email_verificado = true
        ) as total_clt_associados,
        
        -- Coordenadores ativos
        COUNT(*) FILTER (
          WHERE is_coordenador = true 
          AND ativo = true
        ) as total_coordenadores,
        
        -- Administradores ativos
        COUNT(*) FILTER (
          WHERE tipo_usuario = 'admin' 
          AND ativo = true
        ) as total_admins,
        
        -- Usuários com email não verificado (excluindo estagiários pendentes)
        COUNT(*) FILTER (
          WHERE email_verificado = false 
          AND ativo = true
          AND NOT (tipo_colaborador = 'estagiario' AND aprovado_admin IS NULL)
        ) as nao_verificados,
        
        -- Estagiários pendentes de aprovação
        COUNT(*) FILTER (
          WHERE tipo_colaborador = 'estagiario' 
          AND aprovado_admin IS NULL 
          AND ativo = true
        ) as pendentes_aprovacao,
        
        -- Usuários revogados
        COUNT(*) FILTER (WHERE ativo = false) as revogados,
        
        -- Usuários ativos nos últimos 30 dias
        COUNT(*) FILTER (
          WHERE ultimo_login > NOW() - INTERVAL '30 days' 
          AND ativo = true
        ) as ativos_ultimos_30_dias
      FROM v_usuarios_completo
    `);

    // Estatísticas por setor (apenas usuários ativos)
    const estatisticasPorSetor = await pool.query(`
      SELECT 
        setor,
        COUNT(*) as total,
        COUNT(*) FILTER (
          WHERE tipo_colaborador = 'estagiario' 
          AND aprovado_admin = true 
          AND email_verificado = true
        ) as estagiarios,
        COUNT(*) FILTER (
          WHERE tipo_colaborador = 'clt_associado' 
          AND email_verificado = true
        ) as clt_associados,
        COUNT(*) FILTER (WHERE is_coordenador = true) as coordenadores,
        COUNT(*) FILTER (WHERE tipo_usuario = 'admin') as admins
      FROM v_usuarios_completo
      WHERE ativo = true
      GROUP BY setor
      ORDER BY total DESC
    `);

    // Log para debug
    console.log('📊 ESTATÍSTICAS CALCULADAS:', {
      ...stats.rows[0],
      por_setor: estatisticasPorSetor.rows.length
    });

    res.json({
      geral: stats.rows[0],
      por_setor: estatisticasPorSetor.rows
    });

  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ROTA: Histórico de ações administrativas
app.get('/api/admin/historico-acoes', adminMiddleware, async (req, res) => {
  try {
    const { limite = 50 } = req.query;

    const result = await pool.query(`
      SELECT 
        'aprovacao' as tipo_acao,
        u.nome as usuario_afetado,
        CASE 
          WHEN u.tipo_colaborador = 'estagiario' THEN u.email_pessoal 
          ELSE u.email 
        END as email_login,
        admin.nome as admin_responsavel,
        u.aprovado_em as data_acao,
        'Usuário aprovado' as descricao
      FROM usuarios u
      JOIN usuarios admin ON u.aprovado_por = admin.id
      WHERE u.aprovado_em IS NOT NULL
      
      UNION ALL
      
      SELECT 
        'revogacao' as tipo_acao,
        u.nome as usuario_afetado,
        CASE 
          WHEN u.tipo_colaborador = 'estagiario' THEN u.email_pessoal 
          ELSE u.email 
        END as email_login,
        admin.nome as admin_responsavel,
        u.revogado_em as data_acao,
        'Acesso revogado' as descricao
      FROM usuarios u
      JOIN usuarios admin ON u.revogado_por = admin.id
      WHERE u.revogado_em IS NOT NULL
      
      UNION ALL
      
      SELECT 
        'criacao' as tipo_acao,
        u.nome as usuario_afetado,
        CASE 
          WHEN u.tipo_colaborador = 'estagiario' THEN u.email_pessoal 
          ELSE u.email 
        END as email_login,
        admin.nome as admin_responsavel,
        u.criado_em as data_acao,
        'Usuário adicionado pelo admin' as descricao
      FROM usuarios u
      JOIN usuarios admin ON u.criado_por_admin = admin.id
      WHERE u.criado_por_admin IS NOT NULL
      
      ORDER BY data_acao DESC
      LIMIT $1
    `, [limite]);

    res.json({
      historico: result.rows
    });

  } catch (error) {
    console.error('❌ Erro ao buscar histórico:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===============================================
// TRATAMENTO DE ERROS E ROTAS NÃO ENCONTRADAS
// ===============================================

// Middleware de tratamento de erros
app.use((error, req, res, next) => {
  console.error('❌ ERRO GLOBAL:', error);
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({ error: 'Dados inválidos', details: error.message });
  }
  
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Token inválido' });
  }
  
  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expirado' });
  }

  if (error.code === 'ECONNREFUSED') {
    return res.status(503).json({ error: 'Erro de conexão com banco de dados' });
  }

  res.status(500).json({ 
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// ✅ ROTA PARA DEBUG - LISTAR ARQUIVOS DO SERVIDOR
app.get('/api/debug/files', async (req, res) => {
  try {
    // Listar arquivos das duas pastas principais
    const documentsFiles = await fs.readdir(DOCUMENTS_PATH).catch(() => []);
    const thumbnailsFiles = await fs.readdir(THUMBNAILS_PATH).catch(() => []);
    
    // Filtrar apenas PNGs dos thumbnails
    const thumbnailsPng = thumbnailsFiles.filter(file => file.endsWith('.png'));
    
    // Obter estatísticas dos thumbnails
    const thumbnailsStats = [];
    for (const file of thumbnailsPng) {
      try {
        const filePath = path.join(THUMBNAILS_PATH, file);
        const stats = await fs.stat(filePath);
        thumbnailsStats.push({
          filename: file,
          size: stats.size,
          sizeFormatted: `${(stats.size / 1024).toFixed(1)} KB`,
          created: stats.birthtime,
          modified: stats.mtime,
          url: `/thumbnails/${file}`
        });
      } catch (error) {
        thumbnailsStats.push({
          filename: file,
          error: 'Erro ao obter estatísticas'
        });
      }
    }

    res.json({
      success: true,
      environment: process.env.NODE_ENV || 'development',
      serverInfo: {
        currentWorkingDirectory: process.cwd(),
        serverDirectory: __dirname,
        nodeVersion: process.version
      },
      paths: {
        documentsPath: DOCUMENTS_PATH,
        thumbnailsPath: THUMBNAILS_PATH
      },
      files: {
        documents: {
          total: documentsFiles.length,
          files: documentsFiles
        },
        thumbnails: {
          total: thumbnailsPng.length,
          totalAllFiles: thumbnailsFiles.length,
          files: thumbnailsStats
        }
      },
      memory: {
        used: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heap: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao listar arquivos:', error);
    res.status(500).json({ 
      error: 'Erro ao listar arquivos',
      details: error.message,
      paths: {
        documentsPath: DOCUMENTS_PATH,
        thumbnailsPath: THUMBNAILS_PATH
      }
    });
  }
});

// ROTA: Alterar senha do usuário
app.post('/api/usuario/alterar-senha', authMiddleware, async (req, res) => {
  try {
    const { senhaAtual, novaSenha } = req.body;
    const userId = req.user.id;

    if (!senhaAtual || !novaSenha) {
      return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
    }

    if (novaSenha.length < 6) {
      return res.status(400).json({ error: 'Nova senha deve ter pelo menos 6 caracteres' });
    }

    // Buscar usuário atual
    const userResult = await pool.query('SELECT senha FROM usuarios WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = userResult.rows[0];

    // Verificar senha atual
    const senhaValida = await bcrypt.compare(senhaAtual, user.senha);
    if (!senhaValida) {
      return res.status(400).json({ error: 'Senha atual incorreta' });
    }

    // Hash da nova senha
    const novaSenhaHash = await bcrypt.hash(novaSenha, 10);

    // Atualizar no banco
    await pool.query(
      'UPDATE usuarios SET senha = $1, atualizado_em = NOW() WHERE id = $2',
      [novaSenhaHash, userId]
    );

    console.log(`✅ Senha alterada para usuário ${userId}`);

    res.json({
      message: 'Senha alterada com sucesso!'
    });

  } catch (error) {
    console.error('❌ Erro ao alterar senha:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ROTA: Atualizar dados pessoais do usuário
app.put('/api/usuario/atualizar-dados', authMiddleware, async (req, res) => {
  try {
    const { nome, email_pessoal, setor, tipo_colaborador } = req.body;
    const userId = req.user.id;
    const userTipo = req.user.tipo_usuario;

    // Validação básica
    if (!nome) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    // Verificar se usuário existe
    const userResult = await pool.query(
      'SELECT id, tipo_usuario FROM usuarios WHERE id = $1 AND ativo = true',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Preparar campos para atualização
    let camposParaAtualizar = ['nome = $1'];
    let valores = [nome];
    let valorIndex = 2;

    // Email pessoal (todos podem editar)
    if (email_pessoal !== undefined) {
      camposParaAtualizar.push(`email_pessoal = $${valorIndex}`);
      valores.push(email_pessoal);
      valorIndex++;
    }

    // Setor e tipo_colaborador (só admin pode editar)
    if (userTipo === 'admin') {
      if (setor !== undefined) {
        camposParaAtualizar.push(`setor = $${valorIndex}`);
        valores.push(setor);
        valorIndex++;
      }
      
      if (tipo_colaborador !== undefined) {
        camposParaAtualizar.push(`tipo_colaborador = $${valorIndex}`);
        valores.push(tipo_colaborador);
        valorIndex++;
      }
    }

    // Adicionar timestamp e userId
    camposParaAtualizar.push(`atualizado_em = NOW()`);
    valores.push(userId);

    // Construir e executar query
    const query = `
      UPDATE usuarios 
      SET ${camposParaAtualizar.join(', ')} 
      WHERE id = $${valorIndex} AND ativo = true
      RETURNING id, nome, email_pessoal, setor, tipo_colaborador
    `;

    const result = await pool.query(query, valores);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Erro ao atualizar usuário' });
    }

    const usuarioAtualizado = result.rows[0];

    console.log(`✅ Dados atualizados para usuário ${userId}: ${nome}`);

    res.json({
      message: 'Dados atualizados com sucesso',
      usuario: usuarioAtualizado
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar dados do usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota catch-all para SPAs - deve ser a ÚLTIMA rota
app.get('*', (req, res) => {
  console.log(`🎯 CATCH-ALL: Redirecionando ${req.path} para index.html`);
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const limparTokensExpirados = async () => {
  try {
    const result = await pool.query(
      'DELETE FROM verificacoes_email WHERE expira_em < NOW() AND usado_em IS NULL'
    );
    console.log(`🧹 LIMPEZA: ${result.rowCount} tokens expirados removidos`);
  } catch (error) {
    console.error('❌ Erro na limpeza de tokens:', error);
  }
};

// Executar limpeza a cada hora
setInterval(limparTokensExpirados, 60 * 60 * 1000);

// ===============================================
// INICIALIZAÇÃO DO SERVIDOR
// ===============================================

async function iniciarServidor() {
  try {
    console.log('🚀 Iniciando servidor RMH Dashboards...');
    console.log(`📍 Ambiente: ${process.env.NODE_ENV || 'development'}`);

    // Testar conexão com banco
    await testarConexao();

    // Iniciar servidor
    const server = app.listen(PORT, '0.0.0.0', async () => {
      const isProduction = process.env.NODE_ENV === 'production';
      const isRailway = process.env.RAILWAY_VOLUME;
      const railwayUrl = process.env.RAILWAY_PUBLIC_DOMAIN;

      // Detectar ambiente
      let ambiente = 'development';
      if (isRailway) {
        ambiente = 'Railway (production)';
      } else if (isProduction) {
        ambiente = 'production';
      }

      console.log('\n🚀 =====================================');
      console.log('   RMH DASHBOARDS - SERVIDOR ONLINE');
      console.log('=====================================');

      console.log(`📍 Ambiente: ${ambiente}`);
      console.log(`🔧 Porta: ${PORT}`);
      console.log(`🕐 Iniciado em: ${new Date().toLocaleString('pt-BR')}`);

      // URLs baseadas no ambiente
      if (isRailway && railwayUrl) {
        console.log(`\n🌐 URLs de Acesso:`);
        console.log(`   📱 Aplicação: https://${railwayUrl}`);
        console.log(`   📊 API Base: https://${railwayUrl}/api`);
        console.log(`   🔐 Health Check: https://${railwayUrl}/health`);
        console.log(`   📈 Ping: https://${railwayUrl}/ping`);
      } else if (isProduction) {
        const baseUrl = process.env.API_BASE_URL || process.env.FRONTEND_URL || `http://localhost:${PORT}`;
        console.log(`\n🌐 URLs de Acesso:`);
        console.log(`   📱 Aplicação: ${baseUrl}`);
        console.log(`   📊 API Base: ${baseUrl}/api`);
        console.log(`   🔐 Health Check: ${baseUrl}/health`);
      } else {
        console.log(`\n🌐 URLs de Acesso (Local):`);
        console.log(`   📱 Aplicação: http://localhost:${PORT}`);
        console.log(`   📊 API Base: http://localhost:${PORT}/api`);
        console.log(`   🔐 Health Check: http://localhost:${PORT}/health`);
        console.log(`   📈 Ping: http://localhost:${PORT}/ping`);
      }

      // Informações do banco
      const dbUrl = process.env.DATABASE_URL;
      if (dbUrl) {
        const dbHost = dbUrl.includes('railway') ? 'Railway PostgreSQL' :
                       dbUrl.includes('localhost') ? 'Local PostgreSQL' : 'PostgreSQL';
        console.log(`\n💾 Banco de dados: ${dbHost}`);
      }

      // Status do frontend
      if (isProduction) {
        console.log(`\n🎯 Frontend: Servido estaticamente da pasta dist/`);
        console.log(`📦 Build: Produção otimizada`);

        // Mostrar arquivos .js da pasta dist/assets usando fs.promises
        const assetsPath = path.join(__dirname, 'dist', 'assets');
        try {
          const files = await fs.readdir(assetsPath);
          const jsFiles = files.filter(file => file.endsWith('.js'));
          console.log('\n📦 Arquivos .js em dist/assets:');
          jsFiles.forEach(file => console.log(`   - ${file}`));
        } catch (err) {
          console.error('❌ Erro ao listar arquivos em dist/assets:', err.message);
        }
      } else {
        console.log(`\n🛠️ Frontend: Modo desenvolvimento`);
        console.log(`📦 Build: Vite dev server (porta 8080)`);
      }

      // Configurações importantes
      console.log(`\n⚙️ Configurações:`);
      console.log(`   🔒 CORS: ${isProduction ? 'Restrito (Railway)' : 'Liberado (Local)'}`);
      console.log(`   📧 Email: ${process.env.RESEND_API_KEY ? 'Configurado' : 'Não configurado'}`);
      console.log(`   🔑 JWT: ${process.env.JWT_SECRET ? 'Configurado' : 'Não configurado'}`);
      console.log(`   📊 Power BI: ${process.env.POWERBI_CLIENT_ID ? 'Configurado' : 'Não configurado'}`);

      console.log('\n✅ Servidor pronto para receber requisições!');
      console.log('=====================================\n');
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('🔄 Recebido SIGTERM. Fechando servidor graciosamente...');
      server.close(() => {
        console.log('✅ Servidor fechado com sucesso');
        pool.end(() => {
          console.log('🔌 Pool de conexões PostgreSQL fechado');
          process.exit(0);
        });
      });
    });

    process.on('SIGINT', () => {
      console.log('🔄 Recebido SIGINT. Fechando servidor graciosamente...');
      server.close(() => {
        console.log('✅ Servidor fechado com sucesso');
        pool.end(() => {
          console.log('🔌 Pool de conexões PostgreSQL fechado');
          process.exit(0);
        });
      });
    });

  } catch (error) {
    console.error('❌ Falha ao iniciar servidor:', error);
    process.exit(1);
  }
}

// Iniciar servidor
iniciarServidor();

// ===============================================
// EXPORTS PARA TESTES (OPCIONAL)
// ===============================================

module.exports = app;