// backend/refreshThumbnails.js - SEMPRE ATUALIZA MINIATURAS

const path = require('path');
const fs = require('fs/promises');

// ✅ FUNÇÃO PARA OBTER CAMINHO DOS THUMBNAILS
function getThumbnailsPath() {
  // Mesma lógica do server.js
  const alternatives = [
    path.join(__dirname, '..', 'dist', 'thumbnails'),
    path.join(process.cwd(), 'public', 'thumbnails'),
    path.join(process.cwd(), 'dist', 'thumbnails')
  ];
  
  for (const altPath of alternatives) {
    try {
      require('fs').mkdirSync(altPath, { recursive: true });
      return altPath;
    } catch (error) {
      continue;
    }
  }
  
  return alternatives[0]; // fallback
}

// ✅ FUNÇÃO PRINCIPAL - SEMPRE DELETA CACHE E REGENERA
async function refreshWebThumbnails(pool, baseUrl = 'http://localhost:3001') {
  console.log('🔄 INICIANDO REFRESH DE THUMBNAILS WEB (FORÇA REGENERAÇÃO)...');
  
  try {
    // Buscar todos os documentos que são arquivos da web
    const result = await pool.query(`
      SELECT id, titulo, url_arquivo, thumbnail_url, categoria
      FROM documentos 
      WHERE ativo = true 
      AND (
        url_arquivo LIKE '%docs.google.com/spreadsheets%' OR
        url_arquivo LIKE '%docs.google.com/document%' OR
        url_arquivo LIKE '%drive.google.com%' OR
        url_arquivo LIKE 'http%'
      )
      ORDER BY atualizado_em DESC
    `);

    const webDocuments = result.rows;
    console.log(`📊 Encontrados ${webDocuments.length} documentos web para atualizar`);

    let atualizados = 0;
    let erros = 0;
    const thumbnailsPath = getThumbnailsPath();

    // Processar cada documento
    for (const doc of webDocuments) {
      try {
        console.log(`🔄 Processando: ${doc.titulo} (ID: ${doc.id})`);

        const fileType = getFileType(doc.url_arquivo);
        let apiUrl = null;

        // ✅ GOOGLE SHEETS: DELETAR CACHE E REGENERAR
        if (fileType === 'google-sheet') {
          const sheetId = doc.url_arquivo.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
          if (sheetId) {
            // 🗑️ DELETAR CACHE PRIMEIRO
            try {
              const cacheFile = path.join(thumbnailsPath, `${sheetId}.png`);
              await fs.unlink(cacheFile);
              console.log(`🗑️ Cache removido: ${sheetId}.png`);
            } catch (error) {
              console.log(`ℹ️ Cache não existia ou já removido: ${sheetId}.png`);
            }
            
            // Chamar API para regenerar
            apiUrl = `${baseUrl}/api/thumbnail?sheetId=${sheetId}&documentId=${doc.id}`;
          }
        } 
        // ✅ WEBSITES: DELETAR CACHE E REGENERAR
        else if (fileType === 'website') {
          try {
            const domain = new URL(doc.url_arquivo).hostname.replace(/[^a-zA-Z0-9]/g, '-');
            const cacheFile = path.join(thumbnailsPath, `website-${domain}.png`);
            await fs.unlink(cacheFile);
            console.log(`🗑️ Cache removido: website-${domain}.png`);
          } catch (error) {
            console.log(`ℹ️ Cache não existia para website`);
          }
          
          // Chamar API para regenerar
          apiUrl = `${baseUrl}/api/website-screenshot?url=${encodeURIComponent(doc.url_arquivo)}&documentId=${doc.id}`;
        } 
        // ✅ GOOGLE DOCS: ATUALIZAR URL DIRETAMENTE
        else if (fileType === 'google-doc') {
          const docId = doc.url_arquivo.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
          if (docId) {
            const thumbnailUrl = `https://drive.google.com/thumbnail?id=${docId}&sz=w500-h650`;
            
            const updateResult = await pool.query(`
              UPDATE documentos 
              SET thumbnail_url = $1, atualizado_em = CURRENT_TIMESTAMP
              WHERE id = $2
            `, [thumbnailUrl, doc.id]);
            
            if (updateResult.rowCount > 0) {
              atualizados++;
              console.log(`✅ Google Doc atualizado: ${doc.titulo}`);
            }
            continue;
          }
        }

        // ✅ CHAMAR API PARA REGENERAR THUMBNAIL
        if (apiUrl) {
          console.log(`📡 Chamando API: ${apiUrl}`);
          
          const response = await fetch(apiUrl, {
            method: 'GET',
            timeout: 60000
          });

          if (response.ok) {
            const data = await response.json();
            atualizados++;
            console.log(`✅ Thumbnail regenerado: ${doc.titulo} - ${data.thumbnailUrl || 'sucesso'}`);
          } else {
            console.log(`⚠️ API retornou erro para ${doc.titulo}: ${response.status}`);
            erros++;
          }
        } else {
          console.log(`⚠️ Tipo não suportado para refresh: ${fileType} - ${doc.titulo}`);
        }

        // Delay entre requisições para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        erros++;
        console.error(`❌ Erro ao processar ${doc.titulo}:`, error.message);
      }
    }

    console.log(`🎉 REFRESH CONCLUÍDO:`);
    console.log(`   📊 Total processados: ${webDocuments.length}`);
    console.log(`   ✅ Thumbnails regenerados: ${atualizados}`);
    console.log(`   ❌ Erros: ${erros}`);

    // Salvar log no banco
    await pool.query(`
      INSERT INTO logs_sistema (evento, detalhes, criado_em)
      VALUES ('refresh_thumbnails', $1, CURRENT_TIMESTAMP)
    `, [JSON.stringify({ 
      total: webDocuments.length, 
      regenerados: atualizados,
      erros,
      timestamp: new Date().toISOString(),
      modo: 'sempre_regenera'
    })]);

    return { 
      total: webDocuments.length, 
      regenerados: atualizados,
      erros 
    };

  } catch (error) {
    console.error('❌ Erro no refresh de thumbnails:', error);
    throw error;
  }
}

