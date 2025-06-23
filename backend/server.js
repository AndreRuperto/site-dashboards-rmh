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
          "https://app.fabric.microsoft.com",
          "https://app.powerbi.com",          // ✅ ADICIONAR ESTA LINHA
          "https://msit.powerbi.com" 
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
        process.env.API_BASE_URL,
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
    
    // ✅ CORREÇÃO: Query usando LEFT JOIN com usuarios_admin_log
    const result = await pool.query(
      `SELECT 
         u.id, u.nome, u.email, u.email_pessoal, u.setor, u.tipo_usuario, u.tipo_colaborador,
         u.email_verificado, u.is_coordenador,
         COALESCE(ual.ativo, true) as ativo,
         CASE 
           WHEN u.tipo_colaborador = 'estagiario' THEN u.email_pessoal 
           ELSE u.email 
         END as email_login
       FROM usuarios u
       LEFT JOIN usuarios_admin_log ual ON u.id = ual.usuario_id
       WHERE u.id = $1`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      console.log('❌ AUTH: Usuário não encontrado no banco');
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    const user = result.rows[0];

    if (!user.email_verificado) {
      console.log('❌ AUTH: Email não verificado');
      return res.status(401).json({ error: 'Email não verificado' });
    }

    if (!user.ativo) {
      console.log('❌ AUTH: Usuário inativo/revogado');
      return res.status(401).json({ error: 'Acesso revogado. Entre em contato com o administrador.' });
    }

    req.user = user;
    console.log('✅ AUTH: Usuário autenticado:', 
      user.tipo_colaborador === 'estagiario' ? user.email_pessoal : user.email
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

// TEMPLATE DE EMAIL PARA VALIDAÇÃO DE ESTAGIÁRIO - PADRÃO RMH
async function gerarTemplateValidacaoEstagiario(nome, linkValidacao, email) {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Cadastro Aprovado - RMH</title>
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
          background-color: #165A5D;
          color: white;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          margin: 10px 0;
        }
        .link-box {
          margin: 30px auto;
          background-color: #f8f8f8;
          border: 2px dashed #165A5D;
          border-radius: 12px;
          padding: 30px 20px;
          max-width: 400px;
        }
        .action-button {
          background: #165A5D;
          color: white;
          padding: 15px 30px;
          text-decoration: none;
          border-radius: 8px;
          display: inline-block;
          font-weight: bold;
          font-size: 16px;
          margin: 10px 0;
          transition: background-color 0.3s;
        }
        .action-button:hover {
          background: #0d3638;
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
          .link-box {
            padding: 20px 15px;
          }
          .action-button {
            padding: 12px 24px;
            font-size: 14px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://rmh.up.railway.app/logo-rmh.ico" alt="Logo RMH" style="height: 50px; margin-bottom: 20px;" />
          <h1>Cadastro Aprovado</h1>
        </div>
        <div class="content">
          <h2>Olá, ${nome}!</h2>
          <div class="tipo-badge">Estagiário</div>
          <p>Seu cadastro foi aprovado pelo administrador! Clique no botão abaixo para ativar automaticamente seu acesso:</p>
          
          <div class="link-box">
            <a href="${linkValidacao}" class="action-button" style="color: #ffffff;">
              Ativar Conta Automaticamente
            </a>
          </div>
          <p class="note">Este link expira em 24 horas. Após ativar, você poderá fazer login na plataforma com seu email pessoal e senha. Se você não solicitou este cadastro, ignore este e-mail.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

async function gerarTemplateEstagiarioAdicionadoPorAdmin(nome, linkValidacao, email) {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Conta Criada - RMH</title>
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
          background-color: #165A5D;
          color: white;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          margin: 10px 0;
        }
        .link-box {
          margin: 30px auto;
          background-color: #f8f8f8;
          border: 2px dashed #165A5D;
          border-radius: 12px;
          padding: 30px 20px;
          max-width: 400px;
        }
        .action-button {
          background: #165A5D;
          color: white;
          padding: 15px 30px;
          text-decoration: none;
          border-radius: 8px;
          display: inline-block;
          font-weight: bold;
          font-size: 16px;
          margin: 10px 0;
          transition: background-color 0.3s;
        }
        .action-button:hover {
          background: #0d3638;
        }
        .info-box {
          background: #e3f2fd;
          padding: 15px;
          border-radius: 8px;
          margin: 20px 0;
          text-align: left;
          border-left: 4px solid #165A5D;
        }
        .note {
          font-size: 13px;
          color: #8b848b;
          background-color: #EFEFEF;
          padding: 15px;
          border-radius: 10px;
          margin-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://rmh.up.railway.app/logo-rmh.ico" alt="Logo RMH" style="height: 50px; margin-bottom: 20px;" />
          <h1>🎉 Conta Criada</h1>
        </div>
        <div class="content">
          <h2>Olá, ${nome}!</h2>
          <div class="tipo-badge">Estagiário</div>
          <p>Você foi adicionado à plataforma de dashboards da RMH por um administrador!</p>
          
          <div class="link-box">
            <a href="${linkValidacao}" class="action-button" style="color: #ffffff;">
              🚀 Ativar Conta Automaticamente
            </a>
            <p style="font-size: 14px; color: #666; margin: 15px 0 0 0;">
              Clique no botão para ativar sua conta instantaneamente
            </p>
          </div>
          
          <div class="info-box">
            <p style="margin: 0;"><strong>📧 Seu email de login:</strong> ${email}</p>
            <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Use este email para fazer login após ativar a conta.</p>
          </div>
          
          <p><strong>📋 Próximos passos:</strong></p>
          <ol style="text-align: left; margin: 0 auto; display: inline-block;">
            <li>Clique no botão "Ativar Conta Automaticamente"</li>
            <li>Sua conta será ativada instantaneamente</li>
            <li>Faça login na plataforma com suas credenciais</li>
          </ol>
          
          <p class="note">Este link expira em 7 dias. Sua senha foi gerada automaticamente - você pode alterá-la após o primeiro login.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// TEMPLATE: Email de configuração de conta
async function gerarTemplateConfiguracaoConta(nome, linkAtivacao, emailLogin, tipoColaborador) {
  const tipoTexto = tipoColaborador === 'estagiario' ? 'Estagiário' : 'CLT/Associado';
  
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Configure sua Conta - RMH</title>
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
          background-color: #165A5D;
          color: white;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          margin: 10px 0;
        }
        .link-box {
          margin: 30px auto;
          background-color: #f8f8f8;
          border: 2px dashed #165A5D;
          border-radius: 12px;
          padding: 30px 20px;
          max-width: 400px;
        }
        .action-button {
          background: #165A5D;
          color: white;
          padding: 15px 30px;
          text-decoration: none;
          border-radius: 8px;
          display: inline-block;
          font-weight: bold;
          font-size: 16px;
          margin: 10px 0;
          transition: background-color 0.3s;
        }
        .action-button:hover {
          background: #0d3638;
        }
        .info-box {
          background: #e3f2fd;
          padding: 15px;
          border-radius: 8px;
          margin: 20px 0;
          text-align: left;
          border-left: 4px solid #165A5D;
        }
        .note {
          font-size: 13px;
          color: #8b848b;
          background-color: #EFEFEF;
          padding: 15px;
          border-radius: 10px;
          margin-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://rmh.up.railway.app/logo-rmh.ico" alt="Logo RMH" style="height: 50px; margin-bottom: 20px;" />
          <h1>Configure sua Conta</h1>
        </div>
        <div class="content">
          <h2>Olá, ${nome}!</h2>
          <div class="tipo-badge">${tipoTexto}</div>
          <p>Você foi adicionado à plataforma de dashboards da RMH por um administrador!</p>
          
          <div class="link-box">
            <a href="${linkAtivacao}" class="action-button">
              🔐 Configurar Minha Senha
            </a>
            <p style="font-size: 14px; color: #666; margin: 15px 0 0 0;">
              Clique no botão para definir sua senha
            </p>
          </div>
          
          <div class="info-box">
            <p style="margin: 0;"><strong>📧 Seu email de login:</strong> ${emailLogin}</p>
            <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Use este email para acessar a plataforma após configurar sua senha.</p>
          </div>
          
          <p><strong>📋 Próximos passos:</strong></p>
          <ol style="text-align: left; margin: 0 auto; display: inline-block;">
            <li>Clique no botão "Configurar Minha Senha"</li>
            <li>Defina uma senha segura para sua conta</li>
            <li>Acesse a plataforma com suas credenciais</li>
          </ol>
          
          <p class="note">Este link expira em 7 dias. Se precisar de ajuda, entre em contato com o administrador.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

async function gerarTemplateConfigurarSenha(nome, linkConfiguracao, email) {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Configure sua Senha - RMH</title>
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
          background-color: #165A5D;
          color: white;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          margin: 10px 0;
        }
        .link-box {
          margin: 30px auto;
          background-color: #f8f8f8;
          border: 2px dashed #165A5D;
          border-radius: 12px;
          padding: 30px 20px;
          max-width: 400px;
        }
        .action-button {
          background: #165A5D;
          color: white;
          padding: 15px 30px;
          text-decoration: none;
          border-radius: 8px;
          display: inline-block;
          font-weight: bold;
          font-size: 16px;
          margin: 10px 0;
          transition: background-color 0.3s;
        }
        .action-button:hover {
          background: #0d3638;
        }
        .info-box {
          background: #e3f2fd;
          padding: 15px;
          border-radius: 8px;
          margin: 20px 0;
          text-align: left;
          border-left: 4px solid #165A5D;
        }
        .steps {
          background: #f0f9ff;
          padding: 20px;
          border-radius: 10px;
          margin: 20px 0;
          text-align: left;
        }
        .note {
          font-size: 13px;
          color: #8b848b;
          background-color: #EFEFEF;
          padding: 15px;
          border-radius: 10px;
          margin-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://rmh.up.railway.app/logo-rmh.ico" alt="Logo RMH" style="height: 50px; margin-bottom: 20px;" />
          <h1>Configure sua Senha</h1>
        </div>
        <div class="content">
          <h2>Olá, ${nome}!</h2>
          <div class="tipo-badge">Estagiário</div>
          <p>Você foi adicionado à plataforma de dashboards da RMH! Agora precisa definir sua senha para acessar a plataforma.</p>
          
          <div class="link-box">
            <a href="${linkConfiguracao}" class="action-button" style="color: #ffffff;">
              🔑 Definir Minha Senha
            </a>
            <p style="font-size: 14px; color: #666; margin: 15px 0 0 0;">
              Clique no botão para escolher sua senha
            </p>
          </div>
          <p class="note">Este link expira em 7 dias. Se precisar de ajuda, entre em contato com o administrador.</p>
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
  // ✅ ADICIONAR: Invalidar códigos anteriores se usuário já existir
      await client.query(
        'UPDATE verificacoes_email SET usado_em = NOW() WHERE usuario_id = $1 AND usado_em IS NULL',
        [newUser.id]
      );

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
          from: 'andre.macedo@resendemh.com.br',
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
  const client = await pool.connect(); // ✅ ADICIONADO: client definido
  
  try {
    await client.query('BEGIN');
    
    const { email, codigo } = req.body;

    if (!email || !codigo) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'Email e código são obrigatórios' });
    }

    console.log(`🔍 VERIFICAÇÃO: Email: ${email}, Código: ${codigo}`);

    // Buscar usuário (por email corporativo ou pessoal)
    const userResult = await client.query(
      `SELECT id, nome, email, email_pessoal, tipo_colaborador, email_verificado 
       FROM usuarios 
       WHERE (tipo_colaborador = 'estagiario' AND email_pessoal = $1) 
          OR (tipo_colaborador = 'clt_associado' AND email = $1)`,
      [email]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = userResult.rows[0];

    if (user.email_verificado) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'Email já verificado' });
    }

    // ✅ CORRIGIDO: Usar client em vez de pool
    const tokenResult = await client.query(
      `SELECT v.*, u.nome, u.email, u.email_pessoal, u.tipo_colaborador 
       FROM verificacoes_email v
       JOIN usuarios u ON v.usuario_id = u.id
       WHERE v.token = $1 
         AND v.tipo_token = 'verificacao_email'
         AND v.usado_em IS NULL 
         AND v.expira_em > NOW()`,
      [codigo] // ✅ CORRIGIDO: usar 'codigo' em vez de 'token'
    );

    if (tokenResult.rows.length === 0) {
      console.log(`❌ VERIFICAÇÃO: Código inválido ou expirado para usuário ${user.id}`);
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ 
        error: 'Código inválido ou expirado. Solicite um novo código.' 
      });
    }

    const verification = tokenResult.rows[0];
    console.log(`✅ VERIFICAÇÃO: Código válido encontrado!`);

    // Marcar usuário como verificado
    await client.query(
      'UPDATE usuarios SET email_verificado = TRUE, verificado_em = NOW() WHERE id = $1',
      [user.id]
    );

    // Marcar token como usado
    await client.query(
      'UPDATE verificacoes_email SET usado_em = NOW() WHERE id = $1',
      [verification.id]
    );

    await client.query('COMMIT');

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
    await client.query('ROLLBACK');
    console.error('❌ Erro na verificação:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    client.release(); // ✅ ADICIONADO: sempre liberar conexão
  }
});

