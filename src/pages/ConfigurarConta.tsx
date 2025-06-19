// src/pages/ConfigurarConta.tsx - PÁGINA PARA CONFIGURAR SENHA
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Shield
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const API_BASE_URL = process.env.REACT_APP_API_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://rmh.up.railway.app'
    : 'http://localhost:3001');

const ConfigurarConta: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validandoToken, setValidandoToken] = useState(true);
  const [tokenValido, setTokenValido] = useState(false);
  const [contaConfigurada, setContaConfigurada] = useState(false);
  const [dadosUsuario, setDadosUsuario] = useState<{nome: string, email_login: string} | null>(null);

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
      
      // Verificar se o token é válido fazendo uma chamada para o backend
      const response = await fetch(`${API_BASE_URL}/api/auth/validar-token-configuracao/${token}`);
      
      if (response.ok) {
        const data = await response.json();
        setTokenValido(true);
        setDadosUsuario(data.usuario);
      } else {
        setTokenValido(false);
        toast({
          title: "Link expirado ou inválido",
          description: "Este link de configuração não é mais válido.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro ao validar token:', error);
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

    // Validações adicionais de força da senha
    if (!/(?=.*[a-z])/.test(senha)) {
      return 'A senha deve conter pelo menos uma letra minúscula';
    }
    
    if (!/(?=.*[A-Z])/.test(senha)) {
      return 'A senha deve conter pelo menos uma letra maiúscula';
    }
    
    if (!/(?=.*\d)/.test(senha)) {
      return 'A senha deve conter pelo menos um número';
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
      
      const response = await fetch(`${API_BASE_URL}/api/auth/configurar-conta/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ senha })
      });

      if (response.ok) {
        const data = await response.json();
        setDadosUsuario(data.usuario);
        setContaConfigurada(true);
        
        toast({
          title: "✅ Conta configurada!",
          description: "Sua senha foi definida com sucesso. Agora você pode fazer login.",
          variant: "default"
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao configurar conta');
      }
    } catch (error) {
      console.error('Erro ao configurar conta:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível configurar sua conta",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const irParaLogin = () => {
    navigate('/', { 
      state: { 
        email: dadosUsuario?.email_login,
        message: 'Conta configurada com sucesso! Faça login com suas credenciais.' 
      } 
    });
  };

  // Componente de força da senha
  const ForcaSenha = () => {
    const avaliarForca = () => {
      if (!senha) return { nivel: 0, texto: '', cor: '' };
      
      let pontos = 0;
      
      if (senha.length >= 6) pontos++;
      if (senha.length >= 8) pontos++;
      if (/(?=.*[a-z])/.test(senha)) pontos++;
      if (/(?=.*[A-Z])/.test(senha)) pontos++;
      if (/(?=.*\d)/.test(senha)) pontos++;
      if (/(?=.*[!@#$%^&*])/.test(senha)) pontos++;
      
      if (pontos <= 2) return { nivel: 1, texto: 'Fraca', cor: 'bg-red-500' };
      if (pontos <= 4) return { nivel: 2, texto: 'Média', cor: 'bg-yellow-500' };
      if (pontos <= 5) return { nivel: 3, texto: 'Forte', cor: 'bg-green-500' };
      return { nivel: 4, texto: 'Muito Forte', cor: 'bg-green-600' };
    };

    const forca = avaliarForca();
    const largura = (forca.nivel / 4) * 100;

    return (
      <div className="mt-2">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-gray-600">Força da senha:</span>
          <span className={`text-xs font-medium ${
            forca.nivel <= 2 ? 'text-red-600' : 
            forca.nivel === 3 ? 'text-yellow-600' : 'text-green-600'
          }`}>
            {forca.texto}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${forca.cor}`}
            style={{ width: `${largura}%` }}
          />
        </div>
      </div>
    );
  };

  // Loading inicial
  if (validandoToken) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <h2 className="text-lg font-semibold mb-2">Validando link...</h2>
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
            <Button onClick={() => navigate('/')} className="w-full">
              Voltar ao Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Conta já configurada - sucesso
  if (contaConfigurada && dadosUsuario) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardContent className="p-8 text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Conta Configurada!</h2>
              <p className="text-gray-600">
                Olá, <strong>{dadosUsuario.nome}</strong>! Sua conta foi configurada com sucesso.
              </p>
            </div>

            <Alert className="mb-6">
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <strong>Email de login:</strong> {dadosUsuario.email_login}
                <br />
                Use este email e a senha que você acabou de criar para acessar a plataforma.
              </AlertDescription>
            </Alert>

            <Button onClick={irParaLogin} className="w-full" size="lg">
              Fazer Login na Plataforma
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
}

export default ConfigurarConta;