// DashboardCard.tsx - VERSÃO COM POWER BI CLIENT OFICIAL + OCULTAÇÃO DE BANNER
import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, User, Eye, Edit, Trash2, ExternalLink, Loader2, Shield, AlertTriangle } from 'lucide-react';
import { Dashboard } from '@/contexts/DashboardContext';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { useConfirmation } from '@/hooks/useConfirmation';

// ✅ IMPORTAÇÃO DA BIBLIOTECA OFICIAL DO POWER BI
import { service, factories, models, Report, Embed } from 'powerbi-client';

// ✅ Interface para tipagem do embed
interface PowerBIEmbed extends Embed {
  remove?: () => void;
}

interface DashboardCardProps {
  dashboard: Dashboard;
  onEdit?: (dashboard: Dashboard) => void;
  onDelete?: (id: string) => void;
}

interface PowerBIEmbedToken {
  accessToken: string;
  tokenType: string;
  expiration: string;
  reportId: string;
  groupId: string;
  embedUrl: string;
  generatedAt: string;
  validFor: number;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ dashboard, onEdit, onDelete }) => {
  const { user } = useAuth();
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [embedToken, setEmbedToken] = useState<PowerBIEmbedToken | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [powerbiReport, setPowerbiReport] = useState<PowerBIEmbed | null>(null);
  
  // ✅ Hook do modal de confirmação
  const { ConfirmationComponent, confirm } = useConfirmation();
  
  // ✅ Refs para containers de embed
  const dialogRef = useRef<HTMLDivElement>(null);
  const reportContainerRef = useRef<HTMLDivElement>(null);
  const iframeContainerRef = useRef<HTMLDivElement>(null);

  // ✅ NOVO: FUNÇÃO PARA OCULTAR BANNER DO POWER BI
  const hidePowerBIBanner = () => {
    try {
      // Lista de seletores para diferentes tipos de banners/notificações
      const selectors = [
        '.notification-bar.unselectable.teaching',
        '.notification-bar',
        '.teaching-bubble',
        '.teaching-tooltip',
        '[class*="notification"]',
        '[class*="banner"]',
        '[class*="teaching"]',
        '[data-automation-id*="notification"]',
        '[data-automation-id*="banner"]',
        '.pbi-glyph-close', // Botão de fechar banners
      ];
      
      let bannerFound = false;
      
      // Procura e oculta elementos na página principal
      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          const htmlElement = el as HTMLElement;
          if (htmlElement && htmlElement.style.display !== 'none') {
            htmlElement.style.display = 'none';
            console.log('🔕 Banner Power BI ocultado:', selector);
            bannerFound = true;
          }
        });
      });

      // Tenta acessar iframe do Power BI para ocultar banners internos
      const powerbiIframes = document.querySelectorAll('iframe[src*="powerbi.com"], iframe[src*="fabric.microsoft.com"]');
      
      powerbiIframes.forEach(iframe => {
        try {
          const iframeElement = iframe as HTMLIFrameElement;
          const iframeDoc = iframeElement.contentDocument || iframeElement.contentWindow?.document;
          
          if (iframeDoc) {
            selectors.forEach(selector => {
              const elements = iframeDoc.querySelectorAll(selector);
              elements.forEach(el => {
                const htmlElement = el as HTMLElement;
                if (htmlElement && htmlElement.style.display !== 'none') {
                  htmlElement.style.display = 'none';
                  console.log('🔕 Banner Power BI ocultado no iframe:', selector);
                  bannerFound = true;
                }
              });
            });

            // Injeta CSS para ocultar banners que podem aparecer dinamicamente
            const style = iframeDoc.createElement('style');
            style.textContent = `
              .notification-bar,
              .teaching-bubble,
              .teaching-tooltip,
              [class*="notification"],
              [class*="banner"],
              [class*="teaching"] {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
              }
            `;
            
            if (!iframeDoc.querySelector('#hide-powerbi-banners')) {
              style.id = 'hide-powerbi-banners';
              iframeDoc.head.appendChild(style);
              console.log('🎨 CSS para ocultar banners injetado no iframe');
            }
          }
        } catch (error) {
          // Cross-origin restriction - normal para iframes externos
          console.log('⚠️ Não foi possível acessar iframe cross-origin (normal)');
        }
      });

      return bannerFound;
    } catch (error) {
      console.warn('⚠️ Erro ao ocultar banner Power BI:', error);
      return false;
    }
  };

  // ✅ SOLUÇÃO DEFINITIVA: useEffect para injetar CSS e monitorar
  useEffect(() => {
    if (!isViewerOpen) return;

    console.log('🎯 Iniciando solução anti-banner Power BI...');

    // ✅ 1. Injetar CSS global para ocultar banners
    const injectBannerHidingCSS = () => {
      const cssId = 'powerbi-banner-hider';
      
      if (!document.getElementById(cssId)) {
        const style = document.createElement('style');
        style.id = cssId;
        style.textContent = `
          /* Power BI Banner Hider - Injected CSS */
          .notification-bar,
          .teaching-bubble,
          .teaching-tooltip,
          .teaching-callout,
          .banner-container,
          .notification-container,
          [class*="notification"],
          [class*="banner"], 
          [class*="teaching"],
          [data-automation-id*="notification"],
          [data-automation-id*="banner"],
          .pbi-glyph-close {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            height: 0 !important;
            overflow: hidden !important;
          }
          
          /* Overlay para cobrir área de banners */
          body::after {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 50px;
            background: transparent;
            z-index: 10000;
            pointer-events: none;
          }
        `;
        
        document.head.appendChild(style);
        console.log('🎨 CSS anti-banner injetado globalmente');
      }
    };

    // ✅ 2. Função otimizada para ocultar banners
    const hidePowerBIBannerOptimized = () => {
      try {
        const selectors = [
          '.notification-bar',
          '.teaching-bubble', 
          '.teaching-tooltip',
          '.banner-container',
          '[class*="notification"]',
          '[class*="banner"]',
          '[class*="teaching"]'
        ];
        
        let found = 0;
        
        // Verificar página principal
        selectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            const htmlElement = el as HTMLElement;
            if (htmlElement && htmlElement.style.display !== 'none') {
              htmlElement.style.display = 'none';
              found++;
            }
          });
        });
        
        if (found > 0) {
          console.log(`🔕 ${found} banner(s) ocultado(s) na página principal`);
        }

        // ✅ 3. Tentar manipular Power BI via postMessage
        const powerbiIframes = document.querySelectorAll('iframe[src*="powerbi.com"], iframe[src*="fabric.microsoft.com"]');
        
        powerbiIframes.forEach(iframe => {
          try {
            const iframeWindow = (iframe as HTMLIFrameElement).contentWindow;
            
            if (iframeWindow) {
              // Tentar enviar comando para ocultar elementos
              iframeWindow.postMessage({
                type: 'hideBanners',
                selectors: selectors
              }, '*');
              
              console.log('📤 Comando postMessage enviado para iframe Power BI');
            }
          } catch (error) {
            // Cross-origin expected
          }
        });

        return found;
      } catch (error) {
        console.warn('⚠️ Erro na função hidePowerBIBanner:', error);
        return 0;
      }
    };

    // ✅ 4. Listener para postMessage responses
    const handlePostMessage = (event: MessageEvent) => {
      if (event.data?.type === 'bannersHidden') {
        console.log('✅ Power BI respondeu: banners ocultados');
      }
    };

    // ✅ 5. Executar soluções
    injectBannerHidingCSS();
    hidePowerBIBannerOptimized();
    
    window.addEventListener('message', handlePostMessage);

    // ✅ 6. Monitoramento reduzido (não spam logs)
    let attempts = 0;
    const maxAttempts = 10;
    
    const bannerInterval = setInterval(() => {
      attempts++;
      const found = hidePowerBIBannerOptimized();
      
      if (attempts >= maxAttempts) {
        console.log('🏁 Monitoramento de banner finalizado após 10 tentativas');
        clearInterval(bannerInterval);
      }
    }, 3000); // A cada 3 segundos, menos spam

    // ✅ 7. Observer otimizado
    const observer = new MutationObserver((mutations) => {
      const hasNewNodes = mutations.some(m => m.addedNodes.length > 0);
      if (hasNewNodes) {
        setTimeout(hidePowerBIBannerOptimized, 1000);
      }
    });

    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });

    // ✅ 8. Cleanup
    return () => {
      clearInterval(bannerInterval);
      observer.disconnect();
      window.removeEventListener('message', handlePostMessage);
      
      // Remover CSS injetado
      const cssElement = document.getElementById('powerbi-banner-hider');
      if (cssElement) {
        cssElement.remove();
      }
    };
  }, [isViewerOpen]);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(date);
    } catch (error) {
      return 'Data inválida';
    }
  };

  const canEdit = user?.tipo_usuario === 'admin' || dashboard.criado_por === user?.id;

  // ✅ HANDLER PARA EXCLUSÃO COM MODAL CUSTOMIZADO
  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Excluir Dashboard',
      description: `Tem certeza que deseja excluir o dashboard "${dashboard.titulo}"? Esta ação não pode ser desfeita.`,
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
      icon: <Trash2 className="h-6 w-6 text-red-600" />
    });

    if (confirmed && onDelete) {
      onDelete(dashboard.id);
    }
  };

  // ✅ FUNÇÃO PARA OBTER TOKEN DE EMBED SEGURO
  const getEmbedToken = async (): Promise<PowerBIEmbedToken | null> => {
    try {
      console.log('🔐 Obtendo token de embed seguro...');
      
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      
      const response = await fetch(`${API_BASE_URL}/api/powerbi/embed-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          reportId: dashboard.powerbi_report_id,
          groupId: dashboard.powerbi_group_id,
          dashboardId: dashboard.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Erro na resposta:', errorData);
        throw new Error(errorData.error || 'Falha ao obter token de embed');
      }

      const tokenData = await response.json();
      console.log('✅ Token de embed obtido com sucesso');
      
      return tokenData;
    } catch (error) {
      console.error('❌ Erro ao obter token de embed:', error);
      setTokenError('Erro ao carregar dashboard seguro');
      return null;
    }
  };

  // ✅ FUNÇÃO PARA EMBED SEGURO COM POWER BI CLIENT
  const embedSecureReport = async (token: PowerBIEmbedToken) => {
    if (!reportContainerRef.current) {
      console.error('❌ Container do relatório não encontrado');
      return;
    }

    try {
      console.log('🚀 Iniciando embed seguro com Power BI Client...');
      
      // ✅ Configuração oficial do Power BI (simplificada)
      const embedConfig = {
        type: 'report',
        id: token.reportId,
        embedUrl: token.embedUrl,
        accessToken: token.accessToken,
        tokenType: models.TokenType.Embed,
        permissions: models.Permissions.Read,
        settings: {
          panes: {
            filters: {
              expanded: false,
              visible: false
            },
            pageNavigation: {
              visible: false
            }
          },
          background: models.BackgroundType.Transparent,
          bars: {
            statusBar: {
              visible: false
            },
            actionBar: {
              visible: false
            }
          }
        }
      };

      // ✅ Limpar embed anterior se existir
      if (powerbiReport) {
        try {
          powerbiReport.off('loaded');
          powerbiReport.off('error');
          powerbiReport.off('rendered');
          // ✅ Usar método remove se disponível
          if (powerbiReport.remove) {
            powerbiReport.remove();
          }
        } catch (e) {
          console.warn('⚠️ Aviso ao limpar embed anterior:', e);
        }
      }

      // ✅ Criar instância do serviço Power BI
      const powerbiService = new service.Service(
        factories.hpmFactory, 
        factories.wpmpFactory, 
        factories.routerFactory
      );

      // ✅ Fazer embed usando o serviço
      const report = powerbiService.embed(reportContainerRef.current, embedConfig) as PowerBIEmbed;
      setPowerbiReport(report);

      // ✅ Event listeners
      report.on('loaded', () => {
        console.log('✅ Relatório Power BI carregado com sucesso!');
        setIframeLoading(false);
        setTokenError(null);
        
        // ✅ NOVO: Ocultar banners após carregar
        setTimeout(() => {
          const hidePowerBIBannerOptimized = () => {
            try {
              const selectors = [
                '.notification-bar',
                '.teaching-bubble', 
                '.teaching-tooltip',
                '.banner-container',
                '[class*="notification"]',
                '[class*="banner"]',
                '[class*="teaching"]'
              ];
              
              let found = 0;
              selectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                  const htmlElement = el as HTMLElement;
                  if (htmlElement && htmlElement.style.display !== 'none') {
                    htmlElement.style.display = 'none';
                    found++;
                  }
                });
              });
              
              if (found > 0) {
                console.log(`🔕 ${found} banner(s) ocultado(s) após carregar Power BI`);
              }
            } catch (error) {
              console.warn('⚠️ Erro ao ocultar banner:', error);
            }
          };
          hidePowerBIBannerOptimized();
        }, 1000);
        
        setTimeout(() => {
          const hidePowerBIBannerOptimized = () => {
            try {
              const selectors = [
                '.notification-bar',
                '.teaching-bubble', 
                '.teaching-tooltip',
                '.banner-container',
                '[class*="notification"]',
                '[class*="banner"]',
                '[class*="teaching"]'
              ];
              
              let found = 0;
              selectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                  const htmlElement = el as HTMLElement;
                  if (htmlElement && htmlElement.style.display !== 'none') {
                    htmlElement.style.display = 'none';
                    found++;
                  }
                });
              });
              
              if (found > 0) {
                console.log(`🔕 ${found} banner(s) ocultado(s) após carregar Power BI (segunda tentativa)`);
              }
            } catch (error) {
              console.warn('⚠️ Erro ao ocultar banner:', error);
            }
          };
          hidePowerBIBannerOptimized();
        }, 3000); // Segunda tentativa para elementos tardios
      });

      report.on('error', (event) => {
        console.error('❌ Erro no Power BI:', event.detail);
        setTokenError('Erro ao carregar relatório Power BI');
        setIframeLoading(false);
      });

      report.on('rendered', () => {
        console.log('🎨 Relatório Power BI renderizado!');
        
        // ✅ NOVO: Ocultar banners após renderizar
        setTimeout(() => {
          const hidePowerBIBannerOptimized = () => {
            try {
              const selectors = [
                '.notification-bar',
                '.teaching-bubble', 
                '.teaching-tooltip',
                '.banner-container',
                '[class*="notification"]',
                '[class*="banner"]',
                '[class*="teaching"]'
              ];
              
              let found = 0;
              selectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                  const htmlElement = el as HTMLElement;
                  if (htmlElement && htmlElement.style.display !== 'none') {
                    htmlElement.style.display = 'none';
                    found++;
                  }
                });
              });
              
              if (found > 0) {
                console.log(`🔕 ${found} banner(s) ocultado(s) após renderizar Power BI`);
              }
            } catch (error) {
              console.warn('⚠️ Erro ao ocultar banner:', error);
            }
          };
          hidePowerBIBannerOptimized();
        }, 500);
      });

    } catch (error) {
      console.error('❌ Erro ao fazer embed do relatório:', error);
      setTokenError('Erro ao inicializar relatório Power BI');
      setIframeLoading(false);
    }
  };

  // ✅ FUNÇÃO PARA GERAR URL OTIMIZADA (FALLBACK PARA DASHBOARDS PÚBLICOS)
  const getOptimizedUrl = (baseUrl: string) => {
    const separator = baseUrl.includes('?') ? '&' : '?';
    
    const params = new URLSearchParams({
      'pageView': 'FitToPage',
    });
    
    return `${baseUrl}${separator}${params.toString()}`;
  };

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

  // ✅ HANDLER PRINCIPAL PARA ABRIR O VIEWER
  const handleViewerOpen = async (open: boolean) => {
    setIsViewerOpen(open);
    
    if (open) {
      setIframeLoading(true);
      setTokenError(null);
      
      // ✅ Se é dashboard seguro (tem powerbi_report_id), usar Power BI Client
      if (dashboard.embed_type === 'secure') {
        console.log('🔐 Dashboard seguro detectado, obtendo token...');
        const token = await getEmbedToken();
        if (token) {
          setEmbedToken(token);
          // ✅ Aguardar um pouco para o DOM estar pronto
          setTimeout(() => {
            embedSecureReport(token);
          }, 100);
        }
      } else {
        // ✅ Dashboard público, usar iframe normal
        console.log('🌐 Dashboard público, usando iframe...');
        setIframeLoading(false);
      }
      
      await enterFullscreen();
    } else {
      // ✅ Cleanup ao fechar
      if (powerbiReport) {
        try {
          powerbiReport.off('loaded');
          powerbiReport.off('error');
          powerbiReport.off('rendered');
          // ✅ Usar método remove se disponível
          if (powerbiReport.remove) {
            powerbiReport.remove();
          }
          setPowerbiReport(null);
        } catch (e) {
          console.warn('⚠️ Aviso ao limpar Power BI:', e);
        }
      }
      setEmbedToken(null);
      setTokenError(null);
      await exitFullscreen();
    }
  };

  // ✅ Cleanup no unmount
  useEffect(() => {
    return () => {
      if (document.fullscreenElement) {
        exitFullscreen();
      }
      if (powerbiReport) {
        try {
          powerbiReport.off('loaded');
          powerbiReport.off('error');
          powerbiReport.off('rendered');
          if (powerbiReport.remove) {
            powerbiReport.remove();
          }
        } catch (e) {
          console.warn('Cleanup warning:', e);
        }
      }
    };
  }, [powerbiReport]);

  // ✅ DETERMINAR SE É DASHBOARD SEGURO OU PÚBLICO
  const isSecureDashboard = dashboard.embed_type === 'secure';

  return (
    <>
      <Card className="group hover:shadow-lg transition-all duration-300 border-gray-200 hover:border-corporate-blue/50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              <CardTitle className="text-lg font-heading font-semibold text-corporate-blue line-clamp-1 flex items-center gap-2">
                {dashboard.titulo}
              </CardTitle>
              <CardDescription className="text-sm text-corporate-gray line-clamp-2">
                {dashboard.descricao || 'Sem descrição'}
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="secondary" className="bg-corporate-lightGray text-corporate-blue border border-rmh-primary hover:bg-rmh-primary hover:text-white">
              {dashboard.setor}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-corporate-gray">
              <div className="flex items-center space-x-1">
                <Calendar className="h-3 w-3" />
                <span>Atualizado em {formatDate(dashboard.atualizado_em)}</span>
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
                      className="border-corporate-blue text-corporate-blue hover:bg-rmh-primary hover:text-white"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  {onDelete && user?.tipo_usuario === 'admin' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDelete}
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
        <DialogContent
          ref={dialogRef}
          className="max-w-[100vw] max-h-[100vh] w-[100vw] h-[100vh] p-0 m-0 flex flex-col"
          aria-describedby="dashboard-viewer-description"
        >
          <DialogDescription id="dashboard-viewer-description" className="sr-only">
            Visualização do dashboard {dashboard.titulo}
          </DialogDescription>

          <DialogHeader className="p-2 pr-12 pb-2 flex-shrink-0 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg font-heading font-semibold text-corporate-blue truncate flex items-center gap-2">
                  {dashboard.titulo}
                  {isSecureDashboard && (
                    <Shield className="h-4 w-4 text-green-600"/>
                  )}
                </DialogTitle>
                <p className="text-xs text-corporate-gray mt-0.5 truncate">
                  {dashboard.descricao || 'Sem descrição'} 
                  {isSecureDashboard && ' • Embed Seguro via Power BI Client'}
                  <span className="text-green-600 ml-2">• Banner auto-ocultado</span>
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(dashboard.url_iframe, '_blank')}
                className="border-corporate-blue text-corporate-blue hover:bg-corporate-blue hover:text-white ml-3 flex-shrink-0"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Abrir em nova aba
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 p-1 relative overflow-hidden">
            {/* ✅ LOADING STATE */}
            {iframeLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                <div className="flex flex-col items-center space-y-3">
                  <Loader2 className="h-8 w-8 animate-spin text-corporate-blue" />
                  <p className="text-sm text-corporate-gray">
                    {isSecureDashboard ? 'Autenticando dashboard seguro...' : 'Carregando dashboard...'}
                  </p>
                  {isSecureDashboard && (
                    <p className="text-xs text-gray-500">Usando Power BI Client oficial</p>
                  )}
                  <p className="text-xs text-green-600">Banners serão ocultados automaticamente</p>
                </div>
              </div>
            )}

            {/* ✅ ERROR STATE */}
            {tokenError && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                <div className="flex flex-col items-center space-y-3 text-center p-4">
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                  <p className="text-sm text-red-600">{tokenError}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setTokenError(null);
                      setIframeLoading(true);
                      if (isSecureDashboard) {
                        getEmbedToken().then(token => {
                          if (token) {
                            setEmbedToken(token);
                            embedSecureReport(token);
                          }
                        });
                      }
                    }}
                  >
                    Tentar novamente
                  </Button>
                </div>
              </div>
            )}

            {/* ✅ CONTAINER PARA POWER BI EMBED SEGURO */}
            {isSecureDashboard && !tokenError && (
              <div 
                ref={reportContainerRef}
                className="w-full h-full"
                style={{
                  display: 'block',
                  width: '100%',
                  height: '100%',
                  minHeight: '500px'
                }}
              />
            )}

            {/* ✅ CONTAINER PARA IFRAME PÚBLICO (FALLBACK) */}
            {!isSecureDashboard && !tokenError && (
              <div ref={iframeContainerRef} className="w-full h-full">
                <iframe
                  src={getOptimizedUrl(dashboard.url_iframe)}
                  title={dashboard.titulo}
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  scrolling="no"
                  allowFullScreen
                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
                  referrerPolicy="strict-origin-when-cross-origin"
                  className={`w-full h-full rounded transition-opacity duration-300 ${
                    iframeLoading ? 'opacity-0' : 'opacity-100'
                  }`}
                  style={{
                    border: 'none',
                    overflow: 'hidden',
                    width: '100%',
                    height: '100%',
                    maxHeight: '100vh',
                    display: 'block'
                  }}
                  onLoad={() => {
                    console.log('🚀 Dashboard público carregado!', dashboard.titulo);
                    setIframeLoading(false);
                    
                    // ✅ NOVO: Ocultar banners após carregar iframe público
                    setTimeout(() => {
                      const hidePowerBIBannerOptimized = () => {
                        try {
                          const selectors = [
                            '.notification-bar',
                            '.teaching-bubble', 
                            '.teaching-tooltip',
                            '.banner-container',
                            '[class*="notification"]',
                            '[class*="banner"]',
                            '[class*="teaching"]'
                          ];
                          
                          let found = 0;
                          selectors.forEach(selector => {
                            const elements = document.querySelectorAll(selector);
                            elements.forEach(el => {
                              const htmlElement = el as HTMLElement;
                              if (htmlElement && htmlElement.style.display !== 'none') {
                                htmlElement.style.display = 'none';
                                found++;
                              }
                            });
                          });
                          
                          if (found > 0) {
                            console.log(`🔕 ${found} banner(s) ocultado(s) após carregar iframe público`);
                          }
                        } catch (error) {
                          console.warn('⚠️ Erro ao ocultar banner:', error);
                        }
                      };
                      hidePowerBIBannerOptimized();
                    }, 1000);
                    
                    setTimeout(() => {
                      const hidePowerBIBannerOptimized = () => {
                        try {
                          const selectors = [
                            '.notification-bar',
                            '.teaching-bubble', 
                            '.teaching-tooltip',
                            '.banner-container',
                            '[class*="notification"]',
                            '[class*="banner"]',
                            '[class*="teaching"]'
                          ];
                          
                          let found = 0;
                          selectors.forEach(selector => {
                            const elements = document.querySelectorAll(selector);
                            elements.forEach(el => {
                              const htmlElement = el as HTMLElement;
                              if (htmlElement && htmlElement.style.display !== 'none') {
                                htmlElement.style.display = 'none';
                                found++;
                              }
                            });
                          });
                          
                          if (found > 0) {
                            console.log(`🔕 ${found} banner(s) ocultado(s) após carregar iframe público (segunda tentativa)`);
                          }
                        } catch (error) {
                          console.warn('⚠️ Erro ao ocultar banner:', error);
                        }
                      };
                      hidePowerBIBannerOptimized();
                    }, 3000);
                  }}
                  onError={() => {
                    console.error('❌ Erro ao carregar dashboard público');
                    setIframeLoading(false);
                  }}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ✅ MODAL DE CONFIRMAÇÃO CUSTOMIZADO */}
      <ConfirmationComponent />
    </>
  );
};

export default DashboardCard;