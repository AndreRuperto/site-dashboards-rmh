// server.js - VERSÃO CORRIGIDA PARA RAILWAY
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

// ❗ CORREÇÃO 1: Configurar trust proxy para Railway
app.set('trust proxy', 1); // Trust primeiro proxy (Railway)

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

// ❗ CORREÇÃO 2: Rate limiting melhorado para Railway
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200, // Máximo 200 requests por 15 min
  message: { error: 'Muitas tentativas, tente novamente em 15 minutos' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Pular rate limit para rotas de health e assets
    return req.path === '/health' || 
           req.path === '/ping' || 
           req.path === '/' || 
           req.path.startsWith('/assets/') ||
           req.path.includes('.ico') ||
           req.path.includes('.png') ||
           req.path.includes('.css') ||
           req.path.includes('.js');
  },
  // ❗ CORREÇÃO 3: Key generator customizado para Railway
  keyGenerator: (req) => {
    // Usar IP real do Railway
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
          <p>Agora com PostgreSQL e sistema completo de autenticação.</p>
          <div style="background: #10b981; color: white; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <h3 style="margin: 0;">✅ SISTEMA COMPLETO!</h3>
          </div>
          <ul>
            <li>✅ PostgreSQL conectado</li>
            <li>✅ JWT funcionando</li>
            <li>✅ Resend integrado</li>
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

// ROTAS DE AUTENTICAÇÃO
app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { error, value } = schemaRegistro.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { nome, email, senha, departamento } = value;

    // Verificar se o usuário já existe
    const userExists = await pool.query(
      'SELECT id FROM usuarios WHERE email = $1',
      [email]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    // Criptografar senha
    const saltRounds = 10;
    const senhaHash = await bcrypt.hash(senha, saltRounds);

    // Gerar token de verificação
    const tokenVerificacao = crypto.randomBytes(32).toString('hex');

    // Inserir usuário
    const result = await pool.query(
      `INSERT INTO usuarios (nome, email, senha, departamento, token_verificacao)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, nome, email, departamento`,
      [nome, email, senhaHash, departamento, tokenVerificacao]
    );

    const newUser = result.rows[0];

    // Enviar email de verificação
    try {
      const urlVerificacao = `${process.env.FRONTEND_URL || 'https://rmh.up.railway.app'}/verify-email?token=${tokenVerificacao}&email=${email}`;
      
      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: [email],
        subject: '🔐 Confirme seu email - RMH Dashboards',
        html: gerarTemplateEmailVerificacao(nome, urlVerificacao)
      });

      console.log(`Email de verificação enviado para: ${email}`);
    } catch (emailError) {
      console.error('Erro ao enviar email de verificação:', emailError);
    }

    res.status(201).json({
      message: 'Usuário cadastrado com sucesso. Verifique seu email para ativar a conta.',
      user: newUser
    });

  } catch (error) {
    console.error('Erro no registro:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Verificar email
app.get('/api/auth/verify-email', async (req, res) => {
  try {
    const { token, email } = req.query;

    if (!token || !email) {
      return res.status(400).json({ error: 'Token e email são obrigatórios' });
    }

    const result = await pool.query(
      'UPDATE usuarios SET email_verificado = true, verificado_em = NOW() WHERE token_verificacao = $1 AND email = $2 RETURNING id, nome, email',
      [token, email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Token inválido ou expirado' });
    }

    res.json({ message: 'Email verificado com sucesso!' });

  } catch (error) {
    console.error('Erro na verificação:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ❗ CORREÇÃO 4: Login com nomes de colunas corretos
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { error, value } = schemaLogin.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, senha } = value;

    // Buscar usuário - CORRIGIDO: usar 'senha' ao invés de 'senha_hash'
    const result = await pool.query(
      'SELECT id, nome, email, senha, departamento, tipo_usuario, email_verificado FROM usuarios WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    const user = result.rows[0];

    // Verificar senha - CORRIGIDO: usar 'user.senha' ao invés de 'user.senha_hash'
    const senhaValida = await bcrypt.compare(senha, user.senha);
    if (!senhaValida) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    // Verificar se email foi verificado
    if (!user.email_verificado) {
      return res.status(401).json({ 
        error: 'Email não verificado. Verifique sua caixa de entrada.' 
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

// Função para gerar template de email
function gerarTemplateEmailVerificacao(nome, urlVerificacao) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Confirmar Email - RMH Dashboards</title>
      <style>
        .container { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1e40af; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; }
        .footer { text-align: center; margin-top: 20px; color: #64748b; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Confirme seu Email</h1>
        </div>
        <div class="content">
          <h2>Olá, ${nome}!</h2>
          <p>Bem-vindo aos Dashboards Corporativos da Resende MH!</p>
          <p>Para ativar sua conta, clique no botão abaixo:</p>
          <p style="text-align: center;">
            <a href="${urlVerificacao}" class="button">✅ Ativar Conta</a>
          </p>
          <p>Ou copie este link: <br><code>${urlVerificacao}</code></p>
          <p><small>Este link expira em 24 horas.</small></p>
        </div>
        <div class="footer">
          <p>Resende MH - Este é um email automático, não responda.</p>
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

// ❗ CORREÇÃO 5: Inicialização melhorada para Railway
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
      if (process.env.NODE_ENV === 'production') {
        console.log(`🎨 Frontend sendo servido da pasta dist/`);
      }
    });

    // ❗ CORREÇÃO 6: Keep-alive reduzido para Railway (melhor performance)
    if (process.env.NODE_ENV === 'production') {
      setInterval(() => {
        console.log('🏓 Keep-alive ping:', new Date().toISOString());
      }, 60000); // Reduzido para 1 minuto
    }

    // ❗ CORREÇÃO 7: Graceful shutdown melhorado
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