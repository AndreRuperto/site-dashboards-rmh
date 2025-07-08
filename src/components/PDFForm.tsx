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
}

type UploadType = 'file' | 'url';

const PDFForm: React.FC<PDFFormProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  document, 
  categories 
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

  // Função para upload do arquivo
  const uploadFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();

      // Monitorar progresso
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100;
          setUploadProgress(progress);
        }
      });

      xhr.onload = () => {
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response.fileUrl || `/documents/${file.name}`);
          } catch {
            // Se não for JSON, assumir que retornou a URL diretamente
            resolve(`/documents/${file.name}`);
          }
        } else {
          reject(new Error(`Upload falhou com status ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Erro na conexão durante upload'));

      // Para desenvolvimento/teste, simular upload bem-sucedido
      if (process.env.NODE_ENV === 'development') {
        setTimeout(() => {
          setUploadProgress(100);
          resolve(`/documents/${file.name}`);
        }, 1500);
        
        // Simular progresso
        let progress = 0;
        const interval = setInterval(() => {
          progress += 10;
          setUploadProgress(progress);
          if (progress >= 90) clearInterval(interval);
        }, 150);
        
        return;
      }

      // Em produção, fazer o upload real
      xhr.open('POST', '/api/upload-document');
      xhr.send(formData);
    });
  };

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

      let fileUrl = formData.fileUrl;
      let fileName = formData.fileName;

      // Se for upload de arquivo (não edição)
      if (uploadType === 'file' && selectedFile && !document) {
        try {
          setUploadStatus('uploading');
          setUploadProgress(0);
          
          fileUrl = await uploadFile(selectedFile);
          fileName = selectedFile.name;
          
          setUploadStatus('success');
          
          toast({
            title: "Sucesso",
            description: "Arquivo enviado com sucesso!",
          });
          
        } catch (error) {
          setUploadStatus('error');
          console.error('Erro no upload:', error);
          toast({
            title: "Erro no Upload",
            description: "Falha ao enviar arquivo. Tente novamente.",
            variant: "destructive"
          });
          return;
        }
      }

      // Se for URL, usar a URL fornecida
      if (uploadType === 'url') {
        fileName = formData.fileName || 'Documento via URL';
      }

      const documentData: Partial<PDFDocument> = {
        id: document?.id, // Será undefined para novos documentos
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: categoryToUse,
        fileName: fileName,
        fileUrl: fileUrl,
        uploadedBy: user?.email || '',
        uploadedAt: document?.uploadedAt || new Date(),
        isActive: true
      };

      onSubmit(documentData);
      onClose();
      
    } catch (error) {
      console.error('Erro ao salvar documento:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar documento. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
      setUploadStatus('idle');
      setUploadProgress(0);
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

          {/* Para edição, mostrar arquivo atual */}
          {document && (
            <div className="space-y-2">
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
              
              {/* Opção para alterar URL */}
              <div className="space-y-2 mt-4">
                <Label htmlFor="newFileUrl">Alterar URL do Arquivo</Label>
                <Input
                  id="newFileUrl"
                  type="url"
                  value={formData.fileUrl}
                  onChange={(e) => setFormData(prev => ({ ...prev, fileUrl: e.target.value }))}
                  placeholder="Nova URL do arquivo..."
                />
                <p className="text-xs text-gray-500">
                  Deixe em branco para manter o arquivo atual
                </p>
              </div>
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