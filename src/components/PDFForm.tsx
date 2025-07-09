import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PDFDocument } from '@/contexts/PDFContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { FileText, Upload, Link, X, CheckCircle, AlertCircle } from 'lucide-react';

interface PDFFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (documentData: Partial<PDFDocument>) => void;
  document?: PDFDocument | null; // Para edição
  categories: string[];
  uploadFile: (file: File, documentData: Partial<PDFDocument>, existingId?: string) => Promise<PDFDocument>; // Função de upload
}

type UploadType = 'file' | 'url';

const PDFForm: React.FC<PDFFormProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  document, 
  categories,
  uploadFile // Receber a função de upload
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    newCategory: '',
    fileName: '',
    fileUrl: ''
  });
  
  const [uploadType, setUploadType] = useState<UploadType>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');

  // Preencher formulário quando for edição
  useEffect(() => {
    if (document) {
      setFormData({
        title: document.title,
        description: document.description,
        category: document.category,
        newCategory: '',
        fileName: document.fileName,
        fileUrl: document.fileUrl
      });
      
      // Se for URL, definir como upload por URL
      if (document.fileUrl.startsWith('http')) {
        setUploadType('url');
      }
    } else {
      // Limpar formulário para novo documento
      setFormData({
        title: '',
        description: '',
        category: '',
        newCategory: '',
        fileName: '',
        fileUrl: ''
      });
      setSelectedFile(null);
      setUploadType('file');
      setUploadStatus('idle');
      setUploadProgress(0);
    }
  }, [document, isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tipo de arquivo
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp'
      ];

      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Erro",
          description: "Tipo de arquivo não permitido. Use PDF, DOC, XLS, PPT ou imagens.",
          variant: "destructive"
        });
        return;
      }

      // Validar tamanho (máximo 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Erro",
          description: "Arquivo muito grande. Máximo 10MB permitido.",
          variant: "destructive"
        });
        return;
      }

      setSelectedFile(file);
      setUploadStatus('idle');
      setFormData(prev => ({
        ...prev,
        fileName: file.name,
        title: prev.title || file.name.replace(/\.[^/.]+$/, '') // Remove extensão
      }));
    }
  };

  // ✅ REMOVIDO: Função uploadFile duplicada 
  // A função uploadFile já vem como prop do contexto

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const categoryToUse = formData.newCategory.trim() || formData.category;
      
      if (!categoryToUse) {
        toast({
          title: "Erro",
          description: "Por favor, selecione ou digite uma categoria",
          variant: "destructive"
        });
        return;
      }

      if (document) { // ✅ CORRIGIDO: usar 'document' em vez de 'editingDocument'
        // ✅ EDITANDO DOCUMENTO EXISTENTE
        
        // Se foi selecionado um novo arquivo, fazer upload primeiro
        if (selectedFile) {
          try {
            setUploadStatus('uploading');
            setUploadProgress(0);
            
            // Simular progresso para feedback visual
            const progressInterval = setInterval(() => {
              setUploadProgress(prev => {
                if (prev >= 90) {
                  clearInterval(progressInterval);
                  return 90;
                }
                return prev + 10;
              });
            }, 200);

            // Usar a função uploadFile do contexto
            const uploadedDocument = await uploadFile(
              selectedFile,
              {
                title: formData.title.trim(),
                description: formData.description.trim(),
                category: categoryToUse,
                isActive: true
              },
              document?.id // <-- passa o ID do documento existente
            );
            
            clearInterval(progressInterval);
            setUploadProgress(100);
            setUploadStatus('success');
            
            // Atualizar o documento com os novos dados incluindo o novo arquivo
            const updates: Partial<PDFDocument> = {
              title: formData.title.trim(),
              description: formData.description.trim(),
              category: categoryToUse,
              fileName: uploadedDocument.fileName,
              fileUrl: uploadedDocument.fileUrl
            };

            onSubmit(updates);
            
            toast({
              title: "Sucesso",
              description: "Documento e arquivo atualizados com sucesso!",
            });

            // Fechar modal
            setTimeout(() => {
              onClose();
            }, 1000);

          } catch (error) {
            setUploadStatus('error');
            console.error('Erro no upload:', error);
            toast({
              title: "Erro no Upload",
              description: error instanceof Error ? error.message : "Falha ao enviar arquivo",
              variant: "destructive"
            });
            return;
          }
        } else {
          // Edição sem novo arquivo - apenas atualizar metadados
          const updates: Partial<PDFDocument> = {
            title: formData.title.trim(),
            description: formData.description.trim(),
            category: categoryToUse
          };

          // Se mudou a URL, incluir nos updates
          if (formData.fileUrl !== document?.fileUrl) {
            updates.fileUrl = formData.fileUrl.trim();
          }

          // Se mudou o nome do arquivo, incluir nos updates
          if (formData.fileName !== document?.fileName) {
            updates.fileName = formData.fileName.trim();
          }

          onSubmit(updates);
        }
      } else {
        // ✅ CRIANDO NOVO DOCUMENTO
        if (uploadType === 'file' && selectedFile) {
          // Upload de arquivo físico - usar função específica do contexto
          const documentData: Partial<PDFDocument> = {
            title: formData.title.trim(),
            description: formData.description.trim(),
            category: categoryToUse,
            isActive: true
          };

          setUploadStatus('uploading');
          setUploadProgress(0);
          
          // Simular progresso para feedback visual
          const progressInterval = setInterval(() => {
            setUploadProgress(prev => {
              if (prev >= 90) {
                clearInterval(progressInterval);
                return 90;
              }
              return prev + 10;
            });
          }, 200);

          try {
            // Usar a função uploadFile do contexto
            const uploadedDocument = await uploadFile(selectedFile, documentData);
            
            clearInterval(progressInterval);
            setUploadProgress(100);
            setUploadStatus('success');
            
            toast({
              title: "Sucesso",
              description: "Arquivo enviado com sucesso!",
            });

            // Fechar modal
            setTimeout(() => {
              onClose();
            }, 1000);
            
          } catch (error) {
            clearInterval(progressInterval);
            setUploadStatus('error');
            console.error('Erro no upload:', error);
            toast({
              title: "Erro no Upload",
              description: error instanceof Error ? error.message : "Falha ao enviar arquivo",
              variant: "destructive"
            });
            return;
          }
        } else {
          // ✅ DOCUMENTO VIA URL
          const documentData: Partial<PDFDocument> = {
            title: formData.title.trim(),
            description: formData.description.trim(),
            category: categoryToUse,
            fileName: formData.fileName || 'Documento via URL',
            fileUrl: formData.fileUrl.trim(),
            isActive: true
          };

          onSubmit(documentData);
        }
      }
      
    } catch (error) {
      console.error('Erro ao salvar documento:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar documento. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
      if (uploadType !== 'file' || !selectedFile) {
        setUploadStatus('idle');
        setUploadProgress(0);
      }
    }
  };

  const isValid = formData.title.trim() && 
                  (formData.category || formData.newCategory.trim()) &&
                  ((uploadType === 'file' && (selectedFile || document)) ||
                   (uploadType === 'url' && formData.fileUrl.trim()));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-rmh-primary" />
            <span>{document ? 'Editar Documento' : 'Novo Documento'}</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Nome do documento"
              required
            />
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descreva o conteúdo do documento"
              rows={3}
            />
          </div>

          {/* Categoria */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Categoria Existente</Label>
              <Select 
                value={formData.category} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, category: value, newCategory: '' }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newCategory">Nova Categoria</Label>
              <Input
                id="newCategory"
                value={formData.newCategory}
                onChange={(e) => setFormData(prev => ({ ...prev, newCategory: e.target.value, category: '' }))}
                placeholder="Digite nova categoria"
              />
            </div>
          </div>

          {/* Tipo de Upload (apenas para novos documentos) */}
          {!document && (
            <div className="space-y-3">
              <Label>Tipo de Arquivo</Label>
              <div className="flex space-x-4">
                <Button
                  type="button"
                  variant={uploadType === 'file' ? 'default' : 'outline'}
                  onClick={() => setUploadType('file')}
                  className="flex items-center space-x-2"
                >
                  <Upload className="h-4 w-4" />
                  <span>Upload de Arquivo</span>
                </Button>
                <Button
                  type="button"
                  variant={uploadType === 'url' ? 'default' : 'outline'}
                  onClick={() => setUploadType('url')}
                  className="flex items-center space-x-2"
                >
                  <Link className="h-4 w-4" />
                  <span>Link/URL</span>
                </Button>
              </div>
            </div>
          )}

          {/* Upload de Arquivo */}
          {uploadType === 'file' && !document && (
            <div className="space-y-3">
              <Label htmlFor="file">Arquivo *</Label>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Input
                    id="file"
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp"
                    onChange={handleFileChange}
                    className="flex-1"
                    disabled={uploadStatus === 'uploading'}
                  />
                  {selectedFile && uploadStatus === 'idle' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedFile(null);
                        setFormData(prev => ({ ...prev, fileName: '', title: '' }));
                        setUploadStatus('idle');
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Status do Upload */}
                {selectedFile && (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm">
                      {uploadStatus === 'uploading' && (
                        <div className="flex items-center space-x-2 text-blue-600">
                          <Upload className="h-4 w-4 animate-pulse" />
                          <span>Enviando... {Math.round(uploadProgress)}%</span>
                        </div>
                      )}
                      {uploadStatus === 'success' && (
                        <div className="flex items-center space-x-2 text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          <span>Arquivo enviado com sucesso!</span>
                        </div>
                      )}
                      {uploadStatus === 'error' && (
                        <div className="flex items-center space-x-2 text-red-600">
                          <AlertCircle className="h-4 w-4" />
                          <span>Erro no upload. Tente novamente.</span>
                        </div>
                      )}
                      {uploadStatus === 'idle' && (
                        <div className="flex items-center space-x-2 text-gray-600">
                          <FileText className="h-4 w-4" />
                          <span>{selectedFile.name}</span>
                        </div>
                      )}
                    </div>

                    {/* Barra de Progresso */}
                    {uploadStatus === 'uploading' && (
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                    )}
                  </div>
                )}

                <p className="text-xs text-gray-500">
                  Tipos permitidos: PDF, DOC, XLS, PPT, imagens • Máximo: 10MB
                </p>
              </div>
            </div>
          )}

          {/* URL do Arquivo */}
          {uploadType === 'url' && (
            <div className="space-y-2">
              <Label htmlFor="fileUrl">URL do Arquivo *</Label>
              <Input
                id="fileUrl"
                type="url"
                value={formData.fileUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, fileUrl: e.target.value }))}
                placeholder="https://exemplo.com/documento.pdf"
                required={uploadType === 'url'}
              />
              <p className="text-xs text-gray-500">
                Cole a URL de um documento do Google Drive, Dropbox, ou qualquer link público
              </p>
            </div>
          )}

          {/* Nome do Arquivo (para URLs) */}
          {uploadType === 'url' && (
            <div className="space-y-2">
              <Label htmlFor="fileName">Nome do Arquivo</Label>
              <Input
                id="fileName"
                value={formData.fileName}
                onChange={(e) => setFormData(prev => ({ ...prev, fileName: e.target.value }))}
                placeholder="documento.pdf"
              />
            </div>
          )}

          {/* Para edição, mostrar arquivo atual + opção de substituir */}
          {document && (
            <div className="space-y-4">
              <Label>Arquivo Atual</Label>
              <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                <FileText className="h-4 w-4 text-rmh-primary" />
                <span className="text-sm text-gray-700">{document.fileName}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(document.fileUrl, '_blank')}
                >
                  Ver Arquivo
                </Button>
              </div>
              
              {/* Opção para substituir arquivo */}
              <div className="space-y-3">
                <Label>Substituir Arquivo</Label>
                <div className="flex space-x-4">
                  <Button
                    type="button"
                    variant={uploadType === 'file' ? 'default' : 'outline'}
                    onClick={() => setUploadType('file')}
                    className="flex items-center space-x-2"
                  >
                    <Upload className="h-4 w-4" />
                    <span>Novo Upload</span>
                  </Button>
                  <Button
                    type="button"
                    variant={uploadType === 'url' ? 'default' : 'outline'}
                    onClick={() => setUploadType('url')}
                    className="flex items-center space-x-2"
                  >
                    <Link className="h-4 w-4" />
                    <span>Nova URL</span>
                  </Button>
                </div>
              </div>

              {/* Upload de novo arquivo */}
              {uploadType === 'file' && (
                <div className="space-y-3">
                  <Label htmlFor="file-edit">Selecionar Novo Arquivo</Label>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Input
                        id="file-edit"
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp"
                        onChange={handleFileChange}
                        className="flex-1"
                        disabled={uploadStatus === 'uploading'}
                      />
                      {selectedFile && uploadStatus === 'idle' && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedFile(null);
                            setUploadStatus('idle');
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {/* Status do Upload */}
                    {selectedFile && (
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 text-sm">
                          {uploadStatus === 'uploading' && (
                            <div className="flex items-center space-x-2 text-blue-600">
                              <Upload className="h-4 w-4 animate-pulse" />
                              <span>Enviando... {Math.round(uploadProgress)}%</span>
                            </div>
                          )}
                          {uploadStatus === 'success' && (
                            <div className="flex items-center space-x-2 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              <span>Arquivo enviado com sucesso!</span>
                            </div>
                          )}
                          {uploadStatus === 'error' && (
                            <div className="flex items-center space-x-2 text-red-600">
                              <AlertCircle className="h-4 w-4" />
                              <span>Erro no upload. Tente novamente.</span>
                            </div>
                          )}
                          {uploadStatus === 'idle' && (
                            <div className="flex items-center space-x-2 text-gray-600">
                              <FileText className="h-4 w-4" />
                              <span>{selectedFile.name}</span>
                            </div>
                          )}
                        </div>

                        {/* Barra de Progresso */}
                        {uploadStatus === 'uploading' && (
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            ></div>
                          </div>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-gray-500">
                      Tipos permitidos: PDF, DOC, XLS, PPT, imagens • Máximo: 10MB
                    </p>
                  </div>
                </div>
              )}

              {/* Nova URL */}
              {uploadType === 'url' && (
                <div className="space-y-2">
                  <Label htmlFor="newFileUrl">Nova URL do Arquivo</Label>
                  <Input
                    id="newFileUrl"
                    type="url"
                    value={formData.fileUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, fileUrl: e.target.value }))}
                    placeholder="https://exemplo.com/novo-documento.pdf"
                  />
                  <p className="text-xs text-gray-500">
                    Cole a URL do novo arquivo (Google Drive, Dropbox, etc.)
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Botões */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              disabled={uploadStatus === 'uploading'}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="bg-rmh-primary hover:bg-rmh-secondary"
              disabled={!isValid || isSubmitting || uploadStatus === 'uploading'}
            >
              {uploadStatus === 'uploading' ? (
                <>
                  <Upload className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : isSubmitting ? (
                <>
                  <Upload className="h-4 w-4 mr-2 animate-spin" />
                  {document ? 'Atualizando...' : 'Salvando...'}
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  {document ? 'Atualizar Documento' : 'Salvar Documento'}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PDFForm;