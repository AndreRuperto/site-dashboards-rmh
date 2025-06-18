import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Users, ArrowLeft, Loader2 } from 'lucide-react';

// Types definition - alinhado com o projeto
type TipoColaborador = 'estagiario' | 'clt_associado';

// Interface compatível com o AuthSystem do projeto
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

// API Configuration - usar variável de ambiente se disponível
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

interface RegisterProps {
  tipoPreSelecionado?: TipoColaborador;
  onBackToLogin: () => void;
  onEmailSent: (data: RegistrationResult) => void;
  onSwitchToVerification: (email: string) => void;
}

const Register: React.FC<RegisterProps> = ({ 
  tipoPreSelecionado = 'clt_associado',
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
    tipo_colaborador: tipoPreSelecionado
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Setores específicos da RMH - mantidos conforme o contexto
  const setores = [
    'Carteira',
    'Atendimento',
    'Prazos',
    'Trabalhista',
    'Projetos',
    'Inicial',
    'Criminal',
    'Financeiro',
    'Saúde',
    'Comercial/Marketing',
    'Administrativo',
    'Família e Sucessões'
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
      // Limpar emails ao mudar tipo para evitar confusão
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

  // Função para capitalizar nomes corretamente (padrão português)
  const capitalizeText = (text: string): string => {
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
        nome: capitalizeText(formData.nome.trim()), // 🔧 Aplicar capitalize no nome
        setor: formData.setor.trim(), // Setor mantém como está (já vem do select)
        tipo_colaborador: formData.tipo_colaborador,
        senha: formData.senha,
        ...(formData.tipo_colaborador === 'estagiario' 
          ? { email_pessoal: formData.email_pessoal.trim().toLowerCase() } // 🔧 Email sempre minúsculo
          : { 
              email: formData.email.trim().toLowerCase(), // 🔧 Email sempre minúsculo
              email_pessoal: formData.email_pessoal.trim().toLowerCase() // 🔧 Email sempre minúsculo
            }
        )
      };

      console.log('📝 Register: Enviando payload:', { ...payload, senha: '[REDACTED]' });

      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data: RegistrationResult = await response.json();
      console.log('📧 Register: Resposta da API:', data);

      if (response.ok) {
        // Enriquecer dados para compatibilidade com AuthSystem
        const enrichedData: RegistrationResult = {
          ...data,
          nome: formData.nome,
          tipo_colaborador: formData.tipo_colaborador,
          email: formData.tipo_colaborador === 'clt_associado' ? formData.email : undefined,
          email_login: formData.tipo_colaborador === 'estagiario' ? formData.email_pessoal : formData.email,
          email_enviado_para: formData.tipo_colaborador === 'estagiario' ? formData.email_pessoal : formData.email
        };

        const emailForVerification = formData.tipo_colaborador === 'estagiario' 
          ? formData.email_pessoal 
          : formData.email;
        
        if (data.verification_required) {
          console.log('🔢 Register: Redirecionando para verificação');
          onSwitchToVerification(emailForVerification);
          toast({
            title: "📧 Cadastro realizado!",
            description: "Verifique seu email e digite o código de verificação",
            variant: "default",
          });
        } else {
          console.log('📋 Register: Enviando para próxima etapa');
          onEmailSent(enrichedData);
          toast({
            title: "📧 Cadastro realizado!",
            description: "Verifique seu email para ativar a conta",
          });
        }
      } else {
        console.error('❌ Register: Erro na resposta:', data);
        toast({
          title: "❌ Erro no cadastro",
          description: data.error || data.message || 'Erro no cadastro',
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('❌ Register: Erro de conexão:', error);
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
          <form onSubmit={handleSubmit} className="space-y-4">
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
                autoComplete="name"
              />
            </div>

            <div className="space-y-3">
              <Label>Tipo de Colaborador</Label>
              <RadioGroup
                value={formData.tipo_colaborador}
                onValueChange={handleTipoColaboradorChange}
                className="flex flex-col space-y-2"
              >
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                  <RadioGroupItem value="clt_associado" id="clt_associado" />
                  <Label htmlFor="clt_associado" className="flex items-center space-x-2 cursor-pointer flex-1">
                    <div>
                      <div className="font-medium">CLT/Associado</div>
                      <div className="text-sm text-gray-500">Login com email corporativo</div>
                    </div>
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                  <RadioGroupItem value="estagiario" id="estagiario" />
                  <Label htmlFor="estagiario" className="flex items-center space-x-2 cursor-pointer flex-1">
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
                  autoComplete="email"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email_pessoal">
                Email Pessoal
                {!isEstagiario && <span className="text-sm text-gray-500 ml-1">(para contracheque)</span>}
              </Label>
              <Input
                id="email_pessoal"
                name="email_pessoal"
                type="email"
                placeholder={isEstagiario ? 'seu.email@gmail.com' : 'email.pessoal@gmail.com'}
                value={formData.email_pessoal}
                onChange={handleInputChange}
                required
                autoComplete="email"
              />
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
                {setores.map(setor => (
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
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
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
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-rmh-lightGreen hover:bg-primary-800 transition-colors" 
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

            <div className="text-center">
              <Button
                type="button"
                onClick={onBackToLogin}
                variant="ghost"
                className="text-corporate-blue hover:text-primary-800 transition-colors"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Já tem uma conta? Faça login
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;