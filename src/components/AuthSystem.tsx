import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, ArrowLeft } from 'lucide-react';
import EmailVerificationForm from '@/components/EmailVerificationForm';

// IMPORTANTE: Descomente estas linhas se ainda estão comentadas
import Login from './Login';
import Register from './Register';

// Types definition
interface User {
  id: string;
  nome: string;
  email: string;
  email_verificado: boolean;
}

type AuthView = 'login' | 'register' | 'forgot-password' | 'email-sent' | 'verification';
type TipoColaborador = 'estagiario' | 'clt_associado';

const AuthSystem = () => {
  const [currentView, setCurrentView] = useState<AuthView>('login');
  const [userEmail, setUserEmail] = useState('');
  const [tipoColaboradorPreSelecionado, setTipoColaboradorPreSelecionado] = useState<TipoColaborador>('clt_associado');

  // DEBUG: Log inicial
  console.log('🚀 AuthSystem: Componente renderizado, currentView:', currentView);

  const switchView = (view: AuthView, email?: string, tipo?: TipoColaborador) => {
    console.log('🔄 AuthSystem: Mudando para view:', view, 'Email:', email, 'Tipo:', tipo);
    setCurrentView(view);
    if (email) setUserEmail(email);
    if (tipo) setTipoColaboradorPreSelecionado(tipo);
  };

  const handleSwitchToRegister = (tipoPreSelecionado?: TipoColaborador) => {
    console.log('📝 AuthSystem: handleSwitchToRegister chamado com:', tipoPreSelecionado);
    console.log('📝 AuthSystem: Tipo da função:', typeof handleSwitchToRegister);
    switchView('register', undefined, tipoPreSelecionado || 'clt_associado');
  };

  // DEBUG: Log da função antes de passar para o Login
  console.log('🔧 AuthSystem: handleSwitchToRegister criado, tipo:', typeof handleSwitchToRegister);

  return (
    <>
      {currentView === 'login' && (
        <>
          {console.log('🔍 AuthSystem: Renderizando Login component')}
          <Login 
            onSwitchToRegister={handleSwitchToRegister}
            onSwitchToForgotPassword={() => switchView('forgot-password')}
            onSwitchToVerification={(email) => switchView('verification', email)}
          />
        </>
      )}
      {currentView === 'register' && (
        <Register 
          tipoPreSelecionado={tipoColaboradorPreSelecionado}
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
              <li>Digite o código de 6 dígitos</li>
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