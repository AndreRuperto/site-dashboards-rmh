// cleanup.js - Script de limpeza para Railway Cron - VERSÃO CORRIGIDA
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 2, // Menos conexões para o job de limpeza
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
  query_timeout: 30000,
  statement_timeout: 30000,
});

// Event listeners para debug da conexão
pool.on('connect', () => {
  console.log('🔌 Conexão estabelecida com PostgreSQL para limpeza');
});

pool.on('error', (err) => {
  console.error('❌ Erro inesperado no pool de conexões da limpeza:', err);
});

async function executarLimpeza() {
  const client = await pool.connect();
  
  try {
    console.log('🧹 INICIANDO LIMPEZA AUTOMÁTICA');
    console.log('📅 Data/Hora:', new Date().toISOString());
    console.log('🌍 Timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
    console.log('🔌 Conectado ao banco:', process.env.DATABASE_URL ? 'SIM' : 'NÃO');
    
    await client.query('BEGIN');
    console.log('🔄 Transação iniciada');

    // ===============================================
    // 1. LIMPAR CÓDIGOS DE VERIFICAÇÃO EXPIRADOS
    // ===============================================
    
    console.log('🔍 Limpando códigos de verificação expirados...');
    const codigosExpirados = await client.query(
      `DELETE FROM verificacoes_email 
       WHERE expira_em < NOW() 
       RETURNING id, usuario_id, token, tipo_token, criado_em`
    );
    
    if (codigosExpirados.rowCount > 0) {
      console.log(`✅ ${codigosExpirados.rowCount} códigos expirados removidos`);
      console.log('📋 Primeiros 3 códigos removidos:', 
        codigosExpirados.rows.slice(0, 3).map(row => ({
          id: row.id,
          tipo: row.tipo_token,
          criado_em: row.criado_em
        }))
      );
    } else {
      console.log('ℹ️ Nenhum código expirado encontrado');
    }

    // ===============================================
    // 2. LIMPAR CÓDIGOS MUITO ANTIGOS (MESMO QUE NÃO EXPIRADOS)
    // ===============================================
    
    console.log('🔍 Limpando códigos antigos (+7 dias)...');
    const codigosAntigos = await client.query(
      `DELETE FROM verificacoes_email 
       WHERE criado_em < NOW() - INTERVAL '7 days' 
         AND tipo_token = 'verificacao_email'
         AND usado_em IS NULL
       RETURNING id, usuario_id, criado_em`
    );
    
    if (codigosAntigos.rowCount > 0) {
      console.log(`✅ ${codigosAntigos.rowCount} códigos antigos removidos`);
    } else {
      console.log('ℹ️ Nenhum código antigo encontrado');
    }

    // ===============================================
    // 3. VERIFICAR USUÁRIOS NÃO VERIFICADOS PARA REMOÇÃO
    // ===============================================
    
    console.log('🔍 Verificando usuários não verificados há mais de 7 dias...');
    const usuariosParaRemover = await client.query(`
      SELECT 
        id, 
        nome, 
        CASE 
          WHEN tipo_colaborador = 'estagiario' THEN email_pessoal 
          ELSE email 
        END as email_login,
        tipo_colaborador,
        criado_em,
        email_verificado,
        aprovado_admin
      FROM usuarios 
      WHERE email_verificado = false 
        AND criado_em < NOW() - INTERVAL '7 days'
        AND (
          tipo_colaborador = 'clt_associado' 
          OR (tipo_colaborador = 'estagiario' AND aprovado_admin IS NULL)
        )
      ORDER BY criado_em ASC
    `);
    
    if (usuariosParaRemover.rowCount > 0) {
      console.log(`⚠️ ${usuariosParaRemover.rowCount} usuários serão removidos:`);
      usuariosParaRemover.rows.forEach((user, index) => {
        const diasAtras = Math.floor((Date.now() - new Date(user.criado_em).getTime()) / (1000 * 60 * 60 * 24));
        console.log(`   ${index + 1}. ${user.nome} (${user.email_login}) - ${user.tipo_colaborador} - ${diasAtras} dias atrás`);
      });

      // ===============================================
      // 4. REMOVER USUÁRIOS NÃO VERIFICADOS
      // ===============================================
      
      console.log('🗑️ Removendo usuários não verificados...');
      
      // Primeiro, remover tokens relacionados
      const tokensRemovidos = await client.query(`
        DELETE FROM verificacoes_email 
        WHERE usuario_id IN (
          SELECT id FROM usuarios 
          WHERE email_verificado = false 
            AND criado_em < NOW() - INTERVAL '7 days'
            AND (
              tipo_colaborador = 'clt_associado' 
              OR (tipo_colaborador = 'estagiario' AND aprovado_admin IS NULL)
            )
        )
        RETURNING id
      `);
      
      console.log(`🗑️ ${tokensRemovidos.rowCount} tokens de usuários removidos`);
      
      // Depois, remover usuários
      const usuariosRemovidos = await client.query(`
        DELETE FROM usuarios 
        WHERE email_verificado = false 
          AND criado_em < NOW() - INTERVAL '7 days'
          AND (
            tipo_colaborador = 'clt_associado' 
            OR (tipo_colaborador = 'estagiario' AND aprovado_admin IS NULL)
          )
        RETURNING id, nome, tipo_colaborador
      `);
      
      console.log(`✅ ${usuariosRemovidos.rowCount} usuários não verificados removidos`);
      
    } else {
      console.log('ℹ️ Nenhum usuário não verificado para remoção');
    }

    // ===============================================
    // 5. DETECTAR E CORRIGIR TOKENS DUPLICADOS
    // ===============================================
    
    console.log('🔍 Verificando tokens duplicados...');
    const tokensDuplicados = await client.query(`
      SELECT 
        usuario_id,
        COUNT(*) as total_tokens,
        STRING_AGG(id::text, ', ') as token_ids,
        STRING_AGG(token, ', ') as tokens
      FROM verificacoes_email 
      WHERE usado_em IS NULL 
        AND tipo_token = 'verificacao_email'
        AND expira_em > NOW()
      GROUP BY usuario_id
      HAVING COUNT(*) > 1
      ORDER BY total_tokens DESC
    `);

    if (tokensDuplicados.rowCount > 0) {
      console.log(`⚠️ ${tokensDuplicados.rowCount} usuários com tokens duplicados encontrados`);
      
      for (const duplicata of tokensDuplicados.rows) {
        // Manter apenas o token mais recente, invalidar os outros
        const tokenMaisRecente = await client.query(`
          SELECT id FROM verificacoes_email 
          WHERE usuario_id = $1 
            AND usado_em IS NULL 
            AND tipo_token = 'verificacao_email'
            AND expira_em > NOW()
          ORDER BY criado_em DESC 
          LIMIT 1
        `, [duplicata.usuario_id]);

        if (tokenMaisRecente.rows.length > 0) {
          const tokenParaManter = tokenMaisRecente.rows[0].id;
          
          const tokensInvalidados = await client.query(`
            UPDATE verificacoes_email 
            SET usado_em = NOW() 
            WHERE usuario_id = $1 
              AND id != $2 
              AND usado_em IS NULL 
              AND tipo_token = 'verificacao_email'
            RETURNING id
          `, [duplicata.usuario_id, tokenParaManter]);

          console.log(`   ✅ Usuário ${duplicata.usuario_id}: ${tokensInvalidados.rowCount} tokens duplicados invalidados`);
        }
      }
    } else {
      console.log('✅ Nenhum token duplicado encontrado');
    }

    // ===============================================
    // 6. ESTATÍSTICAS FINAIS
    // ===============================================
    
    console.log('📊 Coletando estatísticas finais...');
    const estatisticas = await client.query(`
      SELECT 
        COUNT(*) as total_usuarios,
        COUNT(*) FILTER (WHERE email_verificado = true) as usuarios_verificados,
        COUNT(*) FILTER (WHERE email_verificado = false) as usuarios_nao_verificados,
        COUNT(*) FILTER (WHERE tipo_colaborador = 'estagiario') as total_estagiarios,
        COUNT(*) FILTER (WHERE tipo_colaborador = 'clt_associado') as total_clt_associados,
        COUNT(*) FILTER (WHERE tipo_colaborador = 'estagiario' AND aprovado_admin IS NULL) as estagiarios_pendentes
      FROM usuarios
    `);

    const estatisticasTokens = await client.query(`
      SELECT 
        COUNT(*) as total_tokens,
        COUNT(*) FILTER (WHERE expira_em > NOW() AND usado_em IS NULL) as tokens_ativos,
        COUNT(*) FILTER (WHERE expira_em <= NOW()) as tokens_expirados,
        COUNT(*) FILTER (WHERE usado_em IS NOT NULL) as tokens_usados,
        COUNT(DISTINCT usuario_id) FILTER (WHERE expira_em > NOW() AND usado_em IS NULL) as usuarios_com_tokens_ativos
      FROM verificacoes_email 
      WHERE tipo_token = 'verificacao_email'
    `);

    await client.query('COMMIT');
    console.log('✅ Transação commitada com sucesso');

    const stats = estatisticas.rows[0];
    const tokenStats = estatisticasTokens.rows[0];

    console.log(`📊 ESTATÍSTICAS APÓS LIMPEZA:
    
👥 USUÁRIOS:
  - Total: ${stats.total_usuarios}
  - Verificados: ${stats.usuarios_verificados}
  - Não verificados: ${stats.usuarios_nao_verificados}
  - Estagiários: ${stats.total_estagiarios}
  - CLT/Associados: ${stats.total_clt_associados}
  - Estagiários pendentes aprovação: ${stats.estagiarios_pendentes}

🎫 TOKENS:
  - Total: ${tokenStats.total_tokens}
  - Ativos: ${tokenStats.tokens_ativos}
  - Expirados: ${tokenStats.tokens_expirados}
  - Usados: ${tokenStats.tokens_usados}
  - Usuários com tokens ativos: ${tokenStats.usuarios_com_tokens_ativos}
    `);
    
    console.log('✅ LIMPEZA CONCLUÍDA COM SUCESSO!');
    console.log('📅 Finalizado em:', new Date().toISOString());
    
  } catch (error) {
    // Rollback em caso de erro
    try {
      await client.query('ROLLBACK');
      console.log('🔄 Rollback executado devido ao erro');
    } catch (rollbackError) {
      console.error('❌ Erro no rollback:', rollbackError);
    }
    
    console.error('❌ ERRO NA LIMPEZA:', error.message);
    console.error('📍 Stack trace:', error.stack);
    
    // Log adicional para debug
    console.error('🔧 Informações de debug:', {
      error_name: error.name,
      error_code: error.code,
      error_detail: error.detail,
      error_hint: error.hint,
      database_url_exists: !!process.env.DATABASE_URL,
      node_env: process.env.NODE_ENV
    });
    
    process.exit(1); // Exit com erro para o Railway detectar falha
    
  } finally {
    // Sempre liberar a conexão
    client.release();
    console.log('🔌 Conexão de transação liberada');
  }
}

// ===============================================
// FUNÇÃO DE TESTE DE CONEXÃO
// ===============================================

async function testarConexao() {
  try {
    console.log('🔍 Testando conexão com o banco...');
    const result = await pool.query('SELECT NOW() as agora, version() as versao');
    console.log('✅ Conexão testada com sucesso!');
    console.log('⏰ Hora do banco:', result.rows[0].agora);
    console.log('📊 Versão do PostgreSQL:', result.rows[0].versao.split(' ')[0]);
    return true;
  } catch (error) {
    console.error('❌ Erro no teste de conexão:', error.message);
    return false;
  }
}

// ===============================================
// EXECUÇÃO PRINCIPAL
// ===============================================

async function main() {
  console.log('🚀 INICIANDO SCRIPT DE LIMPEZA');
  console.log('📦 Versão Node.js:', process.version);
  console.log('🌐 Ambiente:', process.env.NODE_ENV || 'development');
  
  // Testar conexão primeiro
  const conexaoOk = await testarConexao();
  
  if (!conexaoOk) {
    console.error('❌ Falha na conexão. Abortando limpeza.');
    process.exit(1);
  }
  
  // Executar limpeza
  await executarLimpeza();
  
  // Fechar pool de conexões
  try {
    await pool.end();
    console.log('🔌 Pool de conexões encerrado');
  } catch (closeError) {
    console.error('❌ Erro ao fechar pool:', closeError);
  }
  
  console.log('🎉 Script finalizado com sucesso!');
  process.exit(0);
}

// Capturar sinais de interrupção
process.on('SIGINT', () => {
  console.log('🛑 SIGINT recebido. Encerrando graciosamente...');
  pool.end(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM recebido. Encerrando graciosamente...');
  pool.end(() => {
    process.exit(0);
  });
});

// Capturar erros não tratados
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Executar script principal
main().catch((error) => {
  console.error('❌ Erro fatal no script principal:', error);
  process.exit(1);
});