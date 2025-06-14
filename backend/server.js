// backend/server.js - Versão com CORS corrigido e logs
const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');

const app = express();
const PORT = 3001;

// Middleware de log ANTES de tudo
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - ${new Date().toLocaleString()}`);
  next();
});

// CORS mais permissivo para desenvolvimento
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8080'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Middleware adicional para OPTIONS
app.options('*', cors());

app.use(express.json());

// Inicializar Resend
const resend = new Resend('re_BVk2fgSA_npWD4cQkwoAz9MFkgH4CdptG');

// Rota de teste
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 Backend Resend funcionando!',
    endpoints: ['/send-test-email', '/send-verification-email'],
    time: new Date().toLocaleString('pt-BR'),
    cors: 'Configurado para localhost:8080'
  });
});

// Rota para testar email
app.post('/send-test-email', async (req, res) => {
  try {
    console.log('📧 Recebida requisição para enviar email de teste...');
    console.log('Headers:', req.headers);
    
    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: ['andreruperto@gmail.com'],
      subject: '🎉 SUCESSO! Email do Dashboard RMH',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
          <h2 style="color: #1e40af;">🚀 Backend funcionando perfeitamente!</h2>
          <p>Este email confirma que a integração está 100% funcional.</p>
          
          <div style="background: #10b981; color: white; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <h3 style="margin: 0;">✅ INTEGRAÇÃO COMPLETA!</h3>
          </div>
          
          <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Status dos componentes:</strong></p>
            <ul>
              <li>✅ Frontend React (localhost:8080)</li>
              <li>✅ Backend Express (localhost:3001)</li>
              <li>✅ API Resend</li>
              <li>✅ CORS configurado</li>
              <li>✅ Email chegando na caixa!</li>
            </ul>
          </div>
          
          <p><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}</p>
          <p><strong>Projeto:</strong> Dashboards Corporativos - Resende MH</p>
          
          <hr style="margin: 20px 0;">
          <p style="font-size: 12px; color: #666;">
            🎯 Próximo passo: implementar sistema completo de cadastro e verificação de email!
          </p>
        </div>
      `
    });

    if (error) {
      console.error('❌ Erro do Resend:', error);
      return res.status(400).json({ 
        success: false, 
        error: error.message || 'Erro ao enviar email' 
      });
    }

    console.log('✅ Email enviado com sucesso! ID:', data.id);
    
    res.json({ 
      success: true, 
      data: {
        id: data.id,
        message: 'Email enviado com sucesso via backend!'
      }
    });

  } catch (err) {
    console.error('❌ Erro interno:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Backend rodando em http://localhost:${PORT}`);
  console.log(`📧 Resend configurado e pronto!`);
  console.log(`🔧 CORS configurado para porta 8080`);
  console.log(`🌐 Teste direto: http://localhost:${PORT}`);
  console.log(`📬 Endpoint de teste: POST http://localhost:${PORT}/send-test-email`);
});