// NOVA ROTA: Validar email por token direto
app.get('/api/auth/validar-email/:token', async (req, res) => {
  try {
    const { token } = req.params;

    console.log(`🔍 VALIDAÇÃO: Processando token: ${token}`);

    // Buscar token (incluindo os expirados e usados para diagnóstico)
    const tokenResult = await pool.query(
      `SELECT v.*, u.nome, u.email_pessoal, u.tipo_colaborador, u.email_verificado
       FROM verificacoes_email v
       JOIN usuarios u ON v.usuario_id = u.id
       WHERE v.token = $1 AND v.tipo_token = 'verificacao_email'`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).send(`
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Token Não Encontrado - RMH</title>
          <link href="https://fonts.googleapis.com/css2?family=Raleway:wght@400;600&family=Ruda:wght@900&display=swap" rel="stylesheet">
          <style>
            body { 
              font-family: 'Raleway', sans-serif; 
              background-color: #DADADA;
              color: #0d3638;
              margin: 0; padding: 20px; min-height: 100vh;
              display: flex; align-items: center; justify-content: center;
            }
            .container { 
              background: #f9f9f9; padding: 40px; border-radius: 16px; 
              box-shadow: 0 10px 30px rgba(0,0,0,0.08); text-align: center; 
              max-width: 500px; margin: 20px;
            }
            .header {
              background-color: #165A5D;
              margin: -40px -40px 30px -40px;
              padding: 30px 40px;
              border-radius: 16px 16px 0 0;
              color: white;
            }
            .header h1 {
              font-family: 'Ruda', sans-serif;
              font-size: 24px;
              margin: 0;
              letter-spacing: 0.5px;
            }
            .icon { font-size: 48px; margin-bottom: 10px; }
            h2 { color: #0d3638; margin: 20px 0; font-family: 'Ruda', sans-serif; }
            p { color: #555; line-height: 1.6; margin: 15px 0; }
            .reason { 
              background: #EFEFEF; padding: 15px; border-radius: 10px; 
              border-left: 4px solid #165A5D; margin: 20px 0; text-align: left;
            }
            .contact { 
              background: #e3f2fd; padding: 15px; border-radius: 10px; 
              margin: 20px 0; border-left: 4px solid #165A5D;
            }
            .button {
              background: #165A5D; color: white; padding: 15px 30px;
              text-decoration: none; border-radius: 8px; display: inline-block;
              margin: 20px 10px; transition: all 0.3s; font-weight: 600;
            }
            .button:hover { background: #0d3638; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="icon">🔍</div>
              <h1>Token Não Encontrado</h1>
            </div>
            <h2>Link de Validação Inválido</h2>
            <p>Este link de validação não foi encontrado em nossa base de dados.</p>
            
            <div class="reason">
              <strong>❌ Motivo:</strong> Token inexistente ou inválido
            </div>
            
            <div class="contact">
              <strong>💡 O que fazer:</strong><br>
              • Verifique se copiou o link completo<br>
              • Solicite um novo link de verificação<br>
              • Entre em contato com o administrador
            </div>
            
            <a href="${process.env.API_BASE_URL || 'http://localhost:3001'}" class="button">
              🏠 Voltar ao Início
            </a>
          </div>
        </body>
        </html>
      `);
    }

    const verification = tokenResult.rows[0];
    const agora = new Date();
    const expirou = new Date(verification.expira_em) < agora;
    const jaUsado = verification.usado_em !== null;
    const usuarioJaVerificado = verification.email_verificado;

    console.log(`📊 DIAGNÓSTICO:`, {
      token_encontrado: true,
      expirou: expirou,
      ja_usado: jaUsado,
      usuario_ja_verificado: usuarioJaVerificado,
      expira_em: verification.expira_em,
      usado_em: verification.usado_em,
      criado_em: verification.criado_em
    });

    // VERIFICAR CONDIÇÕES DE ERRO
    if (usuarioJaVerificado) {
      return res.status(400).send(`
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Conta Já Ativada - RMH</title>
          <link href="https://fonts.googleapis.com/css2?family=Raleway:wght@400;600&family=Ruda:wght@900&display=swap" rel="stylesheet">
          <style>
            body { 
              font-family: 'Raleway', sans-serif; 
              background-color: #DADADA;
              color: #0d3638;
              margin: 0; padding: 20px; min-height: 100vh;
              display: flex; align-items: center; justify-content: center;
            }
            .container { 
              background: #f9f9f9; padding: 40px; border-radius: 16px; 
              box-shadow: 0 10px 30px rgba(0,0,0,0.08); text-align: center; 
              max-width: 500px; margin: 20px;
            }
            .header {
              background-color: #165A5D;
              margin: -40px -40px 30px -40px;
              padding: 30px 40px;
              border-radius: 16px 16px 0 0;
              color: white;
            }
            .header h1 {
              font-family: 'Ruda', sans-serif;
              font-size: 24px;
              margin: 0;
              letter-spacing: 0.5px;
            }
            .icon { font-size: 48px; margin-bottom: 10px; }
            h2 { color: #0d3638; margin: 20px 0; font-family: 'Ruda', sans-serif; }
            p { color: #555; line-height: 1.6; margin: 15px 0; }
            .info { 
              background: #EFEFEF; padding: 15px; border-radius: 10px; 
              border-left: 4px solid #165A5D; margin: 20px 0;
            }
            .button {
              background: #165A5D; color: white; padding: 15px 30px;
              text-decoration: none; border-radius: 8px; display: inline-block;
              margin: 20px 10px; transition: all 0.3s; font-weight: 600;
            }
            .button:hover { background: #0d3638; }
            .success-badge {
              display: inline-block;
              padding: 6px 12px;
              background-color: #165A5D;
              color: white;
              border-radius: 20px;
              font-size: 14px;
              font-weight: 600;
              margin: 10px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="icon">✅</div>
              <h1>Conta Já Ativada</h1>
            </div>
            <h2>Olá, ${verification.nome}!</h2>
            <div class="success-badge">${verification.tipo_colaborador === 'estagiario' ? 'Estagiário' : 'CLT/Associado'}</div>
            <p>Sua conta já foi verificada anteriormente e está ativa.</p>
            
            <div class="info">
              <strong>✨ Status:</strong> Email já verificado<br>
              <strong>📧 Email:</strong> ${verification.email_pessoal}<br>
              <strong>🎯 Tipo:</strong> ${verification.tipo_colaborador === 'estagiario' ? 'Estagiário' : 'CLT/Associado'}
            </div>
            
            <p>Você já pode fazer login na plataforma!</p>
            
            <a href="${process.env.API_BASE_URL || 'http://localhost:3001'}" class="button">
              🚀 Acessar Plataforma
            </a>
          </div>
        </body>
        </html>
      `);
    }

    if (jaUsado) {
      const dataUso = new Date(verification.usado_em).toLocaleString('pt-BR');
      
      return res.status(400).send(`
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Link Já Utilizado - RMH</title>
          <link href="https://fonts.googleapis.com/css2?family=Raleway:wght@400;600&family=Ruda:wght@900&display=swap" rel="stylesheet">
          <style>
            body { 
              font-family: 'Raleway', sans-serif; 
              background-color: #DADADA;
              color: #0d3638;
              margin: 0; padding: 20px; min-height: 100vh;
              display: flex; align-items: center; justify-content: center;
            }
            .container { 
              background: #f9f9f9; padding: 40px; border-radius: 16px; 
              box-shadow: 0 10px 30px rgba(0,0,0,0.08); text-align: center; 
              max-width: 500px; margin: 20px;
            }
            .header {
              background-color: #165A5D;
              margin: -40px -40px 30px -40px;
              padding: 30px 40px;
              border-radius: 16px 16px 0 0;
              color: white;
            }
            .header h1 {
              font-family: 'Ruda', sans-serif;
              font-size: 24px;
              margin: 0;
              letter-spacing: 0.5px;
            }
            .icon { font-size: 48px; margin-bottom: 10px; }
            h2 { color: #0d3638; margin: 20px 0; font-family: 'Ruda', sans-serif; }
            p { color: #555; line-height: 1.6; margin: 15px 0; }
            .reason { 
              background: #EFEFEF; padding: 15px; border-radius: 10px; 
              border-left: 4px solid #165A5D; margin: 20px 0; text-align: left;
            }
            .contact { 
              background: #e3f2fd; padding: 15px; border-radius: 10px; 
              margin: 20px 0; border-left: 4px solid #165A5D;
            }
            .button {
              background: #165A5D; color: white; padding: 15px 30px;
              text-decoration: none; border-radius: 8px; display: inline-block;
              margin: 20px 10px; transition: all 0.3s; font-weight: 600;
            }
            .button:hover { background: #0d3638; }
            .warning-badge {
              display: inline-block;
              padding: 6px 12px;
              background-color: #165A5D;
              color: white;
              border-radius: 20px;
              font-size: 14px;
              font-weight: 600;
              margin: 10px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="icon">🔒</div>
              <h1>Link Já Utilizado</h1>
            </div>
            <h2>Olá, ${verification.nome}!</h2>
            <div class="warning-badge">${verification.tipo_colaborador === 'estagiario' ? 'Estagiário' : 'CLT/Associado'}</div>
            <p>Este link de validação já foi usado anteriormente.</p>
            
            <div class="reason">
              <strong>⚠️ Motivo:</strong> Link já utilizado<br>
              <strong>📅 Usado em:</strong> ${dataUso}<br>
              <strong>👤 Usuário:</strong> ${verification.nome}
            </div>
            
            <div class="contact">
              <strong>💡 O que fazer:</strong><br>
              • Tente fazer login normalmente<br>
              • Se não conseguir, solicite um novo link<br>
              • Entre em contato com o administrador se precisar
            </div>
            
            <a href="${process.env.API_BASE_URL || 'http://localhost:3001'}" class="button">
              🚀 Tentar Login
            </a>
          </div>
        </body>
        </html>
      `);
    }

    if (expirou) {
      const dataExpiracao = new Date(verification.expira_em).toLocaleString('pt-BR');
      const horasAtrasado = Math.floor((agora - new Date(verification.expira_em)) / (1000 * 60 * 60));
      
      return res.status(400).send(`
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Link Expirado - RMH</title>
          <style>
            body { 
              font-family: 'Segoe UI', Arial, sans-serif; 
              background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
              margin: 0; padding: 0; min-height: 100vh;
              display: flex; align-items: center; justify-content: center;
            }
            .container { 
              background: white; padding: 40px; border-radius: 15px; 
              box-shadow: 0 20px 40px rgba(0,0,0,0.1); text-align: center; 
              max-width: 500px; margin: 20px;
            }
            .icon { font-size: 64px; margin-bottom: 20px; }
            h2 { color: #e74c3c; margin: 20px 0; }
            p { color: #666; line-height: 1.6; margin: 15px 0; }
            .reason { 
              background: #fdf2f2; padding: 15px; border-radius: 8px; 
              border-left: 4px solid #e74c3c; margin: 20px 0; text-align: left;
            }
            .contact { 
              background: #e3f2fd; padding: 15px; border-radius: 8px; 
              margin: 20px 0; border-left: 4px solid #2196f3;
            }
            .button {
              background: #165A5D; color: white; padding: 12px 24px;
              text-decoration: none; border-radius: 6px; display: inline-block;
              margin: 20px 10px; transition: all 0.3s;
            }
            .button:hover { background: #0d3638; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">⏰</div>
            <h2>Link Expirado</h2>
            <p>Olá, <strong>${verification.nome}</strong>!</p>
            <p>Este link de validação expirou e não pode mais ser usado.</p>
            
            <div class="reason">
              <strong>❌ Motivo:</strong> Link expirado<br>
              <strong>📅 Expirou em:</strong> ${dataExpiracao}<br>
              <strong>⏳ Há:</strong> ${horasAtrasado} hora(s) atrás<br>
              <strong>👤 Usuário:</strong> ${verification.nome}
            </div>
            
            <div class="contact">
              <strong>💡 O que fazer:</strong><br>
              • Solicite um novo link de verificação<br>
              • Entre em contato com o administrador<br>
              • Use a opção "Reenviar código" no login
            </div>
            
            <a href="${process.env.API_BASE_URL || 'http://localhost:3001'}" class="button">
              🔄 Solicitar Novo Link
            </a>
          </div>
        </body>
        </html>
      `);
    }

    // SE CHEGOU ATÉ AQUI, O TOKEN É VÁLIDO - PROCESSAR VERIFICAÇÃO
    await pool.query('BEGIN');
    
    await pool.query(
      'UPDATE usuarios SET email_verificado = true WHERE id = $1',
      [verification.usuario_id]
    );

    await pool.query(
      'UPDATE verificacoes_email SET usado_em = NOW() WHERE token = $1',
      [token]
    );

    await pool.query('COMMIT');

    console.log(`✅ Email validado automaticamente para: ${verification.email_pessoal}`);

    // PÁGINA DE SUCESSO
    res.send(`
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Email Verificado - RMH</title>
        <style>
          body { 
            font-family: 'Segoe UI', Arial, sans-serif; 
            background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
            margin: 0; padding: 0; min-height: 100vh;
            display: flex; align-items: center; justify-content: center;
          }
          .container { 
            background: white; padding: 40px; border-radius: 15px; 
            box-shadow: 0 20px 40px rgba(0,0,0,0.1); text-align: center; 
            max-width: 500px; margin: 20px;
            animation: slideIn 0.5s ease-out;
          }
          @keyframes slideIn {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .icon { font-size: 64px; margin-bottom: 20px; animation: bounce 1s; }
          @keyframes bounce {
            0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
            40% { transform: translateY(-10px); }
            60% { transform: translateY(-5px); }
          }
          h2 { color: #27ae60; margin: 20px 0; }
          p { color: #666; line-height: 1.6; margin: 15px 0; }
          .success { 
            background: #e8f5e8; padding: 15px; border-radius: 8px; 
            border-left: 4px solid #27ae60; margin: 20px 0;
          }
          .button {
            background: #165A5D; color: white; padding: 15px 30px;
            text-decoration: none; border-radius: 6px; display: inline-block;
            margin: 20px 10px; transition: all 0.3s; font-weight: bold;
          }
          .button:hover { background: #0d3638; transform: translateY(-2px); }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">🎉</div>
          <h2>Email Verificado com Sucesso!</h2>
          <p>Parabéns, <strong>${verification.nome}</strong>!</p>
          <p>Seu email foi verificado automaticamente e sua conta está ativa.</p>
          
          <div class="success">
            <strong>✅ Status:</strong> Conta ativada<br>
            <strong>📧 Email:</strong> ${verification.email_pessoal}<br>
            <strong>🎯 Tipo:</strong> ${verification.tipo_colaborador === 'estagiario' ? 'Estagiário' : 'CLT/Associado'}<br>
            <strong>⏰ Verificado:</strong> ${new Date().toLocaleString('pt-BR')}
          </div>
          
          <p>Agora você pode fazer login na plataforma com suas credenciais!</p>
          
          <a href="${process.env.API_BASE_URL || 'http://localhost:3001'}" class="button">
            🚀 Acessar Plataforma
          </a>
        </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('❌ Erro na validação automática:', error);
    res.status(500).send(`
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Erro Interno - RMH</title>
        <style>
          body { 
            font-family: 'Segoe UI', Arial, sans-serif; 
            background: linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%);
            margin: 0; padding: 0; min-height: 100vh;
            display: flex; align-items: center; justify-content: center;
          }
          .container { 
            background: white; padding: 40px; border-radius: 15px; 
            box-shadow: 0 20px 40px rgba(0,0,0,0.1); text-align: center; 
            max-width: 500px; margin: 20px;
          }
          .icon { font-size: 64px; margin-bottom: 20px; }
          h2 { color: #7f8c8d; margin: 20px 0; }
          p { color: #666; line-height: 1.6; margin: 15px 0; }
          .error { 
            background: #f8f9fa; padding: 15px; border-radius: 8px; 
            border-left: 4px solid #7f8c8d; margin: 20px 0;
          }
          .button {
            background: #165A5D; color: white; padding: 12px 24px;
            text-decoration: none; border-radius: 6px; display: inline-block;
            margin: 20px 10px; transition: all 0.3s;
          }
          .button:hover { background: #0d3638; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">⚠️</div>
          <h2>Erro Interno do Servidor</h2>
          <p>Ocorreu um erro inesperado ao processar sua solicitação.</p>
          
          <div class="error">
            <strong>🔧 Situação:</strong> Erro interno do sistema<br>
            <strong>💡 Recomendação:</strong> Tente novamente em alguns instantes
          </div>
          
          <p>Se o problema persistir, entre em contato com o administrador.</p>
          
          <a href="${process.env.API_BASE_URL || 'http://localhost:3001'}" class="button">
            🏠 Voltar ao Início
          </a>
        </div>
      </body>
      </html>
    `);
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
const resendLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutos
  max: 3, // máximo 3 tentativas por 2 minutos
  message: { error: 'Muitas tentativas de reenvio. Aguarde 2 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit por email, não por IP
    return req.body.email || req.ip;
  }
});

// ===============================================
// ROTA PARA REENVIAR CÓDIGO DE VERIFICAÇÃO - VERSÃO COMPLETA OTIMIZADA
// ===============================================

app.post('/api/auth/resend-verification', resendLimiter, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { email } = req.body;

    if (!email) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'Email é obrigatório' });
    }

    console.log(`🔄 REENVIO: Solicitação para email: ${email}`);

    // Buscar usuário (por email corporativo ou pessoal)
    const userResult = await client.query(
      `SELECT id, nome, email, email_pessoal, tipo_colaborador, email_verificado 
       FROM usuarios 
       WHERE (tipo_colaborador = 'estagiario' AND email_pessoal = $1) 
          OR (tipo_colaborador = 'clt_associado' AND email = $1)`,
      [email]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = userResult.rows[0];

    if (user.email_verificado) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'Email já verificado' });
    }

    // ✅ VERIFICAR SE JÁ FOI REENVIADO RECENTEMENTE
    const ultimoReenvio = await client.query(
      `SELECT criado_em FROM verificacoes_email 
       WHERE usuario_id = $1
         AND tipo_token = 'verificacao_email'
       ORDER BY criado_em DESC 
       LIMIT 1`,
      [user.id]
    );

    if (ultimoReenvio.rows.length > 0) {
      const tempoEspera = 60; // 60 segundos
      const ultimoCriado = new Date(ultimoReenvio.rows[0].criado_em);
      const agora = new Date();
      const diferencaSegundos = (agora.getTime() - ultimoCriado.getTime()) / 1000;

      if (diferencaSegundos < tempoEspera) {
        const restante = Math.ceil(tempoEspera - diferencaSegundos);
        await client.query('ROLLBACK');
        client.release();
        return res.status(429).json({ 
          error: `Aguarde ${restante} segundos antes de solicitar novo código.` 
        });
      }
    }

    // ✅ INVALIDAR TODOS OS CÓDIGOS ANTERIORES
    const tokensInvalidados = await client.query(
      'UPDATE verificacoes_email SET usado_em = NOW() WHERE usuario_id = $1 AND usado_em IS NULL RETURNING id',
      [user.id]
    );

    console.log(`🗑️ REENVIO: ${tokensInvalidados.rowCount} tokens anteriores invalidados para usuário ${user.id}`);

    // Gerar novo código
    const codigoVerificacao = Math.floor(100000 + Math.random() * 900000).toString();
    const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Salvar novo token
    const novoTokenResult = await client.query(
      `INSERT INTO verificacoes_email (usuario_id, token, tipo_token, expira_em) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, criado_em`,
      [user.id, codigoVerificacao, 'verificacao_email', expiraEm]
    );

    await client.query('COMMIT');

    const emailLogin = user.tipo_colaborador === 'estagiario' ? user.email_pessoal : user.email;

    console.log(`🔄 REENVIO: Novo código para ${user.tipo_colaborador}: ${emailLogin}`);
    console.log(`🔢 Novo código: ${codigoVerificacao}`);
    console.log(`📅 Token ID: ${novoTokenResult.rows[0].id}, Criado: ${novoTokenResult.rows[0].criado_em}`);

    // Enviar email
    try {
      const emailResult = await resend.emails.send({
        from: 'andre.macedo@resendemh.com.br',
        to: [emailLogin],
        subject: '🔐 Novo código de verificação - Dashboards RMH',
        html: await gerarTemplateVerificacao(user.nome, codigoVerificacao, emailLogin, user.tipo_colaborador)
      });

      console.log(`✅ Novo código enviado com sucesso! Email ID:`, emailResult.id);

      res.json({
        message: 'Novo código enviado para seu email',
        email_enviado_para: emailLogin,
        tipo_colaborador: user.tipo_colaborador,
        codigo_expira_em: expiraEm.toISOString(),
        timestamp: new Date().toISOString()
      });

    } catch (emailError) {
      console.error('❌ Erro ao enviar email:', emailError);
      
      // Mesmo com erro no email, não falhar a API
      res.json({
        message: 'Novo código gerado, mas houve erro no envio do email. Tente novamente.',
        email_enviado_para: emailLogin,
        tipo_colaborador: user.tipo_colaborador,
        email_error: true
      });
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao reenviar código:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    client.release();
  }
});

// ROTA: Configurar senha (usuário adicionado pelo admin)
app.post('/api/auth/configurar-conta/:token', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { token } = req.params;
    const { senha } = req.body;

    if (!senha || senha.length < 6) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });
    }

    console.log(`🔑 CONFIGURAR CONTA: Processando token: ${token.substring(0, 8)}...`);

    // ✅ CORREÇÃO: Busca mais permissiva + debug
    const tokenResult = await client.query(
      `SELECT 
         v.*,
         u.nome, 
         u.email, 
         u.email_pessoal, 
         u.tipo_colaborador, 
         u.email_verificado,
         NOW() as agora_servidor,
         (v.expira_em > NOW()) as token_ainda_valido
       FROM verificacoes_email v
       JOIN usuarios u ON v.usuario_id = u.id
       WHERE v.token = $1 
         AND v.tipo_token IN ('configuracao_senha', 'ativacao_admin')`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      await client.query('ROLLBACK');
      console.log('❌ Token não encontrado no banco');
      return res.status(400).json({ error: 'Token não encontrado' });
    }

    const verification = tokenResult.rows[0];
    
    console.log('📊 DEBUG Configuração:', {
      tipo: verification.tipo_token,
      usuario: verification.nome,
      email_verificado: verification.email_verificado,
      usado: verification.usado_em,
      token_ainda_valido: verification.token_ainda_valido
    });

    // Verificar se já foi usado
    if (verification.usado_em) {
      await client.query('ROLLBACK');
      console.log('❌ Token já foi usado');
      return res.status(400).json({ error: 'Este link já foi utilizado' });
    }

    // Verificar se usuário já foi verificado
    if (verification.email_verificado) {
      await client.query('ROLLBACK');
      console.log('❌ Usuário já verificado');
      return res.status(400).json({ error: 'Esta conta já foi configurada' });
    }

    // ✅ PERMITIR TOKENS EXPIRADOS POR ALGUMAS HORAS (mesma lógica da validação)
    const agora = new Date();
    const expiracao = new Date(verification.expira_em);
    const horasAtrasado = (agora.getTime() - expiracao.getTime()) / (1000 * 60 * 60);
    
    if (horasAtrasado > 24) { // Só rejeitar se expirou há mais de 24h
      await client.query('ROLLBACK');
      console.log(`❌ Token expirado há ${horasAtrasado.toFixed(1)} horas`);
      return res.status(400).json({ 
        error: 'Token expirado há muito tempo',
        horas_expirado: horasAtrasado.toFixed(1)
      });
    }

    if (horasAtrasado > 0) {
      console.log(`⚠️ Token expirado há ${horasAtrasado.toFixed(1)} horas, mas permitindo uso`);
    }

    console.log(`✅ CONFIGURAR CONTA: Token aceito para ${verification.nome}`);

    // Criptografar senha escolhida pelo usuário
    const senhaHash = await bcrypt.hash(senha, 10);

    // Atualizar usuário: senha + email verificado + conta ativada
    await client.query(
      'UPDATE usuarios SET senha = $1, email_verificado = true, verificado_em = NOW() WHERE id = $2',
      [senhaHash, verification.usuario_id]
    );

    // Marcar token como usado
    await client.query(
      'UPDATE verificacoes_email SET usado_em = NOW() WHERE token = $1',
      [token]
    );

    await client.query('COMMIT');
    console.log(`🎉 CONTA CONFIGURADA: ${verification.nome} - conta ativada com sucesso!`);

    // Gerar JWT para login automático
    const jwtToken = jwt.sign(
      { 
        id: verification.usuario_id, 
        email: verification.tipo_colaborador === 'estagiario' ? verification.email_pessoal : verification.email,
        tipo_usuario: 'usuario'
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      message: 'Conta configurada com sucesso! Você foi logado automaticamente.',
      token: jwtToken,
      usuario: {
        id: verification.usuario_id,
        nome: verification.nome,
        email: verification.email,
        email_pessoal: verification.email_pessoal,
        tipo_colaborador: verification.tipo_colaborador,
        email_verificado: true,
        email_login: verification.tipo_colaborador === 'estagiario' ? verification.email_pessoal : verification.email
      }
    });

  } catch (error) {
    // ✅ CORREÇÃO: Rollback seguro
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('❌ Erro no rollback:', rollbackError);
    }
    
    console.error('❌ Erro ao configurar conta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    // ✅ CORREÇÃO: Release seguro - só fazer release se ainda conectado
    try {
      client.release();
    } catch (releaseError) {
      console.error('❌ Erro ao liberar conexão:', releaseError);
    }
  }
});

app.post('/api/auth/configurar-senha/:token', async (req, res) => {
  // Redirecionar para a rota unificada
  req.url = req.url.replace('/configurar-senha/', '/configurar-conta/');
  return app._router.handle(req, res);
});

app.get('/api/auth/validar-token-configuracao/:token', async (req, res) => {
  try {
    const { token } = req.params;

    console.log(`🔍 VALIDAR TOKEN: ${token.substring(0, 8)}...`);

    // ✅ BUSCA MAIS PERMISSIVA - Não verificar expiração ainda
    const tokenResult = await pool.query(
      `SELECT 
         v.*,
         u.nome, 
         u.email, 
         u.email_pessoal, 
         u.tipo_colaborador, 
         u.email_verificado,
         NOW() as agora_servidor,
         (v.expira_em > NOW()) as token_ainda_valido
       FROM verificacoes_email v
       JOIN usuarios u ON v.usuario_id = u.id
       WHERE v.token = $1 
         AND v.tipo_token IN ('configuracao_senha', 'ativacao_admin')`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      console.log('❌ Token não encontrado no banco');
      return res.status(400).json({ error: 'Token não encontrado' });
    }

    const verification = tokenResult.rows[0];
    
    console.log('📊 DEBUG Token:', {
      tipo: verification.tipo_token,
      criado: verification.criado_em,
      expira: verification.expira_em,
      agora: verification.agora_servidor,
      usado: verification.usado_em,
      email_verificado: verification.email_verificado,
      token_ainda_valido: verification.token_ainda_valido
    });

    // Verificar se já foi usado
    if (verification.usado_em) {
      console.log('❌ Token já foi usado');
      return res.status(400).json({ error: 'Este link já foi utilizado' });
    }

    // Verificar se usuário já foi verificado
    if (verification.email_verificado) {
      console.log('❌ Usuário já verificado');
      return res.status(400).json({ error: 'Esta conta já foi configurada' });
    }

    // ✅ PERMITIR TOKENS EXPIRADOS POR ALGUMAS HORAS (flexibilidade)
    const agora = new Date();
    const expiracao = new Date(verification.expira_em);
    const horasAtrasado = (agora.getTime() - expiracao.getTime()) / (1000 * 60 * 60);
    
    if (horasAtrasado > 24) { // Só rejeitar se expirou há mais de 24h
      console.log(`❌ Token expirado há ${horasAtrasado.toFixed(1)} horas`);
      return res.status(400).json({ 
        error: 'Token expirado há muito tempo',
        horas_expirado: horasAtrasado.toFixed(1)
      });
    }

    if (horasAtrasado > 0) {
      console.log(`⚠️ Token expirado há ${horasAtrasado.toFixed(1)} horas, mas permitindo uso`);
    }

    // ✅ TOKEN VÁLIDO
    console.log('✅ Token aceito para uso');
    
    res.json({
      valido: true,
      usuario: {
        nome: verification.nome,
        email_login: verification.tipo_colaborador === 'estagiario' ? verification.email_pessoal : verification.email,
        tipo_colaborador: verification.tipo_colaborador
      },
      aviso: horasAtrasado > 0 ? `Token expirou há ${horasAtrasado.toFixed(1)} horas, mas ainda permitindo uso` : null
    });

  } catch (error) {
    console.error('❌ Erro ao validar token:', error);
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

app.get('/api/auth/validar-token-configuracao-senha/:token', async (req, res) => {
  try {
    const { token } = req.params;

    console.log(`🔍 VALIDAR TOKEN: ${token.substring(0, 8)}...`);

    // Buscar token válido
    const tokenResult = await pool.query(
      `SELECT v.*, u.nome, u.email, u.email_pessoal, u.tipo_colaborador, u.email_verificado
       FROM verificacoes_email v
       JOIN usuarios u ON v.usuario_id = u.id
       WHERE v.token = $1 
         AND v.tipo_token = 'configuracao_senha' 
         AND v.usado_em IS NULL 
         AND v.expira_em > NOW()`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'Token inválido ou expirado' });
    }

    const verification = tokenResult.rows[0];

    if (verification.email_verificado) {
      return res.status(400).json({ error: 'Esta conta já foi configurada' });
    }

    res.json({
      valido: true,
      usuario: {
        nome: verification.nome,
        email_login: verification.tipo_colaborador === 'estagiario' ? verification.email_pessoal : verification.email,
        tipo_colaborador: verification.tipo_colaborador
      }
    });

  } catch (error) {
    console.error('❌ Erro ao validar token:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===============================================
// ROTAS DE DASHBOARDS (PROTEGIDAS)
// ===============================================

app.get('/api/dashboards', authMiddleware, async (req, res) => {
  try {
    console.log(`📊 DASHBOARDS: Listando para usuário ${req.user.id} (${req.user.tipo_colaborador}, ${req.user.tipo_usuario})`);
    console.log(`🔍 DEBUG: is_coordenador = ${req.user.is_coordenador}`);
    
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
          d.tipo_visibilidade, d.powerbi_report_id, d.powerbi_group_id, d.embed_type,
          u.nome as criado_por_nome
        FROM dashboards d
        LEFT JOIN usuarios u ON d.criado_por = u.id
        WHERE d.ativo = true
        ORDER BY d.criado_em DESC
      `;
    } else {
      // USUÁRIOS NORMAIS: baseado no tipo_visibilidade
      console.log(`👤 USUÁRIO: Buscando dashboards para setor: ${req.user.setor}`);
      console.log(`👑 COORDENADOR: ${req.user.is_coordenador ? 'SIM' : 'NÃO'}`);
      
      query = `
        SELECT 
          d.id, d.titulo, d.descricao, d.setor, d.url_iframe, 
          d.ativo, d.largura, d.altura, d.criado_por, 
          d.criado_em, d.atualizado_em,
          d.tipo_visibilidade, d.powerbi_report_id, d.powerbi_group_id, d.embed_type,
          u.nome as criado_por_nome
        FROM dashboards d
        LEFT JOIN usuarios u ON d.criado_por = u.id
        WHERE d.ativo = true 
          AND d.setor = $1
          AND (
            d.tipo_visibilidade = 'geral'
            OR (d.tipo_visibilidade = 'coordenadores' AND $2 = true)
          )
        ORDER BY d.criado_em DESC
      `;
      params = [req.user.setor, req.user.is_coordenador];
    }

    const result = await pool.query(query, params);
    const dashboards = result.rows;

    console.log(`📊 DASHBOARDS: Encontrados ${dashboards.length} dashboards para setor ${req.user.setor}`);
    console.log(`🔍 DASHBOARDS DEBUG:`, dashboards.map(d => ({
      titulo: d.titulo,
      setor: d.setor,
      tipo_visibilidade: d.tipo_visibilidade
    })));
    
    // ✅ DEBUG: Log de dashboards com Power BI
    const dashboardsComPowerBI = dashboards.filter(d => d.powerbi_report_id && d.powerbi_group_id);
    console.log(`🔐 DASHBOARDS SEGUROS: ${dashboardsComPowerBI.length} dashboards com Power BI configurado`);
    
    if (dashboardsComPowerBI.length > 0) {
      console.log('📋 Dashboards seguros:', dashboardsComPowerBI.map(d => ({
        titulo: d.titulo,
        setor: d.setor,
        tipo_visibilidade: d.tipo_visibilidade,
        embed_type: d.embed_type,
        reportId: d.powerbi_report_id?.substring(0, 8) + '...',
        groupId: d.powerbi_group_id?.substring(0, 8) + '...'
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
        is_coordenador: req.user.is_coordenador, // ✅ ADICIONAR PARA DEBUG
        total_dashboards: dashboards.length,
        dashboards_seguros: dashboardsComPowerBI.length,
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

const axios = require('axios');

// ✅ CONFIGURAÇÕES DO AZURE AD (com validação)
const POWERBI_CONFIG = {
  clientId: process.env.POWERBI_CLIENT_ID || '7eab07c0-eae6-422b-a44a-1030d96e7eab',
  clientSecret: process.env.POWERBI_CLIENT_SECRET,
  tenantId: process.env.AZURE_TENANT_ID,
  scope: 'https://analysis.windows.net/powerbi/api/.default',
  authorityHost: 'https://login.microsoftonline.com'
};

// ✅ VALIDAÇÃO DE CONFIGURAÇÃO NO STARTUP
const validatePowerBIConfig = () => {
  const missing = [];
  if (!POWERBI_CONFIG.clientSecret) missing.push('POWERBI_CLIENT_SECRET');
  if (!POWERBI_CONFIG.tenantId) missing.push('AZURE_TENANT_ID');
  
  if (missing.length > 0) {
    console.warn(`⚠️ Power BI: Configurações ausentes: ${missing.join(', ')}`);
    console.warn('📝 Embed seguro será desabilitado. Configure as variáveis no .env');
    return false;
  }
  
  console.log('✅ Power BI: Configurações validadas com sucesso');
  return true;
};

// Cache de tokens para otimização
const tokenCache = new Map();
const TOKEN_CACHE_DURATION = 50 * 60 * 1000; // 50 minutos

// ✅ FUNÇÃO OTIMIZADA PARA OBTER TOKEN DE ACESSO
async function getPowerBIAccessToken() {
  const cacheKey = 'powerbi_access_token';
  const cached = tokenCache.get(cacheKey);
  
  // Verificar cache válido
  if (cached && Date.now() < cached.expires) {
    console.log('🔄 Usando token de acesso em cache');
    return cached.token;
  }

  try {
    console.log('🔐 Obtendo novo token de acesso do Azure AD (CLIENT CREDENTIALS)...');
    
    const tokenUrl = `${POWERBI_CONFIG.authorityHost}/${POWERBI_CONFIG.tenantId}/oauth2/v2.0/token`;
    
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: POWERBI_CONFIG.clientId,
      client_secret: POWERBI_CONFIG.clientSecret,
      scope: POWERBI_CONFIG.scope
    });

    // ✅ DEBUG CRÍTICO: Verificar configurações
    console.log('🎯 Token request details:', {
      url: tokenUrl,
      grant_type: 'client_credentials',
      client_id: POWERBI_CONFIG.clientId,
      tenant_id: POWERBI_CONFIG.tenantId,
      has_client_secret: !!POWERBI_CONFIG.clientSecret,
      client_secret_length: POWERBI_CONFIG.clientSecret?.length,
      scope: POWERBI_CONFIG.scope
    });

    const response = await axios.post(tokenUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000
    });

    const token = response.data.access_token;
    const expiresIn = response.data.expires_in || 3600;
    
    // Cache do token
    tokenCache.set(cacheKey, {
      token,
      expires: Date.now() + (expiresIn - 600) * 1000
    });

    // ✅ DEBUG CRÍTICO: Verificar resposta
    console.log('✅ Token CLIENT CREDENTIALS obtido com sucesso');
    console.log('🔑 Token details:', {
      token_type: response.data.token_type,
      expires_in: expiresIn,
      scope: response.data.scope,
      token_prefix: token.substring(0, 50) + '...',
      token_length: token.length
    });
    
    return token;
    
  } catch (error) {
    console.error('❌ Erro ao obter token CLIENT CREDENTIALS:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: error.config?.url,
      method: error.config?.method
    });
    
    // ✅ DEBUG ESPECÍFICO PARA AZURE AD
    if (error.response?.status === 400) {
      console.error('🔐 ERRO 400 - Parâmetros inválidos:', {
        possible_causes: [
          'Client Secret incorreto',
          'Client ID incorreto', 
          'Tenant ID incorreto',
          'Scope inválido'
        ],
        current_config: {
          clientId: POWERBI_CONFIG.clientId,
          tenantId: POWERBI_CONFIG.tenantId,
          scope: POWERBI_CONFIG.scope,
          hasSecret: !!POWERBI_CONFIG.clientSecret
        }
      });
    }
    
    tokenCache.delete(cacheKey);
    throw new Error('Falha na autenticação CLIENT CREDENTIALS com Azure AD');
  }
}

// ✅ FUNÇÃO OTIMIZADA PARA GERAR TOKEN DE EMBED
async function generateEmbedToken(accessToken, groupId, reportId, userIdentity = null) {
  try {
    console.log(`🎯 Gerando token de embed para report: ${reportId.substring(0, 8)}...`);
    
    const embedUrl = `https://api.powerbi.com/v1.0/myorg/groups/${groupId}/reports/${reportId}/GenerateToken`;
    
    const embedData = {
      accessLevel: 'View',
      allowSaveAs: false,
      identities: userIdentity ? [userIdentity] : [] // Para RLS se necessário
    };

    const response = await axios.post(embedUrl, embedData, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 segundos timeout
    });

    console.log('✅ Token de embed gerado com sucesso');
    return response.data;
    
  } catch (error) {
    console.error('❌ Erro ao gerar token de embed:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      reportId: reportId.substring(0, 8) + '...'
    });
    
    // Diferentes tipos de erro
    if (error.response?.status === 404) {
      throw new Error('Relatório não encontrado no workspace especificado');
    } else if (error.response?.status === 403) {
      throw new Error('Sem permissão para acessar este relatório');
    } else {
      throw new Error('Falha ao gerar token de embed');
    }
  }
}

// ✅ FUNÇÃO MELHORADA PARA VERIFICAR ACESSO
async function checkUserDashboardAccess(userId, dashboardId) {
  try {
    const result = await pool.query(`
      SELECT 
        d.id,
        d.titulo,
        d.setor,
        d.powerbi_report_id,
        d.powerbi_group_id,
        u.tipo_usuario,
        u.setor as user_setor
      FROM dashboards d
      CROSS JOIN usuarios u
      WHERE d.id = $1 
        AND u.id = $2
        AND d.ativo = true
        AND (
          -- Admin pode ver tudo
          u.tipo_usuario = 'admin'
          -- Ou mesmo setor
          OR d.setor = u.setor
          -- Ou dashboard público
          OR d.setor = 'Geral'
          OR d.setor = 'Todos'
        )
    `, [dashboardId, userId]);

    const hasAccess = result.rows.length > 0;
    
    if (hasAccess) {
      const dashboard = result.rows[0];
      console.log(`✅ Usuário ${userId} tem acesso ao dashboard "${dashboard.titulo}"`);
      return dashboard;
    } else {
      console.log(`❌ Usuário ${userId} não tem acesso ao dashboard ${dashboardId}`);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar acesso:', error);
    return null;
  }
}

app.post('/api/powerbi/embed-token', authMiddleware, async (req, res) => {
  const debugInfo = {
    timestamp: new Date().toISOString(),
    requestId: Math.random().toString(36).substring(7),
    user: req.user ? { id: req.user.id, nome: req.user.nome, setor: req.user.setor } : 'undefined'
  };

  try {
    console.log(`\n🔐 ========== POWER BI EMBED TOKEN REQUEST (${debugInfo.requestId}) ==========`);
    console.log(`👤 Usuário: ${req.user.nome} (ID: ${req.user.id})`);
    console.log(`📧 Email: ${req.user.email}`);
    console.log(`🏢 Setor: ${req.user.setor}`);
    console.log(`⏰ Timestamp: ${debugInfo.timestamp}`);
    
    const { reportId, groupId, dashboardId } = req.body;
    console.log(`📥 Request Body:`, {
      reportId: reportId || 'não fornecido',
      groupId: groupId || 'não fornecido', 
      dashboardId: dashboardId || 'não fornecido'
    });

    // ✅ VALIDAÇÃO 1: Dashboard ID
    if (!dashboardId) {
      console.log(`❌ VALIDAÇÃO FALHOU: dashboardId ausente`);
      return res.status(400).json({ 
        error: 'dashboardId é obrigatório',
        code: 'MISSING_DASHBOARD_ID',
        debugInfo
      });
    }
    console.log(`✅ VALIDAÇÃO 1: dashboardId presente: ${dashboardId}`);

    // ✅ VALIDAÇÃO 2: Configuração Power BI
    const configValid = validatePowerBIConfig();
    console.log(`🔧 VALIDAÇÃO 2: Configuração Power BI:`, {
      valid: configValid,
      clientId: POWERBI_CONFIG.clientId,
      hasClientSecret: !!POWERBI_CONFIG.clientSecret,
      hasTenantId: !!POWERBI_CONFIG.tenantId,
      scope: POWERBI_CONFIG.scope
    });

    if (!configValid) {
      console.log(`❌ CONFIGURAÇÃO INVÁLIDA: Power BI não configurado`);
      return res.status(503).json({ 
        error: 'Serviço de embed seguro não está configurado',
        code: 'POWERBI_NOT_CONFIGURED',
        fallback: true,
        debugInfo
      });
    }

    // ✅ VALIDAÇÃO 3: Permissões do usuário
    console.log(`🔍 VALIDAÇÃO 3: Verificando acesso do usuário ao dashboard...`);
    const dashboardAccess = await checkUserDashboardAccess(req.user.id, dashboardId);
    
    console.log(`📊 Dashboard Access Result:`, {
      hasAccess: !!dashboardAccess,
      dashboard: dashboardAccess ? {
        id: dashboardAccess.id,
        titulo: dashboardAccess.titulo,
        setor: dashboardAccess.setor,
        powerbi_report_id: dashboardAccess.powerbi_report_id,
        powerbi_group_id: dashboardAccess.powerbi_group_id,
        user_setor: dashboardAccess.user_setor,
        user_tipo: dashboardAccess.tipo_usuario
      } : null
    });

    if (!dashboardAccess) {
      console.log(`❌ ACESSO NEGADO: Usuário não tem permissão para dashboard ${dashboardId}`);
      return res.status(403).json({ 
        error: 'Usuário não tem permissão para acessar este dashboard',
        code: 'ACCESS_DENIED',
        debugInfo
      });
    }

    // ✅ VALIDAÇÃO 4: IDs do Power BI
    const finalReportId = reportId || dashboardAccess.powerbi_report_id;
    const finalGroupId = groupId || dashboardAccess.powerbi_group_id;

    console.log(`🎯 VALIDAÇÃO 4: IDs finais do Power BI:`, {
      finalReportId: finalReportId || 'AUSENTE',
      finalGroupId: finalGroupId || 'AUSENTE',
      source: {
        reportId_from: reportId ? 'request' : 'database',
        groupId_from: groupId ? 'request' : 'database'
      }
    });

    if (!finalReportId || !finalGroupId) {
      console.log(`❌ CONFIGURAÇÃO INCOMPLETA: Faltam IDs do Power BI`);
      return res.status(400).json({ 
        error: 'Dashboard não está configurado para embed seguro',
        code: 'MISSING_POWERBI_CONFIG',
        missing: {
          reportId: !finalReportId,
          groupId: !finalGroupId
        },
        debugInfo
      });
    }

    // ✅ ETAPA 5: Obter Access Token
    console.log(`\n🔑 ETAPA 5: Obtendo Access Token do Azure AD...`);
    const accessTokenStart = Date.now();
    const accessToken = await getPowerBIAccessToken();
    const accessTokenTime = Date.now() - accessTokenStart;
    
    console.log(`✅ Access Token obtido:`, {
      time_ms: accessTokenTime,
      token_prefix: accessToken.substring(0, 30) + '...',
      token_length: accessToken.length,
      cached: accessTokenTime < 100 // Se foi muito rápido, provavelmente veio do cache
    });

    // ✅ ETAPA 6: Gerar Embed Token
    console.log(`\n🎫 ETAPA 6: Gerando Embed Token...`);
    console.log(`📍 Power BI API Request:`, {
      url: `https://api.powerbi.com/v1.0/myorg/groups/${finalGroupId}/reports/${finalReportId}/GenerateToken`,
      method: 'POST',
      reportId: finalReportId,
      groupId: finalGroupId,
      hasAccessToken: !!accessToken
    });

    const embedTokenStart = Date.now();
    const embedToken = await generateEmbedToken(accessToken, finalGroupId, finalReportId);
    const embedTokenTime = Date.now() - embedTokenStart;
    
    console.log(`✅ Embed Token gerado com sucesso:`, {
      time_ms: embedTokenTime,
      token_prefix: embedToken.token.substring(0, 30) + '...',
      expiration: embedToken.expiration,
      tokenId: embedToken.tokenId || 'não fornecido'
    });
    
    // ✅ RESPOSTA FINAL
    const response = {
      accessToken: embedToken.token,
      tokenType: 'Bearer',
      expiration: embedToken.expiration,
      reportId: finalReportId,
      groupId: finalGroupId,
      embedUrl: `https://app.powerbi.com/reportEmbed?reportId=${finalReportId}&groupId=${finalGroupId}`,
      generatedAt: new Date().toISOString(),
      validFor: 60, // minutos
      user: {
        id: req.user.id,
        nome: req.user.nome,
        setor: req.user.setor
      },
      dashboard: {
        id: dashboardAccess.id,
        titulo: dashboardAccess.titulo,
        setor: dashboardAccess.setor
      },
      debug: {
        requestId: debugInfo.requestId,
        totalTime_ms: Date.now() - new Date(debugInfo.timestamp).getTime(),
        accessTokenTime_ms: accessTokenTime,
        embedTokenTime_ms: embedTokenTime
      }
    };

    const totalTime = Date.now() - new Date(debugInfo.timestamp).getTime();
    console.log(`\n🎉 SUCESSO COMPLETO (${debugInfo.requestId}):`, {
      dashboard: dashboardAccess.titulo,
      usuario: req.user.nome,
      totalTime_ms: totalTime,
      embedUrl: response.embedUrl
    });
    console.log(`========== FIM REQUEST ${debugInfo.requestId} ==========\n`);

    res.json(response);

  } catch (error) {
    const totalTime = Date.now() - new Date(debugInfo.timestamp).getTime();
    
    console.log(`\n❌ ========== ERRO COMPLETO (${debugInfo.requestId}) ==========`);
    console.log(`🕐 Tempo até erro: ${totalTime}ms`);
    console.log(`📍 Erro na rota de embed token:`, {
      message: error.message,
      name: error.name,
      user: req.user?.id,
      stack: process.env.NODE_ENV === 'development' ? error.stack : 'hidden'
    });

    // ✅ DEBUG ESPECÍFICO PARA ERROS DE AXIOS/HTTP
    if (error.response) {
      console.log(`🌐 HTTP Error Details:`, {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers ? {
          'content-type': error.response.headers['content-type'],
          'x-request-id': error.response.headers['x-request-id']
        } : 'not available'
      });
    }

    // ✅ DEBUG ESPECÍFICO PARA ERROS DE POWER BI
    if (error.message.includes('401')) {
      console.log(`🔐 DIAGNÓSTICO 401 (Unauthorized):`, {
        possible_causes: [
          'Service Principal não tem permissão no workspace',
          'Access token inválido ou expirado',
          'Report ID ou Group ID incorretos',
          'Tenant ID incorreto'
        ],
        next_steps: [
          'Verificar permissões do Service Principal no workspace',
          'Confirmar IDs no banco de dados',
          'Testar access token manualmente'
        ]
      });
    }

    if (error.message.includes('404')) {
      console.log(`📍 DIAGNÓSTICO 404 (Not Found):`, {
        possible_causes: [
          'Report ID não existe',
          'Group ID (workspace) não existe',
          'Report não está no workspace especificado'
        ],
        current_ids: {
          reportId: req.body.reportId || 'from database',
          groupId: req.body.groupId || 'from database'
        }
      });
    }

    console.log(`========== FIM ERRO ${debugInfo.requestId} ==========\n`);
    
    // Resposta de erro padronizada
    const errorResponse = {
      error: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
      requestId: debugInfo.requestId,
      debugInfo
    };

    if (process.env.NODE_ENV === 'development') {
      errorResponse.details = error.message;
      errorResponse.httpStatus = error.response?.status;
      errorResponse.httpData = error.response?.data;
    }
    
    res.status(500).json(errorResponse);
  }
});

// ===============================================
// ROTAS DE ADMINISTRAÇÃO (FUTURO)
// ===============================================

app.get('/api/debug/token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    console.log(`🔍 DEBUG TOKEN: ${token}`);
    
    // Buscar token com informações detalhadas
    const result = await pool.query(`
      SELECT 
        v.*,
        u.nome,
        u.email,
        u.email_pessoal,
        u.tipo_colaborador,
        u.email_verificado,
        NOW() as agora,
        (v.expira_em > NOW()) as token_valido,
        EXTRACT(EPOCH FROM (v.expira_em - NOW())) as segundos_restantes
      FROM verificacoes_email v
      JOIN usuarios u ON v.usuario_id = u.id
      WHERE v.token = $1
    `, [token]);
    
    if (result.rows.length === 0) {
      return res.json({
        erro: 'Token não encontrado no banco',
        token_procurado: token
      });
    }
    
    const tokenData = result.rows[0];
    
    const debug = {
      token_encontrado: true,
      token: token,
      tipo_token: tokenData.tipo_token,
      usuario: {
        nome: tokenData.nome,
        email_verificado: tokenData.email_verificado,
        tipo_colaborador: tokenData.tipo_colaborador
      },
      datas: {
        criado_em: tokenData.criado_em,
        expira_em: tokenData.expira_em,
        usado_em: tokenData.usado_em,
        agora_servidor: tokenData.agora
      },
      validacao: {
        token_valido: tokenData.token_valido,
        ja_usado: tokenData.usado_em !== null,
        usuario_ja_verificado: tokenData.email_verificado,
        segundos_restantes: tokenData.segundos_restantes
      },
      status: (() => {
        if (tokenData.usado_em) return 'JA_USADO';
        if (tokenData.email_verificado) return 'USUARIO_JA_VERIFICADO';
        if (!tokenData.token_valido) return 'EXPIRADO';
        return 'VALIDO';
      })()
    };
    
    res.json(debug);
    
  } catch (error) {
    console.error('❌ Erro no debug:', error);
    res.status(500).json({ 
      erro: 'Erro interno',
      detalhes: error.message 
    });
  }
});

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
    
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      console.log('❌ ADMIN: Token não encontrado');
      return res.status(401).json({ error: 'Token de acesso negado' });
    }

    console.log('🔑 ADMIN: Token presente, verificando JWT...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ ADMIN: Token válido para usuário ID:', decoded.id);
    
    // ✅ CORREÇÃO: Query usando LEFT JOIN com usuarios_admin_log
    const result = await pool.query(
      `SELECT 
         u.id, u.nome, u.email, u.email_pessoal, u.setor, u.tipo_usuario, u.tipo_colaborador,
         u.email_verificado, u.is_coordenador,
         COALESCE(ual.ativo, true) as ativo,
         CASE 
           WHEN u.tipo_colaborador = 'estagiario' THEN u.email_pessoal 
           ELSE u.email 
         END as email_login
       FROM usuarios u
       LEFT JOIN usuarios_admin_log ual ON u.id = ual.usuario_id
       WHERE u.id = $1`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      console.log('❌ ADMIN: Usuário não encontrado no banco');
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    const user = result.rows[0];

    if (!user.email_verificado) {
      console.log('❌ ADMIN: Email não verificado');
      return res.status(401).json({ error: 'Email não verificado' });
    }

    if (!user.ativo) {
      console.log('❌ ADMIN: Usuário inativo/revogado');
      return res.status(401).json({ error: 'Acesso revogado' });
    }

    if (user.tipo_usuario !== 'admin') {
      console.log(`❌ ADMIN: Acesso negado para usuário ${user.id} (${user.tipo_usuario})`);
      return res.status(403).json({ 
        error: 'Acesso negado. Apenas administradores podem acessar esta funcionalidade.'
      });
    }
    
    req.user = user;
    console.log(`🔧 ADMIN: Acesso autorizado para ${user.nome}`);
    next();
    
  } catch (error) {
    console.error('❌ ADMIN: Erro na verificação:', error.message);
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};

// ✅ ROTA PARA VALIDAR STATUS DO POWER BI
app.get('/api/powerbi/status', authMiddleware, async (req, res) => {
  try {
    const configured = validatePowerBIConfig();
    
    let serviceStatus = 'unknown';
    if (configured) {
      try {
        await getPowerBIAccessToken();
        serviceStatus = 'online';
      } catch (error) {
        serviceStatus = 'error';
      }
    } else {
      serviceStatus = 'not_configured';
    }

    res.json({
      configured,
      serviceStatus,
      embedSupported: configured && serviceStatus === 'online',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Erro ao verificar status',
      serviceStatus: 'error' 
    });
  }
});

// ✅ ROTA PARA INVALIDAR CACHE (ADMIN)
app.delete('/api/powerbi/cache', adminMiddleware, (req, res) => {
  tokenCache.clear();
  console.log('🗑️ Cache de tokens Power BI limpo por admin');
  res.json({ message: 'Cache limpo com sucesso' });
});

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
        v.expira_em as codigo_expira_em,
        v.criado_em as codigo_criado_em,
        -- Status detalhado do token
        CASE 
          WHEN v.token IS NULL THEN 'sem_codigo'
          WHEN v.expira_em < NOW() THEN 'codigo_expirado' 
          WHEN v.usado_em IS NOT NULL THEN 'codigo_usado'
          ELSE 'codigo_ativo'
        END as status_token,
        -- Tempo desde criação
        EXTRACT(EPOCH FROM (NOW() - u.criado_em))/3600 as horas_desde_criacao,
        -- Tempo até/desde expiração
        CASE 
          WHEN v.expira_em IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (v.expira_em - NOW()))/3600
          ELSE NULL
        END as horas_para_expiracao
      FROM usuarios u
      LEFT JOIN verificacoes_email v ON u.id = v.usuario_id 
        AND v.tipo_token = 'verificacao_email' 
        AND v.usado_em IS NULL
      WHERE 
        (u.tipo_colaborador = 'estagiario' AND u.aprovado_admin IS NULL)
        OR (u.email_verificado = false)
      ORDER BY 
        CASE 
          WHEN u.tipo_colaborador = 'estagiario' AND u.aprovado_admin IS NULL THEN 1
          WHEN v.expira_em < NOW() THEN 2
          WHEN v.token IS NULL THEN 3
          ELSE 4
        END,
        u.criado_em DESC
    `);

    const usuarios = result.rows.map(user => ({
      ...user,
      email_login: user.tipo_colaborador === 'estagiario' ? user.email_pessoal : user.email,
      status: user.tipo_colaborador === 'estagiario' 
        ? (user.aprovado_admin === null ? 'pendente_aprovacao' : 'aprovado')
        : 'corporativo',
      codigo_ativo: user.codigo_verificacao && user.codigo_expira_em > new Date(),
      pode_reenviar: user.email_verificado === false && (
        user.tipo_colaborador === 'clt_associado' || 
        (user.tipo_colaborador === 'estagiario' && user.aprovado_admin === true)
      ),
      tempo_expirado_horas: user.horas_para_expiracao < 0 ? Math.abs(user.horas_para_expiracao) : 0
    }));

    // Separar por categorias
    const pendentes_aprovacao = usuarios.filter(u => u.status === 'pendente_aprovacao');
    const tokens_expirados = usuarios.filter(u => u.status_token === 'codigo_expirado');
    const sem_codigo = usuarios.filter(u => u.status_token === 'sem_codigo' && u.status !== 'pendente_aprovacao');
    const aguardando_verificacao = usuarios.filter(u => u.status_token === 'codigo_ativo');

    res.json({
      usuarios,
      total: usuarios.length,
      categorias: {
        pendentes_aprovacao: pendentes_aprovacao.length,
        tokens_expirados: tokens_expirados.length,
        sem_codigo: sem_codigo.length,
        aguardando_verificacao: aguardando_verificacao.length
      },
      usuarios_por_categoria: {
        pendentes_aprovacao,
        tokens_expirados,
        sem_codigo,
        aguardando_verificacao
      }
    });

  } catch (error) {
    console.error('❌ Erro ao listar usuários pendentes:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// APROVAR CADASTRO DE ESTAGIÁRIO - CORRIGIDO
app.post('/api/admin/aprovar-usuario/:userId', adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { userId } = req.params;
    const { enviar_codigo = true } = req.body;

    console.log(`✅ ADMIN: Aprovando usuário ${userId}, enviar código: ${enviar_codigo}`);

    // Buscar usuário - ESTA LINHA ESTAVA FALTANDO!
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
      // Gerar TOKEN único para validação direta (ao invés de código)
      const tokenValidacao = crypto.randomBytes(32).toString('hex');
      const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Invalidar códigos anteriores
      await client.query(
        'UPDATE verificacoes_email SET usado_em = NOW() WHERE usuario_id = $1 AND usado_em IS NULL',
        [userId]
      );

      // Salvar token
      await client.query(
        `INSERT INTO verificacoes_email (usuario_id, token, tipo_token, expira_em) 
         VALUES ($1, $2, $3, $4)`,
        [userId, tokenValidacao, 'verificacao_email', expiraEm]
      );

      await client.query('COMMIT');

      // Criar link de validação
      const linkValidacao = `${process.env.API_BASE_URL}/api/auth/validar-email/${tokenValidacao}`;

      console.log(`🔗 ADMIN: Link de validação gerado: ${linkValidacao}`);

      // Enviar email com LINK (não código)
      try {
        const emailResult = await resend.emails.send({
          from: 'andre.macedo@resendemh.com.br',
          to: [user.email_pessoal],
          subject: '✅ Cadastro aprovado - Dashboards RMH',
          html: await gerarTemplateValidacaoEstagiario(user.nome, linkValidacao, user.email_pessoal)
        });

        console.log(`✅ Email de aprovação enviado para ${user.email_pessoal}`);
      } catch (emailError) {
        console.error('❌ Erro ao enviar email de aprovação:', emailError);
      }

      res.json({
        message: 'Usuário aprovado e link de validação enviado',
        link_enviado: true,
        email_enviado_para: user.email_pessoal,
        link_validacao: linkValidacao // Para debug (remover em produção)
      });
    } else {
      await client.query('COMMIT');
      
      res.json({
        message: 'Usuário aprovado. Link não foi enviado.',
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
    console.log('📋 ADMIN: Listando todos os usuários');
    
    const { status, tipo } = req.query;
    
    let whereConditions = [];
    let params = [];
    
    if (status === 'verificados') {
      whereConditions.push('u.email_verificado = true');
    } else if (status === 'nao_verificados') {
      whereConditions.push('u.email_verificado = false');
    }
    
    if (tipo && ['estagiario', 'clt_associado'].includes(tipo)) {
      whereConditions.push(`u.tipo_colaborador = ${params.length + 1}`);
      params.push(tipo);
    }
    
    const whereClause = whereConditions.length > 0 ?
      `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // ✅ CORREÇÃO: Query usando LEFT JOIN com usuarios_admin_log
    const result = await pool.query(`
      SELECT 
        u.id,
        u.nome,
        u.setor,
        u.email,
        u.email_pessoal,
        CASE 
          WHEN u.tipo_colaborador = 'estagiario' THEN u.email_pessoal 
          ELSE u.email 
        END as email_login,
        u.tipo_colaborador,
        u.tipo_usuario,
        u.email_verificado,
        u.criado_em,
        u.verificado_em,
        u.atualizado_em,
        u.ultimo_login,
        u.aprovado_admin,
        u.aprovado_em,
        u.aprovado_por,
        COALESCE(u.is_coordenador, false) as is_coordenador,
        COALESCE(ual.ativo, true) as ativo,
        ual.criado_por_admin,
        ual.criado_por_admin_em,
        ual.revogado_por,
        ual.revogado_em,
        ual.reativado_por,
        ual.reativado_em,
        -- Nome do admin criador
        admin_criador.nome as criado_por_admin_nome,
        -- Status calculado
        CASE 
          WHEN COALESCE(ual.ativo, true) = false THEN 'revogado'
          WHEN u.tipo_colaborador = 'estagiario' 
               AND u.aprovado_admin IS NULL 
               AND ual.criado_por_admin IS NULL
               THEN 'pendente_aprovacao'
          WHEN u.email_verificado = false THEN 'pendente_verificacao'
          WHEN u.email_verificado = true 
               AND (u.aprovado_admin = true OR u.tipo_colaborador = 'clt_associado') 
               THEN 'ativo'
          ELSE 'indefinido'
        END as status
      FROM usuarios u
      LEFT JOIN usuarios_admin_log ual ON u.id = ual.usuario_id
      LEFT JOIN usuarios admin_criador ON ual.criado_por_admin = admin_criador.id
      ${whereClause}
      ORDER BY u.criado_em DESC
    `, params);

    const usuarios = result.rows;
    
    // Buscar lista de setores únicos
    const setoresResult = await pool.query(
      'SELECT DISTINCT setor FROM usuarios WHERE setor IS NOT NULL ORDER BY setor'
    );
    const setores = setoresResult.rows.map(row => row.setor);

    console.log(`📋 ADMIN: Encontrados ${usuarios.length} usuários`);

    res.json({
      usuarios,
      setores,
      total: usuarios.length,
      stats: {
        total: usuarios.length,
        // ✅ CORREÇÃO: Apenas estagiários que se cadastraram sozinhos (sem criado_por_admin)
        pendentes_aprovacao: usuarios.filter(u => 
          u.tipo_colaborador === 'estagiario' && 
          !u.aprovado_admin && 
          !u.criado_por_admin
        ).length,
        nao_verificados: usuarios.filter(u => !u.email_verificado).length,
        admins: usuarios.filter(u => u.tipo_usuario === 'admin').length,
        coordenadores: usuarios.filter(u => u.is_coordenador === true).length,
        clt_associados: usuarios.filter(u => 
          u.tipo_colaborador === 'clt_associado' && u.email_verificado === true
        ).length,
        estagiarios: usuarios.filter(u => 
          u.tipo_colaborador === 'estagiario' && 
          u.aprovado_admin === true && 
          u.email_verificado === true
        ).length,
        revogados: usuarios.filter(u => u.ativo === false).length
      }
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

    console.log(`🔄 ADMIN: Reenviando código para usuário ${userId} por ${req.user.nome}`);

    // Buscar usuário
    const userResult = await client.query(
      'SELECT * FROM usuarios WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = userResult.rows[0];

    if (user.email_verificado) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'Usuário já verificado' });
    }

    // Determinar email de destino
    const emailLogin = user.tipo_colaborador === 'estagiario' ? 
      user.email_pessoal : user.email;

    if (!emailLogin) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'Email não encontrado para este usuário' });
    }

    // Para estagiários, verificar se foi aprovado
    if (user.tipo_colaborador === 'estagiario' && !user.aprovado_admin) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'Estagiário ainda não foi aprovado. Aprove primeiro.' });
    }

    // Gerar novo token/código dependendo do tipo
    let novoToken, tipoToken, templateHtml;
    const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000);

    if (user.tipo_colaborador === 'estagiario') {
      // Para estagiários: gerar LINK de validação
      novoToken = crypto.randomBytes(32).toString('hex');
      tipoToken = 'verificacao_email';
      const linkValidacao = `${process.env.API_BASE_URL}/api/auth/validar-email/${novoToken}`;
      templateHtml = await gerarTemplateValidacaoEstagiario(user.nome, linkValidacao, emailLogin);
    } else {
      // Para CLT: gerar CÓDIGO
      novoToken = Math.floor(100000 + Math.random() * 900000).toString();
      tipoToken = 'verificacao_email';
      templateHtml = await gerarTemplateVerificacao(user.nome, novoToken, emailLogin, user.tipo_colaborador);
    }

    // Invalidar tokens/códigos anteriores
    await client.query(
      'UPDATE verificacoes_email SET usado_em = NOW() WHERE usuario_id = $1 AND usado_em IS NULL',
      [userId]
    );

    // Criar novo token/código
    await client.query(
      `INSERT INTO verificacoes_email (usuario_id, token, tipo_token, expira_em) 
       VALUES ($1, $2, $3, $4)`,
      [userId, novoToken, tipoToken, expiraEm]
    );

    await client.query('COMMIT');

    // Enviar email
    try {
      const emailResult = await resend.emails.send({
        from: 'andre.macedo@resendemh.com.br',
        to: [emailLogin],
        subject: user.tipo_colaborador === 'estagiario' 
          ? '🔗 Novo link de validação - Dashboards RMH'
          : '🔐 Novo código de verificação - Dashboards RMH',
        html: templateHtml
      });

      console.log(`📧 ADMIN: ${user.tipo_colaborador === 'estagiario' ? 'Link' : 'Código'} reenviado para ${emailLogin} pelo admin ${req.user.nome}`);

      // Log da ação admin
      await pool.query(
        `INSERT INTO logs_email (usuario_id, email_para, tipo_email, status) 
         VALUES ($1, $2, $3, $4)`,
        [userId, emailLogin, 'reenvio_admin', 'enviado']
      );

    } catch (emailError) {
      console.error('❌ Erro ao enviar email:', emailError);
      return res.status(500).json({ error: 'Erro ao enviar email' });
    }

    res.json({
      message: user.tipo_colaborador === 'estagiario' 
        ? 'Novo link de validação enviado com sucesso'
        : 'Novo código de verificação enviado com sucesso',
      email_enviado_para: emailLogin,
      tipo_colaborador: user.tipo_colaborador,
      tipo_envio: user.tipo_colaborador === 'estagiario' ? 'link' : 'codigo'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao reenviar código:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    client.release();
  }
});

app.post('/api/admin/reenviar-codigo-problema/:userId', adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { userId } = req.params;

    console.log(`📧 ADMIN: Reenviando código para usuário com problema ${userId}`);

    // Buscar usuário
    const userResult = await client.query(
      'SELECT * FROM usuarios WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = userResult.rows[0];

    if (user.email_verificado) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Usuário já está verificado' });
    }

    // Verificar se pode reenviar
    if (user.tipo_colaborador === 'estagiario' && !user.aprovado_admin) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Estagiário ainda não foi aprovado pelo admin' });
    }

    // Contar tentativas de reenvio nas últimas 24h
    const tentativasRecentes = await client.query(
      `SELECT COUNT(*) as total 
       FROM verificacoes_email 
       WHERE usuario_id = $1 
         AND tipo_token = 'verificacao_email'
         AND criado_em > NOW() - INTERVAL '24 hours'`,
      [userId]
    );

    if (parseInt(tentativasRecentes.rows[0].total) >= 5) {
      await client.query('ROLLBACK');
      return res.status(429).json({ 
        error: 'Limite de reenvios atingido (5 por dia). Aguarde 24 horas.' 
      });
    }

    // Invalidar tokens anteriores
    await client.query(
      'UPDATE verificacoes_email SET usado_em = NOW() WHERE usuario_id = $1 AND usado_em IS NULL',
      [userId]
    );

    // Gerar novo token/código baseado no tipo
    const emailDestino = user.tipo_colaborador === 'estagiario' ? user.email_pessoal : user.email;
    let novoToken, tipoToken, assunto, templateHtml;
    const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias

    if (user.tipo_colaborador === 'estagiario') {
      // Estagiários: gerar link de validação
      novoToken = require('crypto').randomBytes(32).toString('hex');
      tipoToken = 'verificacao_email';
      assunto = '🔗 Novo link de verificação - Dashboards RMH';
      const linkValidacao = `${process.env.API_BASE_URL}/api/auth/validar-email/${novoToken}`;
      templateHtml = await gerarTemplateValidacaoEstagiario(user.nome, linkValidacao, emailDestino);
    } else {
      // CLT: gerar código numérico
      novoToken = Math.floor(100000 + Math.random() * 900000).toString();
      tipoToken = 'verificacao_email';
      assunto = '🔐 Novo código de verificação - Dashboards RMH';
      templateHtml = await gerarTemplateVerificacao(user.nome, novoToken, emailDestino, user.tipo_colaborador);
    }

    // Criar novo token/código
    await client.query(
      `INSERT INTO verificacoes_email (usuario_id, token, tipo_token, expira_em) 
       VALUES ($1, $2, $3, $4)`,
      [userId, novoToken, tipoToken, expiraEm]
    );

    // Atualizar log administrativo se existir
    const logResult = await client.query(
      'SELECT id FROM usuarios_admin_log WHERE usuario_id = $1',
      [userId]
    );

    if (logResult.rows.length > 0) {
      await client.query(
        `UPDATE usuarios_admin_log 
         SET observacoes = $1, atualizado_em = NOW()
         WHERE usuario_id = $2`,
        [
          `Novo ${user.tipo_colaborador === 'estagiario' ? 'link' : 'código'} reenviado pelo admin ${req.user.nome} em ${new Date().toLocaleString('pt-BR')}`,
          userId
        ]
      );
    } else {
      await client.query(
        `INSERT INTO usuarios_admin_log (usuario_id, ativo, observacoes, criado_em, atualizado_em) 
         VALUES ($1, true, $2, NOW(), NOW())`,
        [
          userId,
          `Primeiro reenvio pelo admin ${req.user.nome} em ${new Date().toLocaleString('pt-BR')}`
        ]
      );
    }

    await client.query('COMMIT');

    // Enviar email
    try {
      const { Resend } = require('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);

      await resend.emails.send({
        from: 'andre.macedo@resendemh.com.br',
        to: [emailDestino],
        subject: assunto,
        html: templateHtml
      });

      console.log(`✅ ADMIN: ${user.tipo_colaborador === 'estagiario' ? 'Link' : 'Código'} reenviado para ${emailDestino} pelo admin ${req.user.nome}`);

    } catch (emailError) {
      console.error('❌ Erro ao enviar email:', emailError);
      return res.status(500).json({ error: 'Erro ao enviar email' });
    }

    res.json({
      message: user.tipo_colaborador === 'estagiario' 
        ? 'Novo link de verificação enviado com sucesso'
        : 'Novo código de verificação enviado com sucesso',
      email_enviado_para: emailDestino,
      tipo_colaborador: user.tipo_colaborador,
      tipo_envio: user.tipo_colaborador === 'estagiario' ? 'link' : 'codigo',
      tentativas_hoje: parseInt(tentativasRecentes.rows[0].total) + 1
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao reenviar código:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    client.release();
  }
});

