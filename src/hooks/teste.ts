// TestResendButton.tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import resendService from '../services/resendService';
import { Loader2, Mail } from 'lucide-react';

const TestResendButton: React.FC = () => {
  const [isTesting, setIsTesting] = useState(false);
  const { toast } = useToast();

  const testResend = async () => {
    setIsTesting(true);
    
    try {
      const success = await resendService.testEmailService();
      
      if (success) {
        toast({
          title: "✅ Teste realizado com sucesso!",
          description: "Verifique o email andreruperto@gmail.com",
        });
      } else {
        throw new Error('Falha no teste');
      }
    } catch (error) {
      toast({
        title: "❌ Erro no teste",
        description: "Verifique a configuração do Resend",
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Button
      onClick={testResend}
      disabled={isTesting}
      variant="outline"
      className="mb-4"
    >
      {isTesting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Testando...
        </>
      ) : (
        <>
          <Mail className="mr-2 h-4 w-4" />
          Testar Resend
        </>
      )}
    </Button>
  );
};

export default TestResendButton;