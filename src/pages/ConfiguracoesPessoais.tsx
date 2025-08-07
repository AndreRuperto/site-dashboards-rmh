// src/pages/ConfiguracoesPessoais.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/Header';
import { 
 Eye, 
 EyeOff, 
 Save,
 AlertCircle, 
 Loader2,
 UserCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3002';

interface FormularioDados {
 nome: string;
}

interface FormularioSenha {
 senhaAtual: string;
 novaSenha: string;
 confirmarSenha: string;
}

const ConfiguracoesPessoais: React.FC = () => {
 const navigate = useNavigate();
 const { user } = useAuth();
 const { toast } = useToast();

 // Estados dos formulários
 const [dadosForm, setDadosForm] = useState<FormularioDados>({
   nome: ''
 });

 const [senhaForm, setSenhaForm] = useState<FormularioSenha>({
   senhaAtual: '',
   novaSenha: '',
   confirmarSenha: ''
 });

 // Estados de controle
 const [carregandoDados, setCarregandoDados] = useState(false);
 const [mostrarSenhas, setMostrarSenhas] = useState({
   atual: false,
   nova: false,
   confirmar: false
 });

 // Carregar dados do usuário
 useEffect(() => {
   if (user) {
     console.log('👤 Dados do usuário:', user);
     
     setDadosForm({
       nome: user.nome || ''
     });
   }
 }, [user]);

 // Função para obter token de autenticação
 const getAuthToken = () => localStorage.getItem("authToken");

 // Função para fazer requisições autenticadas
 const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
   const token = getAuthToken();
   if (!token) throw new Error("Token não encontrado");

   const response = await fetch(url, {
     ...options,
     headers: {
       Authorization: `Bearer ${token}`,
       "Content-Type": "application/json",
       ...options.headers,
     },
   });

   if (response.status === 401) {
     localStorage.removeItem("authToken");
     localStorage.removeItem("user");
     window.location.href = "/";
     throw new Error("Sessão expirada");
   }

   return response;
 };

 // Validar senha
 const validarSenha = (): string | null => {
   if (!senhaForm.senhaAtual) {
     return 'Digite sua senha atual';
   }
   
   if (!senhaForm.novaSenha || senhaForm.novaSenha.length < 6) {
     return 'A nova senha deve ter pelo menos 6 caracteres';
   }
   
   if (senhaForm.novaSenha !== senhaForm.confirmarSenha) {
     return 'As senhas não coincidem';
   }

   return null;
 };

 // ✅ ATUALIZAR DADOS E SENHA (UNIFICADO)
 const atualizarDados = async () => {
   try {
     setCarregandoDados(true);

     // ✅ Dados pessoais para enviar
     const dadosParaEnviar = {
       nome: dadosForm.nome
     };

     console.log('📝 Enviando dados:', dadosParaEnviar);

     // ✅ 1. ATUALIZAR DADOS PESSOAIS
     const response = await fetchWithAuth(`${API_BASE_URL}/api/usuario/atualizar-dados`, {
       method: 'PUT',
       body: JSON.stringify(dadosParaEnviar)
     });

     if (!response.ok) {
       const error = await response.json();
       throw new Error(error.error || 'Erro ao atualizar dados');
     }

     // ✅ 2. ATUALIZAR SENHA (SE PREENCHIDA)
     if (senhaForm.senhaAtual && senhaForm.novaSenha) {
       const erroValidacao = validarSenha();
       if (erroValidacao) {
         throw new Error(erroValidacao);
       }

       const senhaResponse = await fetchWithAuth(`${API_BASE_URL}/api/usuario/alterar-senha`, {
         method: 'POST',
         body: JSON.stringify({
           senhaAtual: senhaForm.senhaAtual,
           novaSenha: senhaForm.novaSenha
         })
       });

       if (!senhaResponse.ok) {
         const error = await senhaResponse.json();
         throw new Error(error.error || 'Erro ao alterar senha');
       }

       // ✅ Limpar campos de senha após sucesso
       setSenhaForm({
         senhaAtual: '',
         novaSenha: '',
         confirmarSenha: ''
       });
     }

     // ✅ 3. ATUALIZAR LOCALSTORAGE
     const usuarioAtualizado = { ...user, ...dadosParaEnviar };
     localStorage.setItem('user', JSON.stringify(usuarioAtualizado));

     // ✅ 4. FEEDBACK DE SUCESSO
     const mensagemSucesso = senhaForm.senhaAtual && senhaForm.novaSenha 
       ? "Dados e senha atualizados com sucesso!" 
       : "Dados atualizados com sucesso!";

     toast({
       title: "✅ Sucesso!",
       description: mensagemSucesso,
     });

   } catch (error) {
     console.error('Erro ao atualizar:', error);
     toast({
       title: "Erro ao salvar",
       description: error instanceof Error ? error.message : "Não foi possível atualizar os dados",
       variant: "destructive"
     });
   } finally {
     setCarregandoDados(false);
   }
 };

 // Handler para campos de dados
 const handleDadosChange = (field: keyof FormularioDados, value: string) => {
   setDadosForm(prev => ({ ...prev, [field]: value }));
 };

 // Handler para campos de senha
 const handleSenhaChange = (field: keyof FormularioSenha, value: string) => {
   setSenhaForm(prev => ({ ...prev, [field]: value }));
 };

 // Toggle de mostrar senha
 const toggleMostrarSenha = (field: keyof typeof mostrarSenhas) => {
   setMostrarSenhas(prev => ({ ...prev, [field]: !prev[field] }));
 };

 if (!user) {
   return (
     <div className="min-h-screen flex items-center justify-center bg-gray-50">
       <div className="text-center">
         <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
         <p>Carregando...</p>
       </div>
     </div>
   );
 }

 return (
   <div className="min-h-screen bg-gray-50">
     <Header />
     
     <main className="container mx-auto px-6 py-8">
       <div className="max-w-4xl mx-auto space-y-6">
         {/* Header da página */}
         <div className="flex items-center justify-between">
           <div>
             <h1 className="text-3xl font-heading font-bold text-rmh-primary">
               Configurações Pessoais
             </h1>
             <p className="text-corporate-gray mt-1">
               Gerencie suas informações pessoais
             </p>
           </div>
         </div>

         {/* Seção Unificada: Dados Pessoais */}
         <Card>
           <CardHeader>
             <CardTitle className="flex items-center gap-2">
               <UserCircle className="h-5 w-5" />
               Dados Pessoais
             </CardTitle>
           </CardHeader>
           <CardContent className="space-y-6">
             {/* Formulário de edição */}
             <div className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label htmlFor="nome">Nome Completo</Label>
                   <Input
                     id="nome"
                     value={dadosForm.nome}
                     onChange={(e) => handleDadosChange('nome', e.target.value)}
                     placeholder="Seu nome completo"
                   />
                 </div>
                 
                 {/* Email - Somente leitura */}
                 <div className="space-y-2">
                   <Label className="flex items-center gap-2">
                     Email
                     <Badge variant="outline" className="text-xs">Somente leitura</Badge>
                   </Label>
                   <Input
                     value={user.email || 'Não informado'}
                     disabled
                     className="bg-gray-100 text-gray-600"
                     placeholder="Email (somente leitura)"
                   />
                 </div>
               </div>
             </div>
           </CardContent>
           
           <CardContent className="space-y-4">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="space-y-2 md:col-span-2">
                 <Label htmlFor="senhaAtual">Senha Atual</Label>
                 <div className="relative">
                   <Input
                     id="senhaAtual"
                     type={mostrarSenhas.atual ? 'text' : 'password'}
                     value={senhaForm.senhaAtual}
                     onChange={(e) => handleSenhaChange('senhaAtual', e.target.value)}
                     placeholder="Digite sua senha atual"
                     className="pr-10"
                   />
                   <Button
                     type="button"
                     variant="ghost"
                     size="sm"
                     className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                     onClick={() => toggleMostrarSenha('atual')}
                   >
                     {mostrarSenhas.atual ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                   </Button>
                 </div>
               </div>

               <div className="space-y-2">
                 <Label htmlFor="novaSenha">Nova Senha</Label>
                 <div className="relative">
                   <Input
                     id="novaSenha"
                     type={mostrarSenhas.nova ? 'text' : 'password'}
                     value={senhaForm.novaSenha}
                     onChange={(e) => handleSenhaChange('novaSenha', e.target.value)}
                     placeholder="Mínimo 6 caracteres"
                     className="pr-10"
                   />
                   <Button
                     type="button"
                     variant="ghost"
                     size="sm"
                     className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                     onClick={() => toggleMostrarSenha('nova')}
                   >
                     {mostrarSenhas.nova ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                   </Button>
                 </div>
               </div>

               <div className="space-y-2">
                 <Label htmlFor="confirmarSenha">Confirmar Nova Senha</Label>
                 <div className="relative">
                   <Input
                     id="confirmarSenha"
                     type={mostrarSenhas.confirmar ? 'text' : 'password'}
                     value={senhaForm.confirmarSenha}
                     onChange={(e) => handleSenhaChange('confirmarSenha', e.target.value)}
                     placeholder="Digite novamente"
                     className="pr-10"
                   />
                   <Button
                     type="button"
                     variant="ghost"
                     size="sm"
                     className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                     onClick={() => toggleMostrarSenha('confirmar')}
                   >
                     {mostrarSenhas.confirmar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                   </Button>
                 </div>
               </div>
             </div>

             {/* Indicador de força da senha */}
             {senhaForm.novaSenha && (
               <div className="space-y-2">
                 <div className="flex justify-between text-xs">
                   <span className="text-gray-600">Força da senha:</span>
                   <span className={senhaForm.novaSenha.length >= 6 ? "text-green-600" : "text-red-600"}>
                     {senhaForm.novaSenha.length >= 6 ? "✓ Válida" : "Muito curta"}
                   </span>
                 </div>
                 <div className="w-full bg-gray-200 rounded-full h-2">
                   <div 
                     className={`h-2 rounded-full transition-all duration-300 ${
                       senhaForm.novaSenha.length >= 8 ? 'bg-green-500 w-full' :
                       senhaForm.novaSenha.length >= 6 ? 'bg-yellow-500 w-3/4' :
                       senhaForm.novaSenha.length >= 3 ? 'bg-red-500 w-1/2' : 'bg-red-400 w-1/4'
                     }`}
                   />
                 </div>
               </div>
             )}

             {/* Validação de senhas */}
             {senhaForm.novaSenha && senhaForm.confirmarSenha && senhaForm.novaSenha !== senhaForm.confirmarSenha && (
               <div className="text-red-600 text-sm flex items-center space-x-1">
                 <AlertCircle className="h-4 w-4" />
                 <span>As senhas não coincidem</span>
               </div>
             )}

             <div className="flex justify-end pt-4">
               <Button
                 onClick={atualizarDados}
                 disabled={carregandoDados}
                 className="bg-rmh-lightGreen hover:bg-rmh-primary"
               >
                 {carregandoDados ? (
                   <>
                     <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                     Salvando...
                   </>
                 ) : (
                   <>
                     <Save className="h-4 w-4 mr-2" />
                     Salvar Dados
                   </>
                 )}
               </Button>
             </div>
           </CardContent>
         </Card>
       </div>
     </main>
   </div>
 );
};

export default ConfiguracoesPessoais;