// ✅ FUNÇÃO PARA LIMPAR TODOS OS CACHES E REGENERAR TUDO
async function forceRefreshAllThumbnails(pool, baseUrl = 'http://localhost:3001') {
  console.log('🔄 INICIANDO LIMPEZA TOTAL DE CACHE...');
  
  try {
    const thumbnailsPath = getThumbnailsPath();
    
    // 🗑️ LIMPAR PASTA INTEIRA DE THUMBNAILS
    try {
      const files = await fs.readdir(thumbnailsPath);
      console.log(`🗑️ Removendo ${files.length} arquivos de cache...`);
      
      for (const file of files) {
        if (file.endsWith('.png')) {
          await fs.unlink(path.join(thumbnailsPath, file));
        }
      }
      console.log(`✅ Cache limpo: ${files.length} arquivos removidos`);
    } catch (error) {
      console.log(`ℹ️ Pasta de cache vazia ou não existe`);
    }

    // Agora executar refresh normal (vai regenerar tudo)
    return await refreshWebThumbnails(pool, baseUrl);

  } catch (error) {
    console.error('❌ Erro no refresh total:', error);
    throw error;
  }
}

// ✅ FUNÇÃO AUXILIAR PARA DETECTAR TIPO DE ARQUIVO
function getFileType(url) {
  if (url.includes('docs.google.com/spreadsheets')) return 'google-sheet';
  if (url.includes('docs.google.com/document')) return 'google-doc';
  if (url.includes('drive.google.com')) return 'google-drive';
  if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) return 'image';
  if (url.includes('.pdf') || url.includes('pdf')) return 'pdf';
  if (url.startsWith('http') && !url.includes('docs.google.com')) return 'website';
  return 'unknown';
}

// ✅ FUNÇÃO PARA CRIAR TABELA DE LOGS
async function createLogsTable(pool) {
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

// ✅ ENDPOINTS PARA USAR NO SERVER.JS
function addRefreshEndpoint(app, pool, authMiddleware) {
  // Endpoint para refresh (sempre regenera)
  app.post('/api/refresh-thumbnails', authMiddleware, async (req, res) => {
    try {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const result = await refreshWebThumbnails(pool, baseUrl);
      
      res.json({
        success: true,
        message: 'Refresh de thumbnails concluído (sempre regenera)',
        ...result
      });
    } catch (error) {
      console.error('❌ Erro no endpoint de refresh:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        message: error.message
      });
    }
  });

  // Endpoint para limpeza total + regeneração
  app.post('/api/refresh-all-thumbnails', authMiddleware, async (req, res) => {
    try {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const result = await forceRefreshAllThumbnails(pool, baseUrl);
      
      res.json({
        success: true,
        message: 'Limpeza total e regeneração concluída',
        ...result
      });
    } catch (error) {
      console.error('❌ Erro no endpoint de refresh total:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        message: error.message
      });
    }
  });
}

// ✅ EXPORTAR FUNÇÕES
module.exports = {
  refreshWebThumbnails,
  forceRefreshAllThumbnails,
  getFileType,
  createLogsTable,
  addRefreshEndpoint
};