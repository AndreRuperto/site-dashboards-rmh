// cleanup.js - Script de limpeza para Railway Cron
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 2, // Menos conexões para o job de limpeza
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});

async function executarLimpeza() {
  try {
    console.log('🧹 INICIANDO LIMPEZA AUTOMÁTICA');
    console.log('📅 Data/Hora:', new Date().toISOString());
    console.log('🌍 Timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
    
    // 1. Limpar códigos de verificação expirados
    console.log('🔍 Limpando códigos expirados...');
    const codigosResult = await pool.query(
      'DELETE FROM verificacoes_email WHERE expira_em < NOW()'
    );
    console.log(`✅ ${codigosResult.rowCount} códigos expirados removidos`);
    
    // 2. Listar usuários que serão removidos (para log)
    console.log('🔍 Verificando usuários não verificados...');
    const usuariosParaRemover = await pool.query(`
      SELECT id, nome, email, criado_em 
      FROM usuarios 
      WHERE email_verificado = false 
        AND criado_em < NOW() - INTERVAL '7 days'
    `);
    
    if (usuariosParaRemover.rowCount > 0) {
      console.log(`⚠️ ${usuariosParaRemover.rowCount} usuários serão removidos:`);
      usuariosParaRemover.rows.forEach(user => {
        console.log(`   - ${user.email} (criado em ${user.criado_em})`);
      });
    }
    
    // 3. Remover usuários não verificados há mais de 7 dias
    const usuariosResult = await pool.query(`
      DELETE FROM usuarios 
      WHERE email_verificado = false 
        AND criado_em < NOW() - INTERVAL '7 days'
    `);
    console.log(`✅ ${usuariosResult.rowCount} usuários não verificados removidos`);
    
    // 4. Estatísticas finais
    const totalUsuarios = await pool.query('SELECT COUNT(*) FROM usuarios');
    const usuariosVerificados = await pool.query('SELECT COUNT(*) FROM usuarios WHERE email_verificado = true');
    const codigosAtivos = await pool.query('SELECT COUNT(*) FROM verificacoes_email WHERE expira_em > NOW()');
    
    console.log(`📊 ESTATÍSTICAS APÓS LIMPEZA:
      - Total de usuários: ${totalUsuarios.rows[0].count}
      - Usuários verificados: ${usuariosVerificados.rows[0].count}
      - Códigos ativos: ${codigosAtivos.rows[0].count}`);
    
    console.log('✅ LIMPEZA CONCLUÍDA COM SUCESSO!');
    
  } catch (error) {
    console.error('❌ ERRO NA LIMPEZA:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1); // Exit com erro para o Railway detectar falha
  } finally {
    try {
      await pool.end();
      console.log('🔌 Conexão com banco encerrada');
    } catch (closeError) {
      console.error('❌ Erro ao fechar conexão:', closeError);
    }
    process.exit(0); // Exit com sucesso
  }
}

// Executar imediatamente
executarLimpeza();