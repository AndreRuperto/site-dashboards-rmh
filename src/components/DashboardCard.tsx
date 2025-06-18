import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, User, Eye, Edit, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { Dashboard } from '@/contexts/DashboardContext';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';

interface DashboardCardProps {
  dashboard: Dashboard;
  onEdit?: (dashboard: Dashboard) => void;
  onDelete?: (id: string) => void;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ dashboard, onEdit, onDelete }) => {
  const { user } = useAuth();
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const dialogRef = useRef<HTMLDivElement>(null);

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
    if (!open) {
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

  const getOptimizedUrl = (baseUrl: string) => {
    const separator = baseUrl.includes('?') ? '&' : '?';
    const params = new URLSearchParams({
      chromeless: '1',
      filterPaneEnabled: 'false',
      navContentPaneEnabled: 'false',
      autofit: '1',
      fitToPage: '1',
      zoom: 'fitToPage',
      'rs:embed': 'true',
      autoSize: 'true'
    });
    return `${baseUrl}${separator}${params.toString()}`;
  };

  return (
    <>
      <Card className="group hover:shadow-lg transition-all duration-300 border-gray-200 hover:border-corporate-blue/50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              <CardTitle className="text-lg font-heading font-semibold text-corporate-blue line-clamp-1">
                {dashboard.titulo}
              </CardTitle>
              <CardDescription className="text-sm text-corporate-gray line-clamp-2">
                {dashboard.descricao || 'Sem descrição'}
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="secondary" className="bg-corporate-lightGray text-corporate-blue">
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
              <div className="flex items-center space-x-1">
                <User className="h-3 w-3" />
                <span>Por: {dashboard.criado_por_nome || dashboard.criado_por || 'Sistema'}</span>
              </div>
            </div>

            <div className="flex space-x-2">
              <Dialog open={isViewerOpen} onOpenChange={handleViewerOpen}>
                <DialogTrigger asChild>
                  <Button
                    className="flex-1 bg-primary hover:bg-primary-800"
                    onClick={() => {
                      setIsViewerOpen(true);
                      enterFullscreen(); // ✅ agora dentro de um clique do usuário
                    }}
                  >
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
                  {onDelete && user?.tipo_usuario === 'admin' && (
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
                <DialogTitle className="text-lg font-heading font-semibold text-corporate-blue truncate">
                  {dashboard.titulo}
                </DialogTitle>
                <p className="text-xs text-corporate-gray mt-0.5 truncate">
                  {dashboard.descricao || 'Sem descrição'}
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

          <div className="flex-1 min-h-0 p-1 relative" style={{ maxHeight: '1080px' }}>
            {iframeLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                <div className="flex flex-col items-center space-y-3">
                  <Loader2 className="h-8 w-8 animate-spin text-corporate-blue" />
                  <p className="text-sm text-corporate-gray">Carregando dashboard...</p>
                </div>
              </div>
            )}

            <iframe
              src={getOptimizedUrl(dashboard.url_iframe)}
              title={dashboard.titulo}
              width="100%"
              height="100%"
              frameBorder="0"
              scrolling="no"
              allowFullScreen
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
              onLoad={(e) => {
                const iframe = e.target as HTMLIFrameElement;
                console.log('🚀 Dashboard carregado!', dashboard.titulo);
                console.log('🔗 URL:', iframe.src);
                setIframeLoading(false);
              }}
              onError={() => {
                console.error('❌ Erro ao carregar dashboard');
                setIframeLoading(false);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DashboardCard;