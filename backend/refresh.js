// backend/refreshThumbnails.js - ADAPTADO AO CÓDIGO ATUAL

const path = require('path');
const fs = require('fs/promises');
const { Pool } = require('pg');
const puppeteer = require('puppeteer');
const sharp = require('sharp');

console.log('🚀 Iniciando sistema de refresh de thumbnails...');

// ✅ CONFIGURAÇÃO DO BANCO (ADAPTADA)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
  query_timeout: 60000,
  statement_timeout: 60000,
  idle_in_transaction_session_timeout: 60000,
});

// Log para debug
console.log('🔗 Tentando conectar ao banco...');
console.log('🌍 NODE_ENV:', process.env.NODE_ENV);
console.log('📦 DATABASE_URL:', process.env.DATABASE_URL ? 'Configurada' : 'Não encontrada');

// ✅ FUNÇÃO PARA OBTER CAMINHO DOS THUMBNAILS (IGUAL AO SERVER.JS)
function getThumbnailsPath() {
  const alternatives = [
    path.join(__dirname, '..', 'dist', 'thumbnails'),
    path.join(process.cwd(), 'public', 'thumbnails'),
    path.join(process.cwd(), 'dist', 'thumbnails'),
    '/tmp/thumbnails' // Para Railway
  ];
  
  for (const altPath of alternatives) {
    try {
      require('fs').mkdirSync(altPath, { recursive: true });
      console.log(`📁 Usando diretório de thumbnails: ${altPath}`);
      return altPath;
    } catch (error) {
      continue;
    }
  }
  
  return alternatives[0];
}

// ✅ FUNÇÃO PARA GERAR THUMBNAIL PADRÃO (IGUAL AO SERVER.JS)
async function generateDefaultThumbnail(imagePath, sheetId, title = 'Planilha Privada') {
  console.log(`🎨 Gerando thumbnail padrão para: ${sheetId}`);
  
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

  try {
    // Criar a base verde com grid
    const baseImage = await sharp(Buffer.from(svgImage)).png().toBuffer();

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
        
      console.log(`✅ Thumbnail padrão criado com cadeado: ${sheetId}`);
      
    } catch (cadeadoError) {
      console.log(`⚠️ Erro ao sobrepor cadeado, salvando só o grid:`, cadeadoError.message);
      
      // Fallback: salvar só a imagem base se der erro com o cadeado
      await sharp(baseImage).toFile(imagePath);
      console.log(`✅ Thumbnail padrão criado (sem cadeado): ${sheetId}`);
    }
    
  } catch (error) {
    console.error(`❌ Erro ao gerar thumbnail padrão:`, error.message);
    throw error;
  }
}

// ✅ FUNÇÃO PARA VERIFICAR SE GOOGLE SHEET É PÚBLICO (ADAPTADA)
async function checkPublicAccessAndGenerate(page, sheetId) {
  try {
    const publicUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit#gid=0`;
    console.log(`🔍 Verificando acesso público: ${sheetId}`);
    
    await page.goto(publicUrl, { 
      waitUntil: 'networkidle0', 
      timeout: 30000 
    });
    
    await page.waitForSelector('body', { timeout: 5000 });
    
    const isPublic = await page.evaluate(() => {
      const bodyText = document.body.textContent || '';
      const hasError = bodyText.includes('acesso negado') || 
                      bodyText.includes('não tem permissão') ||
                      bodyText.includes('access denied') ||
                      bodyText.includes('permission denied') ||
                      bodyText.includes('sem permissão');
      
      return !hasError;
    });
    
    console.log(`${isPublic ? '🔓' : '🔒'} Planilha ${sheetId}: ${isPublic ? 'pública' : 'privada'}`);
    return { isPublic, method: 'navegacao-direta' };
    
  } catch (error) {
    console.log(`⚠️ Erro ao verificar acesso público para ${sheetId}:`, error.message);
    return { isPublic: false, method: 'erro' };
  }
}

// ✅ FUNÇÃO PARA ATUALIZAR THUMBNAIL NO BANCO (IGUAL AO SERVER.JS)
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

