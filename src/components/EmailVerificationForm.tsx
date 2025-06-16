// src/components/EmailVerificationForm.tsx
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, ArrowLeft, RefreshCw } from 'lucide-react';

// Definir tipos para o usuário
interface User {
  id: string;
  nome: string;
  email: string;
  email_verificado: boolean;
}

interface EmailVerificationFormProps {
  email: string;
  onVerificationSuccess: (token: string, user: User) => void;
  onBackToLogin: () => void;
}

// Configuração da API
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://rmh.up.railway.app'
  : 'http://localhost:3001';

const EmailVerificationForm: React.FC<EmailVerificationFormProps> = ({
  email,
  onVerificationSuccess,
  onBackToLogin
}) => {
  const [codigo, setCodigo] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const { toast } = useToast();

  // Countdown para reenvio
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (countdown > 0) {
      interval = setInterval(() => {
        setCountdown(countdown - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [countdown]);

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();

    if (codigo.length !== 6) {
      toast({
        title: "Código inválido",
        description: "O código deve ter 6 dígitos",
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          codigo
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro na verificação');
      }

      toast({
        title: "✅ Email verificado!",
        description: "Conta ativada com sucesso. Você foi logado automaticamente.",
        variant: "default",
      });

      // Chamar callback de sucesso com token e dados do usuário
      onVerificationSuccess(data.token, data.user);

    } catch (error) {
      toast({
        title: "❌ Erro na verificação",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendCode = async () => {
    setIsResending(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao reenviar código');
      }

      toast({
        title: "📧 Código reenviado!",
        description: "Novo código enviado para seu email",
        variant: "default",
      });

      setCountdown(120); // 2 minutos
      setCodigo(''); // Limpar código atual

    } catch (error) {
      toast({
        title: "❌ Erro ao reenviar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="flex items-center justify-center">
            <img 
              src="/logo-rmh.png" 
              alt="Resende MH" 
              className="h-16 w-auto mb-4"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <div className="flex items-center justify-center">
            <Mail className="h-12 w-12 text-corporate-blue" />
          </div>
          <CardTitle className="text-2xl font-heading font-bold text-corporate-blue">
            Verifique seu Email
          </CardTitle>
          <CardDescription className="text-corporate-gray">
            Enviamos um código de 6 dígitos para
            <br />
            <strong className="text-corporate-blue">{email}</strong>
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleVerifyCode} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="codigo" className="text-corporate-blue font-medium">
                Código de Verificação
              </Label>
              <Input
                id="codigo"
                type="text"
                placeholder="123456"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-2xl font-mono tracking-widest border-2 border-corporate-blue/20 focus:border-corporate-blue focus:ring-2 focus:ring-corporate-blue/20"
                maxLength={6}
                required
              />
              <p className="text-sm text-corporate-gray text-center">
                Digite o código de 6 dígitos enviado por email
              </p>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-rmh-lightGreen hover:bg-primary-800 transition-colors duration-200"
              disabled={isVerifying || codigo.length !== 6}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                'Verificar Código'
              )}
            </Button>
          </form>

          <div className="mt-6 space-y-4">
            <div className="text-center">
              <p className="text-sm text-corporate-gray mb-3">
                Não recebeu o código?
              </p>
              
              {countdown > 0 ? (
                <p className="text-sm text-corporate-blue font-medium">
                  Reenviar em {formatCountdown(countdown)}
                </p>
              ) : (
                <Button
                  variant="outline"
                  onClick={handleResendCode}
                  disabled={isResending}
                  className="w-full border-corporate-blue text-corporate-blue hover:bg-corporate-blue hover:text-white"
                >
                  {isResending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Reenviando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Reenviar Código
                    </>
                  )}
                </Button>
              )}
            </div>

            <div className="text-center">
              <Button
                variant="ghost"
                onClick={onBackToLogin}
                className="text-corporate-gray hover:text-corporate-blue"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao Login
              </Button>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-corporate-blue/20">
            <p className="text-sm text-corporate-blue">
              <strong>💡 Dica:</strong> Verifique também sua caixa de spam se não encontrar o email.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailVerificationForm;