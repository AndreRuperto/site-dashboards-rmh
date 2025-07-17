// backend/refreshThumbnails.js - REFATORADO

const path = require('path');
const fs = require('fs/promises');

// ✅ FUNÇÃO PRINCIPAL - USA A API QUE JÁ EXISTE
async function refreshWebThumbnails(pool, baseUrl = 'http://localhost:3001') {
  console.log('🔄 INICIANDO REFRESH DE THUMBNAILS WEB...');
  
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
    let pularCache = 0;

    // Processar cada documento
    for (const doc of webDocuments) {
      try {
        console.log(`🔄 Processando: ${doc.titulo} (ID: ${doc.id})`);

        const fileType = getFileType(doc.url_arquivo);
        let apiUrl = null;

        // ✅ USAR A API QUE JÁ EXISTE NO SERVER.JS
        if (fileType === 'google-sheet') {
          const sheetId = doc.url_arquivo.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
          if (sheetId) {
            // Chamar a API de thumbnail que já existe
            apiUrl = `${baseUrl}/api/thumbnail?sheetId=${sheetId}&documentId=${doc.id}`;
          }
        } else if (fileType === 'website') {
          // Chamar a API de screenshot que já existe
          apiUrl = `${baseUrl}/api/website-screenshot?url=${encodeURIComponent(doc.url_arquivo)}&documentId=${doc.id}`;
        } else if (fileType === 'google-doc') {
          // Para Google Docs, atualizar diretamente no banco (API do Google)
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

        if (apiUrl) {
          console.log(`📡 Chamando API: ${apiUrl}`);
          
          const response = await fetch(apiUrl, {
            method: 'GET',
            timeout: 60000 // 60 segundos timeout
          });

          if (response.ok) {
            const data = await response.json();
            
            if (data.cached) {
              pularCache++;
              console.log(`♻️ Thumbnail em cache: ${doc.titulo}`);
            } else {
              atualizados++;
              console.log(`✅ Thumbnail atualizado: ${doc.titulo} - ${data.thumbnailUrl}`);
            }
          } else {
            console.log(`⚠️ API retornou erro para ${doc.titulo}: ${response.status}`);
            erros++;
          }
        } else {
          console.log(`⚠️ Tipo não suportado para refresh: ${fileType} - ${doc.titulo}`);
        }

        // Delay entre requisições para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 3000));

      } catch (error) {
        erros++;
        console.error(`❌ Erro ao processar ${doc.titulo}:`, error.message);
      }
    }

    console.log(`🎉 REFRESH CONCLUÍDO:`);
    console.log(`   📊 Total processados: ${webDocuments.length}`);
    console.log(`   ✅ Atualizados: ${atualizados}`);
    console.log(`   ♻️ Cache aproveitado: ${pularCache}`);
    console.log(`   ❌ Erros: ${erros}`);

    // Salvar log no banco
    await pool.query(`
      INSERT INTO logs_sistema (evento, detalhes, criado_em)
      VALUES ('refresh_thumbnails', $1, CURRENT_TIMESTAMP)
    `, [JSON.stringify({ 
      total: webDocuments.length, 
      atualizados, 
      cache: pularCache,
      erros,
      timestamp: new Date().toISOString()
    })]);

    return { 
      total: webDocuments.length, 
      atualizados, 
      cache: pularCache, 
      erros 
    };

  } catch (error) {
    console.error('❌ Erro no refresh de thumbnails:', error);
    throw error;
  }
}

// ✅ FUNÇÃO PARA FORÇAR REGENERAÇÃO (SEM CACHE)
async function forceRefreshThumbnails(pool, baseUrl = 'http://localhost:3001') {
  console.log('🔄 INICIANDO REFRESH FORÇADO (SEM CACHE)...');
  
  try {
    // Buscar apenas documentos com problemas de thumbnail
    const result = await pool.query(`
      SELECT id, titulo, url_arquivo, thumbnail_url, categoria
      FROM documentos 
      WHERE ativo = true 
      AND (
        thumbnail_url IS NULL OR
        thumbnail_url = '' OR
        (url_arquivo LIKE '%docs.google.com/spreadsheets%' AND thumbnail_url NOT LIKE '/thumbnails/%')
      )
      ORDER BY atualizado_em DESC
      LIMIT 50
    `);

    const problematicDocs = result.rows;
    console.log(`🔧 Encontrados ${problematicDocs.length} documentos com problemas de thumbnail`);

    // Primeiro, limpar cache físico para forçar regeneração
    for (const doc of problematicDocs) {
      const fileType = getFileType(doc.url_arquivo);
      
      if (fileType === 'google-sheet') {
        const sheetId = doc.url_arquivo.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
        if (sheetId) {
          try {
            // Tentar deletar arquivo de cache
            const thumbnailsPath = path.join(process.cwd(), 'dist', 'thumbnails');
            const cacheFile = path.join(thumbnailsPath, `${sheetId}.png`);
            await fs.unlink(cacheFile);
            console.log(`🗑️ Cache removido para: ${sheetId}`);
          } catch (error) {
            // Ignorar erro se arquivo não existir
          }
        }
      }
    }

    // Agora chamar a API normal para regenerar
    return await refreshWebThumbnails(pool, baseUrl);

  } catch (error) {
    console.error('❌ Erro no refresh forçado:', error);
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

// ✅ FUNÇÃO PARA CRIAR TABELA DE LOGS (EXECUTAR UMA VEZ)
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

// ✅ ENDPOINT PARA USAR NO SERVER.JS
function addRefreshEndpoint(app, pool, authMiddleware) {
  // Endpoint para refresh normal
  app.post('/api/refresh-thumbnails', authMiddleware, async (req, res) => {
    try {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const result = await refreshWebThumbnails(pool, baseUrl);
      
      res.json({
        success: true,
        message: 'Refresh de thumbnails concluído',
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

  // Endpoint para refresh forçado
  app.post('/api/force-refresh-thumbnails', authMiddleware, async (req, res) => {
    try {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const result = await forceRefreshThumbnails(pool, baseUrl);
      
      res.json({
        success: true,
        message: 'Refresh forçado concluído',
        ...result
      });
    } catch (error) {
      console.error('❌ Erro no endpoint de refresh forçado:', error);
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
  forceRefreshThumbnails,
  getFileType,
  createLogsTable,
  addRefreshEndpoint
};