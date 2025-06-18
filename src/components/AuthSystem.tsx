import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, ArrowLeft, Clock, CheckCircle } from 'lucide-react';
import EmailVerificationForm from '@/components/EmailVerificationForm';

// IMPORTANTE: Importar tipos centralizados
import { User, TipoColaborador } from '@/types';

// IMPORTANTE: Descomente estas linhas se ainda estão comentadas
import Login from './Login';
import Register from './Register';

// Tipos específicos para o AuthSystem - UNIFICADOS
interface RegistrationResult {
  success?: boolean;
  message?: string;
  error?: string;
  verification_required?: boolean;
  awaiting_admin_approval?: boolean;
  email_enviado_para?: string;
  email_login?: string;
  email?: string;
  nome?: string;
  tipo_colaborador?: TipoColaborador;
  email_enviado?: boolean;
  info?: string;
  user_id?: string;
}

type AuthView = 'login' | 'register' | 'forgot-password' | 'email-sent' | 'verification' | 'awaiting-approval';

const AuthSystem = () => {
  // 🔧 CORREÇÃO: Estado inicial sempre deve ser 'login'
  const [currentView, setCurrentView] = useState<AuthView>('login');
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [tipoColaboradorPreSelecionado, setTipoColaboradorPreSelecionado] = useState<TipoColaborador>('clt_associado');

  // DEBUG: Log inicial para verificar estado
  console.log('🚀 AuthSystem: Componente renderizado, currentView inicial:', currentView);

  const switchView = (view: AuthView, email?: string, nome?: string, tipo?: TipoColaborador) => {
    console.log('🔄 AuthSystem: Mudando de', currentView, 'para:', view, 'Email:', email, 'Nome:', nome, 'Tipo:', tipo);
    setCurrentView(view);
    if (email) setUserEmail(email);
    if (nome) setUserName(nome);
    if (tipo) setTipoColaboradorPreSelecionado(tipo);
  };

  const handleSwitchToRegister = (tipoPreSelecionado?: TipoColaborador) => {
    console.log('📝 AuthSystem: handleSwitchToRegister chamado com:', tipoPreSelecionado);
    switchView('register', undefined, undefined, tipoPreSelecionado || 'clt_associado');
  };

  // 🔧 NOVA FUNÇÃO: Lidar com diferentes resultados de registro
  const handleRegistrationResult = (data: RegistrationResult) => {
    console.log('📝 AuthSystem: Resultado do registro:', data);
    
    if (data.awaiting_admin_approval) {
      // Estagiário - aguardando aprovação
      switchView('awaiting-approval', data.email_login || data.email || userEmail, data.nome || userName, data.tipo_colaborador);
    } else if (data.verification_required) {
      // CLT - email enviado, precisa verificar
      switchView('email-sent', data.email_enviado_para || data.email || userEmail, data.nome || userName, data.tipo_colaborador);
    } else {
      // Fallback - voltar ao login
      switchView('login');
    }
  };

  // 🔧 DEBUG: Log toda vez que o currentView mudar
  React.useEffect(() => {
    console.log('🔄 AuthSystem: currentView mudou para:', currentView);
  }, [currentView]);

  return (
    <>
      {currentView === 'login' && (
        <>
          {console.log('🔑 AuthSystem: Renderizando componente Login')}
          <Login 
            onSwitchToRegister={handleSwitchToRegister}
            onSwitchToForgotPassword={() => switchView('forgot-password')}
            onSwitchToVerification={(email) => switchView('verification', email)}
          />
        </>
      )}
      
      {currentView === 'register' && (
        <>
          {console.log('📝 AuthSystem: Renderizando componente Register')}
          <Register 
            tipoPreSelecionado={tipoColaboradorPreSelecionado}
            onBackToLogin={() => switchView('login')}
            onEmailSent={handleRegistrationResult}
            onSwitchToVerification={(email) => switchView('verification', email)}
          />
        </>
      )}
      
      {currentView === 'email-sent' && (
        <>
          {console.log('📧 AuthSystem: Renderizando EmailSentView')}
          <EmailSentView 
            email={userEmail}
            userName={userName}
            tipoColaborador={tipoColaboradorPreSelecionado}
            onBackToLogin={() => switchView('login')}
            onSwitchToVerification={() => switchView('verification', userEmail)}
          />
        </>
      )}
      
      {currentView === 'awaiting-approval' && (
        <>
          {console.log('⏳ AuthSystem: Renderizando AwaitingApprovalView')}
          <AwaitingApprovalView 
            email={userEmail}
            userName={userName}
            onBackToLogin={() => switchView('login')}
          />
        </>
      )}
      
      {currentView === 'verification' && (
        <>
          {console.log('🔢 AuthSystem: Renderizando EmailVerificationForm')}
          <EmailVerificationForm
            email={userEmail}
            onVerificationSuccess={(token: string, userData: User) => {
              console.log('✅ AuthSystem: Verificação bem-sucedida:', userData);
              localStorage.setItem('authToken', token);
              localStorage.setItem('user', JSON.stringify(userData));
              window.location.reload();
            }}
            onBackToLogin={() => switchView('login')}
          />
        </>
      )}
      
      {currentView === 'forgot-password' && (
        <>
          {console.log('🔐 AuthSystem: Renderizando ForgotPasswordView')}
          <ForgotPasswordView 
            onBackToLogin={() => switchView('login')}
          />
        </>
      )}
    </>
  );
};

