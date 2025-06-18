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

const app = express();
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
          "https://*.railway.app",
          "https://api.resend.com",
          "https://app.fabric.microsoft.com"
        ],
        frameSrc: [
          "'self'",
          "https://app.fabric.microsoft.com"
        ],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://app.fabric.microsoft.com"
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com"
        ],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "https:", "data:"]
      }
    }
  })
);

// CORS configurado corretamente
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [
        'https://rmh.up.railway.app',
        'https://railway.com',
        process.env.FRONTEND_URL,
        'http://localhost:3001'
      ]
    : [
        'http://localhost:3001', 
        'http://localhost:5173', 
        'http://localhost:8080'
      ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

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
    
    const result = await pool.query(
      `SELECT id, nome, email, email_pessoal, setor, tipo_usuario, tipo_colaborador, email_verificado 
       FROM usuarios WHERE id = $1`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      console.log('❌ AUTH: Usuário não encontrado no banco');
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    if (!result.rows[0].email_verificado) {
      console.log('❌ AUTH: Email não verificado');
      return res.status(401).json({ error: 'Email não verificado' });
    }

    req.user = result.rows[0];
    console.log('✅ AUTH: Usuário autenticado:', 
      req.user.tipo_colaborador === 'estagiario' ? req.user.email_pessoal : req.user.email
    );
    next();
  } catch (error) {
    console.error('❌ AUTH: Erro na verificação:', error.message);
    res.status(401).json({ error: 'Token inválido' });
  }
};

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
        <img src="https://rmh.up.railway.app/logo-rmh.ico" alt="Logo RMH" style="height: 50px; margin-bottom: 20px;" />
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
// ROTAS DE AUTENTICAÇÃO ATUALIZADAS
// ===============================================

