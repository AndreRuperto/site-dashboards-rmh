import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, FileText, Shield, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { usePDFs, PDFDocument } from '@/contexts/PDFContext';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import PDFCard from '@/components/PDFCard';
import PDFForm from '@/components/PDFForm';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isAdmin } from '@/types';
import ConfirmationDialog from '@/components/ConfirmationDialog';

const DocumentsPage = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<PDFDocument | null>(null);
  
  const categories = [
    "Institucional",
    "Colaboradores",
    "TI / Acessos",
    "Escalas e Rotinas",
    "Documentos Operacionais",
    "RH / Benefícios",
    "Capacitação"
  ];

  // ✅ ESTADOS PARA O MODAL DE CONFIRMAÇÃO
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    documentId: '',
    documentTitle: ''
  });

  const { user } = useAuth();
  const navigate = useNavigate();
  const { 
    getFilteredDocuments, 
    deleteDocument, 
    addDocument, 
    updateDocument, 
    uploadFile,
    isLoading,
    error 
  } = usePDFs();
  const { toast } = useToast();

  // ✅ PERMISSÕES DE EDIÇÃO (apenas Admin e Administrativo)
  const userIsAdmin = user ? isAdmin(user) : false;
  const isAdministrativo = user?.setor?.toLowerCase().includes('administrativo') || false;
  const canEdit = userIsAdmin || isAdministrativo;

  // ✅ Mostrar loading enquanto carrega usuário
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-rmh-primary"></div>
          <span className="text-rmh-gray">Carregando...</span>
        </div>
      </div>
    );
  }

  const filteredDocuments = getFilteredDocuments(
    selectedCategory === 'all' ? undefined : selectedCategory
  );

  // ✅ NOVA FUNÇÃO SEM window.confirm
  const handleDeleteDocument = async (id: string) => {
    if (!canEdit) {
      toast({
        title: "Acesso Negado",
        description: "Apenas administradores e setor Administrativo podem excluir documentos.",
        variant: "destructive"
      });
      return;
    }

    // Encontrar o documento para mostrar o título na confirmação
    const document = filteredDocuments.find(doc => doc.id === id);
    
    setConfirmDialog({
      isOpen: true,
      documentId: id,
      documentTitle: document?.title || 'documento'
    });
  };

  // ✅ FUNÇÃO PARA CONFIRMAR A EXCLUSÃO
  const handleConfirmDelete = async () => {
    try {
      await deleteDocument(confirmDialog.documentId);
      toast({
        title: "Sucesso",
        description: "Documento excluído com sucesso"
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao excluir documento",
        variant: "destructive"
      });
    }
  };

  // ✅ FUNÇÃO PARA FECHAR O MODAL
  const handleCloseConfirmDialog = () => {
    setConfirmDialog({
      isOpen: false,
      documentId: '',
      documentTitle: ''
    });
  };

  const handleNewDocument = () => {
    if (!canEdit) {
      toast({
        title: "Acesso Negado",
        description: "Apenas administradores e setor Administrativo podem criar documentos.",
        variant: "destructive"
      });
      return;
    }

    setEditingDocument(null);
    setIsFormOpen(true);
  };

  const handleEditDocument = (document: PDFDocument) => {
    if (!canEdit) {
      toast({
        title: "Acesso Negado",
        description: "Apenas administradores e setor Administrativo podem editar documentos.",
        variant: "destructive"
      });
      return;
    }

    setEditingDocument(document);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (documentData: Partial<PDFDocument>) => {
    try {
      if (editingDocument) {
        // ✅ EDITANDO DOCUMENTO EXISTENTE
        await updateDocument(editingDocument.id, documentData);
        toast({
          title: "Sucesso",
          description: "Documento atualizado com sucesso"
        });
      } else {
        // ✅ CRIANDO NOVO DOCUMENTO VIA URL
        // O upload de arquivos é tratado diretamente no PDFForm via uploadFile
        await addDocument(documentData as Omit<PDFDocument, 'id' | 'uploadedAt' | 'createdAt' | 'updatedAt'>);
        toast({
          title: "Sucesso",
          description: "Documento adicionado com sucesso"
        });
      }
      
      setIsFormOpen(false);
      setEditingDocument(null);
    } catch (error) {
      console.error('Erro ao salvar documento:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao salvar documento",
        variant: "destructive"
      });
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingDocument(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="px-4 py-8">
        <div className="space-y-6">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div>
              <h1 className="text-3xl font-heading font-bold text-rmh-primary">
                Documentos
              </h1>
              <p className="text-rmh-gray mt-1">
                {canEdit 
                  ? "Acesse e organize os documentos da empresa" 
                  : "Acesse os documentos da empresa"
                }
              </p>
            </div>
            
            {/* ✅ Botão de adicionar apenas para quem pode editar */}
            {canEdit && (
              <Button 
                onClick={handleNewDocument}
                className="bg-rmh-lightGreen hover:bg-rmh-primary"
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Documento
              </Button>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-col space-y-3 md:flex-row md:space-y-0 md:gap-4 md:items-center">
            <div className="flex-1 min-w-0">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full h-10">
                  <SelectValue placeholder="Todas as categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCategory !== 'all' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCategory('all')}
                className="border-rmh-primary text-rmh-primary hover:bg-rmh-primary hover:text-white transition-colors w-full md:w-auto"
              >
                Limpar Filtros
              </Button>
            )}
          </div>

          {/* Documents Grid */}
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rmh-primary"></div>
                <span className="ml-2 text-rmh-gray">Carregando documentos...</span>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <FileText className="h-16 w-16 text-red-400 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-red-600 mb-2">
                  Erro ao carregar documentos
                </h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.reload()}
                  className="border-rmh-primary text-rmh-primary hover:bg-rmh-primary hover:text-white"
                >
                  Tentar Novamente
                </Button>
              </div>
            ) : filteredDocuments.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2 text-sm text-rmh-gray">
                    <FileText className="h-4 w-4" />
                    <span>
                      {filteredDocuments.length} documento{filteredDocuments.length !== 1 ? 's' : ''} encontrado{filteredDocuments.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  
                  {/* Badge com categoria ativa */}
                  {selectedCategory !== 'all' && (
                    <Badge variant="secondary" className="bg-rmh-primary/10 text-rmh-primary">
                      {selectedCategory}
                    </Badge>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6">
                  {filteredDocuments.map((document) => (
                    <PDFCard
                      key={document.id}
                      document={document}
                      onEdit={canEdit ? handleEditDocument : undefined}
                      onDelete={canEdit ? handleDeleteDocument : undefined}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-16 w-16 text-rmh-gray mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-rmh-primary mb-2">
                  Nenhum documento encontrado
                </h3>
                <p className="text-rmh-gray mb-6">
                  {selectedCategory !== 'all'
                    ? 'Tente ajustar os filtros para encontrar documentos.'
                    : 'Não há documentos enviados ainda.'}
                </p>
                {selectedCategory !== 'all' ? (
                  <Button 
                    variant="outline" 
                    onClick={() => setSelectedCategory('all')}
                    className="border-rmh-primary text-rmh-primary hover:bg-rmh-primary hover:text-white"
                  >
                    Limpar Filtros
                  </Button>
                ) : canEdit && (
                  <Button 
                    onClick={handleNewDocument}
                    className="bg-rmh-primary hover:bg-rmh-secondary"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Primeiro Documento
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modal de Formulário - apenas renderiza se o usuário pode editar */}
      {canEdit && (
        <PDFForm
          isOpen={isFormOpen}
          onClose={handleFormClose}
          onSubmit={handleFormSubmit}
          document={editingDocument}
          categories={[
            "Institucional",
            "Colaboradores",
            "TI / Acessos",
            "Escalas e Rotinas",
            "Documentos Operacionais",
            "RH / Benefícios",
            "Capacitação"
          ]}
          uploadFile={uploadFile}
        />
      )}

      {/* ✅ MODAL DE CONFIRMAÇÃO */}
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={handleCloseConfirmDialog}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        description={`Tem certeza que deseja excluir o documento "${confirmDialog.documentTitle}"?`}
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="destructive"
      />
    </div>
  );
};

export default DocumentsPage;