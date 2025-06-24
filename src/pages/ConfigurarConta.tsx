// src/pages/ConfigurarConta.tsx - VERSÃO ALINHADA COM DESIGN RMH
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  LogIn,
  ArrowLeft
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const API_BASE_URL = process.env.REACT_APP_API_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://sistema.resendemh.com.br'
    : 'http://localhost:3001');

interface DadosUsuario {
  nome: string;
  email_login: string;
  tipo_colaborador: 'estagiario' | 'clt_associado';
}

const ConfigurarConta: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Estados principais
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);
  
  // Estados de controle
  const [loading, setLoading] = useState(false);
  const [validandoToken, setValidandoToken] = useState(true);
  const [tokenValido, setTokenValido] = useState(false);
  const [contaConfigurada, setContaConfigurada] = useState(false);
  const [dadosUsuario, setDadosUsuario] = useState<DadosUsuario | null>(null);

  // Validar token ao carregar a página
  useEffect(() => {
    if (!token) {
      toast({
        title: "Link inválido",
        description: "Token de configuração não encontrado na URL",
        variant: "destructive"
      });
      navigate('/');
      return;
    }

    validarToken();
  }, [token, navigate]);

  const validarToken = async () => {
    try {
      setValidandoToken(true);
      console.log(`🔍 Validando token: ${token.substring(0, 8)}...`);
      
      const response = await fetch(`${API_BASE_URL}/api/auth/validar-token-configuracao/${token}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Token válido:', data);
        setTokenValido(true);
        setDadosUsuario(data.usuario);
      } else {
        const error = await response.json();
        console.log('❌ Token inválido:', error);
        setTokenValido(false);
        toast({
          title: "Link expirado ou inválido",
          description: error.error || "Este link de configuração não é mais válido.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('❌ Erro ao validar token:', error);
      setTokenValido(false);
      toast({
        title: "Erro de conexão",
        description: "Não foi possível validar o link. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setValidandoToken(false);
    }
  };

  const validarSenha = (): string | null => {
    if (!senha || senha.length < 6) {
      return 'A senha deve ter pelo menos 6 caracteres';
    }
    
    if (senha !== confirmarSenha) {
      return 'As senhas não coincidem';
    }

    return null;
  };

  const configurarConta = async () => {
    const erroValidacao = validarSenha();
    if (erroValidacao) {
      toast({
        title: "Senha inválida",
        description: erroValidacao,
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      console.log(`🔑 Configurando conta com token: ${token.substring(0, 8)}...`);
      
      const response = await fetch(`${API_BASE_URL}/api/auth/configurar-conta/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ senha })
      });

      const data = await response.json();

      if (response.ok) {
        console.log('✅ Conta configurada com sucesso:', data);
        
        // Se receber token JWT, salvar para login automático
        if (data.token) {
          localStorage.setItem('authToken', data.token);
          localStorage.setItem('user', JSON.stringify(data.usuario));
        }
        
        setDadosUsuario(data.usuario);
        setContaConfigurada(true);
        
        toast({
          title: "✅ Conta configurada!",
          description: "Sua senha foi definida com sucesso. Redirecionando...",
          variant: "default"
        });

        // Redirecionar após sucesso
        setTimeout(() => {
          if (data.token) {
            // Se tem token, redirecionar para dashboard
            window.location.href = '/';
          } else {
            // Se não, redirecionar para login
            navigate('/', { 
              state: { 
                email: data.usuario?.email_login,
                message: 'Conta configurada com sucesso! Faça login com suas credenciais.' 
              } 
            });
          }
        }, 2000);

      } else {
        console.log('❌ Erro ao configurar conta:', data);
        throw new Error(data.error || 'Erro ao configurar conta');
      }
    } catch (error) {
      console.error('❌ Erro ao configurar conta:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível configurar sua conta",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    configurarConta();
  };

  // Loading inicial
  if (validandoToken) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-rmh-lightGreen" />
            <h2 className="text-lg font-semibold mb-2 text-gray-900">Validando link...</h2>
            <p className="text-gray-600">Aguarde enquanto verificamos seu link de configuração.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Token inválido
  if (!tokenValido) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Link Inválido</h2>
            <p className="text-gray-600 mb-6">
              Este link de configuração expirou ou não é válido. Entre em contato com o administrador para obter um novo link.
            </p>
            <Button 
              onClick={() => navigate('/')} 
              variant="outline"
              className="w-full border-white text-gray-700 hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Conta configurada com sucesso
  if (contaConfigurada) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Conta Configurada!</h2>
            <p className="text-gray-600 mb-4">
              Sua senha foi definida com sucesso, <strong>{dadosUsuario?.nome}</strong>!
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Redirecionando automaticamente para o sistema...
            </p>
            <Button 
              onClick={() => window.location.href = '/'} 
              className="w-full bg-rmh-lightGreen hover:bg-rmh-primary"
            >
              <LogIn className="h-4 w-4 mr-2" />
              Acessar Sistema
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Formulário de configuração
  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="text-center pb-6 bg-white rounded-t-lg">
          {/* Logo RMH */}
          <div className="flex justify-center mb-4">
            <img 
              src="/logo-rmh.png" 
              alt="RMH" 
              className="h-12 w-auto object-contain"
            />
          </div>
          
          <div className="mx-auto mb-4 p-3 bg-rmh-primary/10 rounded-full w-fit">
            <Lock className="h-6 w-6 text-rmh-primary" />
          </div>
          
          <CardTitle className="text-2xl font-bold text-rmh-primary mb-2">
            🔐 Configure sua Senha
          </CardTitle>
          
          <div className="space-y-2">
            <p className="text-gray-700">
              Olá, <strong className="text-rmh-primary">{dadosUsuario?.nome}</strong>!
            </p>
            <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-rmh-lightGreen text-white">
              {dadosUsuario?.tipo_colaborador === 'estagiario' ? '🎓 Estagiário' : '💼 CLT/Associado'}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 bg-white rounded-b-lg">
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Email de login - Destaque */}
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <p className="text-sm font-medium text-blue-800">
                  Seu email de login
                </p>
              </div>
              <p className="text-blue-700 font-mono text-sm mt-1 ml-4">
                {dadosUsuario?.email_login}
              </p>
            </div>

            {/* Campo de senha */}
            <div className="space-y-2">
              <Label htmlFor="senha" className="text-gray-700 font-medium">
                Nova Senha
              </Label>
              <div className="relative">
                <Input
                  id="senha"
                  type={mostrarSenha ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  className="pr-10 border-gray-300 focus:border-rmh-lightGreen focus:ring-rmh-lightGreen"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-gray-400 hover:text-gray-600"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                >
                  {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Campo de confirmar senha */}
            <div className="space-y-2">
              <Label htmlFor="confirmarSenha" className="text-gray-700 font-medium">
                Confirmar Senha
              </Label>
              <div className="relative">
                <Input
                  id="confirmarSenha"
                  type={mostrarConfirmarSenha ? 'text' : 'password'}
                  placeholder="Digite a senha novamente"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  required
                  className="pr-10 border-gray-300 focus:border-rmh-lightGreen focus:ring-rmh-lightGreen"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-gray-400 hover:text-gray-600"
                  onClick={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)}
                >
                  {mostrarConfirmarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Indicador de força da senha */}
            {senha && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Força da senha:</span>
                  <span className={senha.length >= 6 ? "text-green-600" : "text-red-600"}>
                    {senha.length >= 6 ? "✓ Válida" : "Muito curta"}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      senha.length >= 8 ? 'bg-green-500 w-full' :
                      senha.length >= 6 ? 'bg-yellow-500 w-3/4' :
                      senha.length >= 3 ? 'bg-red-500 w-1/2' : 'bg-red-400 w-1/4'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Validação de senhas */}
            {senha && confirmarSenha && senha !== confirmarSenha && (
              <div className="text-red-600 text-sm flex items-center space-x-1">
                <AlertCircle className="h-4 w-4" />
                <span>As senhas não coincidem</span>
              </div>
            )}

            {/* Botão de configurar */}
            <Button
              type="submit"
              className="w-full bg-rmh-lightGreen hover:bg-rmh-primary text-white font-medium py-3"
              disabled={loading || !senha || !confirmarSenha || senha !== confirmarSenha}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Configurando...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Configurar Senha
                </>
              )}
            </Button>
          </form>

          {/* Link para voltar */}
          <div className="text-center pt-6 border-t border-gray-100 mt-6">
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar ao login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfigurarConta;