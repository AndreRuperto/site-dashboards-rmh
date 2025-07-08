import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, User, Eye, Edit, Trash2, Download, FileText, BarChart3, Image, AlertCircle, Loader2 } from 'lucide-react';
import { PDFDocument } from '@/contexts/PDFContext';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { isAdmin } from '@/types';
import * as pdfjsLib from 'pdfjs-dist';

// ✅ CONFIGURAÇÃO OTIMIZADA DO PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.9.179/pdf.worker.min.js';

interface PDFCardProps {
  document: PDFDocument;
  onEdit?: (document: PDFDocument) => void;
  onDelete?: (id: string) => void;
}

const PDFCard: React.FC<PDFCardProps> = ({ document, onEdit, onDelete }) => {
  const { user } = useAuth();
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLoadingThumbnail, setIsLoadingThumbnail] = useState(true);
  const [thumbnailError, setThumbnailError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  };

  // Verificação de permissões
  const canEdit = user && (isAdmin(user) || document.uploadedBy === user.email);
  const userIsAdmin = user ? isAdmin(user) : false;

  // Check if URL is valid and accessible
  const isValidFileUrl = (url: string): boolean => {
    return url && 
           !url.includes('sample-document.pdf') && 
           !url.includes('example.com') &&
           (url.startsWith('http') || url.startsWith('/'));
  };

  // Detect file type
  const getFileType = (url: string): 'pdf' | 'google-sheet' | 'google-doc' | 'image' | 'unknown' => {
    if (url.includes('docs.google.com/spreadsheets')) return 'google-sheet';
    if (url.includes('docs.google.com/document')) return 'google-doc';
    if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) return 'image';
    if (url.includes('.pdf') || url.includes('pdf')) return 'pdf';
    return 'unknown';
  };

  // Get file icon and label
  const getFileInfo = () => {
    const fileType = getFileType(document.fileUrl);
    switch(fileType) {
      case 'google-sheet': 
        return { icon: BarChart3, label: 'Planilha', color: 'text-green-600' };
      case 'google-doc': 
        return { icon: FileText, label: 'Documento', color: 'text-blue-600' };
      case 'image': 
        return { icon: Image, label: 'Imagem', color: 'text-purple-600' };
      case 'pdf': 
        return { icon: FileText, label: 'PDF', color: 'text-rmh-primary' };
      default: 
        return { icon: FileText, label: 'Arquivo', color: 'text-gray-600' };
    }
  };

  // ✅ FUNÇÃO CORRIGIDA PARA GERAR MINIATURA PDF
  const generateHighQualityPDFThumbnail = async (pdfUrl: string): Promise<string> => {
    try {
      console.log(`📄 Gerando miniatura HD para: ${document.title}`);
      
      const browserDocument = window.document;
      
      const loadingTask = pdfjsLib.getDocument({
        url: pdfUrl,
        cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.9.179/cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.9.179/standard_fonts/`,
        disableAutoFetch: false,
        disableStream: false
      });
      
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);
      
      // ✅ CONFIGURAÇÕES PARA ALTA QUALIDADE E TAMANHO MAIOR
      const desiredWidth = 500;  // Aumentado de 400
      const desiredHeight = 650; // Aumentado de 520
      
      const originalViewport = page.getViewport({ scale: 1.0 });
      const scaleX = desiredWidth / originalViewport.width;
      const scaleY = desiredHeight / originalViewport.height;
      const scale = Math.min(scaleX, scaleY) * 3; // Aumentado para 3x
      
      const viewport = page.getViewport({ scale });
      
      let canvas = canvasRef.current;
      if (!canvas) {
        canvas = browserDocument.createElement('canvas');
      }
      
      const context = canvas.getContext('2d', { 
        alpha: false,
        desynchronized: false
      });
      
      if (!context) {
        throw new Error('Contexto 2D não disponível');
      }
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      // Fundo branco sólido
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, viewport.width, viewport.height);
      
      // Configurações de qualidade
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        renderInteractiveForms: false,
        enableWebGL: false
      };
      
      await page.render(renderContext).promise;
      
      // ✅ REDIMENSIONAMENTO FINAL MANTENDO QUALIDADE
      const finalCanvas = browserDocument.createElement('canvas');
      const finalContext = finalCanvas.getContext('2d');
      
      if (finalContext) {
        const finalWidth = Math.min(viewport.width / 3, desiredWidth);
        const finalHeight = Math.min(viewport.height / 3, desiredHeight);
        
        finalCanvas.width = finalWidth;
        finalCanvas.height = finalHeight;
        
        finalContext.imageSmoothingEnabled = true;
        finalContext.imageSmoothingQuality = 'high';
        
        finalContext.drawImage(
          canvas,
          0, 0, canvas.width, canvas.height,
          0, 0, finalWidth, finalHeight
        );
        
        const result = finalCanvas.toDataURL('image/jpeg', 0.95); // Qualidade máxima
        
        console.log(`✅ Miniatura HD gerada: ${finalWidth}x${finalHeight}px`);
        
        page.cleanup();
        
        return result;
      }
      
      return canvas.toDataURL('image/jpeg', 0.92);
      
    } catch (error) {
      console.error('❌ Erro ao gerar miniatura HD:', error);
      throw error;
    }
  };

  // ✅ VERSÃO SIMPLIFICADA COMO FALLBACK
  const generateSimplePDFThumbnail = async (pdfUrl: string): Promise<string> => {
    try {
      console.log(`📄 Gerando miniatura simples para: ${document.title}`);
      
      const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
      const page = await pdf.getPage(1);
      
      const viewport = page.getViewport({ scale: 2.0 }); // Aumentado para 2.0
      const canvas = canvasRef.current || window.document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) {
        throw new Error('Contexto 2D não disponível');
      }
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);
      
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      
      page.cleanup();
      
      return canvas.toDataURL('image/jpeg', 0.90);
      
    } catch (error) {
      console.error('❌ Erro na miniatura simples:', error);
      throw error;
    }
  };

  const generateThumbnail = async () => {
    if (!isValidFileUrl(document.fileUrl)) {
      setThumbnailError(true);
      setIsLoadingThumbnail(false);
      return;
    }

    try {
      setIsLoadingThumbnail(true);
      setThumbnailError(false);
      setImageLoaded(false);

      console.log(`🎯 Processando arquivo: ${document.title}`);

      const fileType = getFileType(document.fileUrl);
      
      if (fileType === 'google-sheet') {
        const sheetId = document.fileUrl.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
        if (sheetId) {
          const thumbnailUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=png&gid=0`;
          setThumbnailUrl(thumbnailUrl);
          console.log('✅ Miniatura Google Sheets configurada');
          setIsLoadingThumbnail(false);
          return;
        }
      }
      
      if (fileType === 'google-doc') {
        const docId = document.fileUrl.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
        if (docId) {
          const thumbnailUrl = `https://drive.google.com/thumbnail?id=${docId}&sz=w500-h650`; // Tamanho maior
          setThumbnailUrl(thumbnailUrl);
          console.log('✅ Miniatura Google Docs configurada');
          setIsLoadingThumbnail(false);
          return;
        }
      }
      
      if (fileType === 'image') {
        setThumbnailUrl(document.fileUrl);
        console.log('✅ Imagem carregada como miniatura');
        setIsLoadingThumbnail(false);
        return;
      }
      
      if (fileType === 'pdf') {
        try {
          const thumbnailData = await generateHighQualityPDFThumbnail(document.fileUrl);
          setThumbnailUrl(thumbnailData);
          console.log('✅ Miniatura PDF HD gerada com sucesso');
        } catch (hdError) {
          console.warn('⚠️ Fallback para miniatura simples:', hdError);
          try {
            const simpleThumbnail = await generateSimplePDFThumbnail(document.fileUrl);
            setThumbnailUrl(simpleThumbnail);
            console.log('✅ Miniatura PDF simples gerada com sucesso');
          } catch (simpleError) {
            console.error('❌ Ambas as versões falharam:', simpleError);
            throw simpleError;
          }
        }
      }
      
    } catch (error) {
      console.error(`❌ Erro ao gerar miniatura para ${document.title}:`, error);
      setThumbnailError(true);
    } finally {
      setIsLoadingThumbnail(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      generateThumbnail();
    }, 150);
    
    return () => clearTimeout(timeoutId);
  }, [document.fileUrl]);

  const handleDownload = () => {
    if (!isValidFileUrl(document.fileUrl)) {
      alert('Arquivo não disponível para download');
      return;
    }
    
    const link = window.document.createElement('a');
    link.href = document.fileUrl;
    link.download = document.fileName;
    link.target = '_blank';
    link.click();
  };

  const handleView = () => {
    if (!isValidFileUrl(document.fileUrl)) {
      alert('Arquivo não disponível para visualização');
      return;
    }
    setIsViewerOpen(true);
  };

  const fileInfo = getFileInfo();
  const IconComponent = fileInfo.icon;

  return (
    <>
      <Card className="group hover:shadow-xl transition-all duration-300 border-gray-200 hover:border-rmh-primary/50 overflow-hidden hover:scale-[1.02]">
        {/* ✅ ÁREA DE MINIATURA COM TAMANHO MÁXIMO */}
        <div className="relative bg-gradient-to-br from-gray-50 to-gray-100">
          <AspectRatio ratio={4/3} className="bg-white min-h-[320px]"> {/* Aumentado de 280px */}
            {isLoadingThumbnail && (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-rmh-primary/5 to-rmh-secondary/5">
                <div className="bg-white/90 backdrop-blur-sm rounded-lg p-6 shadow-lg">
                  <div className="flex flex-col items-center space-y-3">
                    <Loader2 className="h-8 w-8 text-rmh-primary animate-spin" />
                    <div className="text-sm text-rmh-primary font-medium">
                      Gerando visualização...
                    </div>
                    <div className="text-xs text-rmh-gray">
                      {getFileType(document.fileUrl) === 'pdf' ? 'PDF de alta qualidade' : 'Carregando arquivo'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {thumbnailUrl && !thumbnailError && (
              <div className="relative w-full h-full"> {/* ✅ REMOVIDO padding para ocupar 100% */}
                <img 
                  src={thumbnailUrl} 
                  alt={`Miniatura de ${document.title}`}
                  className={`w-full h-full object-cover rounded-t-lg transition-all duration-500 ${
                    imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                  }`} // ✅ MUDADO de object-contain para object-cover
                  onLoad={() => {
                    setImageLoaded(true);
                    console.log(`✅ Miniatura carregada: ${document.title}`);
                  }}
                  onError={() => {
                    console.log(`❌ Erro ao carregar miniatura: ${document.title}`);
                    setThumbnailError(true);
                    setThumbnailUrl(null);
                  }}
                  style={{
                    filter: 'contrast(1.05) brightness(1.02)'
                  }}
                />
                

                {!imageLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                    <Loader2 className="h-6 w-6 text-rmh-primary animate-spin" />
                  </div>
                )}
              </div>
            )}

            {(thumbnailError || (!thumbnailUrl && !isLoadingThumbnail)) && (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-rmh-primary/10 to-rmh-secondary/10">
                <div className="bg-white/90 backdrop-blur-sm rounded-lg p-6 shadow-lg">
                  <div className="flex flex-col items-center space-y-3">
                    {thumbnailError ? (
                      <AlertCircle className="h-16 w-16 text-orange-500" /> // ✅ Aumentado de 12 para 16
                    ) : (
                      <IconComponent className={`h-16 w-16 ${fileInfo.color}`} /> // ✅ Aumentado de 12 para 16
                    )}
                    <div className="text-center">
                      <div className={`text-base font-medium ${thumbnailError ? 'text-orange-600' : fileInfo.color} mb-2`}>
                        {thumbnailError ? 'Visualização indisponível' : fileInfo.label}
                      </div>
                      <div className="text-sm text-rmh-gray max-w-[150px] truncate">
                        {document.fileName}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </AspectRatio>
          
          <canvas ref={canvasRef} className="hidden" />
          
          {/* ✅ BADGES POSICIONADAS */}
          <div className="absolute top-4 left-4">
            <Badge 
              variant="secondary" 
              className="bg-white/95 backdrop-blur-sm text-rmh-primary text-sm font-medium border border-rmh-primary/20 shadow-lg"
            >
              {document.category}
            </Badge>
          </div>
        </div>

        {/* ✅ CONTEÚDO DO CARD */}
        <CardHeader className="pb-3 pt-4">
          <CardTitle className="text-lg font-heading font-semibold text-rmh-primary line-clamp-2 leading-tight hover:text-rmh-secondary transition-colors">
            {document.title}
          </CardTitle>
          <CardDescription className="text-sm text-rmh-gray line-clamp-2">
            {document.description}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0 pb-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-rmh-gray">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(document.uploadedAt)}</span>
              </div>
            </div>

            <div className="flex space-x-2">
              <Button
                size="sm"
                onClick={handleView}
                disabled={!isValidFileUrl(document.fileUrl)}
                className="flex-1 bg-rmh-primary hover:bg-rmh-secondary text-sm h-9 disabled:opacity-50 transition-all duration-200"
              >
                <Eye className="h-4 w-4 mr-1" />
                Ver
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={!isValidFileUrl(document.fileUrl)}
                className="border-rmh-primary text-rmh-primary hover:bg-rmh-primary hover:text-white h-9 px-3 disabled:opacity-50 transition-all duration-200"
              >
                <Download className="h-4 w-4" />
              </Button>

              {canEdit && onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(document)}
                  className="border-rmh-primary text-rmh-primary hover:bg-rmh-primary hover:text-white h-9 px-3 transition-all duration-200"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}

              {canEdit && onDelete && userIsAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(document.id)}
                  className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white h-9 px-3 transition-all duration-200"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ✅ MODAL VIEWER */}
      <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
        <DialogContent className="max-w-6xl max-h-[95vh] p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b border-gray-100">
            <DialogTitle className="text-xl font-heading font-semibold text-rmh-primary">
              {document.title}
            </DialogTitle>
            <p className="text-sm text-rmh-gray mt-1">{document.description}</p>
          </DialogHeader>
          <div className="px-6 pb-6">
            <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50 h-[75vh] flex items-center justify-center">
              {isValidFileUrl(document.fileUrl) ? (
                getFileType(document.fileUrl) === 'image' ? (
                  <img 
                    src={document.fileUrl} 
                    alt={document.title}
                    className="max-w-full max-h-full object-contain rounded"
                  />
                ) : (
                  <iframe
                    src={document.fileUrl}
                    className="w-full h-full border-0"
                    title={document.title}
                  />
                )
              ) : (
                <div className="text-center p-8">
                  <IconComponent className="h-16 w-16 text-rmh-gray mx-auto mb-4" />
                  <p className="text-rmh-gray mb-4 text-lg">Arquivo não disponível</p>
                  <p className="text-sm text-rmh-gray">
                    Este é um documento de exemplo. Substitua por um arquivo real.
                  </p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PDFCard;