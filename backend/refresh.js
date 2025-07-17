// ✅ ADICIONAR NO backend/server.js (SEM CRON JOB)

// ✅ FUNÇÃO PARA ATUALIZAR THUMBNAILS DE ARQUIVOS WEB
async function refreshWebThumbnails() {
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
        url_arquivo LIKE '%drive.google.com%'
      )
      ORDER BY atualizado_em DESC
    `);

    const webDocuments = result.rows;
    console.log(`📊 Encontrados ${webDocuments.length} documentos web para atualizar`);

    let atualizados = 0;
    let erros = 0;

    // Processar cada documento
    for (const doc of webDocuments) {
      try {
        console.log(`🔄 Processando: ${doc.titulo} (ID: ${doc.id})`);

        // Detectar tipo de arquivo
        const fileType = getFileType(doc.url_arquivo);
        let thumbnailUrl = null;

        if (fileType === 'google-sheet') {
          // Atualizar thumbnail do Google Sheets
          const sheetId = doc.url_arquivo.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
          if (sheetId) {
            thumbnailUrl = await generateSheetThumbnail(sheetId, doc.id);
          }
        } else if (fileType === 'google-doc') {
          // Para Google Docs, usar a API do Google Drive
          const docId = doc.url_arquivo.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
          if (docId) {
            thumbnailUrl = `https://drive.google.com/thumbnail?id=${docId}&sz=w500-h650`;
            await updateThumbnailInDatabase(doc.id, thumbnailUrl);
          }
        }

        if (thumbnailUrl) {
          atualizados++;
          console.log(`✅ Thumbnail atualizado: ${doc.titulo}`);
        } else {
          console.log(`⚠️ Não foi possível atualizar: ${doc.titulo}`);
        }

        // Delay entre requisições para evitar rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        erros++;
        console.error(`❌ Erro ao processar ${doc.titulo}:`, error.message);
      }
    }

    console.log(`🎉 REFRESH CONCLUÍDO: ${atualizados} atualizados, ${erros} erros`);

    // Salvar log no banco
    await pool.query(`
      INSERT INTO logs_sistema (evento, detalhes, criado_em)
      VALUES ('refresh_thumbnails', $1, CURRENT_TIMESTAMP)
    `, [JSON.stringify({ 
      total: webDocuments.length, 
      atualizados, 
      erros,
      timestamp: new Date().toISOString()
    })]);

    return { total: webDocuments.length, atualizados, erros };

  } catch (error) {
    console.error('❌ Erro no refresh de thumbnails:', error);
    throw error;
  }
}

