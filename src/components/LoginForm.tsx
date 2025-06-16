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

type AuthView = 'login' | 'register' | 'forgot-password' | 'email-sent' | 'verification';

const AuthSystem = () => {
  const [currentView, setCurrentView] = useState<AuthView>('login');
  const [userEmail, setUserEmail] = useState('');

  const switchView = (view: AuthView, email?: string) => {
    setCurrentView(view);
    if (email) setUserEmail(email);
  };

  return (
    <>
      {currentView === 'login' && (
        <LoginView 
          onSwitchToRegister={() => switchView('register')}
          onSwitchToForgotPassword={() => switchView('forgot-password')}
          onSwitchToVerification={(email) => switchView('verification', email)}
        />
      )}
      {currentView === 'register' && (
        <RegisterView 
          onBackToLogin={() => switchView('login')}
          onEmailSent={(email) => switchView('email-sent', email)}
          onSwitchToVerification={(email) => switchView('verification', email)}
        />
      )}
      {currentView === 'email-sent' && (
        <EmailSentView 
          email={userEmail}
          onBackToLogin={() => switchView('login')}
        />
      )}
      {currentView === 'verification' && (
        <EmailVerificationForm
          email={userEmail}
          onVerificationSuccess={(token: string, user: User) => {
            localStorage.setItem('authToken', token);
            localStorage.setItem('user', JSON.stringify(user));
            window.location.reload();
          }}
          onBackToLogin={() => switchView('login')}
        />
      )}
      {currentView === 'forgot-password' && (
        <ForgotPasswordView 
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
  onSwitchToForgotPassword: () => void;
  onSwitchToVerification: (email: string) => void;
}

const LoginView: React.FC<LoginViewProps> = ({ 
  onSwitchToRegister, 
  onSwitchToForgotPassword, 
  onSwitchToVerification 
}) => {
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

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // Função de teste (manter durante desenvolvimento)
  const testResendEmail = async () => {
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
        description: `ID: ${data.data.id} - Backend conectado!`,
      });

    } catch (error) {
      console.error('❌ Erro:', error);
      
      toast({
        title: "❌ Erro no teste",
        description: error instanceof Error ? error.message : "Erro na conexão com backend",
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
              src="/logo-rmh.ico"
              alt="RMH Logo"
              style={{ height: '40px', width: 'auto', marginBottom: '15px' }}
            />
          </div>
          <CardTitle className="text-2xl font-heading font-bold text-corporate-blue">
            Resende Mori Hutchison
          </CardTitle>
        </CardHeader>
        <CardContent className="-mt-3">
          {/* Bloco de teste (REMOVER EM PRODUÇÃO) */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700 mb-2">🧪 <strong>Teste Backend:</strong></p>
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
                  Testando...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Testar Email
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
            
            <div className="flex justify-end">
              <Button
                type="button"
                variant="link"
                onClick={onSwitchToForgotPassword}
                className="text-sm text-corporate-blue hover:text-primary-800 p-0 h-auto"
              >
                Esqueci minha senha
              </Button>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// RegisterView Component
interface RegisterViewProps {
  onBackToLogin: () => void;
  onEmailSent: (email: string) => void;
  onSwitchToVerification: (email: string) => void;
}

const RegisterView: React.FC<RegisterViewProps> = ({ 
  onBackToLogin, 
  onEmailSent, 
  onSwitchToVerification 
}) => {
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
    'Vendas', 'Financeiro', 'Marketing', 'Operações', 'RH', 'TI', 'Diretoria', 'Jurídico', 'Compras'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.senha !== formData.confirmSenha) {
      toast({
        title: "Senhas não coincidem",
        description: "Verifique se as senhas são idênticas",
        variant: "destructive"
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
      } else {
        // Versão antiga - enviar para email-sent
        toast({
          title: "📧 Cadastro realizado!",
          description: "Verifique seu email para ativar a conta",
        });
        onEmailSent(formData.email);
      }

    } catch (error) {
      toast({
        title: "❌ Erro no cadastro",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
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
            <UserPlus className="h-12 w-12 text-primary-600" />
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
              Já tem uma conta? Faça login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// EmailSentView Component
interface EmailSentViewProps {
  email: string;
  onBackToLogin: () => void;
}

const EmailSentView: React.FC<EmailSentViewProps> = ({ email, onBackToLogin }) => {
  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="flex items-center justify-center">
            <Mail className="h-12 w-12 text-green-600" />
          </div>
          <CardTitle className="text-2xl font-heading font-bold text-corporate-blue">
            Email Enviado!
          </CardTitle>
          <CardDescription className="text-corporate-gray">
            Enviamos instruções para <strong>{email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-sm text-corporate-gray space-y-2">
            <p>📧 Um email de ativação foi enviado para sua caixa de entrada.</p>
            <p>🔍 Não encontrou? Verifique sua caixa de spam.</p>
            <p>⏰ O link expira em 24 horas.</p>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-800 mb-2">📋 Próximos passos:</h4>
            <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
              <li>Abra o email que enviamos</li>
              <li>Clique no botão "Ativar Conta"</li>
              <li>Faça login com suas credenciais</li>
            </ol>
          </div>
          
          <Button
            onClick={onBackToLogin}
            variant="ghost"
            className="w-full"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

// ForgotPasswordView Component (placeholder)
interface ForgotPasswordViewProps {
  onBackToLogin: () => void;
}

const ForgotPasswordView: React.FC<ForgotPasswordViewProps> = ({ onBackToLogin }) => {
  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <CardTitle className="text-2xl font-heading font-bold text-corporate-blue">
            Em Breve
          </CardTitle>
          <CardDescription className="text-corporate-gray">
            Função de recuperação de senha será implementada em breve
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={onBackToLogin}
            variant="ghost"
            className="w-full"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthSystem;