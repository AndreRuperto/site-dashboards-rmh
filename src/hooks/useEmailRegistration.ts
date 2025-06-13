// hooks/useEmailRegistration.ts
import { useState } from 'react';
import { useToast } from './use-toast';
import resendService from '../services/resendService';

interface RegistrationData {
  name: string;
  email: string;
  password: string;
  department: string;
}

export const useEmailRegistration = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const { toast } = useToast();

  const registerUser = async (data: RegistrationData): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      // Validações
      if (!data.email.endsWith('@resendemh.com.br')) {
        throw new Error('Email deve ser @resendemh.com.br');
      }

      if (data.password.length < 6) {
        throw new Error('Senha deve ter pelo menos 6 caracteres');
      }

      // Simular salvamento no localStorage (ou API real)
      const verificationToken = generateToken();
      const pendingUser = {
        ...data,
        verificationToken,
        createdAt: new Date().toISOString(),
        isVerified: false
      };

      // Salvar usuário pendente
      const pendingUsers = JSON.parse(localStorage.getItem('pendingUsers') || '[]');
      
      // Verificar se já existe
      const existingIndex = pendingUsers.findIndex((u: any) => u.email === data.email);
      if (existingIndex >= 0) {
        pendingUsers[existingIndex] = pendingUser; // Atualizar
      } else {
        pendingUsers.push(pendingUser); // Adicionar novo
      }
      
      localStorage.setItem('pendingUsers', JSON.stringify(pendingUsers));

      // Enviar email via Resend
      await resendService.sendEmailVerification({
        name: data.name,
        email: data.email,
        verificationToken
      });

      setUserEmail(data.email);
      setEmailSent(true);

      toast({
        title: "📧 Email enviado!",
        description: "Verifique sua caixa de entrada para ativar sua conta",
      });

      return true;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      toast({
        title: "❌ Erro no cadastro",
        description: errorMessage,
        variant: "destructive"
      });
      
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const resendVerificationEmail = async (): Promise<void> => {
    if (!userEmail) return;

    setIsLoading(true);
    try {
      const pendingUsers = JSON.parse(localStorage.getItem('pendingUsers') || '[]');
      const user = pendingUsers.find((u: any) => u.email === userEmail);
      
      if (user) {
        await resendService.sendEmailVerification({
          name: user.name,
          email: user.email,
          verificationToken: user.verificationToken
        });

        toast({
          title: "📧 Email reenviado",
          description: "Verifique sua caixa de entrada novamente",
        });
      }
    } catch (error) {
      toast({
        title: "❌ Erro ao reenviar",
        description: "Tente novamente em alguns minutos",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    registerUser,
    resendVerificationEmail,
    isLoading,
    emailSent,
    userEmail
  };
};

// Função auxiliar para gerar tokens
const generateToken = (): string => {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15) + 
         Date.now().toString(36);
};