// services/resendService.ts
import { Resend } from 'resend';

class ResendService {
  private resend: Resend;
  private fromEmail: string;

  constructor() {
    // Sua API key do Resend
    this.resend = new Resend('re_BVk2fgSA_npWD4cQkwoAz9MFkgH4CdptG');
    
    // Por enquanto usar o domínio padrão, depois trocar pelo seu
    this.fromEmail = 'onboarding@resend.dev'; // Mudar para noreply@resendemh.com.br quando configurar DNS
  }

  async sendEmailVerification(userData: {
    name: string;
    email: string;
    verificationToken: string;
  }): Promise<boolean> {
    try {
      const verificationUrl = `${window.location.origin}/verify-email?token=${userData.verificationToken}&email=${userData.email}`;
      
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: userData.email,
        subject: '🔐 Ative sua conta - Dashboards Corporativos',
        html: this.generateVerificationEmailTemplate(userData.name, verificationUrl)
      });

      if (error) {
        console.error('Erro do Resend:', error);
        throw new Error(`Erro ao enviar email: ${error.message}`);
      }

      console.log('✅ Email de verificação enviado:', data?.id);
      return true;
    } catch (error) {
      console.error('❌ Erro ao enviar email de verificação:', error);
      throw error;
    }
  }

  async sendPasswordReset(userData: {
    name: string;
    email: string;
    resetToken: string;
  }): Promise<boolean> {
    try {
      const resetUrl = `${window.location.origin}/reset-password?token=${userData.resetToken}&email=${userData.email}`;
      
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: userData.email,
        subject: '🔑 Redefinir Senha - Dashboards Corporativos',
        html: this.generatePasswordResetTemplate(userData.name, resetUrl)
      });

      if (error) {
        console.error('Erro do Resend:', error);
        throw new Error(`Erro ao enviar email: ${error.message}`);
      }

      console.log('✅ Email de reset enviado:', data?.id);
      return true;
    } catch (error) {
      console.error('❌ Erro ao enviar email de reset:', error);
      throw error;
    }
  }

  async sendWelcomeEmail(userData: {
    name: string;
    email: string;
  }): Promise<boolean> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: userData.email,
        subject: '🎉 Bem-vindo aos Dashboards Corporativos!',
        html: this.generateWelcomeEmailTemplate(userData.name)
      });

      if (error) {
        console.error('Erro do Resend:', error);
        throw new Error(`Erro ao enviar email: ${error.message}`);
      }

      console.log('✅ Email de boas-vindas enviado:', data?.id);
      return true;
    } catch (error) {
      console.error('❌ Erro ao enviar email de boas-vindas:', error);
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
          .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
            font-size: 16px;
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
            transition: transform 0.2s;
          }
          .button:hover {
            transform: translateY(-1px);
          }
          .link-backup {
            background: #f3f4f6;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
            word-break: break-all;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            color: #374151;
          }
          .info-box {
            background: #eff6ff;
            border-left: 4px solid #3b82f6;
            padding: 20px;
            margin: 25px 0;
            border-radius: 0 6px 6px 0;
          }
          .info-box h3 {
            margin: 0 0 10px 0;
            color: #1e40af;
            font-size: 16px;
          }
          .info-box ul {
            margin: 0;
            padding-left: 20px;
          }
          .info-box li {
            margin: 5px 0;
            color: #374151;
          }
          .footer { 
            padding: 30px; 
            text-align: center; 
            background: #f9fafb;
            border-top: 1px solid #e5e7eb;
          }
          .footer p {
            margin: 5px 0;
            font-size: 14px;
            color: #6b7280;
          }
          .footer .company {
            font-weight: 600;
            color: #1e40af;
          }
          .warning {
            font-size: 12px;
            color: #dc2626;
            margin-top: 20px;
            padding: 10px;
            background: #fef2f2;
            border-radius: 4px;
            border-left: 3px solid #dc2626;
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
            
            <p>Para ativar sua conta e ter acesso completo à plataforma, clique no botão abaixo:</p>
            
            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button">✅ Ativar Minha Conta</a>
            </div>
            
            <p>Ou copie e cole este link no seu navegador:</p>
            <div class="link-backup">${verificationUrl}</div>
            
            <div class="info-box">
              <h3>📋 Informações da sua conta:</h3>
              <ul>
                <li><strong>Nome:</strong> ${name}</li>
                <li><strong>Email:</strong> Seu email corporativo @resendemh.com.br</li>
                <li><strong>Acesso:</strong> Dashboards e relatórios corporativos</li>
              </ul>
            </div>
            
            <div class="warning">
              ⏰ <strong>Importante:</strong> Este link expira em 24 horas por motivos de segurança.
            </div>
          </div>
          
          <div class="footer">
            <p>Se você não solicitou este cadastro, pode ignorar este email com segurança.</p>
            <p><span class="company">Resende MH</span> - Este é um email automático, não responda.</p>
            <p>© ${new Date().getFullYear()} Resende MH. Todos os direitos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generatePasswordResetTemplate(name: string, resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Redefinir Senha</title>
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
            background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
          }
          .content { 
            padding: 40px 30px; 
            background: #ffffff; 
          }
          .button { 
            display: inline-block; 
            padding: 16px 32px; 
            background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
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
          .warning {
            background: #fef2f2;
            border-left: 4px solid #dc2626;
            padding: 15px;
            margin: 20px 0;
            border-radius: 0 4px 4px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔑 Redefinir Senha</h1>
            <p>Dashboards Corporativos</p>
          </div>
          
          <div class="content">
            <h2>Olá, ${name}!</h2>
            
            <p>Você solicitou a redefinição de sua senha para acessar os Dashboards Corporativos.</p>
            
            <p>Clique no botão abaixo para criar uma nova senha:</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">🔐 Redefinir Senha</a>
            </div>
            
            <div class="warning">
              ⚠️ <strong>Importante:</strong> Este link expira em 10 minutos por motivos de segurança.
            </div>
            
            <p>Se você não solicitou esta redefinição, pode ignorar este email. Sua senha atual permanecerá inalterada.</p>
          </div>
          
          <div class="footer">
            <p><strong>Resende MH</strong> - Este é um email automático, não responda.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateWelcomeEmailTemplate(name: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bem-vindo!</title>
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
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
          }
          .content { 
            padding: 40px 30px; 
            background: #ffffff; 
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
          .features {
            background: #f0fdf4;
            border-radius: 8px;
            padding: 20px;
            margin: 25px 0;
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
            <h1>🎉 Conta Ativada!</h1>
            <p>Bem-vindo aos Dashboards Corporativos</p>
          </div>
          
          <div class="content">
            <h2>Parabéns, ${name}! 🚀</h2>
            
            <p>Sua conta foi ativada com sucesso! Agora você tem acesso completo aos <strong>Dashboards Corporativos da Resende MH</strong>.</p>
            
            <div class="features">
              <h3>🔍 O que você pode fazer agora:</h3>
              <ul>
                <li>📊 Visualizar dashboards e relatórios em tempo real</li>
                <li>📈 Acessar métricas do seu departamento</li>
                <li>💼 Acompanhar KPIs corporativos</li>
                <li>🔄 Receber atualizações automáticas</li>
              </ul>
            </div>
            
            <p>Faça login agora e comece a explorar os dados da sua empresa:</p>
            
            <div style="text-align: center;">
              <a href="${window.location.origin}/login" class="button">🔑 Fazer Login</a>
            </div>
            
            <p>Se você tiver alguma dúvida ou precisar de suporte, entre em contato com a equipe de TI.</p>
          </div>
          
          <div class="footer">
            <p><strong>Resende MH</strong> - Dashboards Corporativos</p>
            <p>Este é um email automático, não responda.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Método para testar o serviço
  async testEmailService(): Promise<boolean> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: 'andreruperto@gmail.com', // Seu email para teste
        subject: '🧪 Teste - Integração Resend',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>✅ Integração do Resend Funcionando!</h2>
            <p>Este é um email de teste para verificar se a integração com o Resend está funcionando corretamente.</p>
            <p><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}</p>
            <p><strong>Projeto:</strong> Dashboards Corporativos - Resende MH</p>
          </div>
        `
      });

      if (error) {
        console.error('❌ Erro no teste:', error);
        return false;
      }

      console.log('✅ Email de teste enviado com sucesso:', data?.id);
      return true;
    } catch (error) {
      console.error('❌ Erro ao testar serviço:', error);
      return false;
    }
  }
}

export default new ResendService();