// EmailSentView Component - Atualizado
interface EmailSentViewProps {
  email: string;
  userName?: string;
  tipoColaborador?: TipoColaborador;
  onBackToLogin: () => void;
  onSwitchToVerification: () => void;
}

const EmailSentView: React.FC<EmailSentViewProps> = ({ 
  email, 
  userName, 
  tipoColaborador,
  onBackToLogin,
  onSwitchToVerification 
}) => {
  // Função para capitalizar nomes corretamente (padrão português)
  const capitalizeText = (text: string): string => {
    if (!text) return '';
    
    // Preposições e artigos que devem ficar em minúsculo
    const exceptions = ['da', 'de', 'do', 'das', 'dos', 'e', 'di', 'del', 'della', 'von', 'van', 'du'];
    
    return text
      .trim()
      .split(' ')
      .filter(word => word.length > 0) // Remove espaços extras
      .map((word, index) => {
        const lowerWord = word.toLowerCase();
        
        // Primeira palavra sempre maiúscula, mesmo que seja preposição
        if (index === 0) {
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }
        
        // Preposições e artigos ficam em minúsculo
        if (exceptions.includes(lowerWord)) {
          return lowerWord;
        }
        
        // Demais palavras com primeira letra maiúscula
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  };

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
            {userName && <p className="mb-2">Olá, <strong>{capitalizeText(userName)}</strong>!</p>}
            Enviamos instruções para <strong>{email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-sm text-corporate-gray space-y-2">
            <p>📧 Um email de ativação foi enviado para sua caixa de entrada.</p>
            <p>🔍 Não encontrou? Verifique sua caixa de spam.</p>
            <p>⏰ O código expira em 24 horas.</p>
          </div>
          
          {tipoColaborador && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <CheckCircle className="h-4 w-4 text-blue-600 mr-2" />
                <span className="text-sm font-medium text-blue-800">
                  {tipoColaborador === 'clt_associado' ? 'CLT/Associado' : 'Estagiário'}
                </span>
              </div>
              <h4 className="font-semibold text-blue-800 mb-2">📋 Próximos passos:</h4>
              <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                <li>Abra o email que enviamos</li>
                <li>Digite o código de 6 dígitos</li>
                <li>Faça login com suas credenciais</li>
              </ol>
            </div>
          )}
          
          <div className="flex flex-col space-y-2">
            <Button
              onClick={onSwitchToVerification}
              className="w-full"
            >
              Já tenho o código
            </Button>
            
            <Button
              onClick={onBackToLogin}
              variant="ghost"
              className="w-full"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// 🆕 NOVO COMPONENTE: AwaitingApprovalView
interface AwaitingApprovalViewProps {
  email: string;
  userName?: string;
  onBackToLogin: () => void;
}

const AwaitingApprovalView: React.FC<AwaitingApprovalViewProps> = ({ 
  email, 
  userName, 
  onBackToLogin 
}) => {
  // Função para capitalizar nomes corretamente (padrão português)
  const capitalizeText = (text: string): string => {
    if (!text) return '';
    
    // Preposições e artigos que devem ficar em minúsculo
    const exceptions = ['da', 'de', 'do', 'das', 'dos', 'e', 'di', 'del', 'della', 'von', 'van', 'du'];
    
    return text
      .trim()
      .split(' ')
      .filter(word => word.length > 0) // Remove espaços extras
      .map((word, index) => {
        const lowerWord = word.toLowerCase();
        
        // Primeira palavra sempre maiúscula, mesmo que seja preposição
        if (index === 0) {
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }
        
        // Preposições e artigos ficam em minúsculo
        if (exceptions.includes(lowerWord)) {
          return lowerWord;
        }
        
        // Demais palavras com primeira letra maiúscula
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  };

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="flex items-center justify-center">
            <Clock className="h-12 w-12 text-yellow-600" />
          </div>
          <CardTitle className="text-2xl font-heading font-bold text-corporate-blue">
            Aguardando Aprovação
          </CardTitle>
          <CardDescription className="text-corporate-gray">
            {userName && <p className="mb-2">Olá, <strong>{capitalizeText(userName)}</strong>!</p>}
            Seu cadastro foi realizado com <strong>{email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <Clock className="h-4 w-4 text-yellow-600 mr-2" />
              <span className="text-sm font-medium text-yellow-800">
                Estagiário
              </span>
            </div>
            <h4 className="font-semibold text-yellow-800 mb-2">📋 O que acontece agora:</h4>
            <ol className="text-sm text-yellow-700 space-y-1 list-decimal list-inside">
              <li>Um administrador irá revisar seu cadastro</li>
              <li>Você receberá um email quando for aprovado</li>
              <li>Então poderá fazer login normalmente</li>
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

// ForgotPasswordView Component
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