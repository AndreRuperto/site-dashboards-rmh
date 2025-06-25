// src/pages/Home.tsx - Página Inicial com Dashboard Principal + Ocultação de Banner
import React, { useState, useEffect, useRef } from 'react';
import { Loader2, AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';

// ✅ IMPORTAÇÃO DA BIBLIOTECA OFICIAL DO POWER BI
import { service, factories, models, Report, Embed } from 'powerbi-client';

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

interface MainDashboard {
  id: string;
  titulo: string;
  descricao?: string;
  url_iframe: string;
  embed_type?: 'public' | 'secure';
  powerbi_report_id?: string;
  powerbi_group_id?: string;
  setor: string;
}

const Home: React.FC = () => {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<MainDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [embedToken, setEmbedToken] = useState<PowerBIEmbedToken | null>(null);
  const [powerbiReport, setPowerbiReport] = useState<Report | null>(null);
  
  const reportContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ✅ SOLUÇÃO ANTI-BANNER - useEffect para injetar CSS e monitorar banners
  useEffect(() => {
    if (!dashboard) return;

    console.log('🎯 Iniciando solução anti-banner Power BI (Home)...');

    // ✅ 1. Injetar CSS global para ocultar banners
    const injectBannerHidingCSS = () => {
      const cssId = 'powerbi-banner-hider-home';
      
      if (!document.getElementById(cssId)) {
        const style = document.createElement('style');
        style.id = cssId;
        style.textContent = `
          /* Power BI Banner Hider - Home */
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
          .powerbi-container-home::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 42px;
            background: #ffffff;
            z-index: 10;
            pointer-events: none;
          }
          
          /* Clipping para iframe público */
          .powerbi-container-clipped-home {
            overflow: hidden;
            position: relative;
          }

          .powerbi-container-home iframe,
          .powerbi-container-home div[data-module-name="visual-container-repeat"],
          .powerbi-container-home .visual-sandbox,
          .powerbi-container-home .visual-container-group,
          .visual-container,
          .visualContainer,
          [class*="visual-container"],
          .report-container,
          .exploration-container,
          div[class*="displayArea"],
          div[class*="viewport"] {
            background-color: #ffffff !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
          }
          
          .powerbi-container-home {
            background-color: #ffffff !important; /* Cor de fundo cinza claro */
          }

          .powerbi-container-clipped-home iframe {
            margin-top: -42px;
            height: calc(100% + 42px);
          }
        `;
        
        document.head.appendChild(style);
        console.log('🎨 CSS anti-banner injetado globalmente (Home)');
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
          console.log(`🔕 ${found} banner(s) ocultado(s) na Home`);
        }

        // ✅ 3. Tentar enviar comando para iframes do Power BI
        document.querySelectorAll('iframe[src*="powerbi.com"], iframe[src*="fabric.microsoft.com"]').forEach(iframe => {
          try {
            const iframeWindow = (iframe as HTMLIFrameElement).contentWindow;
            if (iframeWindow) {
              iframeWindow.postMessage({
                type: 'hideBanners',
                selectors: selectors
              }, '*');
              console.log('📤 Comando postMessage enviado para iframe Power BI (Home)');
            }
          } catch (e) {
            // Cross-origin expected
          }
        });

        return found;
      } catch (error) {
        console.warn('⚠️ Erro na função hidePowerBIBanner (Home):', error);
        return 0;
      }
    };

    // ✅ 4. Executar funções
    injectBannerHidingCSS();
    hidePowerBIBannerOptimized();

    // ✅ 5. Monitoramento contínuo (5 tentativas para Home)
    let attempts = 0;
    const maxAttempts = 5;
    const monitoringInterval = setInterval(() => {
      attempts++;
      hidePowerBIBannerOptimized();
      
      if (attempts >= maxAttempts) {
        console.log('🏁 Monitoramento de banner finalizado na Home');
        clearInterval(monitoringInterval);
      }
    }, 3000);

    // ✅ 6. Observer para novos elementos
    const observer = new MutationObserver((mutations) => {
      const hasNewNodes = mutations.some(mutation => mutation.addedNodes.length > 0);
      if (hasNewNodes) {
        setTimeout(hidePowerBIBannerOptimized, 1000);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // ✅ 7. Cleanup
    return () => {
      clearInterval(monitoringInterval);
      observer.disconnect();
      
      const cssElement = document.getElementById('powerbi-banner-hider-home');
      if (cssElement) {
        cssElement.remove();
      }
    };
  }, [dashboard]);

  const debugNavigationIssue = () => {
    console.log('🐛 ===== DEBUGGING NAVEGAÇÃO POWER BI (FIXED) =====');
    
    if (powerbiReport) {
      console.log('✅ powerbiReport existe');
      
      // ✅ 1. FOCO PRINCIPAL: Verificar páginas disponíveis
      powerbiReport.getPages().then(pages => {
        console.log(`📄 RESULTADO CRÍTICO: ${pages.length} página(s) encontrada(s)`);
        
        if (pages.length <= 1) {
          console.log('🚨 PROBLEMA IDENTIFICADO: Dashboard tem apenas 1 página!');
          console.log('💡 SOLUÇÃO: Navegação não aparece porque não há múltiplas páginas');
          console.log('🔧 VERIFIQUE: Se o dashboard no Power BI realmente tem várias páginas/abas');
          return;
        }
        
        console.log('✅ Múltiplas páginas detectadas - navegação DEVERIA funcionar');
        
        // Listar todas as páginas
        pages.forEach((page, index) => {
          console.log(`📄 Página ${index + 1}:`, {
            name: page.name,
            displayName: page.displayName,
            isActive: page.isActive ? '🟢 ATIVA' : '⚪ Inativa'
          });
        });
        
        // ✅ 2. TESTE CRÍTICO: Navegação programática
        console.log('🧪 TESTE DECISIVO: Tentando navegação programática...');
        const targetPage = pages.find(p => !p.isActive);
        
        if (targetPage) {
          targetPage.setActive().then(() => {
            console.log('🎉 SUCESSO! Navegação programática FUNCIONOU!');
            console.log('✅ ISSO SIGNIFICA: O problema é apenas visual/CSS dos botões');
            
            // Voltar para página original
            setTimeout(() => {
              pages[0].setActive().then(() => {
                console.log('✅ Voltou para página inicial');
              });
            }, 2000);
            
          }).catch(err => {
            console.error('❌ FALHA CRÍTICA: Navegação programática falhou!');
            console.error('🚨 ERRO:', err);
            
            if (err.message?.includes('permission') || err.message?.includes('unauthorized')) {
              console.error('🔐 DIAGNÓSTICO: Problema de PERMISSÕES no token');
              console.error('🔧 SOLUÇÃO: Verificar se o token tem permissões ReadWrite');
            } else {
              console.error('⚠️ DIAGNÓSTICO: Problema na configuração do embed');
            }
          });
        }
        
      }).catch(err => {
        console.error('❌ ERRO CRÍTICO: Não conseguiu obter páginas!');
        console.error('🚨 ISSO INDICA: Problema fundamental no embed');
        console.error('📝 ERRO:', err);
      });
      
      // ✅ 3. Verificar se botões existem no DOM
      setTimeout(() => {
        console.log('🔍 Verificando botões de navegação no DOM...');
        
        const navigationSelectors = [
          // Power BI específicos
          '[data-automation-id*="pageNavigation"]',
          '[data-automation-id*="navigation"]',
          '[class*="pageNavigation"]',
          '[class*="navigation"]',
          '.navigation-controls',
          '.page-navigation',
          
          // Botões genéricos
          'button[title*="next"]',
          'button[title*="previous"]',
          'button[title*="próxima"]',
          'button[title*="anterior"]',
          'button[aria-label*="next"]',
          'button[aria-label*="previous"]',
          
          // Tentar encontrar qualquer botão dentro do container Power BI
          '[data-module-name] button',
          '.visual-container button',
          '.report-container button'
        ];
        
        let totalButtons = 0;
        const foundElements = [];
        
        navigationSelectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            console.log(`🔘 Seletor "${selector}": ${elements.length} elemento(s)`);
            totalButtons += elements.length;
            
            elements.forEach((element, index) => {
              const el = element as HTMLElement;
              foundElements.push({
                selector,
                index,
                tagName: el.tagName,
                className: el.className,
                title: el.title,
                textContent: el.textContent?.trim(),
                disabled: el.hasAttribute('disabled'),
                visible: el.offsetWidth > 0 && el.offsetHeight > 0,
                style: {
                  display: getComputedStyle(el).display,
                  visibility: getComputedStyle(el).visibility,
                  opacity: getComputedStyle(el).opacity
                }
              });
            });
          }
        });
        
        console.log(`📊 RESULTADO: ${totalButtons} botões encontrados no total`);
        
        if (totalButtons === 0) {
          console.log('❌ NENHUM botão de navegação encontrado!');
          console.log('🔧 POSSÍVEIS CAUSAS:');
          console.log('   1. Dashboard tem apenas 1 página');
          console.log('   2. CSS está ocultando os botões');
          console.log('   3. Configuração pageNavigation não funcionou');
        } else {
          console.log('✅ Botões encontrados - analisando detalhes:');
          foundElements.forEach((el, i) => {
            console.log(`   Botão ${i + 1}:`, el);
          });
        }
        
        // Procurar especificamente por elementos que podem ser botões de navegação
        const allButtons = document.querySelectorAll('button');
        const suspiciousButtons = Array.from(allButtons).filter(btn => {
          const text = btn.textContent?.toLowerCase() || '';
          const title = btn.title?.toLowerCase() || '';
          const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
          
          return text.includes('next') || text.includes('previous') || 
                text.includes('próxima') || text.includes('anterior') ||
                title.includes('next') || title.includes('previous') ||
                ariaLabel.includes('next') || ariaLabel.includes('previous') ||
                text.includes('►') || text.includes('◄') ||
                text.includes('→') || text.includes('←');
        });
        
        if (suspiciousButtons.length > 0) {
          console.log(`🎯 Encontrados ${suspiciousButtons.length} botões suspeitos de serem navegação:`);
          suspiciousButtons.forEach((btn, i) => {
            console.log(`   Suspeito ${i + 1}:`, {
              text: btn.textContent,
              title: btn.title,
              className: btn.className,
              disabled: btn.disabled
            });
          });
        }
        
      }, 2000);
      
    } else {
      console.log('❌ powerbiReport não existe - embed falhou');
    }
    
    console.log('🐛 ===== FIM DEBUG =====');
  };

  // ✅ BUSCAR O DASHBOARD PRINCIPAL (configurável via admin)
  const fetchMainDashboard = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

      const response = await fetch(`${API_BASE_URL}/api/main-dashboard`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          const data = await response.json();
          throw new Error(data.suggestion || 'Dashboard principal não configurado');
        }
        throw new Error('Erro ao carregar dashboard principal');
      }

      const data = await response.json();
      setDashboard(data.dashboard);

      // ✅ Se é dashboard seguro E tem powerbi_report_id, obter token
      if (data.dashboard.embed_type === 'secure' && data.dashboard.powerbi_report_id) {
        await getEmbedToken(data.dashboard);
      } else {
        // Dashboard público, não precisa de token
        setIsLoading(false);
      }

    } catch (error) {
      console.error('❌ Erro ao carregar dashboard principal:', error);
      setError(error instanceof Error ? error.message : 'Erro ao carregar dashboard');
      setIsLoading(false);
    }
  };

  // ✅ OBTER TOKEN PARA DASHBOARDS SEGUROS
  const getEmbedToken = async (dashboardData: MainDashboard) => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      
      const response = await fetch(`${API_BASE_URL}/api/powerbi/embed-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          reportId: dashboardData.powerbi_report_id,
          groupId: dashboardData.powerbi_group_id,
          dashboardId: dashboardData.id
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao obter token de autenticação');
      }

      const tokenData = await response.json();
      setEmbedToken(tokenData);
      
      // Inicializar Power BI Embed
      setTimeout(() => {
        embedSecureReport(tokenData);
      }, 100);

    } catch (error) {
      console.error('❌ Erro ao obter token:', error);
      setError('Erro ao autenticar dashboard seguro');
      setIsLoading(false);
    }
  };

  // ✅ EMBED SEGURO COM POWER BI CLIENT
  const embedSecureReport = async (token: PowerBIEmbedToken) => {
    if (!reportContainerRef.current) return;

    try {
      const embedConfig = {
        type: 'report',
        id: token.reportId,
        embedUrl: token.embedUrl,
        accessToken: token.accessToken,
        tokenType: models.TokenType.Embed,
        permissions: models.Permissions.ReadWrite,
        settings: {
          layoutType: models.LayoutType.Custom,
          customLayout: {
            displayOption: models.DisplayOption.FitToPage
          },
          panes: {
            filters: { expanded: false, visible: false },
            pageNavigation: { 
              visible: true,
              position: models.PageNavigationPosition.Bottom
             }
          },
          background: models.BackgroundType.Default,
          navContentPaneEnabled: true,
          bars: {
            statusBar: { visible: false },
            actionBar: { visible: false }
          }
        }
      };

      // Limpar embed anterior
      if (powerbiReport) {
        try {
          powerbiReport.off('loaded');
          powerbiReport.off('error');
          powerbiReport.off('rendered');
          if (typeof (powerbiReport as any).remove === 'function') {
            (powerbiReport as any).remove();
          }
        } catch (e) {
          console.warn('Cleanup warning:', e);
        }
      }

      const powerbiService = new service.Service(
        factories.hpmFactory, 
        factories.wpmpFactory, 
        factories.routerFactory
      );

      const report = powerbiService.embed(reportContainerRef.current, embedConfig) as Report;
      setPowerbiReport(report);

      report.on('loaded', () => {
        console.log('✅ Dashboard principal carregado');
        setIsLoading(false);
        
        // ✅ Aplicar layout após carregar
        report.updateSettings({
          layoutType: models.LayoutType.Custom,
          customLayout: {
            displayOption: models.DisplayOption.FitToPage
          },
          panes: {
            pageNavigation: { 
              visible: true,
              position: models.PageNavigationPosition.Bottom // ✅ Aqui também
            }
          },
          navContentPaneEnabled: true
        });

        // ✅ Ocultar banners após carregar
        setTimeout(() => {
          const hideBanners = () => {
            const selectors = [
              '.notification-bar',
              '.teaching-bubble', 
              '.teaching-tooltip',
              '.banner-container',
              '[class*="notification"]',
              '[class*="banner"]',
              '[class*="teaching"]'
            ];
            
            selectors.forEach(selector => {
              const elements = document.querySelectorAll(selector);
              elements.forEach(el => {
                const htmlElement = el as HTMLElement;
                if (htmlElement && htmlElement.style.display !== 'none') {
                  htmlElement.style.display = 'none';
                }
              });
            });
          };
          hideBanners();
        }, 1000);
      });

      report.on('error', (event) => {
        console.error('❌ Erro no Power BI:', event.detail);
        setError('Erro ao carregar dashboard');
        setIsLoading(false);
      });

      report.on('rendered', () => {
        console.log('🎨 Dashboard principal renderizado!');
        
        // Ocultar banners após renderizar
        setTimeout(() => {
          const hideBanners = () => {
            const selectors = [
              '.notification-bar',
              '.teaching-bubble', 
              '.teaching-tooltip',
              '.banner-container',
              '[class*="notification"]',
              '[class*="banner"]',
              '[class*="teaching"]'
            ];
            
            selectors.forEach(selector => {
              const elements = document.querySelectorAll(selector);
              elements.forEach(el => {
                const htmlElement = el as HTMLElement;
                if (htmlElement && htmlElement.style.display !== 'none') {
                  htmlElement.style.display = 'none';
                }
              });
            });
          };
          hideBanners();
        }, 500);
        
        // ✅ ADICIONAR DEBUG AQUI
        setTimeout(() => {
          debugNavigationIssue();
        }, 3000);
      });

    } catch (error) {
      console.error('❌ Erro no embed:', error);
      setError('Erro ao inicializar dashboard');
      setIsLoading(false);
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

  // ✅ RECARREGAR DASHBOARD
  const handleRefresh = () => {
    if (dashboard?.embed_type === 'secure') {
      fetchMainDashboard();
    } else if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  // ✅ ABRIR EM NOVA ABA
  const handleOpenInNewTab = () => {
    if (dashboard) {
      window.open(dashboard.url_iframe, '_blank');
    }
  };

  // ✅ INICIALIZAR AO CARREGAR A PÁGINA
  useEffect(() => {
    fetchMainDashboard();

    // Cleanup ao desmontar
    return () => {
      if (powerbiReport) {
        try {
          powerbiReport.off('loaded');
          powerbiReport.off('error');
          powerbiReport.off('rendered');
          if (typeof (powerbiReport as any).remove === 'function') {
            (powerbiReport as any).remove();
          }
        } catch (e) {
          console.warn('Cleanup warning:', e);
        }
      }
    };
  }, []);

  const isSecureDashboard = dashboard?.embed_type === 'secure';

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header Fixo */}
      <Header />
      
      {/* Container do Dashboard - Ocupa 100% do espaço restante */}
      <main className="flex-1 relative overflow-auto">

        {/* Error State */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
            <div className="flex flex-col items-center space-y-4 text-center p-6">
              <AlertTriangle className="h-12 w-12 text-red-500" />
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Dashboard Indisponível
                </h3>
                <p className="text-sm text-gray-600 mb-4">{error}</p>
              </div>
              <div className="flex space-x-3">
                <Button
                  onClick={fetchMainDashboard}
                  className="bg-[#165A5D] hover:bg-[#0d3638]"
                >
                  <RotateCw className="h-4 w-4 mr-2" />
                  Tentar Novamente
                </Button>
                {user?.tipo_usuario !== 'usuario' && (
                  <Button
                    variant="outline"
                    onClick={() => window.location.href = '/dashboards'}
                  >
                    Ver Todos os Dashboards
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ✅ Dashboard Embed - Power BI Seguro COM OVERLAY */}
        {isSecureDashboard && !error && (
          <div className="relative w-full h-full powerbi-container-home">
            {/* Overlay para cobrir banner de trial */}
            <div
              className="absolute top-0 left-0 right-0 z-10 pointer-events-none"
              style={{
                height: '42px', // Altura do banner
                background: '#ffffff'
              }}
            />
            
            {/* Container do Power BI */}
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
          </div>
        )}

        {/* ✅ Dashboard Embed - Iframe Público COM CLIPPING */}
        {dashboard && !isSecureDashboard && !error && (
          <div className="w-full h-full powerbi-container-clipped-home">
            <iframe
              ref={iframeRef}
              src={getOptimizedUrl(dashboard.url_iframe)}
              title={dashboard.titulo}
              width="100%"
              height="100%"
              frameBorder="0"
              scrolling="yes"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
              referrerPolicy="strict-origin-when-cross-origin"
              className="w-full h-full border-0"
              style={{
                border: 'none',
                overflow: 'hidden',
                width: '100%',
                height: '100%',
                // ✅ Cortar o topo para ocultar banner
                clipPath: 'inset(42px 0px 0px 0px)', // Corta 42px do topo
                display: 'block',
              }}
              onLoad={() => {
                console.log('🚀 Dashboard público carregado!', dashboard.titulo);
                setIsLoading(false);
              }}
              onError={() => {
                console.error('❌ Erro ao carregar dashboard público');
                setError('Erro ao carregar dashboard');
                setIsLoading(false);
              }}
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default Home;