// ✅ FUNÇÃO PARA GERAR THUMBNAIL DE GOOGLE SHEET (ADAPTADA DO SERVER.JS)
async function generateGoogleSheetThumbnail(sheetId, documentId, titulo) {
  const thumbnailsPath = getThumbnailsPath();
  const imagePath = path.join(thumbnailsPath, `${sheetId}.png`);
  
  console.log(`📸 Gerando thumbnail para Google Sheet: ${sheetId}`);
  
  let browser = null;
  
  try {
    // Deletar cache primeiro (sempre regenerar)
    try {
      await fs.unlink(imagePath);
      console.log(`🗑️ Cache removido: ${sheetId}.png`);
    } catch (error) {
      console.log(`ℹ️ Cache não existia: ${sheetId}.png`);
    }
    
    // Configuração do Puppeteer (igual ao server.js)
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
      ],
      timeout: 30000
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    // Timeout de página
    page.setDefaultNavigationTimeout(30000);
    page.setDefaultTimeout(30000);
    
    // Verificar se é pública (igual ao server.js)
    const accessResult = await checkPublicAccessAndGenerate(page, sheetId);
    
    if (!accessResult.isPublic) {
      console.log(`🔒 Planilha privada detectada - gerando thumbnail padrão`);
      await browser.close();
      await generateDefaultThumbnail(imagePath, sheetId);
      
      const thumbnailUrl = `/thumbnails/${sheetId}.png`;
      await updateThumbnailInDatabase(documentId, thumbnailUrl);
      
      return { 
        success: true, 
        isPublic: false, 
        thumbnailUrl,
        titulo,
        status: 'privada'
      };
    }
    
    console.log(`🔓 Planilha pública - tentando fechar avisos...`);
    
    // Tentar fechar avisos automaticamente (igual ao server.js)
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
      
      console.log(`✅ Tentativa de fechar avisos concluída`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (closeError) {
      console.log(`⚠️ Erro ao tentar fechar avisos:`, closeError.message);
    }
    
    // Capturar screenshot (igual ao server.js)
    console.log(`📸 Capturando screenshot via ${accessResult.method}`);
    await page.screenshot({ 
      path: imagePath, 
      fullPage: accessResult.method === 'export-direto',
      type: 'png'
    });
    
    await browser.close();

    const stats = await fs.stat(imagePath);
    console.log(`📏 Screenshot capturado: ${stats.size} bytes`);
    
    if (stats.size === 0) {
      console.log(`⚠️ Screenshot vazio - gerando thumbnail padrão`);
      await generateDefaultThumbnail(imagePath, sheetId, 'Erro na Captura');
    }
    
    const thumbnailUrl = `/thumbnails/${sheetId}.png`;
    await updateThumbnailInDatabase(documentId, thumbnailUrl);
    
    return { 
      success: true, 
      isPublic: true, 
      thumbnailUrl,
      titulo,
      status: 'screenshot_capturado'
    };

  } catch (error) {
    console.error(`❌ Erro ao gerar thumbnail para ${sheetId}:`, error.message);
    
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error(`❌ Erro ao fechar browser:`, closeError.message);
      }
    }
    
    // Fallback para thumbnail padrão
    try {
      await generateDefaultThumbnail(imagePath, sheetId, 'Erro Técnico');
      
      const thumbnailUrl = `/thumbnails/${sheetId}.png`;
      await updateThumbnailInDatabase(documentId, thumbnailUrl);
      
      return { 
        success: true, 
        isPublic: false, 
        thumbnailUrl,
        titulo,
        status: 'erro_fallback',
        error: error.message 
      };
    } catch (fallbackError) {
      console.error(`❌ Erro crítico no fallback:`, fallbackError.message);
      return { 
        success: false, 
        titulo,
        status: 'erro_critico',
        error: fallbackError.message 
      };
    }
  }
}