app.get('/api/admin/usuarios-tokens-expirados', adminMiddleware, async (req, res) => {
  try {
    console.log('📋 ADMIN: Listando usuários com problemas de token');

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
        
        -- Email de login
        CASE 
          WHEN u.tipo_colaborador = 'estagiario' THEN u.email_pessoal 
          ELSE u.email 
        END as email_login,
        
        -- Informações do token ativo (se existir)
        v.token as codigo_verificacao,
        v.expira_em as codigo_expira_em,
        v.criado_em as codigo_criado_em,
        
        -- Status detalhado do token
        CASE 
          WHEN v.token IS NULL THEN 'sem_codigo'
          WHEN v.expira_em < NOW() THEN 'codigo_expirado' 
          WHEN v.usado_em IS NOT NULL THEN 'codigo_usado'
          ELSE 'codigo_ativo'
        END as status_token,
        
        -- Tempo desde criação do usuário
        EXTRACT(DAYS FROM (NOW() - u.criado_em)) as dias_desde_criacao,
        
        -- Tempo desde/até expiração do token
        CASE 
          WHEN v.expira_em IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (NOW() - v.expira_em))/3600
          ELSE NULL
        END as horas_desde_expiracao,
        
        -- Observações do log administrativo
        ual.observacoes,
        ual.ativo as usuario_ativo,
        
        -- Classificação do problema
        CASE 
          WHEN u.criado_em < NOW() - INTERVAL '45 days' AND u.email_verificado = false THEN 'muito_antigo'
          WHEN u.criado_em < NOW() - INTERVAL '30 days' AND u.email_verificado = false THEN 'antigo'
          WHEN u.criado_em < NOW() - INTERVAL '7 days' AND u.email_verificado = false AND v.token IS NULL THEN 'sem_token'
          WHEN v.expira_em < NOW() THEN 'token_expirado'
          ELSE 'normal'
        END as categoria_problema
        
      FROM usuarios u
      LEFT JOIN verificacoes_email v ON u.id = v.usuario_id 
        AND v.tipo_token = 'verificacao_email' 
        AND v.usado_em IS NULL
      LEFT JOIN usuarios_admin_log ual ON u.id = ual.usuario_id
      WHERE 
        u.email_verificado = false
        AND (
          -- CLT não verificado há mais de 1 dia
          (u.tipo_colaborador = 'clt_associado' AND u.criado_em < NOW() - INTERVAL '1 day')
          OR
          -- Estagiário aprovado não verificado há mais de 1 dia
          (u.tipo_colaborador = 'estagiario' AND u.aprovado_admin = true AND u.criado_em < NOW() - INTERVAL '1 day')
          OR
          -- Qualquer usuário com token expirado
          (v.expira_em < NOW())
          OR
          -- Usuários antigos sem token
          (v.token IS NULL AND u.criado_em < NOW() - INTERVAL '2 days')
        )
      ORDER BY 
        CASE 
          WHEN u.criado_em < NOW() - INTERVAL '45 days' THEN 1  -- Muito antigos primeiro
          WHEN v.expira_em < NOW() THEN 2                        -- Tokens expirados
          WHEN v.token IS NULL THEN 3                            -- Sem token
          ELSE 4                                                 -- Outros
        END,
        u.criado_em ASC
    `);

    const usuarios = result.rows.map(user => ({
      ...user,
      dias_expirado: user.horas_desde_expiracao > 0 ? Math.floor(user.horas_desde_expiracao / 24) : 0,
      pode_reenviar: user.tipo_colaborador === 'clt_associado' || 
                     (user.tipo_colaborador === 'estagiario' && user.aprovado_admin),
      prioridade: (() => {
        if (user.categoria_problema === 'muito_antigo') return 'alta';
        if (user.categoria_problema === 'antigo') return 'media';
        if (user.categoria_problema === 'token_expirado') return 'media';
        return 'baixa';
      })()
    }));

    // Agrupar por categoria
    const categorias = {
      muito_antigos: usuarios.filter(u => u.categoria_problema === 'muito_antigo'),
      antigos: usuarios.filter(u => u.categoria_problema === 'antigo'),
      tokens_expirados: usuarios.filter(u => u.categoria_problema === 'token_expirado'),
      sem_token: usuarios.filter(u => u.categoria_problema === 'sem_token'),
      outros: usuarios.filter(u => !['muito_antigo', 'antigo', 'token_expirado', 'sem_token'].includes(u.categoria_problema))
    };

    res.json({
      usuarios,
      total: usuarios.length,
      categorias,
      estatisticas: {
        total_com_problemas: usuarios.length,
        muito_antigos: categorias.muito_antigos.length,
        antigos: categorias.antigos.length,
        tokens_expirados: categorias.tokens_expirados.length,
        sem_token: categorias.sem_token.length,
        alta_prioridade: usuarios.filter(u => u.prioridade === 'alta').length,
        media_prioridade: usuarios.filter(u => u.prioridade === 'media').length,
        baixa_prioridade: usuarios.filter(u => u.prioridade === 'baixa').length
      }
    });

  } catch (error) {
    console.error('❌ Erro ao listar usuários com problemas de token:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PROMOVER USUÁRIO A COORDENADOR
app.patch('/api/admin/usuarios/:userId/promover', adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { userId } = req.params;

    // Buscar dados do usuário que será promovido
    const userResult = await client.query(
      'SELECT id, nome, setor FROM v_usuarios_completo WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = userResult.rows[0];

    // Verificar se já existe coordenador no setor
    const coordenadorExistente = await client.query(
      'SELECT id, nome FROM v_usuarios_completo WHERE setor = $1 AND is_coordenador = true AND id != $2',
      [user.setor, userId]
    );

    let coordenadorSubstituido = null;

    // Se existe coordenador, remover coordenação dele primeiro
    if (coordenadorExistente.rows.length > 0) {
      coordenadorSubstituido = coordenadorExistente.rows[0];
      
      await client.query(
        'UPDATE usuarios SET is_coordenador = FALSE WHERE id = $1',
        [coordenadorSubstituido.id]
      );
      
      console.log(`👤 ADMIN: Coordenação removida de ${coordenadorSubstituido.nome} (${user.setor})`);
    }

    // Promover o novo coordenador
    const result = await client.query(
      'UPDATE usuarios SET is_coordenador = TRUE WHERE id = $1 RETURNING id, nome, is_coordenador',
      [userId]
    );

    await client.query('COMMIT');

    console.log(`👑 ADMIN: ${user.nome} promovido a coordenador do setor ${user.setor}`);

    res.json({
      message: 'Usuário promovido a coordenador com sucesso',
      usuario: result.rows[0],
      coordenador_substituido: coordenadorSubstituido?.nome || null,
      setor: user.setor
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao promover coordenador:', error);
    res.status(500).json({ error: 'Erro ao promover coordenador' });
  } finally {
    client.release();
  }
});

// REBAIXAR COORDENADOR
app.patch('/api/admin/usuarios/:userId/rebaixar', adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      'UPDATE usuarios SET is_coordenador = FALSE WHERE id = $1 RETURNING id, nome, is_coordenador',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json({
      message: 'Usuário rebaixado com sucesso',
      usuario: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Erro ao rebaixar coordenador:', error);
    res.status(500).json({ error: 'Erro ao rebaixar coordenador' });
  }
});

// ROTA: Adicionar novo usuário (Admin)
app.post('/api/admin/adicionar-usuario', adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { nome, email, email_pessoal, setor, tipo_colaborador } = req.body;

    console.log(`👤 ADMIN ADD: Adicionando ${tipo_colaborador} - ${nome} (${email_pessoal})`);

    // Validações básicas
    if (!nome || !email_pessoal || !setor || !tipo_colaborador) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'Campos obrigatórios: nome, email_pessoal, setor, tipo_colaborador' });
    }

    if (!['estagiario', 'clt_associado'].includes(tipo_colaborador)) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'Tipo de colaborador deve ser estagiario ou clt_associado' });
    }

    // Validação para CLT/Associado
    if (tipo_colaborador === 'clt_associado' && (!email || !email.endsWith('@resendemh.com.br'))) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'Email corporativo é obrigatório para CLT/Associado' });
    }

    // Verificar se email já existe
    const emailLogin = tipo_colaborador === 'estagiario' ? email_pessoal : email;
    const userExists = await client.query(
      `SELECT id FROM usuarios 
       WHERE (tipo_colaborador = 'estagiario' AND email_pessoal = $1) 
          OR (tipo_colaborador = 'clt_associado' AND email = $1)`,
      [emailLogin]
    );

    if (userExists.rows.length > 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'Email já cadastrado no sistema' });
    }

    // Geração obrigatória de senha temporária
    const senhaTemporaria = crypto.randomBytes(8).toString('hex');
    const senhaHash = await bcrypt.hash(senhaTemporaria, 10);

    // Inserir usuário na tabela usuarios
    const result = await client.query(
      `INSERT INTO usuarios (nome, email, email_pessoal, senha, setor, tipo_usuario, tipo_colaborador, email_verificado, aprovado_admin) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING id, nome, email, email_pessoal, setor, tipo_colaborador`,
      [
        nome, 
        email || null, 
        email_pessoal, 
        senhaHash,
        setor, 
        'usuario', 
        tipo_colaborador, 
        false, // email_verificado
        tipo_colaborador === 'clt_associado' ? true : null // aprovado_admin
      ]
    );

    const newUser = result.rows[0];
    console.log(`✅ ADMIN: Usuário criado com ID: ${newUser.id}`);

    // ✅ CORREÇÃO: Registrar na tabela usuarios_admin_log
    await client.query(
      `INSERT INTO usuarios_admin_log (usuario_id, ativo, criado_por_admin, criado_por_admin_em, ultima_alteracao_por) 
       VALUES ($1, $2, $3, NOW(), $4)`,
      [newUser.id, true, req.user.id, req.user.id]
    );

    // Gerar token de configuração de senha
    const tokenConfiguracao = crypto.randomBytes(32).toString('hex');
    const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias

    await client.query(
      `INSERT INTO verificacoes_email (usuario_id, token, tipo_token, expira_em) 
       VALUES ($1, $2, $3, $4)`,
      [newUser.id, tokenConfiguracao, 'configuracao_senha', expiraEm]
    );

    await client.query('COMMIT');
    console.log('✅ ADMIN: Transação commitada com sucesso');

    // Enviar email de configuração
    const linkConfiguracao = `${process.env.API_BASE_URL || 'http://localhost:3001'}/configurar-conta/${tokenConfiguracao}`;
    
    try {
      await resend.emails.send({
        from: 'andre.macedo@resendemh.com.br',
        to: [email_pessoal],
        subject: '🔐 Configure sua senha - Dashboards RMH',
        html: await gerarTemplateConfigurarSenha(nome, linkConfiguracao, emailLogin)
      });

      console.log(`✅ ADMIN: Email de configuração enviado para ${email_pessoal}`);
    } catch (emailError) {
      console.error('❌ ADMIN: Erro ao enviar email (não crítico):', emailError);
    }

    res.status(201).json({
      message: 'Usuário adicionado com sucesso',
      usuario: newUser,
      email_enviado: true,
      email_enviado_para: email_pessoal,
      link_configuracao: linkConfiguracao // Para debug
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ ADMIN: Erro ao adicionar usuário:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// ROTA: Editar usuário (Admin)
app.put('/api/admin/editar-usuario/:userId', adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { nome, setor, email_pessoal } = req.body;

    if (!nome || !setor || !email_pessoal) {
      return res.status(400).json({ error: 'Campos obrigatórios: nome, setor, email_pessoal' });
    }

    // Verificar se usuário existe
    const userExists = await pool.query('SELECT id FROM usuarios WHERE id = $1', [userId]);
    if (userExists.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Atualizar usuário
    const result = await pool.query(
      `UPDATE usuarios 
       SET nome = $1, setor = $2, email_pessoal = $3, atualizado_em = NOW() 
       WHERE id = $4 
       RETURNING id, nome, setor, email_pessoal`,
      [nome, setor, email_pessoal, userId]
    );

    console.log(`✅ ADMIN: Usuário ${userId} editado por ${req.user.nome}`);

    res.json({
      message: 'Usuário editado com sucesso',
      usuario: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Erro ao editar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ROTA: Revogar acesso (Admin)
app.patch('/api/admin/revogar-acesso/:userId', adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { userId } = req.params;

    // Verificar se usuário existe
    const userResult = await client.query(
      'SELECT nome FROM usuarios WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = userResult.rows[0];

    // ✅ CORREÇÃO: Verificar se já existe registro no usuarios_admin_log
    const logResult = await client.query(
      'SELECT id FROM usuarios_admin_log WHERE usuario_id = $1',
      [userId]
    );

    if (logResult.rows.length === 0) {
      // Criar registro inicial no usuarios_admin_log
      await client.query(
        `INSERT INTO usuarios_admin_log (usuario_id, ativo, revogado_por, revogado_em, motivo_revogacao, ultima_alteracao_por) 
         VALUES ($1, $2, $3, NOW(), $4, $5)`,
        [userId, false, req.user.id, 'Acesso revogado pelo administrador', req.user.id]
      );
    } else {
      // Atualizar registro existente
      await client.query(
        `UPDATE usuarios_admin_log 
         SET ativo = false, revogado_por = $1, revogado_em = NOW(), 
             motivo_revogacao = $2, ultima_alteracao_por = $3, atualizado_em = NOW()
         WHERE usuario_id = $4`,
        [req.user.id, 'Acesso revogado pelo administrador', req.user.id, userId]
      );
    }

    await client.query('COMMIT');
    console.log(`🚫 ADMIN: Acesso revogado para ${user.nome} por ${req.user.nome}`);

    res.json({
      message: 'Acesso revogado com sucesso',
      usuario_revogado: user.nome
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao revogar acesso:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    client.release();
  }
});

// ROTA: Reativar usuário (Admin)
app.patch('/api/admin/reativar-usuario/:userId', adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verificar se usuário existe e está revogado
    const userResult = await pool.query(
      'SELECT nome FROM usuarios WHERE id = $1 AND ativo = false',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado ou não está revogado' });
    }

    const user = userResult.rows[0];

    // Reativar usuário
    await pool.query(
      'UPDATE usuarios SET ativo = true, reativado_em = NOW(), reativado_por = $1 WHERE id = $2',
      [req.user.id, userId]
    );

    console.log(`✅ ADMIN: Usuário ${user.nome} reativado por ${req.user.nome}`);

    res.json({
      message: 'Usuário reativado com sucesso',
      usuario_reativado: user.nome
    });

  } catch (error) {
    console.error('❌ Erro ao reativar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ROTA: Buscar detalhes de usuário específico (Admin)
app.get('/api/admin/usuario/:userId', adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(`
      SELECT 
        u.*,
        CASE 
          WHEN u.tipo_colaborador = 'estagiario' THEN u.email_pessoal 
          ELSE u.email 
        END as email_login,
        admin_criador.nome as criado_por_nome,
        admin_aprovador.nome as aprovado_por_nome,
        admin_revogador.nome as revogado_por_nome
      FROM usuarios u
      LEFT JOIN usuarios admin_criador ON u.criado_por_admin = admin_criador.id
      LEFT JOIN usuarios admin_aprovador ON u.aprovado_por = admin_aprovador.id
      LEFT JOIN usuarios admin_revogador ON u.revogado_por = admin_revogador.id
      WHERE u.id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json({
      usuario: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Erro ao buscar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.delete('/api/admin/excluir-usuario-problema/:userId', adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { userId } = req.params;
    const { motivo = 'Token expirado há muito tempo' } = req.body;

    console.log(`🗑️ ADMIN: Excluindo usuário ${userId} com problema de token`);

    // Verificar se usuário existe e tem problemas
    const userResult = await client.query(
      `SELECT 
         u.nome, 
         u.email, 
         u.email_pessoal, 
         u.tipo_colaborador,
         u.email_verificado,
         EXTRACT(DAYS FROM (NOW() - u.criado_em)) as dias_desde_criacao
       FROM usuarios u 
       WHERE u.id = $1 AND u.email_verificado = false`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Usuário não encontrado ou já verificado' });
    }

    const user = userResult.rows[0];
    const emailLogin = user.tipo_colaborador === 'estagiario' ? user.email_pessoal : user.email;

    // Log da exclusão
    console.log(`🗑️ Excluindo usuário: ${user.nome} (${emailLogin}) - ${Math.floor(user.dias_desde_criacao)} dias de conta`);

    // Remover tokens relacionados
    await client.query('DELETE FROM verificacoes_email WHERE usuario_id = $1', [userId]);

    // Remover logs administrativos
    await client.query('DELETE FROM usuarios_admin_log WHERE usuario_id = $1', [userId]);

    // Remover usuário
    await client.query('DELETE FROM usuarios WHERE id = $1', [userId]);

    await client.query('COMMIT');

    console.log(`✅ ADMIN: Usuário ${user.nome} excluído definitivamente por ${req.user.nome}`);

    res.json({
      message: 'Usuário excluído com sucesso',
      usuario_excluido: {
        nome: user.nome,
        email: emailLogin,
        tipo_colaborador: user.tipo_colaborador,
        dias_desde_criacao: Math.floor(user.dias_desde_criacao)
      },
      motivo
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao excluir usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    client.release();
  }
});

// AÇÃO EM LOTE: REENVIAR PARA MÚLTIPLOS USUÁRIOS
app.post('/api/admin/reenviar-lote-problemas', adminMiddleware, async (req, res) => {
  const { userIds } = req.body;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'Lista de IDs de usuários inválida' });
  }

  if (userIds.length > 10) {
    return res.status(400).json({ error: 'Máximo de 10 usuários por vez' });
  }

  const resultados = {
    sucessos: [],
    erros: [],
    total_processados: 0
  };

  console.log(`📧 ADMIN: Reenvio em lote para ${userIds.length} usuários por ${req.user.nome}`);

  for (const userId of userIds) {
    try {
      const response = await fetch(`${process.env.API_BASE_URL}/api/admin/reenviar-codigo-problema/${userId}`, {
        method: 'POST',
        headers: {
          'Authorization': req.headers.authorization,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        resultados.sucessos.push({
          userId,
          email: data.email_enviado_para,
          tipo: data.tipo_envio
        });
      } else {
        resultados.erros.push({
          userId,
          erro: data.error || 'Erro desconhecido'
        });
      }

    } catch (error) {
      resultados.erros.push({
        userId,
        erro: 'Erro de conexão'
      });
    }

    resultados.total_processados++;
  }

  console.log(`✅ ADMIN: Reenvio em lote finalizado - ${resultados.sucessos.length} sucessos, ${resultados.erros.length} erros`);

  res.json({
    message: `Processamento concluído: ${resultados.sucessos.length} sucessos, ${resultados.erros.length} erros`,
    resultados
  });
});

// AÇÃO EM LOTE: EXCLUIR MÚLTIPLOS USUÁRIOS
app.post('/api/admin/excluir-lote-problemas', adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { userIds, motivo = 'Limpeza administrativa de usuários com problemas de token' } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Lista de IDs de usuários inválida' });
    }

    if (userIds.length > 20) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Máximo de 20 usuários por vez' });
    }

    console.log(`🗑️ ADMIN: Exclusão em lote de ${userIds.length} usuários por ${req.user.nome}`);

    // Verificar usuários válidos
    const usersResult = await client.query(
      'SELECT id, nome, email, email_pessoal, tipo_colaborador FROM usuarios WHERE id = ANY($1) AND email_verificado = false',
      [userIds]
    );

    if (usersResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Nenhum usuário válido encontrado' });
    }

    const validUserIds = usersResult.rows.map(u => u.id);
    const usuariosParaExcluir = usersResult.rows;

    // Remover tokens
    const tokensResult = await client.query(
      'DELETE FROM verificacoes_email WHERE usuario_id = ANY($1) RETURNING id',
      [validUserIds]
    );

    // Remover logs
    const logsResult = await client.query(
      'DELETE FROM usuarios_admin_log WHERE usuario_id = ANY($1) RETURNING id',
      [validUserIds]
    );

    // Remover usuários
    const usuariosResult = await client.query(
      'DELETE FROM usuarios WHERE id = ANY($1) RETURNING nome',
      [validUserIds]
    );

    await client.query('COMMIT');

    console.log(`✅ ADMIN: ${usuariosResult.rowCount} usuários excluídos em lote por ${req.user.nome}`);

    res.json({
      message: 'Usuários excluídos com sucesso',
      usuarios_excluidos: usuariosResult.rowCount,
      tokens_removidos: tokensResult.rowCount,
      logs_removidos: logsResult.rowCount,
      detalhes: usuariosParaExcluir.map(u => ({
        nome: u.nome,
        email: u.tipo_colaborador === 'estagiario' ? u.email_pessoal : u.email,
        tipo: u.tipo_colaborador
      })),
      motivo
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro na exclusão em lote:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    client.release();
  }
});

// ESTATÍSTICAS DETALHADAS DE PROBLEMAS DE TOKEN
app.get('/api/admin/estatisticas-tokens', adminMiddleware, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        -- Usuários com problemas por tempo
        COUNT(*) FILTER (
          WHERE email_verificado = false 
          AND criado_em < NOW() - INTERVAL '45 days'
        ) as muito_antigos,
        
        COUNT(*) FILTER (
          WHERE email_verificado = false 
          AND criado_em < NOW() - INTERVAL '30 days'
          AND criado_em >= NOW() - INTERVAL '45 days'
        ) as antigos,
        
        COUNT(*) FILTER (
          WHERE email_verificado = false 
          AND criado_em < NOW() - INTERVAL '7 days'
          AND criado_em >= NOW() - INTERVAL '30 days'
        ) as moderados,
        
        -- Usuários por tipo
        COUNT(*) FILTER (
          WHERE email_verificado = false 
          AND tipo_colaborador = 'clt_associado'
          AND criado_em < NOW() - INTERVAL '1 day'
        ) as clt_nao_verificados,
        
        COUNT(*) FILTER (
          WHERE email_verificado = false 
          AND tipo_colaborador = 'estagiario'
          AND aprovado_admin = true
          AND criado_em < NOW() - INTERVAL '1 day'
        ) as estagiarios_nao_verificados,
        
        -- Total geral
        COUNT(*) FILTER (WHERE email_verificado = false) as total_nao_verificados
      FROM usuarios
    `);

    const tokenStats = await pool.query(`
      SELECT 
        COUNT(*) as total_tokens,
        COUNT(*) FILTER (WHERE expira_em < NOW()) as tokens_expirados,
        COUNT(*) FILTER (WHERE expira_em > NOW() AND usado_em IS NULL) as tokens_ativos,
        COUNT(*) FILTER (WHERE usado_em IS NOT NULL) as tokens_usados,
        COUNT(DISTINCT usuario_id) as usuarios_com_tokens
      FROM verificacoes_email 
      WHERE tipo_token = 'verificacao_email'
    `);

    res.json({
      usuarios: stats.rows[0],
      tokens: tokenStats.rows[0],
      recomendacoes: {
        acao_necessaria: parseInt(stats.rows[0].muito_antigos) > 0,
        usuarios_criticos: parseInt(stats.rows[0].muito_antigos),
        usuarios_atenção: parseInt(stats.rows[0].antigos)
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas de tokens:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ROTA: Estatísticas detalhadas do sistema (Admin)
// backend/server.js - CORREÇÃO DAS ESTATÍSTICAS

app.get('/api/admin/estatisticas', adminMiddleware, async (req, res) => {
  try {
    // Usar a view v_usuarios_completo que já tem as informações consolidadas
    const stats = await pool.query(`
      SELECT 
        -- Total de usuários ativos (excluindo revogados)
        COUNT(*) FILTER (WHERE ativo = true) as total_usuarios,
        
        -- Estagiários ativos e aprovados
        COUNT(*) FILTER (
          WHERE tipo_colaborador = 'estagiario' 
          AND ativo = true
          AND aprovado_admin = true 
          AND email_verificado = true
        ) as total_estagiarios,
        
        -- CLT/Associados ativos e verificados
        COUNT(*) FILTER (
          WHERE tipo_colaborador = 'clt_associado' 
          AND ativo = true
          AND email_verificado = true
        ) as total_clt_associados,
        
        -- Coordenadores ativos
        COUNT(*) FILTER (
          WHERE is_coordenador = true 
          AND ativo = true
        ) as total_coordenadores,
        
        -- Administradores ativos
        COUNT(*) FILTER (
          WHERE tipo_usuario = 'admin' 
          AND ativo = true
        ) as total_admins,
        
        -- Usuários com email não verificado (excluindo estagiários pendentes)
        COUNT(*) FILTER (
          WHERE email_verificado = false 
          AND ativo = true
          AND NOT (tipo_colaborador = 'estagiario' AND aprovado_admin IS NULL)
        ) as nao_verificados,
        
        -- Estagiários pendentes de aprovação
        COUNT(*) FILTER (
          WHERE tipo_colaborador = 'estagiario' 
          AND aprovado_admin IS NULL 
          AND ativo = true
        ) as pendentes_aprovacao,
        
        -- Usuários revogados
        COUNT(*) FILTER (WHERE ativo = false) as revogados,
        
        -- Usuários ativos nos últimos 30 dias
        COUNT(*) FILTER (
          WHERE ultimo_login > NOW() - INTERVAL '30 days' 
          AND ativo = true
        ) as ativos_ultimos_30_dias
      FROM v_usuarios_completo
    `);

    // Estatísticas por setor (apenas usuários ativos)
    const estatisticasPorSetor = await pool.query(`
      SELECT 
        setor,
        COUNT(*) as total,
        COUNT(*) FILTER (
          WHERE tipo_colaborador = 'estagiario' 
          AND aprovado_admin = true 
          AND email_verificado = true
        ) as estagiarios,
        COUNT(*) FILTER (
          WHERE tipo_colaborador = 'clt_associado' 
          AND email_verificado = true
        ) as clt_associados,
        COUNT(*) FILTER (WHERE is_coordenador = true) as coordenadores,
        COUNT(*) FILTER (WHERE tipo_usuario = 'admin') as admins
      FROM v_usuarios_completo
      WHERE ativo = true
      GROUP BY setor
      ORDER BY total DESC
    `);

    // Log para debug
    console.log('📊 ESTATÍSTICAS CALCULADAS:', {
      ...stats.rows[0],
      por_setor: estatisticasPorSetor.rows.length
    });

    res.json({
      geral: stats.rows[0],
      por_setor: estatisticasPorSetor.rows
    });

  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ROTA: Histórico de ações administrativas
app.get('/api/admin/historico-acoes', adminMiddleware, async (req, res) => {
  try {
    const { limite = 50 } = req.query;

    const result = await pool.query(`
      SELECT 
        'aprovacao' as tipo_acao,
        u.nome as usuario_afetado,
        CASE 
          WHEN u.tipo_colaborador = 'estagiario' THEN u.email_pessoal 
          ELSE u.email 
        END as email_login,
        admin.nome as admin_responsavel,
        u.aprovado_em as data_acao,
        'Usuário aprovado' as descricao
      FROM usuarios u
      JOIN usuarios admin ON u.aprovado_por = admin.id
      WHERE u.aprovado_em IS NOT NULL
      
      UNION ALL
      
      SELECT 
        'revogacao' as tipo_acao,
        u.nome as usuario_afetado,
        CASE 
          WHEN u.tipo_colaborador = 'estagiario' THEN u.email_pessoal 
          ELSE u.email 
        END as email_login,
        admin.nome as admin_responsavel,
        u.revogado_em as data_acao,
        'Acesso revogado' as descricao
      FROM usuarios u
      JOIN usuarios admin ON u.revogado_por = admin.id
      WHERE u.revogado_em IS NOT NULL
      
      UNION ALL
      
      SELECT 
        'criacao' as tipo_acao,
        u.nome as usuario_afetado,
        CASE 
          WHEN u.tipo_colaborador = 'estagiario' THEN u.email_pessoal 
          ELSE u.email 
        END as email_login,
        admin.nome as admin_responsavel,
        u.criado_em as data_acao,
        'Usuário adicionado pelo admin' as descricao
      FROM usuarios u
      JOIN usuarios admin ON u.criado_por_admin = admin.id
      WHERE u.criado_por_admin IS NOT NULL
      
      ORDER BY data_acao DESC
      LIMIT $1
    `, [limite]);

    res.json({
      historico: result.rows
    });

  } catch (error) {
    console.error('❌ Erro ao buscar histórico:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
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

const limparTokensExpirados = async () => {
  try {
    const result = await pool.query(
      'DELETE FROM verificacoes_email WHERE expira_em < NOW() AND usado_em IS NULL'
    );
    console.log(`🧹 LIMPEZA: ${result.rowCount} tokens expirados removidos`);
  } catch (error) {
    console.error('❌ Erro na limpeza de tokens:', error);
  }
};

// Executar limpeza a cada hora
setInterval(limparTokensExpirados, 60 * 60 * 1000);

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