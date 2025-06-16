// src/components/LoginForm.tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff, UserPlus, ArrowLeft, Mail } from 'lucide-react';
import EmailVerificationForm from './EmailVerificationForm';

// Definir tipos para o usuário
interface User {
  id: string;
  nome: string;
  email: string;
  email_verificado: boolean;
}

type AuthView = 'login' | 'register' | 'verification';

const AuthSystem = () => {
  const [currentView, setCurrentView] = useState<AuthView>('login');
  const [verificationEmail, setVerificationEmail] = useState('');

  const switchView = (view: AuthView, email?: string) => {
    setCurrentView(view);
    if (email) setVerificationEmail(email);
  };

  return (
    <>
      {currentView === 'login' && (
        <LoginView 
          onSwitchToRegister={() => switchView('register')}
          onSwitchToVerification={(email) => switchView('verification', email)}
        />
      )}
      {currentView === 'register' && (
        <RegisterView 
          onBackToLogin={() => switchView('login')}
          onSwitchToVerification={(email) => switchView('verification', email)}
        />
      )}
      {currentView === 'verification' && (
        <EmailVerificationForm
          email={verificationEmail}
          onVerificationSuccess={(token: string, user: User) => {
            // Salvar dados e redirecionar
            localStorage.setItem('authToken', token);
            localStorage.setItem('user', JSON.stringify(user));
            window.location.reload(); // Recarregar para atualizar o AuthContext
          }}
          onBackToLogin={() => switchView('login')}
        />
      )}
    </>
  );
};

// Configuração da API
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://rmh.up.railway.app'
  : 'http://localhost:3001';

// LoginView Component
interface LoginViewProps {
  onSwitchToRegister: () => void;
  onSwitchToVerification: (email: string) => void;
}

const LoginView: React.FC<LoginViewProps> = ({ onSwitchToRegister, onSwitchToVerification }) => {
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
      if (error instanceof Error && error.message.includes('Email não verificado')) {
        // Redirecionar para verificação
        onSwitchToVerification(email);
        toast({
          title: "Email não verificado",
          description: "Verifique seu email e digite o código de verificação",
          variant: "default",
        });
      } else {
        toast({
          title: "Erro de acesso",
          description: error instanceof Error ? error.message : "Erro desconhecido",
          variant: "destructive",
        });
      }
    }
  };

  const testEmailService = async () => {
    setIsTestingEmail(true);
    try {
      const response = await fetch(`${API_BASE_URL}/send-test-email`, {
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
        title: "✅ Email de teste enviado!",
        description: "Verifique se o email chegou em andreruperto@gmail.com",
        variant: "default",
      });

    } catch (error) {
      console.error('❌ Erro:', error);
      toast({
        title: "❌ Erro ao testar email",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
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
              src="/logo-rmh.png" 
              alt="Resende MH" 
              className="h-16 w-auto"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <CardTitle className="text-2xl font-heading font-bold text-corporate-blue">
            Bem-vindo
          </CardTitle>
          <CardDescription className="text-corporate-gray">
            Acesse os Dashboards Corporativos da Resende MH
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
                  onClick={() => setShowPassword(!showPassword)}
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
          
          <div className="mt-6 space-y-4">
            <div className="text-center">
              <Button
                onClick={onSwitchToRegister}
                variant="ghost"
                className="text-corporate-blue hover:text-primary-800"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Não tem uma conta? Cadastre-se
              </Button>
            </div>
            
            <div className="text-center text-sm text-corporate-gray border-t pt-4">
              <p><strong>Acesso admin:</strong> admin@resendemh.com.br | Senha: 123456</p>
            </div>

            <div className="text-center">
              <Button
                onClick={testEmailService}
                variant="outline"
                size="sm"
                disabled={isTestingEmail}
                className="text-xs"
              >
                {isTestingEmail ? (
                  <>
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    Testando...
                  </>
                ) : (
                  <>
                    <Mail className="mr-1 h-3 w-3" />
                    Testar Email
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// RegisterView Component
interface RegisterViewProps {
  onBackToLogin: () => void;
  onSwitchToVerification: (email: string) => void;
}

const RegisterView: React.FC<RegisterViewProps> = ({ onBackToLogin, onSwitchToVerification }) => {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    senha: '',
    confirmSenha: '',
    departamento: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const departamentos = [
    'Vendas', 'Financeiro', 'Marketing', 'Operações', 
    'RH', 'TI', 'Diretoria', 'Jurídico', 'Compras'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.senha !== formData.confirmSenha) {
      toast({
        title: "Senhas não coincidem",
        description: "Verifique se as senhas são idênticas",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nome: formData.nome,
          email: formData.email,
          senha: formData.senha,
          departamento: formData.departamento
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro no cadastro');
      }

      if (data.verification_required) {
        // Redirecionar para verificação
        onSwitchToVerification(formData.email);
        toast({
          title: "📧 Cadastro realizado!",
          description: "Verifique seu email e digite o código de verificação",
          variant: "default",
        });
      }

    } catch (error) {
      toast({
        title: "❌ Erro no cadastro",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="flex items-center justify-center">
            <img 
              src="/logo-rmh.png" 
              alt="Resende MH" 
              className="h-16 w-auto"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <CardTitle className="text-2xl font-heading font-bold text-corporate-blue">
            Criar Conta
          </CardTitle>
          <CardDescription className="text-corporate-gray">
            Cadastre-se com seu email @resendemh.com.br
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo</Label>
              <Input
                id="nome"
                type="text"
                placeholder="Seu nome completo"
                value={formData.nome}
                onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu.email@resendemh.com.br"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="departamento">Departamento</Label>
              <select
                id="departamento"
                value={formData.departamento}
                onChange={(e) => setFormData(prev => ({ ...prev, departamento: e.target.value }))}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecione o departamento</option>
                {departamentos.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <div className="relative">
                <Input
                  id="senha"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={formData.senha}
                  onChange={(e) => setFormData(prev => ({ ...prev, senha: e.target.value }))}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmSenha">Confirmar Senha</Label>
              <div className="relative">
                <Input
                  id="confirmSenha"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Digite a senha novamente"
                  value={formData.confirmSenha}
                  onChange={(e) => setFormData(prev => ({ ...prev, confirmSenha: e.target.value }))}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-rmh-lightGreen hover:bg-primary-800"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando conta...
                </>
              ) : (
                'Criar Conta'
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <Button
              onClick={onBackToLogin}
              variant="ghost"
              className="text-corporate-blue hover:text-primary-800"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Já tem uma conta? Entrar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthSystem;