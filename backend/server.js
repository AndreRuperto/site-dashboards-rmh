// server.js - VERSÃO COMPLETA COM SISTEMA DE VERIFICAÇÃO DE EMAIL
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

const app = express();
const PORT = process.env.PORT || 3001;

// Configurar trust proxy para Railway
app.set('trust proxy', 1);

// Configuração do banco PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

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
        process.env.FRONTEND_URL
      ]
    : [
        'http://localhost:3000', 
        'http://localhost:5173', 
        'http://localhost:8080'
      ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting melhorado para Railway
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200, // Máximo 200 requests por 15 min
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
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // Máximo 10 tentativas de login por 15 min
  message: { error: 'Muitas tentativas de autenticação, tente novamente em 15 minutos' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  }
});

// Body parser
app.use(express.json({ limit: '10mb' }));

// Logging melhorado
app.use((req, res, next) => {
  const origin = req.get('Origin') || 'undefined';
  const ip = req.ip || req.connection.remoteAddress;
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${origin} - IP: ${ip}`);
  next();
});

// Servir arquivos estáticos do frontend EM PRODUÇÃO
if (process.env.NODE_ENV === 'production') {
  console.log('🎨 Servindo frontend estático da pasta dist/');
  app.use(express.static(path.join(__dirname, 'dist')));
}

// Schemas de validação
const schemaRegistro = Joi.object({
  nome: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().pattern(/@resendemh\.com\.br$/).required(),
  senha: Joi.string().min(6).required(),
  departamento: Joi.string().required()
});

const schemaLogin = Joi.object({
  email: Joi.string().email().required(),
  senha: Joi.string().required()
});

// Middleware de autenticação
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token de acesso negado' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await pool.query(
      'SELECT id, nome, email, tipo_usuario, email_verificado FROM usuarios WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0 || !result.rows[0].email_verificado) {
      return res.status(401).json({ error: 'Usuário não encontrado ou email não verificado' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
};

// ROTAS DE HEALTH CHECK E KEEP-ALIVE
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

// Health check para Railway
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

// Ping para keep-alive
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// Rota de teste (manter para compatibilidade)
app.post('/send-test-email', async (req, res) => {
  try {
    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: ['andreruperto@gmail.com'],
      subject: '🎉 Teste Backend Completo - RMH',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
          <h2 style="color: #1e40af;">🚀 Backend Completo Funcionando!</h2>
          <p>Agora com sistema completo de verificação de email!</p>
          <div style="background: #10b981; color: white; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <h3 style="margin: 0;">✅ SISTEMA COMPLETO!</h3>
          </div>
          <ul>
            <li>✅ PostgreSQL conectado</li>
            <li>✅ JWT funcionando</li>
            <li>✅ Resend integrado</li>
            <li>✅ Verificação de email</li>
            <li>✅ Schema em português</li>
          </ul>
          <p><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}</p>
        </div>
      `
    });

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.json({ 
      success: true, 
      data: { id: data.id, message: 'Email enviado com sucesso!' }
    });

  } catch (error) {
    console.error('Erro no teste de email:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===============================================
// ROTAS DE AUTENTICAÇÃO COM VERIFICAÇÃO DE EMAIL
// ===============================================

// REGISTRO COM VERIFICAÇÃO DE EMAIL
app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { error, value } = schemaRegistro.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { nome, email, senha, departamento } = value;

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
      `INSERT INTO usuarios (nome, email, senha, departamento, tipo_usuario, email_verificado) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, nome, email, departamento, tipo_usuario`,
      [nome, email, senhaHash, departamento, 'usuario', false] // email_verificado = false
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

    // Enviar email de verificação
    try {
      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: [email],
        subject: '🔐 Confirme seu email - Dashboards RMH',
        html: gerarTemplateVerificacao(nome, codigoVerificacao, email)
      });

      console.log(`✅ Email de verificação enviado para: ${email} - Código: ${codigoVerificacao}`);
    } catch (emailError) {
      console.error('❌ Erro ao enviar email de verificação:', emailError);
      // Não falhar o registro se o email der erro
    }

    res.status(201).json({
      message: 'Usuário cadastrado! Verifique seu email e digite o código de 6 dígitos.',
      user: {
        id: newUser.id,
        nome: newUser.nome,
        email: newUser.email,
        departamento: newUser.departamento,
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

// REENVIAR CÓDIGO DE VERIFICAÇÃO
app.post('/api/auth/resend-verification', authLimiter, async (req, res) => {
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

    // Verificar se não enviou recentemente (rate limiting)
    const recentToken = await pool.query(
      `SELECT criado_em FROM verificacoes_email 
       WHERE usuario_id = $1 
         AND tipo_token = 'verificacao_email' 
         AND criado_em > NOW() - INTERVAL '2 minutes'
       ORDER BY criado_em DESC 
       LIMIT 1`,
      [user.id]
    );

    if (recentToken.rows.length > 0) {
      return res.status(429).json({ 
        error: 'Aguarde 2 minutos antes de solicitar um novo código' 
      });
    }

    // Invalidar tokens anteriores
    await pool.query(
      `UPDATE verificacoes_email 
       SET usado_em = NOW() 
       WHERE usuario_id = $1 
         AND tipo_token = 'verificacao_email' 
         AND usado_em IS NULL`,
      [user.id]
    );

    // Gerar novo código
    const novoCodigoVerificacao = Math.floor(100000 + Math.random() * 900000).toString();
    const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    // Salvar novo token
    await pool.query(
      `INSERT INTO verificacoes_email (usuario_id, token, tipo_token, expira_em) 
       VALUES ($1, $2, $3, $4)`,
      [user.id, novoCodigoVerificacao, 'verificacao_email', expiraEm]
    );

    // Enviar novo email
    try {
      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: [email],
        subject: '🔐 Novo código de verificação - Dashboards RMH',
        html: gerarTemplateReenvio(user.nome, novoCodigoVerificacao, email)
      });

      console.log(`✅ Novo código enviado para: ${email} - Código: ${novoCodigoVerificacao}`);
    } catch (emailError) {
      console.error('❌ Erro ao reenviar email:', emailError);
      return res.status(500).json({ error: 'Erro ao enviar email' });
    }

    res.json({
      message: 'Novo código de verificação enviado! Verifique seu email.'
    });

  } catch (error) {
    console.error('Erro ao reenviar código:', error);
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
      'SELECT id, nome, email, senha, departamento, tipo_usuario, email_verificado FROM usuarios WHERE email = $1',
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
        departamento: user.departamento,
        tipo_usuario: user.tipo_usuario
      }
    });

  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Obter perfil do usuário
