// server.js - Backend completo servindo também o frontend
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
      connectSrc: ["'self'", "https://*.railway.app"], // Permitir conexões para Railway
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https:", "data:"]
    },
  },
}));

// Rate limiting (mais permissivo para health checks)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Muitas tentativas, tente novamente em 15 minutos' },
  skip: (req) => {
    return req.path === '/health' || req.path === '/ping' || req.path === '/';
  }
});
app.use(limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas de autenticação, tente novamente em 15 minutos' }
});

// Body parser
app.use(express.json({ limit: '10mb' }));

// Logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
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
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// ROTAS DE AUTENTICAÇÃO
app.use('/api/auth', authLimiter);

// Registro de usuário
app.post('/api/auth/register', async (req, res) => {
  try {
    const { error, value } = schemaRegistro.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { nome, email, senha, departamento } = value;

    // Verificar se usuário já existe
    const existingUser = await pool.query(
      'SELECT id FROM usuarios WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    // Hash da senha
    const senhaHash = await bcrypt.hash(senha, 12);

    // Criar usuário
    const userResult = await pool.query(
      `INSERT INTO usuarios (nome, email, senha, departamento, tipo_usuario) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id, nome, email, departamento, tipo_usuario`,
      [nome, email, senhaHash, departamento, email === 'admin@resendemh.com.br' ? 'admin' : 'usuario']
    );

    const user = userResult.rows[0];

    // Gerar token de verificação
    const tokenVerificacao = crypto.randomBytes(32).toString('hex');
    const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    await pool.query(
      `INSERT INTO verificacoes_email (usuario_id, token, expira_em) 
       VALUES ($1, $2, $3)`,
      [user.id, tokenVerificacao, expiraEm]
    );

    // Enviar email de verificação
    const urlVerificacao = `${process.env.FRONTEND_URL || 'https://site-api-rmh-up.railway.app'}/verify-email?token=${tokenVerificacao}&email=${email}`;
    
    try {
      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: [email],
        subject: '🔐 Ative sua conta - Dashboards Corporativos RMH',
        html: gerarTemplateVerificacao(nome, urlVerificacao)
      });

      // Log do email
      await pool.query(
        `INSERT INTO logs_email (usuario_id, email_para, tipo_email, status) 
         VALUES ($1, $2, 'verificacao', 'enviado')`,
        [user.id, email]
      );
    } catch (emailError) {
      console.error('Erro ao enviar email:', emailError);
    }

    res.status(201).json({
      message: 'Usuário registrado! Verifique seu email para ativar a conta.',
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        departamento: user.departamento
      }
    });

  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Verificação de email
app.post('/api/auth/verify-email', async (req, res) => {
  try {
    const { token, email } = req.body;

    if (!token || !email) {
      return res.status(400).json({ error: 'Token e email são obrigatórios' });
    }

    // Buscar token válido
    const tokenResult = await pool.query(
      `SELECT ve.*, u.id as usuario_id, u.nome, u.email 
       FROM verificacoes_email ve
       JOIN usuarios u ON ve.usuario_id = u.id
       WHERE ve.token = $1 AND u.email = $2 AND ve.expira_em > NOW() AND ve.usado_em IS NULL`,
      [token, email]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'Token inválido ou expirado' });
    }

    const verification = tokenResult.rows[0];

    // Marcar usuário como verificado
    await pool.query(
      'UPDATE usuarios SET email_verificado = TRUE WHERE id = $1',
      [verification.usuario_id]
    );

    // Marcar token como usado
    await pool.query(
      'UPDATE verificacoes_email SET usado_em = NOW() WHERE id = $1',
      [verification.id]
    );

    res.json({ message: 'Email verificado com sucesso!' });

  } catch (error) {
    console.error('Erro na verificação:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { error, value } = schemaLogin.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, senha } = value;

    // Buscar usuário
    const userResult = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const user = userResult.rows[0];

    // Verificar senha
    const senhaValida = await bcrypt.compare(senha, user.senha);
    if (!senhaValida) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
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
      `SELECT d.*, u.nome as criado_por_nome 
       FROM dashboards d 
       JOIN usuarios u ON d.criado_por = u.id 
       WHERE d.ativo = TRUE 
       ORDER BY d.criado_em DESC`
    );

    res.json({ dashboards: result.rows });
  } catch (error) {
    console.error('Erro ao buscar dashboards:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Template de email de verificação
function gerarTemplateVerificacao(nome, urlVerificacao) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Ative sua conta</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 30px 20px; text-align: center; }
        .content { padding: 30px; }
        .button { display: inline-block; padding: 16px 32px; background: #10b981; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; background: #f9fafb; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🏢 Dashboards Corporativos</h1>
          <p>Resende MH</p>
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

// Conectar ao banco e iniciar servidor
async function iniciarServidor() {
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Conectado ao PostgreSQL');
    
    const server = app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      console.log(`🌐 Ambiente: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📧 Resend configurado`);
      console.log(`🗄️ PostgreSQL conectado`);
      if (process.env.NODE_ENV === 'production') {
        console.log(`🎨 Frontend sendo servido da pasta dist/`);
      }
    });

    // Keep-alive para Railway em produção
    if (process.env.NODE_ENV === 'production') {
      setInterval(() => {
        console.log('🏓 Keep-alive ping:', new Date().toISOString());
      }, 30000);
    }

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('📴 Recebido SIGTERM, encerrando graciosamente...');
      server.close(() => {
        console.log('🔴 Servidor encerrado');
        pool.end(() => {
          console.log('🔴 Conexão com PostgreSQL encerrada');
          process.exit(0);
        });
      });
    });

    process.on('SIGINT', () => {
      console.log('📴 Recebido SIGINT, encerrando graciosamente...');
      server.close(() => {
        console.log('🔴 Servidor encerrado');
        pool.end(() => {
          console.log('🔴 Conexão com PostgreSQL encerrada');
          process.exit(0);
        });
      });
    });

  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

iniciarServidor();

// Error handler
app.use((error, req, res, next) => {
  console.error('Erro:', error);
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' 
      ? 'Erro interno do servidor' 
      : error.message 
  });
});