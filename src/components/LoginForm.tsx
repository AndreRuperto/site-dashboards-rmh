import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff, UserPlus, Building, Users, Mail } from 'lucide-react';

// API Configuration
const API_BASE_URL = 'http://localhost:3001'; // Adjust for production

interface LoginProps {
  onSwitchToRegister: () => void;
  onSwitchToForgotPassword: () => void;
  onSwitchToVerification: (email: string) => void;
}

const Login: React.FC<LoginProps> = ({ 
  onSwitchToRegister, 
  onSwitchToForgotPassword, 
  onSwitchToVerification 
}) => {
  const [formData, setFormData] = useState({
    email: '',
    senha: ''
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading } = useAuth();
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

    try {
      const success = await login(formData.email, formData.senha);
      if (!success) {
        toast({
          title: "Erro no login",
          description: "Email ou senha incorretos",
          variant: "destructive",
        });
      }
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
    }
  };

  const emailType = detectEmailType(formData.email);

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
          <CardDescription className="text-center">
            Acesse a plataforma de dashboards
          </CardDescription>
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

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onSwitchToRegister}
                className="flex items-center space-x-2"
              >
                <Building className="h-4 w-4" />
                <span>CLT/Associado</span>
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={onSwitchToRegister}
                className="flex items-center space-x-2"
              >
                <Users className="h-4 w-4" />
                <span>Estagiário</span>
              </Button>
            </div>

            <div className="text-center">
              <Button
                onClick={onSwitchToRegister}
                variant="ghost"
                className="text-corporate-blue hover:text-primary-800"
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