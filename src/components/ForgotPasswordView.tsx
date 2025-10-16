import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Mail, KeyRound, CheckCircle, AlertCircle, Loader2, Eye, EyeOff, Lock } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3002';

interface ForgotPasswordViewProps {
  onBackToLogin: () => void;
}

type ForgotPasswordStep = 'email' | 'code' | 'password' | 'success' | 'error';

const ForgotPasswordView: React.FC<ForgotPasswordViewProps> = ({ onBackToLogin }) => {
  const [currentStep, setCurrentStep] = useState<ForgotPasswordStep>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [resetToken, setResetToken] = useState('');

  // STEP 1: Solicitar código por email
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setErrorMessage('Por favor, insira seu email');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMessage('Por favor, insira um email válido');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      console.log('📧 Solicitando código para:', email);
      
      const response = await fetch(`${API_BASE_URL}/api/auth/request-reset-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: email.trim() })
      });

      const data = await response.json();

      if (response.ok) {
        console.log('✅ Código enviado com sucesso');
        setResetToken(data.token);
        setCurrentStep('code');
      } else {
        console.error('❌ Erro ao solicitar código:', data.error);
        setErrorMessage(data.error || 'Erro ao solicitar código');
      }

    } catch (error) {
      console.error('❌ Erro de conexão:', error);
      setErrorMessage('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // STEP 2: Verificar código de 6 dígitos
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!code.trim()) {
      setErrorMessage('Por favor, insira o código');
      return;
    }

    if (code.length !== 6) {
      setErrorMessage('O código deve ter 6 dígitos');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      console.log('🔍 Verificando código:', code);
      
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-reset-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          token: resetToken,
          code: code.trim()
        })
      });

      const data = await response.json();

      if (response.ok) {
        console.log('✅ Código verificado com sucesso');
        setCurrentStep('password');
      } else {
        console.error('❌ Código inválido:', data.error);
        setErrorMessage(data.error || 'Código inválido');
      }

    } catch (error) {
      console.error('❌ Erro de conexão:', error);
      setErrorMessage('Erro de conexão. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // STEP 3: Definir nova senha
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password.trim()) {
      setErrorMessage('Por favor, insira uma nova senha');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('As senhas não coincidem');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      console.log('Redefinindo senha');
      
      const response = await fetch(`${API_BASE_URL}/api/auth/reset-password-with-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          token: resetToken,
          newPassword: password.trim()
        })
      });

      const data = await response.json();

      if (response.ok) {
        console.log('✅ Senha redefinida com sucesso');
        setCurrentStep('success');
      } else {
        console.error('❌ Erro ao redefinir senha:', data.error);
        setErrorMessage(data.error || 'Erro ao redefinir senha');
      }

    } catch (error) {
      console.error('❌ Erro de conexão:', error);
      setErrorMessage('Erro de conexão. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = () => {
    setCurrentStep('email');
    setCode('');
    setErrorMessage('');
  };

  const handleBackToEmail = () => {
    setCurrentStep('email');
    setCode('');
    setErrorMessage('');
  };

  // STEP 1: Solicitar código
  if (currentStep === 'email') {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="flex items-center justify-center mb-2">
              <img 
                src="https://sistema.resendemh.com.br/logo-rmh.ico" 
                alt="RMH Logo" 
                className="h-10 w-auto"
              />
            </div>
            <CardTitle className="text-2xl font-heading font-bold text-corporate-blue">
              Esqueci minha senha
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Digite seu email para receber um código de verificação
            </CardDescription>
          </CardHeader>

          <CardContent className="-mt-3">
            <form onSubmit={handleRequestCode} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu.email@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 transition-all duration-200 focus:ring-2 focus:ring-primary-500"
                    disabled={isLoading}
                    autoFocus
                  />
                  <Mail className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
                </div>
              </div>

              {errorMessage && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    {errorMessage}
                  </AlertDescription>
                </Alert>
              )}

              <div className="pt-3">
                <Button
                  type="submit"
                  className="w-full bg-rmh-lightGreen hover:bg-primary-800 transition-colors duration-200"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando código...
                    </>
                  ) : (
                    'Enviar código'
                  )}
                </Button>
              </div>
            </form>

            <div className="mt-6 text-center">
              <Button
                variant="ghost"
                onClick={onBackToLogin}
                className="text-corporate-blue hover:text-primary-800 hover:bg-blue-50"
                disabled={isLoading}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // STEP 2: Verificar código
  if (currentStep === 'code') {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="flex items-center justify-center mb-2">
              <img 
                src="https://sistema.resendemh.com.br/logo-rmh.ico" 
                alt="RMH Logo" 
                className="h-10 w-auto"
              />
            </div>
            <CardTitle className="text-2xl font-heading font-bold text-corporate-blue">
              Verificar código
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Digite o código de 6 dígitos enviado para<br />
              <span className="font-medium text-corporate-blue">{email}</span>
            </CardDescription>
          </CardHeader>

          <CardContent className="-mt-3">
            <form onSubmit={handleVerifyCode} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="code">Código de verificação</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 6) {
                      setCode(value);
                    }
                  }}
                  className="text-center text-xl tracking-widest transition-all duration-200 focus:ring-2 focus:ring-primary-500"
                  disabled={isLoading}
                  autoFocus
                  maxLength={6}
                />
                <p className="text-sm text-muted-foreground text-center">
                  Digite o código de 6 dígitos enviado por email
                </p>
              </div>

              {errorMessage && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    {errorMessage}
                  </AlertDescription>
                </Alert>
              )}

              <div className="pt-3">
                <Button
                  type="submit"
                  className="w-full bg-rmh-lightGreen hover:bg-primary-800 transition-colors duration-200"
                  disabled={isLoading || code.length !== 6}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    'Verificar Código'
                  )}
                </Button>
              </div>
            </form>

            <div className="mt-6 space-y-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Não recebeu o código?
                  </span>
                </div>
              </div>
              <div className="text-center">
                <Button
                  variant="outline"
                  onClick={handleResendCode}
                  className="border-corporate-blue text-corporate-blue hover:bg-blue-50"
                  disabled={isLoading}
                >
                  Reenviar Código
                </Button>
              </div>

              <div className="text-center">
                <Button
                  variant="ghost"
                  onClick={handleBackToEmail}
                  className="text-corporate-blue hover:text-primary-800 hover:bg-blue-50"
                  disabled={isLoading}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar ao Login
                </Button>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <strong>Dica:</strong> Verifique também sua caixa de spam se não encontrar o email.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // STEP 3: Nova senha
  if (currentStep === 'password') {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="flex items-center justify-center mb-2">
              <img 
                src="https://sistema.resendemh.com.br/logo-rmh.ico" 
                alt="RMH Logo" 
                className="h-10 w-auto"
              />
            </div>
            <CardTitle className="text-2xl font-heading font-bold text-corporate-blue">
              Nova senha
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Defina uma nova senha para sua conta
            </CardDescription>
          </CardHeader>

          <CardContent className="-mt-3">
            <form onSubmit={handleResetPassword} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="password">Nova senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="transition-all duration-200 focus:ring-2 focus:ring-primary-500 pr-10"
                    disabled={isLoading}
                    autoFocus
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

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Digite a senha novamente"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="transition-all duration-200 focus:ring-2 focus:ring-primary-500 pr-10"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {password && (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Força da senha:</div>
                  <div className="flex space-x-1">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className={`h-2 flex-1 rounded ${
                          password.length > i * 2 + 2
                            ? password.length < 8
                              ? 'bg-yellow-400'
                              : password.length < 12
                              ? 'bg-green-400'
                              : 'bg-green-600'
                            : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {password.length < 6 && 'Muito fraca'}
                    {password.length >= 6 && password.length < 8 && 'Fraca'}
                    {password.length >= 8 && password.length < 12 && 'Boa'}
                    {password.length >= 12 && 'Forte'}
                  </div>
                </div>
              )}

              {errorMessage && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    {errorMessage}
                  </AlertDescription>
                </Alert>
              )}

              <div className="pt-3">
                <Button
                  type="submit"
                  className="w-full bg-rmh-lightGreen hover:bg-primary-800 transition-colors duration-200"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Alterando senha...
                    </>
                  ) : (
                    'Alterar senha'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // STEP 4: Sucesso
  if (currentStep === 'success') {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="flex items-center justify-center mb-2">
              <img 
                src="https://sistema.resendemh.com.br/logo-rmh.ico" 
                alt="RMH Logo" 
                className="h-10 w-auto"
              />
            </div>
            <CardTitle className="text-2xl font-heading font-bold text-corporate-blue">
              Senha alterada!
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Sua senha foi redefinida com sucesso
            </CardDescription>
          </CardHeader>

          <CardContent className="-mt-3">
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
                  <div className="text-sm text-green-800">
                    <p className="font-medium mb-1">Tudo pronto!</p>
                    <p>Agora você pode fazer login com sua nova senha.</p>
                  </div>
                </div>
              </div>

              <div className="pt-3">
                <Button
                  onClick={onBackToLogin}
                  className="w-full bg-rmh-lightGreen hover:bg-primary-800 transition-colors duration-200"
                >
                  Ir para o login
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
};

export default ForgotPasswordView;