// ✅ FUNÇÃO AUXILIAR PARA GERAR THUMBNAIL DO GOOGLE SHEETS
async function generateSheetThumbnail(sheetId, documentId) {
  try {
    const thumbnailDir = getThumbnailsPath();
    const imagePath = path.join(thumbnailDir, `${sheetId}.png`);
    
    console.log(`📸 Gerando thumbnail para planilha: ${sheetId}`);
    
    const browser = await puppeteer.launch({
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
    
    // Verificar se é pública e gerar thumbnail
    const accessResult = await checkPublicAccessAndGenerate(page, sheetId);
    
    if (accessResult.isPublic) {
      await page.screenshot({ 
        path: imagePath, 
        fullPage: accessResult.method === 'export-direto',
        type: 'png'
      });
      
      console.log(`✅ Screenshot capturado para: ${sheetId}`);
    } else {
      // Gerar thumbnail padrão para planilhas privadas
      await generateDefaultThumbnail(imagePath, sheetId);
      console.log(`🔒 Thumbnail padrão gerado para planilha privada: ${sheetId}`);
    }
    
    await browser.close();
    
    const thumbnailUrl = `/thumbnails/${sheetId}.png`;
    
    // Atualizar no banco
    await updateThumbnailInDatabase(documentId, thumbnailUrl);
    
    return thumbnailUrl;
    
  } catch (error) {
    console.error(`❌ Erro ao gerar thumbnail para ${sheetId}:`, error);
    
    // Fallback: thumbnail padrão
    try {
      const thumbnailDir = getThumbnailsPath();
      const imagePath = path.join(thumbnailDir, `${sheetId}.png`);
      await generateDefaultThumbnail(imagePath, sheetId, 'Erro na Atualização');
      
      const thumbnailUrl = `/thumbnails/${sheetId}.png`;
      await updateThumbnailInDatabase(documentId, thumbnailUrl);
      
      return thumbnailUrl;
    } catch (fallbackError) {
      console.error(`❌ Erro no fallback para ${sheetId}:`, fallbackError);
      return null;
    }
  }
}

// ✅ FUNÇÃO AUXILIAR PARA DETECTAR TIPO DE ARQUIVO
function getFileType(url) {
  if (url.includes('docs.google.com/spreadsheets')) return 'google-sheet';
  if (url.includes('docs.google.com/document')) return 'google-doc';
  if (url.includes('drive.google.com')) return 'google-drive';
  if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) return 'image';
  if (url.includes('.pdf') || url.includes('pdf')) return 'pdf';
  return 'unknown';
}

// ✅ ENDPOINT MANUAL PARA FORÇAR REFRESH (ADMIN ONLY)
app.post('/api/admin/refresh-thumbnails', authMiddleware, async (req, res) => {
  try {
    // Verificar se é admin
    if (!isAdmin(req.user)) {
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
    }

    console.log(`🔄 REFRESH MANUAL iniciado por: ${req.user.nome}`);
    
    // Executar refresh em background
    refreshWebThumbnails()
      .then(result => {
        console.log(`✅ Refresh concluído: ${result.atualizados}/${result.total} atualizados`);
      })
      .catch(error => {
        console.error('❌ Erro no refresh em background:', error);
      });
    
    res.json({ 
      success: true, 
      message: 'Refresh de thumbnails iniciado em background',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro no refresh manual:', error);
    res.status(500).json({ error: 'Erro ao iniciar refresh de thumbnails' });
  }
});

// ✅ ENDPOINT PÚBLICO PARA CRON JOB DO RAILWAY
app.get('/api/cron/refresh-thumbnails', async (req, res) => {
  try {
    console.log('⏰ CRON JOB: Iniciando refresh diário de thumbnails...');
    
    const result = await refreshWebThumbnails();
    
    res.json({
      success: true,
      message: 'Refresh de thumbnails concluído',
      ...result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro no refresh via cron:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erro ao executar refresh de thumbnails',
      timestamp: new Date().toISOString()
    });
  }
});

// ✅ ENDPOINT PARA VER STATUS DO ÚLTIMO REFRESH
app.get('/api/admin/thumbnail-refresh-status', authMiddleware, async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
    }

    const result = await pool.query(`
      SELECT evento, detalhes, criado_em
      FROM logs_sistema 
      WHERE evento = 'refresh_thumbnails'
      ORDER BY criado_em DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      ultimosRefresh: result.rows.map(row => ({
        ...row,
        detalhes: JSON.parse(row.detalhes)
      }))
    });

  } catch (error) {
    console.error('❌ Erro ao buscar status:', error);
    res.status(500).json({ error: 'Erro ao buscar status do refresh' });
  }
});

// ✅ FUNÇÃO PARA CRIAR TABELA DE LOGS (EXECUTAR UMA VEZ)
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

// ✅ EXECUTAR CRIAÇÃO DA TABELA NA INICIALIZAÇÃO
createLogsTable();

// ✅ LOG DE INICIALIZAÇÃO
console.log('🚀 Sistema de refresh de thumbnails configurado');
console.log('📋 Endpoints disponíveis:');
console.log('  - POST /api/admin/refresh-thumbnails (manual)');
console.log('  - GET /api/cron/refresh-thumbnails (para Railway Cron)');
console.log('  - GET /api/admin/thumbnail-refresh-status (status)');