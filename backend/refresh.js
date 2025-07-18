// refresh.js - VERSÃO OTIMIZADA PARA RAILWAY
const path = require('path');
const fs = require('fs/promises');
const { Pool } = require('pg');
const puppeteer = require('puppeteer');
const sharp = require('sharp');

console.log('🚀 Iniciando sistema de refresh de thumbnails OTIMIZADO...');

// ✅ CONFIGURAÇÃO DE POOL OTIMIZADA PARA RAILWAY
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 2, // ✅ REDUZIDO: Máximo 2 conexões para Railway
  idleTimeoutMillis: 10000, // ✅ REDUZIDO: 10s
  connectionTimeoutMillis: 10000, // ✅ REDUZIDO: 10s
  query_timeout: 30000,
  statement_timeout: 30000,
  idle_in_transaction_session_timeout: 30000,
});

// ✅ CONFIGURAÇÃO DE LIMITES PARA RAILWAY
const RAILWAY_LIMITS = {
  MAX_CONCURRENT_BROWSERS: 1, // ✅ APENAS 1 browser por vez
  MAX_DOCUMENTS_PER_RUN: 10,  // ✅ Máximo 10 documentos por execução
  BROWSER_TIMEOUT: 30000,     // ✅ 30s timeout para operações
  MEMORY_CHECK_INTERVAL: 5000, // ✅ Verificar memória a cada 5s
  MAX_MEMORY_MB: 400          // ✅ Limite de memória (Railway = 512MB)
};

// ✅ MONITOR DE MEMÓRIA
function checkMemoryUsage() {
  const used = process.memoryUsage();
  const usedMB = Math.round(used.rss / 1024 / 1024);
  
  console.log(`🧠 Memória: ${usedMB}MB / ${RAILWAY_LIMITS.MAX_MEMORY_MB}MB`);
  
  if (usedMB > RAILWAY_LIMITS.MAX_MEMORY_MB) {
    console.error(`❌ MEMÓRIA CRÍTICA: ${usedMB}MB excede limite!`);
    return false;
  }
  return true;
}

let currentTimestamp = Date.now();

// ✅ CLASSE PARA GERENCIAR BROWSER COM SEGURANÇA
class SafeBrowserManager {
  constructor() {
    this.browser = null;
    this.isLaunching = false;
    this.lastUsed = null;
  }

  async getBrowser() {
    if (this.browser && !this.browser.isConnected()) {
      console.log('🔄 Browser desconectado, limpando referência');
      this.browser = null;
    }

    if (!this.browser && !this.isLaunching) {
      this.isLaunching = true;
      try {
        console.log('🚀 Lançando browser otimizado para Railway...');
        
        this.browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-extensions',
            '--disable-plugins',
            '--disable-images', // ✅ OTIMIZAÇÃO: Desabilitar imagens desnecessárias
            '--disable-javascript', // ✅ Para screenshots básicos
            '--memory-pressure-off',
            '--max_old_space_size=350', // ✅ Limite de memória do Node
            '--single-process', // ✅ CRÍTICO: Usar apenas 1 processo
          ],
          timeout: RAILWAY_LIMITS.BROWSER_TIMEOUT,
          dumpio: false, // ✅ Desabilitar logs verbosos
        });

        // ✅ CONFIGURAR EVENT LISTENERS
        this.browser.on('disconnected', () => {
          console.log('🔌 Browser desconectado');
          this.browser = null;
        });

        console.log('✅ Browser lançado com sucesso');
        
      } catch (error) {
        console.error('❌ Erro ao lançar browser:', error);
        this.browser = null;
        throw error;
      } finally {
        this.isLaunching = false;
      }
    }

    this.lastUsed = Date.now();
    return this.browser;
  }

  async closeBrowser() {
    if (this.browser) {
      try {
        console.log('🔒 Fechando browser...');
        await this.browser.close();
        console.log('✅ Browser fechado com sucesso');
      } catch (error) {
        console.error('❌ Erro ao fechar browser:', error);
      } finally {
        this.browser = null;
      }
    }
  }

  async forceCloseBrowser() {
    if (this.browser) {
      try {
        console.log('💥 Forçando fechamento do browser...');
        const pages = await this.browser.pages();
        await Promise.all(pages.map(page => page.close()));
        await this.browser.close();
        this.browser = null;
      } catch (error) {
        console.error('❌ Erro no fechamento forçado:', error);
        this.browser = null;
      }
    }
  }
}

// ✅ INSTÂNCIA GLOBAL DO BROWSER MANAGER
const browserManager = new SafeBrowserManager();

