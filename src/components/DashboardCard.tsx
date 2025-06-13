import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, User, Eye, Edit, Trash2, ExternalLink } from 'lucide-react';
import { Dashboard } from '@/contexts/DashboardContext';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface DashboardCardProps {
  dashboard: Dashboard;
  onEdit?: (dashboard: Dashboard) => void;
  onDelete?: (id: string) => void;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ dashboard, onEdit, onDelete }) => {
  const { user } = useAuth();
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  };

  const canEdit = user?.role === 'admin' || dashboard.createdBy === user?.email;

  const enterFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (error) {
      console.log('Fullscreen não suportado ou bloqueado:', error);
    }
  };

  const exitFullscreen = async () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.log('Erro ao sair do fullscreen:', error);
    }
  };

  const handleViewerOpen = async (open: boolean) => {
    setIsViewerOpen(open);
    
    if (open) {
      setTimeout(enterFullscreen, 100);
    } else {
      await exitFullscreen();
    }
  };

  useEffect(() => {
    return () => {
      if (document.fullscreenElement) {
        exitFullscreen();
      }
    };
  }, []);

  // Função para construir a URL otimizada
  const getOptimizedUrl = (baseUrl: string) => {
    const separator = baseUrl.includes('?') ? '&' : '?';
    const params = new URLSearchParams({
      'chromeless': '1',
      'filterPaneEnabled': 'false',
      'navContentPaneEnabled': 'false',
      'autofit': '1',
      'fitToPage': '1',
      'zoom': 'fitToPage',
      'rs:embed': 'true',
      'autoSize': 'true'
    });

    return `${baseUrl}${separator}${params.toString()}`;
  };

  // Função para clicar no botão específico do Power BI
  const clickPowerBIFitButton = (iframe: HTMLIFrameElement) => {
    console.log('🔍 Procurando botão "Ajustar à página"...');
    
    try {
      if (iframe.contentWindow && iframe.contentDocument) {
        console.log('✅ Acesso ao iframe permitido!');
        const iframeDoc = iframe.contentDocument;
        
        // Seletores específicos baseados no elemento encontrado
        const selectors = [
          '#fitToPageButton',
          'button[aria-label*="Ajustar à página"]',
          'button[aria-label*="Fit to page"]',
          '.smallImageButton[aria-label*="Ajustar"]',
          '.resetButtonsContainer button[aria-label*="Ajustar"]'
        ];
        
        let fitButton = null;
        let usedSelector = '';
        
        for (const selector of selectors) {
          fitButton = iframeDoc.querySelector(selector);
          if (fitButton) {
            usedSelector = selector;
            break;
          }
        }
        
        if (fitButton) {
          console.log('🎯 Botão encontrado com seletor:', usedSelector);
          console.log('📝 Elemento:', fitButton);
          (fitButton as HTMLElement).click();
          
          // Verifica se funcionou
          setTimeout(() => {
            const isPressed = fitButton.getAttribute('aria-pressed') === 'true';
            console.log('✨ Resultado - Botão ativado:', isPressed);
          }, 500);
          
          return true;
        } else {
          console.log('❌ Botão não encontrado com nenhum seletor');
          
          // Lista todos os botões disponíveis para debug
          const allButtons = iframeDoc.querySelectorAll('button');
          console.log('🔍 Botões disponíveis no iframe:', allButtons.length);
          allButtons.forEach((btn, index) => {
            if (index < 10) { // Mostra apenas os primeiros 10
              console.log(`Botão ${index + 1}:`, {
                id: btn.id,
                className: btn.className,
                ariaLabel: btn.getAttribute('aria-label'),
                textContent: btn.textContent?.trim()
              });
            }
          });
          
          return false;
        }
      } else {
        console.log('❌ Sem acesso ao contentWindow ou contentDocument');
        return false;
      }
    } catch (error) {
      console.log('🚫 Erro ao acessar iframe (CORS):', error);
      return false;
    }
  };

  return (
    <>
      <Card className="group hover:shadow-lg transition-all duration-300 border-gray-200 hover:border-corporate-blue/50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              <CardTitle className="text-lg font-heading font-semibold text-corporate-blue line-clamp-1">
                {dashboard.title}
              </CardTitle>
              <CardDescription className="text-sm text-corporate-gray line-clamp-2">
                {dashboard.description}
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="secondary" className="bg-corporate-lightGray text-corporate-blue">
              {dashboard.category}
            </Badge>
            <Badge variant="outline" className="border-corporate-blue text-corporate-blue">
              {dashboard.department}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-corporate-gray">
              <div className="flex items-center space-x-1">
                <Calendar className="h-3 w-3" />
                <span>Atualizado em {formatDate(dashboard.updatedAt)}</span>
              </div>
              <div className="flex items-center space-x-1">
                <User className="h-3 w-3" />
                <span>{dashboard.createdBy.split('@')[0]}</span>
              </div>
            </div>

            <div className="flex space-x-2">
              <Dialog open={isViewerOpen} onOpenChange={handleViewerOpen}>
                <DialogTrigger asChild>
                  <Button className="flex-1 bg-primary hover:bg-primary-800">
                    <Eye className="h-4 w-4 mr-2" />
                    Visualizar
                  </Button>
                </DialogTrigger>
              </Dialog>

              {canEdit && (
                <div className="flex space-x-1">
                  {onEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(dashboard)}
                      className="border-corporate-blue text-corporate-blue hover:bg-corporate-blue hover:text-white"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  {onDelete && user?.role === 'admin' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDelete(dashboard.id)}
                      className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isViewerOpen} onOpenChange={handleViewerOpen}>
        <DialogContent ref={dialogRef} className="max-w-[100vw] max-h-[100vh] w-[100vw] h-[100vh] p-0 m-0 flex flex-col">
          <DialogHeader className="p-2 pr-12 pb-2 flex-shrink-0 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg font-heading font-semibold text-corporate-blue truncate">
                  {dashboard.title}
                </DialogTitle>
                <p className="text-xs text-corporate-gray mt-0.5 truncate">{dashboard.description}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(dashboard.iframeUrl, '_blank')}
                className="border-corporate-blue text-corporate-blue hover:bg-corporate-blue hover:text-white ml-3 flex-shrink-0"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Abrir em nova aba
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 p-1" style={{ maxHeight: '1080px' }}>
            <iframe
              src={getOptimizedUrl(dashboard.iframeUrl)}
              width="100%"
              height="100%"
              frameBorder="0"
              allowFullScreen
              className="w-full h-full border-0 rounded"
              title={dashboard.title}
              style={{
                border: 'none',
                overflow: 'hidden'
              }}
              onLoad={(e) => {
                const iframe = e.target as HTMLIFrameElement;
                console.log('🚀 IFRAME CARREGOU!', new Date().toLocaleTimeString());
                console.log('📊 Dashboard:', dashboard.title);
                console.log('🔗 URL:', iframe.src);
                
                // Primeira tentativa após 2 segundos
                setTimeout(() => {
                  console.log('⏰ Primeira tentativa (2s depois do load)...');
                  clickPowerBIFitButton(iframe);
                }, 2000);
                
                // Segunda tentativa após 5 segundos (caso o Power BI demore para renderizar)
                setTimeout(() => {
                  console.log('⏰ Segunda tentativa (5s depois do load)...');
                  clickPowerBIFitButton(iframe);
                }, 5000);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DashboardCard;