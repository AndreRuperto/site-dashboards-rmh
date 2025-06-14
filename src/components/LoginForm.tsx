import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff, Mail } from 'lucide-react';

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const { login, isLoading } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const success = await login(email, password);
      if (!success) {
        toast({
          title: "Erro no login",
          description: "Email ou senha incorretos",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro de acesso",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // Função que usa o backend Express
  const testResendEmail = async () => {
    setIsTestingEmail(true);

    try {
      const response = await fetch('http://localhost:3001/send-test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Erro HTTP: ${response.status}`);
      }

      toast({
        title: "✅ Email enviado com sucesso!",
        description: `ID: ${data.data.id} - Verifique andreruperto@gmail.com`,
      });

      console.log('✅ Resposta do backend:', data);

    } catch (error) {
      console.error('❌ Erro detalhado:', error);
      
      if (error.message.includes('Failed to fetch')) {
        toast({
          title: "❌ Backend não está rodando",
          description: "Inicie o servidor na porta 3001: npm run dev",
          variant: "destructive",
        });
      } else {
        toast({
          title: "❌ Erro no envio",
          description: error instanceof Error ? error.message : "Erro desconhecido",
          variant: "destructive",
        });
      }
    } finally {
      setIsTestingEmail(false);
    }
  };

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="flex items-center justify-center">
            <img
              src="/logo-rmh.ico"
              alt="RMH Logo"
              style={{ height: '40px', width: 'auto', marginBottom: '15px' }}
            />
          </div>
          <CardTitle className="text-2xl font-heading font-bold text-corporate-blue">
            Resende Mori Hutchison
          </CardTitle>
          <CardDescription className="text-corporate-gray">
            Faça login com seu email @resendemh.com.br
          </CardDescription>
        </CardHeader>
        <CardContent className="-mt-3">
          {/* Bloco de teste de email (REMOVER EM PRODUÇÃO) */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700 mb-2">🧪 <strong>Teste do Resend:</strong></p>
            <Button
              onClick={testResendEmail}
              disabled={isTestingEmail}
              variant="outline"
              size="sm"
              className="w-full"
            >
              {isTestingEmail ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando teste...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Testar Email Resend (Backend)
                </>
              )}
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu.email@resendemh.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="transition-all duration-200 focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="transition-all duration-200 focus:ring-2 focus:ring-primary-500 pr-10"
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="pt-3">
              <Button
                type="submit"
                className="w-full bg-rmh-lightGreen hover:bg-primary-800 transition-colors duration-200"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </div>
          </form>
          
          <div className="mt-6 text-center text-sm text-corporate-gray">
            <p>Demo: use qualquer email @resendemh.com.br</p>
            <p>Senha: 123456</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginForm;