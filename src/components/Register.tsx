import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Users, Building, Mail, ArrowLeft, Loader2 } from 'lucide-react';

// Types definition
type TipoColaborador = 'estagiario' | 'clt_associado';

// API Configuration
const API_BASE_URL = 'http://localhost:3001'; // Adjust for production

interface RegisterProps {
  onBackToLogin: () => void;
  onEmailSent: (email: string) => void;
  onSwitchToVerification: (email: string) => void;
}

const Register: React.FC<RegisterProps> = ({ 
  onBackToLogin, 
  onEmailSent, 
  onSwitchToVerification 
}) => {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    email_pessoal: '',
    senha: '',
    confirmarSenha: '',
    setor: '',
    tipo_colaborador: 'clt_associado' as TipoColaborador
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const setors = [
    'Vendas', 'Financeiro', 'Marketing', 'Operações', 'RH', 'TI', 'Diretoria', 'Jurídico', 'Compras'
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleTipoColaboradorChange = (value: TipoColaborador) => {
    setFormData(prev => ({
      ...prev,
      tipo_colaborador: value,
      // Limpar emails ao mudar tipo
      email: value === 'estagiario' ? '' : prev.email,
      email_pessoal: value === 'clt_associado' ? '' : prev.email_pessoal
    }));
  };

  const validateForm = () => {
    if (!formData.nome.trim()) {
      return 'Nome é obrigatório';
    }

    if (formData.tipo_colaborador === 'estagiario') {
      if (!formData.email_pessoal.trim()) {
        return 'Email pessoal é obrigatório para estagiários';
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email_pessoal)) {
        return 'Email pessoal deve ter formato válido';
      }
    } else {
      if (!formData.email.trim()) {
        return 'Email corporativo é obrigatório para CLT/Associado';
      }
      if (!formData.email.endsWith('@resendemh.com.br')) {
        return 'Email corporativo deve terminar com @resendemh.com.br';
      }
      if (!formData.email_pessoal.trim()) {
        return 'Email pessoal é obrigatório para envio do contracheque';
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email_pessoal)) {
        return 'Email pessoal deve ter formato válido';
      }
    }

    if (!formData.setor.trim()) {
      return 'Setor é obrigatório';
    }

    if (formData.senha.length < 6) {
      return 'Senha deve ter pelo menos 6 caracteres';
    }

    if (formData.senha !== formData.confirmarSenha) {
      return 'Senhas não coincidem';
    }

    return null;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      toast({
        title: "Erro de validação",
        description: validationError,
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        nome: formData.nome.trim(),
        setor: formData.setor.trim(),
        tipo_colaborador: formData.tipo_colaborador,
        senha: formData.senha,
        ...(formData.tipo_colaborador === 'estagiario' 
          ? { email_pessoal: formData.email_pessoal.trim() }
          : { 
              email: formData.email.trim(),
              email_pessoal: formData.email_pessoal.trim()
            }
        )
      };

      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        // Redirecionar para verificação com email apropriado
        const emailForVerification = formData.tipo_colaborador === 'estagiario' 
          ? formData.email_pessoal 
          : formData.email;
        
        if (data.verification_required) {
          onSwitchToVerification(emailForVerification);
          toast({
            title: "📧 Cadastro realizado!",
            description: "Verifique seu email e digite o código de verificação",
            variant: "default",
          });
        } else {
          onEmailSent(emailForVerification);
          toast({
            title: "📧 Cadastro realizado!",
            description: "Verifique seu email para ativar a conta",
          });
        }
      } else {
        toast({
          title: "❌ Erro no cadastro",
          description: data.error || 'Erro no cadastro',
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro no cadastro:', error);
      toast({
        title: "❌ Erro de conexão",
        description: "Erro de conexão. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isEstagiario = formData.tipo_colaborador === 'estagiario';

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="flex items-center justify-center">
            <Users className="h-12 w-12 text-primary-600" />
          </div>
          <CardTitle className="text-2xl font-heading font-bold text-corporate-blue">
            Criar Conta
          </CardTitle>
          <CardDescription className="text-center">
            Cadastre-se na plataforma de dashboards RMH
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo</Label>
              <Input
                id="nome"
                name="nome"
                type="text"
                placeholder="Seu nome completo"
                value={formData.nome}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="space-y-3">
              <Label>Tipo de Colaborador</Label>
              <RadioGroup
                value={formData.tipo_colaborador}
                onValueChange={handleTipoColaboradorChange}
                className="flex flex-col space-y-2"
              >
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50">
                  <RadioGroupItem value="clt_associado" id="clt_associado" />
                  <Label htmlFor="clt_associado" className="flex items-center space-x-2 cursor-pointer flex-1">
                    <Building className="h-4 w-4 text-blue-600" />
                    <div>
                      <div className="font-medium">CLT/Associado</div>
                      <div className="text-sm text-gray-500">Login com email corporativo</div>
                    </div>
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50">
                  <RadioGroupItem value="estagiario" id="estagiario" />
                  <Label htmlFor="estagiario" className="flex items-center space-x-2 cursor-pointer flex-1">
                    <Users className="h-4 w-4 text-green-600" />
                    <div>
                      <div className="font-medium">Estagiário</div>
                      <div className="text-sm text-gray-500">Login com email pessoal</div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {!isEstagiario && (
              <div className="space-y-2">
                <Label htmlFor="email">Email Corporativo</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="seu.nome@resendemh.com.br"
                  value={formData.email}
                  onChange={handleInputChange}
                  required={!isEstagiario}
                />
                <p className="text-xs text-gray-500">
                  <Mail className="h-3 w-3 inline mr-1" />
                  Usado para login e comunicação corporativa
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email_pessoal">
                {isEstagiario ? 'Email Pessoal (Login)' : 'Email Pessoal'}
              </Label>
              <Input
                id="email_pessoal"
                name="email_pessoal"
                type="email"
                placeholder={isEstagiario ? 'seu.email@gmail.com' : 'email.pessoal@gmail.com'}
                value={formData.email_pessoal}
                onChange={handleInputChange}
                required
              />
              <p className="text-xs text-gray-500">
                <Mail className="h-3 w-3 inline mr-1" />
                {isEstagiario 
                  ? 'Usado para login e comunicação'
                  : 'Usado para envio do contracheque'
                }
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="setor">Setor</Label>
              <select
                id="setor"
                name="setor"
                value={formData.setor}
                onChange={handleInputChange}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Selecione o setor</option>
                {setors.map(setor => (
                  <option key={setor} value={setor}>{setor}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <div className="relative">
                <Input
                  id="senha"
                  name="senha"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={formData.senha}
                  onChange={handleInputChange}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmarSenha">Confirmar Senha</Label>
              <div className="relative">
                <Input
                  id="confirmarSenha"
                  name="confirmarSenha"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Digite a senha novamente"
                  value={formData.confirmarSenha}
                  onChange={handleInputChange}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Button 
              type="button" 
              className="w-full bg-rmh-lightGreen hover:bg-primary-800" 
              disabled={isLoading}
              onClick={handleSubmit}
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

            <div className="text-center">
              <Button
                onClick={onBackToLogin}
                variant="ghost"
                className="text-corporate-blue hover:text-primary-800"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Já tem uma conta? Faça login
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;