// ✅ FUNÇÃO OTIMIZADA PARA GERAR THUMBNAIL
async function generateGoogleSheetThumbnailOptimized(sheetId, documentId, titulo) {
  let page = null;
  const startMemory = process.memoryUsage().rss;
  
  try {
    // ✅ VERIFICAR MEMÓRIA ANTES DE COMEÇAR
    if (!checkMemoryUsage()) {
      throw new Error('Memória insuficiente para processar documento');
    }

    const thumbnailsPath = getThumbnailsPath();
    const imageName = `${currentTimestamp}_${sheetId}.png`;
    const imagePath = path.join(thumbnailsPath, imageName);

    // ✅ LOGS DETALHADOS DO CAMINHO
    console.log(`🔍 DEBUG CAMINHOS:`);
    console.log(`   📁 thumbnailsPath: ${thumbnailsPath}`);
    console.log(`   📄 imageName: ${imageName}`);
    console.log(`   🗂️ imagePath completo: ${imagePath}`);
    
    // ✅ VERIFICAR SE DIRETÓRIO EXISTE
    try {
      const dirStats = await fs.stat(thumbnailsPath);
      console.log(`   ✅ Diretório existe: ${dirStats.isDirectory()}`);
    } catch (error) {
      console.log(`   ❌ Erro ao verificar diretório: ${error.message}`);
    }
    
    console.log(`📸 Processando: ${titulo || sheetId}`);

    // ✅ OBTER BROWSER REUTILIZÁVEL
    const browser = await browserManager.getBrowser();
    if (!browser) {
      throw new Error('Não foi possível obter browser');
    }

    page = await browser.newPage();
    
    // ✅ CONFIGURAÇÕES MÍNIMAS DA PÁGINA
    await page.setViewport({ width: 1200, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (compatible; Bot/1.0)');
    
    // ✅ DESABILITAR RECURSOS DESNECESSÁRIOS
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // ✅ VERIFICAR SE É PÚBLICA (SIMPLIFICADO)
    const isPublic = await checkIfSheetIsPublic(page, sheetId);
    
    if (!isPublic) {
      console.log(`🔒 Planilha privada: ${sheetId}`);
      await page.close();
      await generateDefaultThumbnail(imagePath, sheetId);
      
      const thumbnailUrl = `/thumbnails/${imageName}`;
      await updateThumbnailInDatabase(documentId, thumbnailUrl);
      
      return {
        success: true,
        isPublic: false,
        thumbnailUrl,
        status: 'private_fallback'
      };
    }

    // ✅ CAPTURAR SCREENSHOT RÁPIDO
    console.log(`📸 Capturando screenshot: ${sheetId}`);
    await page.screenshot({
      path: imagePath,
      type: 'png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 1200, height: 800 }
    });

    await page.close();
    page = null;

    // ✅ VERIFICAR SE ARQUIVO FOI CRIADO
    const stats = await fs.stat(imagePath);
    if (stats.size === 0) {
      console.log(`⚠️ Screenshot vazio, gerando fallback`);
      await generateDefaultThumbnail(imagePath, sheetId);
    }

    const thumbnailUrl = `/thumbnails/${imageName}`;
    await updateThumbnailInDatabase(documentId, thumbnailUrl);

    const endMemory = process.memoryUsage().rss;
    const memoryDiff = Math.round((endMemory - startMemory) / 1024 / 1024);
    console.log(`✅ Thumbnail gerado: ${imageName} (${memoryDiff}MB usado)`);
    console.log(`🔍 DEBUG: currentTimestamp = ${currentTimestamp}`);
    console.log(`🔍 DEBUG: sheetId = ${sheetId}`);
    console.log(`🔍 DEBUG: imageName = ${imageName}`);

    return {
      success: true,
      isPublic: true,
      thumbnailUrl,
      status: 'screenshot_success'
    };

  } catch (error) {
    console.error(`❌ Erro ao gerar thumbnail ${sheetId}:`, error.message);
    
    // ✅ LIMPEZA SEGURA DA PÁGINA
    if (page) {
      try {
        await page.close();
      } catch (closeError) {
        console.error('❌ Erro ao fechar página:', closeError.message);
      }
    }

    // ✅ FALLBACK PARA THUMBNAIL PADRÃO
    try {
      const thumbnailsPath = getThumbnailsPath();
      const imageName = `${currentTimestamp}_${sheetId}.png`;
      const imagePath = path.join(thumbnailsPath, imageName);
      await generateDefaultThumbnail(imagePath, sheetId, 'Erro Técnico');
      
      const thumbnailUrl = `/thumbnails/${imageName}`;
      await updateThumbnailInDatabase(documentId, thumbnailUrl);
      
      return {
        success: true,
        isPublic: false,
        thumbnailUrl,
        status: 'error_fallback',
        error: error.message
      };
    } catch (fallbackError) {
      console.error(`❌ Erro crítico no fallback:`, fallbackError.message);
      return {
        success: false,
        status: 'critical_error',
        error: fallbackError.message
      };
    }
  }
}

// ✅ FUNÇÃO SIMPLIFICADA PARA VERIFICAR SE PLANILHA É PÚBLICA
async function checkIfSheetIsPublic(page, sheetId) {
  try {
    const testUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit#gid=0`;
    const response = await page.goto(testUrl, { 
      waitUntil: 'domcontentloaded', 
      timeout: 15000 
    });
    
    if (!response.ok()) {
      return false;
    }

    // ✅ VERIFICAÇÃO SIMPLES: Se foi redirecionado para login
    const currentUrl = page.url();
    return !currentUrl.includes('accounts.google.com');
    
  } catch (error) {
    console.log(`⚠️ Erro ao verificar acesso: ${error.message}`);
    return false;
  }
}

// ✅ FUNÇÃO PRINCIPAL OTIMIZADA PARA RAILWAY
async function refreshWebThumbnailsOptimized() {
  const thumbnailsPath = getThumbnailsPath();
    try {
      const files = await fs.readdir(thumbnailsPath);
      await Promise.all(files.map(file => fs.unlink(path.join(thumbnailsPath, file))));
      console.log(`🗑️ Limpeza de thumbnails antiga concluída`);
    } catch (error) {
      console.error('❌ Erro ao limpar thumbnails antigos:', error.message);
    }
  const startTime = new Date();
  console.log(`🔄 [${startTime.toISOString()}] INICIANDO REFRESH OTIMIZADO...`);
  
  try {
    // ✅ BUSCAR DOCUMENTOS COM LIMITE
    const result = await pool.query(`
      SELECT id, titulo, url_arquivo, thumbnail_url, categoria
      FROM documentos 
      WHERE ativo = true 
      AND url_arquivo LIKE '%docs.google.com/spreadsheets%'
      ORDER BY atualizado_em DESC                                                                                                                                                                                                                                                                                                                                                                                                    
    `);

    const webDocuments = result.rows;
    console.log(`📊 Processando ${webDocuments.length} documentos (limite: ${RAILWAY_LIMITS.MAX_DOCUMENTS_PER_RUN})`);

    let atualizados = 0;
    let erros = 0;
    const detalhesProcessamento = [];

    // ✅ PROCESSAR SEQUENCIALMENTE (NÃO PARALELO)
    for (let i = 0; i < webDocuments.length; i++) {
      const doc = webDocuments[i];
      
      try {
        // ✅ VERIFICAR MEMÓRIA ANTES DE CADA DOCUMENTO
        if (!checkMemoryUsage()) {
          console.log(`⚠️ Memória insuficiente, parando processamento`);
          break;
        }

        console.log(`🔄 [${i + 1}/${webDocuments.length}] ${doc.titulo}`);

        const sheetId = doc.url_arquivo.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
        if (!sheetId) {
          console.log(`⚠️ Sheet ID não encontrado: ${doc.url_arquivo}`);
          continue;
        }

        const resultado = await generateGoogleSheetThumbnailOptimized(
          sheetId, 
          doc.id, 
          doc.titulo
        );

        detalhesProcessamento.push({
          id: doc.id,
          titulo: doc.titulo,
          sheetId: sheetId,
          status: resultado.status,
          thumbnailUrl: resultado.thumbnailUrl,
          isPublic: resultado.isPublic,
          dataProcessamento: new Date().toISOString()
        });

        if (resultado.success) {
          atualizados++;
        } else {
          erros++;
        }

        // ✅ DELAY ENTRE DOCUMENTOS
        if (i < webDocuments.length - 1) {
          console.log(`⏳ Aguardando 3 segundos...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }

      } catch (error) {
        erros++;
        console.error(`❌ Erro ao processar ${doc.titulo}:`, error.message);
        
        detalhesProcessamento.push({
          id: doc.id,
          titulo: doc.titulo,
          status: 'erro',
          erro: error.message,
          dataProcessamento: new Date().toISOString()
        });
      }
    }

    // ✅ FECHAR BROWSER SEMPRE
    await browserManager.closeBrowser();

    const endTime = new Date();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`🎉 REFRESH CONCLUÍDO em ${duration}s:`);
    console.log(`   📊 Processados: ${webDocuments.length}`);
    console.log(`   ✅ Atualizados: ${atualizados}`);
    console.log(`   ❌ Erros: ${erros}`);

    // ✅ SALVAR LOG RESUMO
    await pool.query(`
      INSERT INTO logs_sistema (evento, detalhes, criado_em)
      VALUES ('cron_refresh_optimized', $1, CURRENT_TIMESTAMP)
    `, [JSON.stringify({ 
      total: webDocuments.length, 
      regenerados: atualizados,
      erros,
      duracao_segundos: parseFloat(duration),
      memoria_final_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      executado_via: 'railway_cron_optimized',
      timestamp: endTime.toISOString()
    })]);

    return { 
      total: webDocuments.length, 
      regenerados: atualizados,
      erros,
      duracao: duration,
      detalhes: detalhesProcessamento
    };

  } catch (error) {
    console.error('❌ Erro crítico no refresh:', error);
    
    // ✅ LIMPEZA DE EMERGÊNCIA
    await browserManager.forceCloseBrowser();
    
    throw error;
  }
}

// ✅ IMPLEMENTAR OUTRAS FUNÇÕES NECESSÁRIAS
function getThumbnailsPath() {
  const alternatives = [
    '/app/storage/thumbnails', // Railway com volume
    path.join(__dirname, '..', 'dist', 'thumbnails'),
    path.join(process.cwd(), 'public', 'thumbnails'),
    '/tmp/thumbnails'
  ];
  
  for (const altPath of alternatives) {
    try {
      require('fs').mkdirSync(altPath, { recursive: true });
      return altPath;
    } catch (error) {
      continue;
    }
  }
  
  return alternatives[0];
}

async function generateDefaultThumbnail(imagePath, sheetId, title = 'Planilha Privada') {
  try {
    const sharp = require('sharp');
    
    const svgImage = `
      <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="300" fill="#d4f7d4"/>
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

    await sharp(Buffer.from(svgImage))
      .png()
      .toFile(imagePath);
      
    console.log(`✅ Thumbnail padrão criado: ${sheetId}`);
    
  } catch (error) {
    console.error(`❌ Erro ao gerar thumbnail padrão:`, error.message);
  }
}

async function updateThumbnailInDatabase(documentId, thumbnailUrl) {
  try {
    const result = await pool.query(`
      UPDATE documentos 
      SET thumbnail_url = $1, atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, titulo
    `, [thumbnailUrl, documentId]);
    
    if (result.rowCount > 0) {
      console.log(`💾 DB atualizado: ${result.rows[0].titulo}`);
    }
    
    return result.rowCount > 0;
  } catch (error) {
    console.error(`❌ Erro ao atualizar DB:`, error.message);
    return false;
  }
}

// ✅ CRIAR TABELA DE LOGS
async function createLogsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS logs_sistema (
        id SERIAL PRIMARY KEY,
        evento VARCHAR(100) NOT NULL,
        detalhes TEXT,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (error) {
    console.error('❌ Erro ao criar tabela de logs:', error);
  }
}

// ✅ MAIN FUNCTION COM LIMPEZA GARANTIDA
async function main() {
  let isRunning = false;
  
  // ✅ PREVENIR EXECUÇÕES SIMULTÂNEAS
  if (isRunning) {
    console.log('⚠️ Cron já está executando, ignorando...');
    return;
  }
  
  isRunning = true;
  
  try {
    console.log('🚀 Iniciando execução OTIMIZADA do Railway Cron...');
    
    // ✅ VERIFICAR MEMÓRIA INICIAL
    const initialMemory = Math.round(process.memoryUsage().rss / 1024 / 1024);
    console.log(`🧠 Memória inicial: ${initialMemory}MB`);
    
    if (initialMemory > RAILWAY_LIMITS.MAX_MEMORY_MB) {
      throw new Error(`Memória inicial (${initialMemory}MB) excede limite`);
    }

    await createLogsTable();
    
    const result = await refreshWebThumbnailsOptimized();
    
    console.log(`✅ Execução concluída!`);
    console.log(`📊 Resultado: ${result.regenerados}/${result.total} em ${result.duracao}s`);
    
    const finalMemory = Math.round(process.memoryUsage().rss / 1024 / 1024);
    console.log(`🧠 Memória final: ${finalMemory}MB`);
    
  } catch (error) {
    console.error('❌ Erro na execução:', error.message);
    
    // ✅ LIMPEZA DE EMERGÊNCIA
    await browserManager.forceCloseBrowser();
    
    // ✅ FORÇAR GARBAGE COLLECTION
    if (global.gc) {
      global.gc();
      console.log('🗑️ Garbage collection forçado');
    }
    
  } finally {
    isRunning = false;
    
    // ✅ LIMPEZA FINAL GARANTIDA
    await browserManager.closeBrowser();
    await pool.end();
    
    console.log('🏁 Processo finalizado');
    process.exit(0);
  }
}

// ✅ HANDLER DE SINAIS
process.on('SIGTERM', async () => {
  console.log('🔄 SIGTERM recebido, limpando recursos...');
  await browserManager.forceCloseBrowser();
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🔄 SIGINT recebido, limpando recursos...');
  await browserManager.forceCloseBrowser();
  await pool.end();
  process.exit(0);
});

// ✅ MONITOR DE MEMÓRIA EM BACKGROUND
setInterval(() => {
  checkMemoryUsage();
}, RAILWAY_LIMITS.MEMORY_CHECK_INTERVAL);

// ✅ EXECUTAR
main().catch(console.error);