// ✅ FUNÇÃO PRINCIPAL - REFRESH DE THUMBNAILS
async function refreshWebThumbnails() {
  const startTime = new Date();
  console.log(`🔄 [${startTime.toISOString()}] INICIANDO REFRESH DE THUMBNAILS WEB...`);
  
  try {
    const result = await pool.query(`
      SELECT id, titulo, url_arquivo, thumbnail_url, categoria
      FROM documentos 
      WHERE ativo = true 
      AND (
        url_arquivo LIKE '%docs.google.com/spreadsheets%' OR
        url_arquivo LIKE '%docs.google.com/document%'
      )
      ORDER BY atualizado_em DESC
    `);

    const webDocuments = result.rows;
    console.log(`📊 Encontrados ${webDocuments.length} documentos web para atualizar`);

    let atualizados = 0;
    let erros = 0;
    const detalhesProcessamento = []; // ✅ ARRAY PARA LOGS DETALHADOS

    for (const doc of webDocuments) {
      try {
        console.log(`🔄 Processando: ${doc.titulo} (ID: ${doc.id})`);

        const fileType = getFileType(doc.url_arquivo);
        let resultado = null;

        if (fileType === 'google-sheet') {
          const sheetId = doc.url_arquivo.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
          if (sheetId) {
            resultado = await generateGoogleSheetThumbnail(sheetId, doc.id, doc.titulo);
            
            // ✅ ADICIONAR AO LOG DETALHADO
            detalhesProcessamento.push({
              id: doc.id,
              titulo: doc.titulo,
              tipo: 'google-sheet',
              sheetId: sheetId,
              status: resultado.status,
              thumbnailUrl: resultado.thumbnailUrl,
              isPublic: resultado.isPublic,
              dataProcessamento: new Date().toISOString()
            });
            
            if (resultado.success) {
              atualizados++;
              console.log(`✅ Thumbnail atualizado: ${doc.titulo}`);
            } else {
              erros++;
              console.log(`❌ Erro ao atualizar: ${doc.titulo}`);
            }
          }
        } else if (fileType === 'google-doc') {
          const docId = doc.url_arquivo.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
          if (docId) {
            const thumbnailUrl = `https://drive.google.com/thumbnail?id=${docId}&sz=w500-h650`;
            
            const updateResult = await pool.query(`
              UPDATE documentos 
              SET thumbnail_url = $1, atualizado_em = CURRENT_TIMESTAMP
              WHERE id = $2
            `, [thumbnailUrl, doc.id]);
            
            // ✅ ADICIONAR AO LOG DETALHADO
            detalhesProcessamento.push({
              id: doc.id,
              titulo: doc.titulo,
              tipo: 'google-doc',
              docId: docId,
              status: 'api_google_drive',
              thumbnailUrl: thumbnailUrl,
              dataProcessamento: new Date().toISOString()
            });
            
            if (updateResult.rowCount > 0) {
              atualizados++;
              console.log(`✅ Google Doc atualizado: ${doc.titulo}`);
            }
          }
        }

        // Delay entre requisições
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        erros++;
        console.error(`❌ Erro ao processar ${doc.titulo}:`, error.message);
        
        // ✅ ADICIONAR ERRO AO LOG DETALHADO
        detalhesProcessamento.push({
          id: doc.id,
          titulo: doc.titulo,
          status: 'erro',
          erro: error.message,
          dataProcessamento: new Date().toISOString()
        });
      }
    }

    const endTime = new Date();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`🎉 [${endTime.toISOString()}] REFRESH CONCLUÍDO em ${duration}s:`);
    console.log(`   📊 Total processados: ${webDocuments.length}`);
    console.log(`   ✅ Thumbnails regenerados: ${atualizados}`);
    console.log(`   ❌ Erros: ${erros}`);

    // ✅ SALVAR LOG DETALHADO NO BANCO
    await pool.query(`
      INSERT INTO logs_sistema (evento, detalhes, criado_em)
      VALUES ('cron_refresh_thumbnails', $1, CURRENT_TIMESTAMP)
    `, [JSON.stringify({ 
      total: webDocuments.length, 
      regenerados: atualizados,
      erros,
      duracao_segundos: parseFloat(duration),
      executado_via: 'railway_cron',
      timestamp: endTime.toISOString(),
      detalhes_processamento: detalhesProcessamento // ✅ LOGS DETALHADOS POR DOCUMENTO
    })]);

    return { 
      total: webDocuments.length, 
      regenerados: atualizados,
      erros,
      duracao: duration,
      detalhes: detalhesProcessamento
    };

  } catch (error) {
    console.error('❌ Erro no refresh de thumbnails:', error);
    throw error;
  }
}

// ✅ FUNÇÃO AUXILIAR PARA DETECTAR TIPO DE ARQUIVO
function getFileType(url) {
  if (url.includes('docs.google.com/spreadsheets')) return 'google-sheet';
  if (url.includes('docs.google.com/document')) return 'google-doc';
  if (url.includes('drive.google.com')) return 'google-drive';
  return 'unknown';
}

// ✅ FUNÇÃO PARA CRIAR TABELA DE LOGS
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
    console.log('✅ Tabela logs_sistema criada/verificada');
  } catch (error) {
    console.error('❌ Erro ao criar tabela de logs:', error);
  }
}

// ✅ TESTE DE CONEXÃO
async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ Conexão com banco bem-sucedida!');
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Erro na conexão com banco:', error.message);
    return false;
  }
}

// ✅ FUNÇÃO PRINCIPAL PARA RAILWAY CRON
async function main() {
  try {
    console.log('🚀 Iniciando execução do Railway Cron...');
    
    // Testar conexão primeiro
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Não foi possível conectar ao banco de dados');
    }
    
    // Inicializar banco
    await createLogsTable();
    
    // Executar refresh
    const result = await refreshWebThumbnails();
    
    console.log(`✅ Execução concluída com sucesso!`);
    console.log(`📊 Resumo: ${result.regenerados}/${result.total} thumbnails atualizados em ${result.duracao}s`);
    
    // ✅ MOSTRAR DETALHES DE CADA THUMBNAIL PROCESSADO
    console.log(`\n📋 DETALHES POR DOCUMENTO:`);
    result.detalhes.forEach((detalhe, index) => {
      console.log(`${index + 1}. ${detalhe.titulo} - ${detalhe.status} - ${detalhe.thumbnailUrl || 'N/A'}`);
    });
    
    // Fechar conexões
    await pool.end();
    
    // Exit com sucesso
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erro na execução principal:', error);
    
    try {
      await pool.end();
    } catch (poolError) {
      console.error('❌ Erro ao fechar pool:', poolError);
    }
    
    // Exit com erro
    process.exit(1);
  }
}

// ✅ EXECUTAR IMEDIATAMENTE
main();