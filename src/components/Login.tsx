import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff, UserPlus, Building, Users, Mail } from 'lucide-react';

// API Configuration
const API_BASE_URL = 'http://localhost:3001';

interface LoginProps {
  onSwitchToRegister: (tipoPreSelecionado?: 'estagiario' | 'clt_associado') => void;
  onSwitchToForgotPassword: () => void;
  onSwitchToVerification: (email: string) => void;
}

const Login: React.FC<LoginProps> = ({ 
  onSwitchToRegister, 
  onSwitchToForgotPassword, 
  onSwitchToVerification 
}) => {
  console.log('🔍 Login: Props recebidas:');
  console.log('   onSwitchToRegister:', typeof onSwitchToRegister, onSwitchToRegister);
  console.log('   onSwitchToForgotPassword:', typeof onSwitchToForgotPassword);
  console.log('   onSwitchToVerification:', typeof onSwitchToVerification);
  const [formData, setFormData] = useState({
    email: '',
    senha: ''
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const detectEmailType = (email: string) => {
    if (email.endsWith('@resendemh.com.br')) {
      return 'corporativo';
    }
    return 'pessoal';
  };

  const performLogin = async (email: string, senha: string) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, senha })
    });

    const data = await response.json();

    if (response.ok) {
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      toast({
        title: "Login realizado!",
        description: "Redirecionando para dashboard...",
      });
      
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
      
      return true;
    } else {
      throw new Error(data.error || 'Erro no login');
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!formData.email.trim() || !formData.senha.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Email e senha são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      await performLogin(formData.email, formData.senha);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Email não verificado')) {
        onSwitchToVerification(formData.email);
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
    } finally {
      setIsLoading(false);
    }
  };

  // Versão simplificada das funções de cadastro - CORRIGIDA
  const handleCadastro = (tipo?: string) => {
    try {
      console.log('🎯 Tentando abrir cadastro, tipo:', tipo);
      
      if (typeof onSwitchToRegister === 'function') {
        if (tipo === 'clt') {
          console.log('🏢 Chamando onSwitchToRegister com clt_associado');
          onSwitchToRegister('clt_associado');
        } else if (tipo === 'estagiario') {
          console.log('👨‍🎓 Chamando onSwitchToRegister com estagiario');
          onSwitchToRegister('estagiario');
        } else {
          console.log('🔄 Chamando onSwitchToRegister sem parâmetro');
          onSwitchToRegister();
        }
      } else {
        console.error('❌ onSwitchToRegister não é uma função:', typeof onSwitchToRegister);
      }
    } catch (error) {
      console.error('❌ Erro ao chamar cadastro:', error);
    }
  };

  // Funções específicas para cada botão
  const handleCadastroGeneral = () => {
    console.log('🔄 Abrindo cadastro geral');
    handleCadastro();
  };

  const handleCadastroCLT = () => {
    console.log('🏢 Abrindo cadastro CLT/Associado');
    handleCadastro('clt');
  };

  const handleCadastroEstagiario = () => {
    console.log('👨‍🎓 Abrindo cadastro Estagiário');
    handleCadastro('estagiario');
  };

  const emailType = detectEmailType(formData.email);

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="flex items-center justify-center">
            <div className="text-4xl font-bold text-corporate-blue">RMH</div>
          </div>
          <CardTitle className="text-2xl font-heading font-bold text-corporate-blue">
            Resende Mori Hutchison
          </CardTitle>
        </CardHeader>
        
        <CardContent className="-mt-3">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="seu.email@exemplo.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="pl-10 transition-all duration-200 focus:ring-2 focus:ring-primary-500"
                />
                <Mail className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
              </div>
              
              {formData.email && (
                <div className="flex items-center space-x-2 text-sm">
                  {emailType === 'corporativo' ? (
                    <>
                      <Building className="h-4 w-4 text-blue-600" />
                      <span className="text-blue-600 font-medium">Email Corporativo (CLT/Associado)</span>
                    </>
                  ) : (
                    <>
                      <Users className="h-4 w-4 text-green-600" />
                      <span className="text-green-600 font-medium">Email Pessoal (Estagiário)</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <div className="relative">
                <Input
                  id="senha"
                  name="senha"
                  type={showPassword ? "text" : "password"}
                  placeholder="Digite sua senha"
                  value={formData.senha}
                  onChange={handleInputChange}
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
                type="button"
                className="w-full bg-rmh-lightGreen hover:bg-primary-800 transition-colors duration-200"
                disabled={isLoading}
                onClick={handleSubmit}
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
          </div>
          
          <div className="mt-6 space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Não tem conta?
                </span>
              </div>
            </div>
            <div className="text-center">
              <Button
                onClick={() => handleCadastro()}
                variant="ghost"
                className="text-corporate-blue hover:text-primary-800 hover:bg-blue-50"
                type="button"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Criar nova conta
              </Button>
            </div>
          </div>

          <div className="text-center text-sm text-gray-600 mt-4">
            <p>💡 <strong>Dica:</strong></p>
            <p className="text-xs">
              • <strong>CLT/Associado:</strong> Use seu email corporativo (@resendemh.com.br)<br/>
              • <strong>Estagiário:</strong> Use seu email pessoal cadastrado
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;