app.get('/api/auth/profile', authMiddleware, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT id, nome, email, departamento, tipo_usuario, criado_em, ultimo_login FROM usuarios WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json({ user: userResult.rows[0] });
  } catch (error) {
    console.error('Erro ao obter perfil:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ROTAS DE DASHBOARDS
app.get('/api/dashboards', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*, u.nome as criador_nome 
       FROM dashboards d 
       LEFT JOIN usuarios u ON d.criado_por = u.id 
       ORDER BY d.criado_em DESC`
    );

    res.json({ dashboards: result.rows });
  } catch (error) {
    console.error('Erro ao buscar dashboards:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===============================================
// TEMPLATES DE EMAIL
// ===============================================

function gerarTemplateVerificacao(nome, codigo, email) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Confirme seu email - RMH Dashboards</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 40px 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
        .content { padding: 40px 30px; text-align: center; }
        .code-box { background: #f8fafc; border: 2px dashed #3b82f6; border-radius: 12px; padding: 30px; margin: 30px 0; }
        .code { font-size: 36px; font-weight: 900; color: #1e40af; letter-spacing: 8px; font-family: 'Courier New', monospace; }
        .footer { padding: 30px; text-align: center; font-size: 14px; color: #64748b; background: #f8fafc; }
        .expire-info { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; color: #92400e; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Confirme seu Email</h1>
          <p>Dashboards Corporativos - Resende MH</p>
        </div>
        <div class="content">
          <h2>Olá, ${nome}!</h2>
          <p>Bem-vindo aos Dashboards Corporativos da Resende MH!</p>
          <p>Para ativar sua conta, digite este código no site:</p>
          
          <div class="code-box">
            <p style="margin: 0; font-size: 16px; color: #64748b;">Seu código de verificação:</p>
            <div class="code">${codigo}</div>
          </div>

          <div class="expire-info">
            ⏰ <strong>Este código expira em 24 horas</strong>
          </div>

          <p>Se você não solicitou este cadastro, ignore este email.</p>
        </div>
        <div class="footer">
          <p><strong>Resende MH</strong> - Este é um email automático, não responda.</p>
          <p>Se precisar de ajuda, entre em contato conosco.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function gerarTemplateReenvio(nome, codigo, email) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Novo código de verificação - RMH Dashboards</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); color: white; padding: 40px 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
        .content { padding: 40px 30px; text-align: center; }
        .code-box { background: #f8fafc; border: 2px dashed #f59e0b; border-radius: 12px; padding: 30px; margin: 30px 0; }
        .code { font-size: 36px; font-weight: 900; color: #f59e0b; letter-spacing: 8px; font-family: 'Courier New', monospace; }
        .footer { padding: 30px; text-align: center; font-size: 14px; color: #64748b; background: #f8fafc; }
        .expire-info { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; color: #92400e; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔄 Novo Código de Verificação</h1>
          <p>Dashboards Corporativos - Resende MH</p>
        </div>
        <div class="content">
          <h2>Olá, ${nome}!</h2>
          <p>Você solicitou um novo código de verificação.</p>
          <p>Aqui está seu novo código:</p>
          
          <div class="code-box">
            <p style="margin: 0; font-size: 16px; color: #64748b;">Seu novo código:</p>
            <div class="code">${codigo}</div>
          </div>

          <div class="expire-info">
            ⏰ <strong>Este código expira em 24 horas</strong>
          </div>

          <p><strong>Nota:</strong> Os códigos anteriores foram invalidados.</p>
        </div>
        <div class="footer">
          <p><strong>Resende MH</strong> - Este é um email automático, não responda.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// SERVIR FRONTEND EM PRODUÇÃO - SPA fallback
if (process.env.NODE_ENV === 'production') {
  // Capturar todas as rotas não-API e servir index.html (SPA)
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
} else {
  // Em desenvolvimento, manter o 404 handler normal
  app.use('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint não encontrado' });
  });
}

// Inicialização melhorada para Railway
async function iniciarServidor() {
  try {
    // Testar conexão com banco
    await pool.query('SELECT NOW()');
    console.log('✅ Conectado ao PostgreSQL');
    
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      console.log(`🌐 Ambiente: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📧 Resend configurado`);
      console.log(`🗄️ PostgreSQL conectado`);
      console.log(`🔐 Sistema de verificação de email ativo`);
      if (process.env.NODE_ENV === 'production') {
        console.log(`🎨 Frontend sendo servido da pasta dist/`);
      }
    });

    // Keep-alive reduzido para Railway (melhor performance)
    if (process.env.NODE_ENV === 'production') {
      setInterval(() => {
        console.log('🏓 Keep-alive ping:', new Date().toISOString());
      }, 60000); // Reduzido para 1 minuto
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