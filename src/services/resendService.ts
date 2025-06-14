// services/resendService.ts - Versão que funciona no frontend
class ResendService {
  private apiKey: string;
  private fromEmail: string;

  constructor() {
    this.apiKey = 're_BVk2fgSA_npWD4cQkwoAz9MFkgH4CdptG';
    this.fromEmail = 'onboarding@resend.dev';
  }

  // Método que chama a API do Resend diretamente via fetch
  async testEmailService(): Promise<boolean> {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: ['andreruperto@gmail.com'],
          subject: '🧪 Teste Direto - Resend API',
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
              <h2 style="color: #1e40af;">🎉 Resend funcionando!</h2>
              <p>Este email foi enviado diretamente da API do Resend!</p>
              <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>✅ Teste realizado com sucesso!</strong></p>
                <p>Data/Hora: ${new Date().toLocaleString('pt-BR')}</p>
                <p>Projeto: Dashboards Corporativos - Resende MH</p>
              </div>
              <p>A integração está funcionando corretamente! 🚀</p>
            </div>
          `
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Erro da API Resend:', data);
        throw new Error(data.message || 'Erro ao enviar email');
      }

      console.log('✅ Email enviado com sucesso:', data);
      return true;

    } catch (error) {
      console.error('❌ Erro ao testar serviço:', error);
      throw error;
    }
  }

  async sendEmailVerification(userData: {
    name: string;
    email: string;
    verificationToken: string;
  }): Promise<boolean> {
    try {
      const verificationUrl = `${window.location.origin}/verify-email?token=${userData.verificationToken}&email=${userData.email}`;
      
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: [userData.email],
          subject: '🔐 Ative sua conta - Dashboards Corporativos',
          html: this.generateVerificationEmailTemplate(userData.name, verificationUrl)
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao enviar email');
      }

      console.log('✅ Email de verificação enviado:', data.id);
      return true;

    } catch (error) {
      console.error('❌ Erro ao enviar email de verificação:', error);
      throw error;
    }
  }

  private generateVerificationEmailTemplate(name: string, verificationUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ative sua conta</title>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header { 
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: bold;
          }
          .content { 
            padding: 40px 30px; 
            background: #ffffff; 
          }
          .greeting {
            font-size: 20px;
            color: #1e40af;
            margin-bottom: 20px;
            font-weight: 600;
          }
          .button { 
            display: inline-block; 
            padding: 16px 32px; 
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white; 
            text-decoration: none; 
            border-radius: 8px; 
            margin: 25px 0;
            font-weight: 600;
            font-size: 16px;
          }
          .footer { 
            padding: 30px; 
            text-align: center; 
            background: #f9fafb;
            border-top: 1px solid #e5e7eb;
            font-size: 14px;
            color: #6b7280;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏢 Dashboards Corporativos</h1>
            <p>Resende MH</p>
          </div>
          
          <div class="content">
            <div class="greeting">Olá, ${name}! 👋</div>
            
            <p>Bem-vindo aos <strong>Dashboards Corporativos da Resende MH</strong>!</p>
            
            <p>Para ativar sua conta, clique no botão abaixo:</p>
            
            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button">✅ Ativar Minha Conta</a>
            </div>
            
            <p>Ou copie este link: <br><code>${verificationUrl}</code></p>
          </div>
          
          <div class="footer">
            <p><strong>Resende MH</strong> - Este é um email automático.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export default new ResendService();