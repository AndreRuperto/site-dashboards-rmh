// cleanup.js - Script de limpeza MELHORADO (sem alterar estrutura do banco)
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 2,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
  query_timeout: 30000,
  statement_timeout: 30000,
});

async function executarLimpeza() {
  const client = await pool.connect();
  
  try {
    console.log('🧹 INICIANDO LIMPEZA AUTOMÁTICA MELHORADA');
    console.log('📅 Data/Hora:', new Date().toISOString());
    
    await client.query('BEGIN');

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
    } else {
      console.log('ℹ️ Nenhum código expirado encontrado');
    }

    // ===============================================
    // 2. IDENTIFICAR USUÁRIOS COM PROBLEMAS DE TOKEN
    // ===============================================
    
    console.log('🔍 Identificando usuários com tokens expirados/perdidos...');
    
    // Usuários não verificados há mais de 7 dias SEM token ativo
    const usuariosTokenExpirado = await client.query(`
      SELECT 
        u.id,
        u.nome,
        CASE 
          WHEN u.tipo_colaborador = 'estagiario' THEN u.email_pessoal 
          ELSE u.email 
        END as email_login,
        u.tipo_colaborador,
        u.criado_em,
        u.email_verificado,
        u.aprovado_admin,
        -- Verificar se tem token ativo
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM verificacoes_email v 
            WHERE v.usuario_id = u.id 
              AND v.tipo_token = 'verificacao_email'
              AND v.usado_em IS NULL 
              AND v.expira_em > NOW()
          ) THEN false
          ELSE true
        END as sem_token_ativo,
        -- Dias desde criação
        EXTRACT(DAYS FROM (NOW() - u.criado_em)) as dias_desde_criacao
      FROM usuarios u
      WHERE u.email_verificado = false
        AND u.criado_em < NOW() - INTERVAL '7 days'
        AND (
          u.tipo_colaborador = 'clt_associado' 
          OR (u.tipo_colaborador = 'estagiario' AND u.aprovado_admin = true)
        )
      ORDER BY u.criado_em ASC
    `);
    
    console.log(`📊 Análise de usuários com problemas:`, {
      total_nao_verificados_antigos: usuariosTokenExpirado.rowCount,
      usuarios_sem_token: usuariosTokenExpirado.rows.filter(u => u.sem_token_ativo).length,
      usuarios_com_token_expirado: usuariosTokenExpirado.rows.filter(u => !u.sem_token_ativo).length
    });

    // ===============================================
    // 3. MARCAR USUÁRIOS ÓRFÃOS NO LOG (ao invés de excluir)
    // ===============================================
    
    if (usuariosTokenExpirado.rowCount > 0) {
      console.log(`⚠️ ${usuariosTokenExpirado.rowCount} usuários com problemas de token encontrados:`);
      
      for (const user of usuariosTokenExpirado.rows) {
        const diasAtras = Math.floor(user.dias_desde_criacao);
        console.log(`   - ${user.nome} (${user.email_login}) - ${user.tipo_colaborador} - ${diasAtras} dias atrás`);
        
        // Se usuário tem mais de 30 dias sem verificar, marcar como "problema"
        if (diasAtras > 30) {
          // Verificar se já existe registro no log
          const logExists = await client.query(
            'SELECT id FROM usuarios_admin_log WHERE usuario_id = $1',
            [user.id]
          );
          
          if (logExists.rows.length === 0) {
            // Criar registro marcando como problema
            await client.query(
              `INSERT INTO usuarios_admin_log 
               (usuario_id, ativo, observacoes, criado_em, atualizado_em) 
               VALUES ($1, true, $2, NOW(), NOW())`,
              [
                user.id, 
                `Token expirado há ${diasAtras} dias. Usuário nunca se verificou.`
              ]
            );
            console.log(`   📝 Log criado para ${user.nome} (${diasAtras} dias)`);
          } else {
            // Atualizar observações do registro existente
            await client.query(
              `UPDATE usuarios_admin_log 
               SET observacoes = $1, atualizado_em = NOW()
               WHERE usuario_id = $2`,
              [
                `Token expirado há ${diasAtras} dias. Usuário nunca se verificou. (Atualizado automaticamente)`,
                user.id
              ]
            );
            console.log(`   📝 Log atualizado para ${user.nome} (${diasAtras} dias)`);
          }
        }
      }
    } else {
      console.log('ℹ️ Nenhum usuário com problema de token');
    }

    // ===============================================
    // 4. LIMPEZA DEFINITIVA (APENAS APÓS 45 DIAS)
    // ===============================================
    
    console.log('🔍 Verificando usuários para limpeza definitiva (+45 dias)...');
    const usuariosParaExcluir = await client.query(`
      SELECT 
        u.id, 
        u.nome,
        CASE 
          WHEN u.tipo_colaborador = 'estagiario' THEN u.email_pessoal 
          ELSE u.email 
        END as email_login,
        u.tipo_colaborador, 
        u.criado_em,
        EXTRACT(DAYS FROM (NOW() - u.criado_em)) as dias_desde_criacao
      FROM usuarios u
      WHERE u.email_verificado = false 
        AND u.criado_em < NOW() - INTERVAL '45 days'  -- 45 dias ao invés de 7
        AND (
          u.tipo_colaborador = 'clt_associado' 
          OR (u.tipo_colaborador = 'estagiario' AND u.aprovado_admin = true)
        )
      ORDER BY u.criado_em ASC
    `);
    
    if (usuariosParaExcluir.rowCount > 0) {
      console.log(`🗑️ ${usuariosParaExcluir.rowCount} usuários antigos serão excluídos definitivamente (+45 dias):`);
      
      for (const user of usuariosParaExcluir.rows) {
        console.log(`   - ${user.nome} (${user.email_login}) - ${Math.floor(user.dias_desde_criacao)} dias`);
      }
      
      // Remover tokens primeiro
      const tokensRemovidos = await client.query(`
        DELETE FROM verificacoes_email 
        WHERE usuario_id IN (
          SELECT id FROM usuarios 
          WHERE email_verificado = false 
            AND criado_em < NOW() - INTERVAL '45 days'
            AND (
              tipo_colaborador = 'clt_associado' 
              OR (tipo_colaborador = 'estagiario' AND aprovado_admin = true)
            )
        )
        RETURNING id
      `);
      
      // Remover logs administrativos
      const logsRemovidos = await client.query(`
        DELETE FROM usuarios_admin_log 
        WHERE usuario_id IN (
          SELECT id FROM usuarios 
          WHERE email_verificado = false 
            AND criado_em < NOW() - INTERVAL '45 days'
            AND (
              tipo_colaborador = 'clt_associado' 
              OR (tipo_colaborador = 'estagiario' AND aprovado_admin = true)
            )
        )
        RETURNING id
      `);
      
      // Remover usuários
      const usuariosRemovidos = await client.query(`
        DELETE FROM usuarios 
        WHERE email_verificado = false 
          AND criado_em < NOW() - INTERVAL '45 days'
          AND (
            tipo_colaborador = 'clt_associado' 
            OR (tipo_colaborador = 'estagiario' AND aprovado_admin = true)
          )
        RETURNING id, nome
      `);
      
      console.log(`✅ Limpeza definitiva realizada:`, {
        tokens_removidos: tokensRemovidos.rowCount,
        logs_removidos: logsRemovidos.rowCount,
        usuarios_removidos: usuariosRemovidos.rowCount
      });
      
    } else {
      console.log('ℹ️ Nenhum usuário antigo para exclusão definitiva');
    }

    // ===============================================
    // 5. DETECTAR E CORRIGIR TOKENS DUPLICADOS
    // ===============================================
    
    console.log('🔍 Verificando tokens duplicados...');
    const tokensDuplicados = await client.query(`
      SELECT 
        usuario_id,
        COUNT(*) as total_tokens,
        STRING_AGG(id::text, ', ') as token_ids
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
        // Manter apenas o token mais recente
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
    // 6. ESTATÍSTICAS FINAIS DETALHADAS
    // ===============================================
    
    console.log('📊 Coletando estatísticas finais...');
    const estatisticas = await client.query(`
      SELECT 
        COUNT(*) as total_usuarios,
        COUNT(*) FILTER (WHERE email_verificado = true) as usuarios_verificados,
        COUNT(*) FILTER (WHERE email_verificado = false) as usuarios_nao_verificados,
        COUNT(*) FILTER (WHERE tipo_colaborador = 'estagiario') as total_estagiarios,
        COUNT(*) FILTER (WHERE tipo_colaborador = 'clt_associado') as total_clt_associados,
        COUNT(*) FILTER (WHERE tipo_colaborador = 'estagiario' AND aprovado_admin IS NULL) as estagiarios_pendentes,
        COUNT(*) FILTER (WHERE email_verificado = false AND criado_em < NOW() - INTERVAL '7 days') as usuarios_token_problemas,
        COUNT(*) FILTER (WHERE email_verificado = false AND criado_em < NOW() - INTERVAL '30 days') as usuarios_muito_antigos
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

    // Estatísticas dos logs administrativos
    const estatisticasLogs = await client.query(`
      SELECT 
        COUNT(*) as total_logs,
        COUNT(*) FILTER (WHERE ativo = true) as usuarios_ativos,
        COUNT(*) FILTER (WHERE ativo = false) as usuarios_revogados,
        COUNT(*) FILTER (WHERE observacoes LIKE '%Token expirado%') as usuarios_com_problema_token
      FROM usuarios_admin_log
    `);

    await client.query('COMMIT');
    console.log('✅ Transação commitada com sucesso');

    const stats = estatisticas.rows[0];
    const tokenStats = estatisticasTokens.rows[0];
    const logStats = estatisticasLogs.rows[0];

    console.log(`📊 ESTATÍSTICAS COMPLETAS APÓS LIMPEZA:
    
👥 USUÁRIOS:
  - Total: ${stats.total_usuarios}
  - Verificados: ${stats.usuarios_verificados}
  - Não verificados: ${stats.usuarios_nao_verificados}
  - Estagiários: ${stats.total_estagiarios}
  - CLT/Associados: ${stats.total_clt_associados}
  - Estagiários pendentes aprovação: ${stats.estagiarios_pendentes}
  - Com problemas de token (+7 dias): ${stats.usuarios_token_problemas}
  - Muito antigos (+30 dias): ${stats.usuarios_muito_antigos}

🎫 TOKENS:
  - Total: ${tokenStats.total_tokens}
  - Ativos: ${tokenStats.tokens_ativos}
  - Expirados: ${tokenStats.tokens_expirados}
  - Usados: ${tokenStats.tokens_usados}
  - Usuários com tokens ativos: ${tokenStats.usuarios_com_tokens_ativos}

📋 LOGS ADMINISTRATIVOS:
  - Total de registros: ${logStats.total_logs}
  - Usuários ativos: ${logStats.usuarios_ativos}
  - Usuários revogados: ${logStats.usuarios_revogados}
  - Usuários com problema de token: ${logStats.usuarios_com_problema_token}
    `);
    
    console.log('✅ LIMPEZA MELHORADA CONCLUÍDA COM SUCESSO!');
    console.log('📅 Finalizado em:', new Date().toISOString());
    
  } catch (error) {
    try {
      await client.query('ROLLBACK');
      console.log('🔄 Rollback executado devido ao erro');
    } catch (rollbackError) {
      console.error('❌ Erro no rollback:', rollbackError);
    }
    
    console.error('❌ ERRO NA LIMPEZA:', error.message);
    console.error('📍 Stack trace:', error.stack);
    process.exit(1);
    
  } finally {
    client.release();
    console.log('🔌 Conexão de transação liberada');
  }
}

// Execução principal (igual ao anterior)
async function main() {
  console.log('🚀 INICIANDO SCRIPT DE LIMPEZA MELHORADO');
  console.log('📦 Versão Node.js:', process.version);
  console.log('🌐 Ambiente:', process.env.NODE_ENV || 'development');
  
  await executarLimpeza();
  
  try {
    await pool.end();
    console.log('🔌 Pool de conexões encerrado');
  } catch (closeError) {
    console.error('❌ Erro ao fechar pool:', closeError);
  }
  
  console.log('🎉 Script finalizado com sucesso!');
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Erro fatal no script principal:', error);
  process.exit(1);
});