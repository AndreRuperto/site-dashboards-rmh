// hooks/useEmailVerification.ts - Atualizado para usar Resend
import { useState, useEffect } from 'react';
import { useToast } from './use-toast';
import resendService from '../services/resendService';

export const useEmailVerification = (token?: string, email?: string) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token || !email) return;
      
      setIsVerifying(true);
      
      try {
        // Buscar usuário pendente
        const pendingUsers = JSON.parse(localStorage.getItem('pendingUsers') || '[]');
        const userIndex = pendingUsers.findIndex((u: any) => 
          u.email === email && u.verificationToken === token
        );

        if (userIndex === -1) {
          throw new Error('Token inválido ou expirado');
        }

        const user = pendingUsers[userIndex];
        
        // Verificar se não expirou (24 horas)
        const createdAt = new Date(user.createdAt);
        const now = new Date();
        const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
        
        if (hoursDiff > 24) {
          throw new Error('Token expirado. Solicite um novo cadastro.');
        }

        // Mover para usuários verificados
        const verifiedUsers = JSON.parse(localStorage.getItem('verifiedUsers') || '[]');
        const verifiedUser = {
          ...user,
          isVerified: true,
          verifiedAt: new Date().toISOString(),
          id: Date.now().toString()
        };
        
        verifiedUsers.push(verifiedUser);
        localStorage.setItem('verifiedUsers', JSON.stringify(verifiedUsers));

        // Remover da lista de pendentes
        pendingUsers.splice(userIndex, 1);
        localStorage.setItem('pendingUsers', JSON.stringify(pendingUsers));

        // Enviar email de boas-vindas
        await resendService.sendWelcomeEmail({
          name: user.name,
          email: user.email
        });

        setIsVerified(true);

        toast({
          title: "✅ Email verificado!",
          description: "Sua conta foi ativada com sucesso",
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro na verificação';
        
        toast({
          title: "❌ Erro na verificação",
          description: errorMessage,
          variant: "destructive"
        });
      } finally {
        setIsVerifying(false);
      }
    };

    verifyEmail();
  }, [token, email, toast]);

  return { isVerifying, isVerified };
};