// REGISTRO COM VERIFICAÇÃO DE EMAIL
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
      // ========== CLT/ASSOCIADO: PROCESSO AUTOMÁTICO ==========
      
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
          from: 'onboarding@resend.dev',
          to: [emailLogin],
          subject: '🔐 Confirme seu email - Dashboards RMH',
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
  try {
    const { email, codigo } = req.body;

    if (!email || !codigo) {
      return res.status(400).json({ error: 'Email e código são obrigatórios' });
    }

    console.log(`🔍 VERIFICAÇÃO: Email: ${email}, Código: ${codigo}`);

    // Buscar usuário (por email corporativo ou pessoal)
    const userResult = await pool.query(
      `SELECT id, nome, email, email_pessoal, tipo_colaborador, email_verificado 
       FROM usuarios 
       WHERE (tipo_colaborador = 'estagiario' AND email_pessoal = $1) 
          OR (tipo_colaborador = 'clt_associado' AND email = $1)`,
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = userResult.rows[0];

    if (user.email_verificado) {
      return res.status(400).json({ error: 'Email já verificado' });
    }

    // BUSCAR TOKEN VÁLIDO (essa é a parte correta!)
    const tokenResult = await pool.query(
      `SELECT id, token, expira_em, usado_em 
       FROM verificacoes_email 
       WHERE usuario_id = $1 
         AND token = $2 
         AND tipo_token = 'verificacao_email' 
         AND expira_em > NOW() 
         AND usado_em IS NULL
       ORDER BY criado_em DESC 
       LIMIT 1`,
      [user.id, codigo]
    );

    if (tokenResult.rows.length === 0) {
      console.log(`❌ VERIFICAÇÃO: Código inválido ou expirado para usuário ${user.id}`);
      return res.status(400).json({ 
        error: 'Código inválido ou expirado. Solicite um novo código.' 
      });
    }

    const verification = tokenResult.rows[0];
    console.log(`✅ VERIFICAÇÃO: Código válido encontrado!`);

    // Marcar usuário como verificado
    await pool.query(
      'UPDATE usuarios SET email_verificado = TRUE, verificado_em = NOW() WHERE id = $1',
      [user.id]
    );

    // Marcar token como usado
    await pool.query(
      'UPDATE verificacoes_email SET usado_em = NOW() WHERE id = $1',
      [verification.id]
    );

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
    console.error('❌ Erro na verificação:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
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
      `SELECT id, nome, email, email_pessoal, senha, setor, tipo_usuario, tipo_colaborador, email_verificado 
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
    console.log(`🔍 LOGIN: Usuário encontrado - Tipo: ${user.tipo_colaborador}`);

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
        tipo_colaborador: user.tipo_colaborador
      }
    });

  } catch (error) {
    console.error('❌ Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ROTA PARA REENVIAR CÓDIGO DE VERIFICAÇÃO ATUALIZADA
app.post('/api/auth/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email é obrigatório' });
    }

    // Buscar usuário (por email corporativo ou pessoal)
    const userResult = await pool.query(
      `SELECT id, nome, email, email_pessoal, tipo_colaborador, email_verificado 
       FROM usuarios 
       WHERE (tipo_colaborador = 'estagiario' AND email_pessoal = $1) 
          OR (tipo_colaborador = 'clt_associado' AND email = $1)`,
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = userResult.rows[0];

    if (user.email_verificado) {
      return res.status(400).json({ error: 'Email já verificado' });
    }

    // Gerar novo código
    const codigoVerificacao = Math.floor(100000 + Math.random() * 900000).toString();
    const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Salvar novo token
    await pool.query(
      `INSERT INTO verificacoes_email (usuario_id, token, tipo_token, expira_em) 
       VALUES ($1, $2, $3, $4)`,
      [user.id, codigoVerificacao, 'verificacao_email', expiraEm]
    );

    const emailLogin = user.tipo_colaborador === 'estagiario' ? user.email_pessoal : user.email;

    console.log(`🔄 REENVIO: Novo código para ${user.tipo_colaborador}: ${emailLogin}`);
    console.log(`🔢 Novo código: ${codigoVerificacao}`);

    // Enviar email
    try {
      const emailResult = await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: [emailLogin],
        subject: '🔐 Novo código de verificação - Dashboards RMH',
        html: await gerarTemplateVerificacao(user.nome, codigoVerificacao, emailLogin, user.tipo_colaborador)
      });

      console.log(`✅ Novo código enviado com sucesso!`, emailResult);
    } catch (emailError) {
      console.error('❌ Erro ao enviar email:', emailError);
    }

    res.json({
      message: 'Novo código enviado para seu email',
      email_enviado_para: emailLogin,
      tipo_colaborador: user.tipo_colaborador
    });

  } catch (error) {
    console.error('❌ Erro ao reenviar código:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
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
      email_verificado: req.user.email_verificado
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

// ===============================================
// ROTAS DE DASHBOARDS (PROTEGIDAS)
// ===============================================

app.get('/api/dashboards', authMiddleware, async (req, res) => {
  try {
    console.log(`📊 DASHBOARDS: Listando para usuário ${req.user.id} (${req.user.tipo_colaborador}, ${req.user.tipo_usuario})`);

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
          u.nome as criado_por_nome
        FROM dashboards d
        LEFT JOIN usuarios u ON d.criado_por = u.id
        WHERE d.ativo = true
        ORDER BY d.criado_em DESC
      `;
    } else {
      // USUÁRIOS NORMAIS veem dashboards do seu setor ou públicos
      console.log(`👤 USUÁRIO: Buscando dashboards para setor: ${req.user.setor}`);
      query = `
        SELECT 
          d.id, d.titulo, d.descricao, d.setor, d.url_iframe, 
          d.ativo, d.largura, d.altura, d.criado_por, 
          d.criado_em, d.atualizado_em,
          u.nome as criado_por_nome
        FROM dashboards d
        LEFT JOIN usuarios u ON d.criado_por = u.id
        WHERE d.ativo = true 
          AND (d.setor = $1 OR d.setor = 'Geral' OR d.setor = 'Público')
        ORDER BY d.criado_em DESC
      `;
      params = [req.user.setor];
    }

    const result = await pool.query(query, params);
    const dashboards = result.rows;

    console.log(`📊 DASHBOARDS: Encontrados ${dashboards.length} dashboards`);
    
    // Log para debug
    if (dashboards.length > 0) {
      console.log('📋 Primeiros dashboards:', dashboards.slice(0, 2).map(d => ({
        id: d.id,
        titulo: d.titulo,
        setor: d.setor
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
        total_dashboards: dashboards.length,
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
app.post('/api/dashboards', authMiddleware, async (req, res) => {
  try {
    // Verificar se é admin
    if (req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({ 
        error: 'Apenas administradores podem criar dashboards' 
      });
    }

    const { titulo, descricao, setor, url_iframe, largura, altura } = req.body;

    // Validações
    if (!titulo || !setor || !url_iframe) {
      return res.status(400).json({
        error: 'Título, setor e URL são obrigatórios'
      });
    }

    const result = await pool.query(`
      INSERT INTO dashboards (titulo, descricao, setor, url_iframe, largura, altura, criado_por, ativo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [titulo, descricao, setor, url_iframe, largura || 800, altura || 600, req.user.id, true]);

    const newDashboard = result.rows[0];

    console.log(`✅ DASHBOARD: ${titulo} criado por ${req.user.nome}`);

    res.status(201).json({
      message: 'Dashboard criado com sucesso',
      dashboard: newDashboard
    });

  } catch (error) {
    console.error('❌ Erro ao criar dashboard:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ATUALIZAR DASHBOARD
app.put('/api/dashboards/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, descricao, setor, url_iframe, largura, altura } = req.body;

    // Verificar se o dashboard existe e se o usuário pode editá-lo
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
        error: 'Você não tem permissão para editar este dashboard'
      });
    }

    const result = await pool.query(`
      UPDATE dashboards 
      SET titulo = $1, descricao = $2, setor = $3, url_iframe = $4, 
          largura = $5, altura = $6, atualizado_em = NOW()
      WHERE id = $7
      RETURNING *
    `, [titulo, descricao, setor, url_iframe, largura, altura, id]);

    console.log(`📝 DASHBOARD: ${titulo} atualizado por ${req.user.nome}`);

    res.json({
      message: 'Dashboard atualizado com sucesso',
      dashboard: result.rows[0]
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

// ===============================================
// ROTAS DE ADMINISTRAÇÃO (FUTURO)
// ===============================================

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
    
    // Debug completo dos headers
    console.log('📡 ADMIN: Headers recebidos:', {
      authorization: req.headers.authorization,
      'content-type': req.headers['content-type'],
      origin: req.headers.origin
    });
    
    // Extrair token de várias formas para debug
    const authHeader = req.header('Authorization');
    const authHeaderLower = req.header('authorization');
    const authFromHeaders = req.headers.authorization;
    
    console.log('🔍 ADMIN: Debug token extraction:', {
      'req.header("Authorization")': authHeader,
      'req.header("authorization")': authHeaderLower,
      'req.headers.authorization': authFromHeaders
    });
    
    const token = authHeader?.replace('Bearer ', '') || 
                  authHeaderLower?.replace('Bearer ', '') || 
                  authFromHeaders?.replace('Bearer ', '');
    
    console.log('🔑 ADMIN: Token extraído:', token ? `${token.substring(0, 20)}...` : 'NULO');
    
    if (!token) {
      console.log('❌ ADMIN: Token não encontrado');
      return res.status(401).json({ error: 'Token de acesso negado' });
    }

    console.log('🔑 ADMIN: Token presente, verificando JWT...');
    
    // Debug do JWT antes de verificar
    console.log('🔍 ADMIN: Formato do token:', {
      length: token.length,
      startsWith: token.substring(0, 10),
      dots: (token.match(/\./g) || []).length
    });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ ADMIN: Token válido para usuário ID:', decoded.id);
    
    // Buscar usuário no banco
    const result = await pool.query(
      `SELECT id, nome, email, email_pessoal, setor, tipo_usuario, tipo_colaborador, email_verificado 
       FROM usuarios WHERE id = $1`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      console.log('❌ ADMIN: Usuário não encontrado no banco');
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    if (!result.rows[0].email_verificado) {
      console.log('❌ ADMIN: Email não verificado');
      return res.status(401).json({ error: 'Email não verificado' });
    }

    // Verificar se é admin
    const user = result.rows[0];
    console.log('👤 ADMIN: Dados do usuário:', {
      id: user.id,
      nome: user.nome,
      tipo_usuario: user.tipo_usuario,
      email: user.email
    });
    
    if (user.tipo_usuario !== 'admin') {
      console.log(`❌ ADMIN: Acesso negado para usuário ${user.id} (${user.tipo_usuario})`);
      return res.status(403).json({ 
        error: 'Acesso negado. Apenas administradores podem acessar esta funcionalidade.' 
      });
    }
    
    // Usuário é admin, continuar
    req.user = user;
    console.log(`🔧 ADMIN: Acesso autorizado para ${user.nome}`);
    next();
    
  } catch (error) {
    console.error('❌ ADMIN: Erro na verificação:', {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n')[0]
    });
    
    // Verificar se a resposta já foi enviada
    if (res.headersSent) {
      console.log('⚠️ ADMIN: Headers já enviados, não respondendo novamente');
      return;
    }
    
    return res.status(401).json({ 
      error: 'Token inválido ou expirado',
      debug: error.message
    });
  }
};
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
        v.expira_em as codigo_expira_em
      FROM usuarios u
      LEFT JOIN verificacoes_email v ON u.id = v.usuario_id 
        AND v.tipo_token = 'verificacao_email' 
        AND v.usado_em IS NULL
      WHERE 
        (u.tipo_colaborador = 'estagiario' AND u.aprovado_admin IS NULL)
        OR (u.email_verificado = false)
      ORDER BY u.criado_em DESC
    `);

    const usuarios = result.rows.map(user => ({
      ...user,
      email_login: user.tipo_colaborador === 'estagiario' ? user.email_pessoal : user.email,
      status: user.tipo_colaborador === 'estagiario' 
        ? (user.aprovado_admin === null ? 'pendente_aprovacao' : 'aprovado')
        : 'corporativo',
      codigo_ativo: user.codigo_verificacao && user.codigo_expira_em > new Date()
    }));

    res.json({
      usuarios,
      total: usuarios.length,
      pendentes_aprovacao: usuarios.filter(u => u.status === 'pendente_aprovacao').length,
      nao_verificados: usuarios.filter(u => !u.email_verificado).length
    });

  } catch (error) {
    console.error('❌ Erro ao listar usuários pendentes:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// APROVAR CADASTRO DE ESTAGIÁRIO
app.post('/api/admin/aprovar-usuario/:userId', adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { userId } = req.params;
    const { enviar_codigo = true } = req.body;

    console.log(`✅ ADMIN: Aprovando usuário ${userId}, enviar código: ${enviar_codigo}`);

    // Buscar usuário
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
      // Gerar novo código de verificação
      const codigoVerificacao = Math.floor(100000 + Math.random() * 900000).toString();
      const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Invalidar códigos anteriores
      await client.query(
        'UPDATE verificacoes_email SET usado_em = NOW() WHERE usuario_id = $1 AND usado_em IS NULL',
        [userId]
      );

      // Criar novo código
      await client.query(
        `INSERT INTO verificacoes_email (usuario_id, token, tipo_token, expira_em) 
         VALUES ($1, $2, $3, $4)`,
        [userId, codigoVerificacao, 'verificacao_email', expiraEm]
      );

      await client.query('COMMIT');

      // Enviar email
      try {
        const emailResult = await resend.emails.send({
          from: 'onboarding@resend.dev',
          to: [user.email_pessoal],
          subject: '✅ Cadastro aprovado - Dashboards RMH',
          html: await gerarTemplateVerificacao(user.nome, codigoVerificacao, user.email_pessoal, user.tipo_colaborador)
        });

        console.log(`✅ Email de aprovação enviado para ${user.email_pessoal}`);
      } catch (emailError) {
        console.error('❌ Erro ao enviar email de aprovação:', emailError);
      }

      res.json({
        message: 'Usuário aprovado e código de verificação enviado',
        codigo_enviado: true,
        email_enviado_para: user.email_pessoal
      });
    } else {
      await client.query('COMMIT');
      
      res.json({
        message: 'Usuário aprovado. Código não foi enviado.',
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
    const { status, tipo } = req.query;
    
    let whereConditions = [];
    let params = [];
    
    if (status === 'verificados') {
      whereConditions.push('email_verificado = true');
    } else if (status === 'nao_verificados') {
      whereConditions.push('email_verificado = false');
    }
    
    if (tipo && ['estagiario', 'clt_associado'].includes(tipo)) {
      whereConditions.push(`tipo_colaborador = $${params.length + 1}`);
      params.push(tipo);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    const result = await pool.query(`
      SELECT 
        id, nome, email, email_pessoal, setor, 
        tipo_colaborador, tipo_usuario, email_verificado,
        aprovado_admin, criado_em, ultimo_login
      FROM usuarios 
      ${whereClause}
      ORDER BY criado_em DESC
    `, params);

    const usuarios = result.rows.map(user => ({
      ...user,
      email_login: user.tipo_colaborador === 'estagiario' ? user.email_pessoal : user.email
    }));

    res.json({
      usuarios,
      total: usuarios.length
    });

  } catch (error) {
    console.error('❌ Erro ao listar usuários:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// REENVIAR CÓDIGO PARA QUALQUER USUÁRIO (ADMIN)
app.post('/api/admin/reenviar-codigo/:userId', adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { userId } = req.params;

    // Buscar usuário
    const userResult = await client.query(
      'SELECT * FROM usuarios WHERE id = $1 AND email_verificado = false',
      [userId]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Usuário não encontrado ou já verificado' });
    }

    const user = userResult.rows[0];
    const emailLogin = user.tipo_colaborador === 'estagiario' ? user.email_pessoal : user.email;

    // Gerar novo código
    const codigoVerificacao = Math.floor(100000 + Math.random() * 900000).toString();
    const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Invalidar códigos anteriores
    await client.query(
      'UPDATE verificacoes_email SET usado_em = NOW() WHERE usuario_id = $1 AND usado_em IS NULL',
      [userId]
    );

    // Criar novo código
    await client.query(
      `INSERT INTO verificacoes_email (usuario_id, token, tipo_token, expira_em) 
       VALUES ($1, $2, $3, $4)`,
      [userId, codigoVerificacao, 'verificacao_email', expiraEm]
    );

    await client.query('COMMIT');

    // Enviar email
    try {
      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: [emailLogin],
        subject: '🔐 Novo código de verificação - Dashboards RMH',
        html: await gerarTemplateVerificacao(user.nome, codigoVerificacao, emailLogin, user.tipo_colaborador)
      });

      console.log(`📧 ADMIN: Código reenviado para ${emailLogin} pelo admin ${req.user.nome}`);
    } catch (emailError) {
      console.error('❌ Erro ao enviar email:', emailError);
    }

    res.json({
      message: 'Novo código enviado com sucesso',
      email_enviado_para: emailLogin,
      tipo_colaborador: user.tipo_colaborador
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao reenviar código:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    client.release();
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

// Rota catch-all para SPAs - deve ser a ÚLTIMA rota
app.get('*', (req, res) => {
  console.log(`🎯 CATCH-ALL: Redirecionando ${req.path} para index.html`);
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

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
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Servidor rodando na porta ${PORT}`);
      console.log(`🌐 URL: http://localhost:${PORT}`);
      console.log(`📊 API Base: http://localhost:${PORT}/api`);
      console.log(`🔐 Health Check: http://localhost:${PORT}/health`);
      console.log(`📝 Logs: Ativados para todas as rotas`);
      
      if (process.env.NODE_ENV === 'production') {
        console.log(`🎯 Frontend: Servido estaticamente da pasta dist/`);
      }
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