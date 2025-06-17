// cleanup.js - Script de limpeza separado
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function executarLimpeza() {
  try {
    console.log('🧹 Iniciando limpeza automática:', new Date().toISOString());
    
    // 1. Limpar códigos expirados
    const codigosResult = await pool.query(
      'DELETE FROM verificacoes_email WHERE expira_em < NOW()'
    );
    
    // 2. Remover usuários não verificados há mais de 7 dias
    const usuariosResult = await pool.query(`
      DELETE FROM usuarios 
      WHERE email_verificado = false 
        AND criado_em < NOW() - INTERVAL '7 days'
    `);
    
    console.log(`✅ Limpeza concluída:
      - ${codigosResult.rowCount} códigos expirados removidos
      - ${usuariosResult.rowCount} usuários não verificados removidos`);
      
  } catch (error) {
    console.error('❌ Erro na limpeza:', error);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

executarLimpeza();