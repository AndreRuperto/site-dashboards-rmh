// server.js - VERSÃO LIMPA E CORRIGIDA
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
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "https://*.railway.app", "https://api.resend.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https:", "data:"]
    },
  },
}));

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

// Schemas de validação
const schemaRegistro = Joi.object({
  nome: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().pattern(/@resendemh\.com\.br$/).required(),
  senha: Joi.string().min(6).required(),
  setor: Joi.string().required()
});

const schemaLogin = Joi.object({
  email: Joi.string().email().required(),
  senha: Joi.string().required()
});

// Middleware de autenticação
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
      'SELECT id, nome, email, tipo_usuario, email_verificado FROM usuarios WHERE id = $1',
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
    console.log('✅ AUTH: Usuário autenticado:', req.user.email);
    next();
  } catch (error) {
    console.error('❌ AUTH: Erro na verificação:', error.message);
    res.status(401).json({ error: 'Token inválido' });
  }
};

// Função para gerar template de email
async function gerarTemplateVerificacao(nome, codigo) {
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
        /* margin-bottom: 15px; */
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
        <p>Insira o código abaixo para confirmar seu email e ativar seu acesso ao site da RMH:</p>
        <div class="code-box">${codigo}</div>
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
// ROTAS DE AUTENTICAÇÃO
// ===============================================

// REGISTRO COM VERIFICAÇÃO DE EMAIL
app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { error, value } = schemaRegistro.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { nome, email, senha, setor } = value;

    // Verificar se o usuário já existe
    const userExists = await pool.query(
      'SELECT id, email_verificado FROM usuarios WHERE email = $1',
      [email]
    );

    if (userExists.rows.length > 0) {
      const existingUser = userExists.rows[0];
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

    // Inserir usuário SEM verificação
    const result = await pool.query(
      `INSERT INTO usuarios (nome, email, senha, setor, tipo_usuario, email_verificado) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, nome, email, setor, tipo_usuario`,
      [nome, email, senhaHash, setor, 'usuario', false]
    );

    const newUser = result.rows[0];

    // Gerar código de verificação (6 dígitos)
    const codigoVerificacao = Math.floor(100000 + Math.random() * 900000).toString();
    const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    // Salvar token na tabela de verificações
    await pool.query(
      `INSERT INTO verificacoes_email (usuario_id, token, tipo_token, expira_em) 
       VALUES ($1, $2, $3, $4)`,
      [newUser.id, codigoVerificacao, 'verificacao_email', expiraEm]
    );

    console.log(`
    🔐 ========== CÓDIGO DE VERIFICAÇÃO ==========
    📧 Email: ${email}
    🔢 Código: ${codigoVerificacao}
    ⏰ Expira em: ${expiraEm}
    =========================================
    `);

    try {
      // CORREÇÃO: Aguardar a geração do template HTML
      const htmlTemplate = await gerarTemplateVerificacao(nome, codigoVerificacao);
      
      const emailResult = await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: [email],
        subject: '🔐 Confirme seu email - Dashboards RMH',
        html: htmlTemplate
      });

      console.log(`✅ Email enviado com sucesso!`, emailResult);
      console.log(`📧 Para: ${email} - Código: ${codigoVerificacao}`);
    } catch (emailError) {
      console.error('❌ ERRO DETALHADO NO EMAIL:', emailError);
      console.error('📧 Tentando enviar para:', email);
      console.error('🔐 Código era:', codigoVerificacao);
    }

    res.status(201).json({
      message: 'Usuário cadastrado! Verifique seu email e digite o código de 6 dígitos.',
      user: {
        id: newUser.id,
        nome: newUser.nome,
        email: newUser.email,
        setor: newUser.setor,
        email_verificado: false
      },
      verification_required: true
    });

  } catch (error) {
    console.error('Erro no registro:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// VERIFICAR CÓDIGO DE EMAIL
app.post('/api/auth/verify-email', async (req, res) => {
  try {
    const { email, codigo } = req.body;

    if (!email || !codigo) {
      return res.status(400).json({ error: 'Email e código são obrigatórios' });
    }

    // Buscar usuário
    const userResult = await pool.query(
      'SELECT id, nome, email, email_verificado FROM usuarios WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = userResult.rows[0];

    if (user.email_verificado) {
      return res.status(400).json({ error: 'Email já verificado' });
    }

    // Buscar token válido
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
      return res.status(400).json({ 
        error: 'Código inválido ou expirado. Solicite um novo código.' 
      });
    }

    const verification = tokenResult.rows[0];

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
        email: user.email, 
        tipo_usuario: 'usuario'
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      message: 'Email verificado com sucesso! Você foi logado automaticamente.',
      token,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        email_verificado: true
      }
    });

  } catch (error) {
    console.error('Erro na verificação:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// LOGIN COM VERIFICAÇÃO DE EMAIL
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { error, value } = schemaLogin.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, senha } = value;

    // Buscar usuário
    const result = await pool.query(
      'SELECT id, nome, email, senha, setor, tipo_usuario, email_verificado FROM usuarios WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    const user = result.rows[0];

    // Verificar senha
    const senhaValida = await bcrypt.compare(senha, user.senha);
    if (!senhaValida) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    // Verificar se email foi verificado
    if (!user.email_verificado) {
      return res.status(401).json({ 
        error: 'Email não verificado. Verifique sua caixa de entrada.',
        verification_required: true,
        user_email: email
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
        email: user.email, 
        tipo_usuario: user.tipo_usuario 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      message: 'Login realizado com sucesso',
      token,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        setor: user.setor,
        tipo_usuario: user.tipo_usuario
      }
    });

  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ROTA PARA REENVIAR CÓDIGO DE VERIFICAÇÃO (VERSÃO CORRIGIDA)
app.post('/api/auth/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email é obrigatório' });
    }

    // Buscar usuário
    const userResult = await pool.query(
      'SELECT id, nome, email, email_verificado FROM usuarios WHERE email = $1',
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
    const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    // Salvar novo token
    await pool.query(
      `INSERT INTO verificacoes_email (usuario_id, token, tipo_token, expira_em) 
       VALUES ($1, $2, $3, $4)`,
      [user.id, codigoVerificacao, 'verificacao_email', expiraEm]
    );

    // Enviar email
    try {
      // CORREÇÃO: Aguardar a geração do template HTML
      const htmlTemplate = await gerarTemplateVerificacao(user.nome, codigoVerificacao);
      
      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: [email],
        subject: '🔐 Novo código de verificação - Dashboards RMH',
        html: htmlTemplate
      });

      console.log(`✅ Novo código enviado para: ${email} - Código: ${codigoVerificacao}`);
    } catch (emailError) {
      console.error('❌ Erro ao enviar email:', emailError);
    }

    res.json({
      message: 'Novo código enviado para seu email'
    });

  } catch (error) {
    console.error('Erro ao reenviar código:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PERFIL DO USUÁRIO
app.get('/api/auth/profile', (req, res, next) => {
  console.log('🔐 TENTATIVA DE ACESSO AO PROFILE');
  console.log('   Token presente:', !!req.header('Authorization'));
  console.log('   Authorization header:', req.header('Authorization')?.substring(0, 50) + '...');
  next();
}, authMiddleware, async (req, res) => {
  try {
    console.log('✅ PROFILE: Usuário autenticado:', req.user.email);
    
    const user = {
      id: req.user.id,
      nome: req.user.nome,
      email: req.user.email,
      tipo_usuario: req.user.tipo_usuario,
      email_verificado: req.user.email_verificado
    };
    
    console.log('📤 PROFILE: Enviando dados:', user);
    
    res.json({ user });
  } catch (error) {
    console.error('❌ PROFILE: Erro ao buscar perfil:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// LISTAR DASHBOARDS
app.get('/api/dashboards', (req, res, next) => {
  console.log('📊 TENTATIVA DE ACESSO AOS DASHBOARDS');
  next();
}, authMiddleware, async (req, res) => {
  try {
    console.log('✅ DASHBOARDS: Usuário autenticado:', req.user.email);
    console.log('🔍 DASHBOARDS: Buscando no banco...');
    
    const result = await pool.query(
      'SELECT * FROM dashboards WHERE ativo = true ORDER BY titulo'
    );

    console.log(`📊 DASHBOARDS: Encontrados ${result.rows.length} dashboards`);
    console.log('📤 DASHBOARDS: Dados encontrados:', result.rows);

    res.json({
      dashboards: result.rows || []
    });
  } catch (error) {
    console.error('❌ DASHBOARDS: Erro ao buscar:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===============================================
// CATCH-ALL ROUTES
// ===============================================

app.get('*', (req, res) => {
  // Se não é uma rota de API, servir o index.html
  if (!req.path.startsWith('/api') && 
      !req.path.startsWith('/health') && 
      !req.path.startsWith('/ping') && 
      !req.path.startsWith('/send-test-email')) {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    res.status(404).json({ error: 'Endpoint não encontrado' });
  }
});

// ===============================================
// INICIALIZAÇÃO DO SERVIDOR
// ===============================================

async function iniciarServidor() {
  try {
    // Testar conexão com banco COM RETRY
    await testarConexao(3);
    
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor rodando em ${process.env.API_BASE_URL || 'http://localhost:3001'} na porta ${PORT}`);
      console.log(`🌐 Ambiente: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📧 Resend configurado`);
      console.log(`🗄️ PostgreSQL conectado`);
      console.log(`🔐 Sistema de verificação de email ativo`);
      if (process.env.NODE_ENV === 'production') {
        console.log(`🎨 Frontend sendo servido da pasta dist/`);
      }
    });

    // Keep-alive apenas em produção
    if (process.env.NODE_ENV === 'production') {
      setInterval(() => {
        console.log('🏓 Keep-alive ping:', new Date().toISOString());
      }, 60000);
    }

    // Graceful shutdown melhorado
    const gracefulShutdown = (signal) => {
      console.log(`📴 Recebido ${signal}, encerrando graciosamente...`);
      server.close((err) => {
        if (err) {
          console.error('❌ Erro ao fechar servidor:', err);
          process.exit(1);
        }
        console.log('🔴 Servidor encerrado');
        pool.end((poolErr) => {
          if (poolErr) {
            console.error('❌ Erro ao fechar pool de conexões:', poolErr);
            process.exit(1);
          }
          console.log('🔴 Conexão com PostgreSQL encerrada');
          process.exit(0);
        });
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Tratar erros não capturados
    process.on('uncaughtException', (err) => {
      console.error('❌ Erro não capturado:', err);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Promise rejeitada não tratada:', reason, 'em', promise);
      gracefulShutdown('UNHANDLED_REJECTION');
    });

  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

// Iniciar o servidor
iniciarServidor();

// Error handler global
app.use((error, req, res, next) => {
  console.error('❌ Erro global:', error);
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' 
      ? 'Erro interno do servidor' 
      : error.message 
  });
});