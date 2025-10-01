import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, FileText, Shield, ArrowLeft, GripVertical, RotateCcw } from 'lucide-react';
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

// ✅ IMPORTAÇÕES PARA DRAG & DROP
import { DndContext, DragEndEvent, closestCorners, DragOverlay } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ✅ COMPONENTE PARA CARD ARRASTÁVEL
const SortablePDFCard = ({ 
  document, 
  canEdit, 
  onEdit, 
  onDelete, 
  isDragging = false 
}: {
  document: PDFDocument;
  canEdit: boolean;
  onEdit?: (doc: PDFDocument) => void;
  onDelete?: (id: string) => void;
  isDragging?: boolean;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging
  } = useSortable({ id: document.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isSortableDragging ? 'none' : transition,
    opacity: isSortableDragging ? 0.3 : 1,
    zIndex: isSortableDragging ? 1000 : 'auto',
    ...(isSortableDragging && {
      pointerEvents: 'none' as const
    })
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {/* ✅ HANDLE DE ARRASTAR - Posicionado à direita com melhor espaçamento */}
      {canEdit && (
        <div
          {...attributes}
          {...listeners}
          className="absolute right-3 top-3 z-20 cursor-grab active:cursor-grabbing p-2 bg-white rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300 border border-gray-200 hover:border-rmh-primary hover:bg-rmh-primary hover:text-white hover:shadow-xl transform hover:scale-110"
          title="Arrastar para reordenar"
          style={{
            // ✅ ESPAÇAMENTO MELHORADO - não cola na borda
            right: '12px',
            top: '12px',
            // ✅ MELHOR ÁREA DE TOQUE
            minWidth: '36px',
            minHeight: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: isSortableDragging ? 1001 : 20
          }}
        >
          <GripVertical className="h-5 w-5" />
        </div>
      )}
      
      {/* ✅ CARD DO DOCUMENTO - Sem margem lateral */}
      <PDFCard
        document={document}
        onEdit={canEdit ? onEdit : undefined}
        onDelete={canEdit ? onDelete : undefined}
      />
    </div>
  );
};

const DocumentsPage = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<PDFDocument | null>(null);
  const [localDocuments, setLocalDocuments] = useState<PDFDocument[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  
  const categories = [
    "Institucional",
    "Pessoas", 
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
    error,
    refreshDocuments
  } = usePDFs();
  const { toast } = useToast();

  // ✅ PERMISSÕES DE EDIÇÃO (apenas Admin e Administrativo)
  const userIsAdmin = user ? isAdmin(user) : false;
  const isAdministrativo = user?.setor?.toLowerCase().includes('administrativo') || false;
  const canEdit = userIsAdmin || isAdministrativo;

  // ✅ SINCRONIZAR DOCUMENTOS LOCAIS COM CONTEXTO
  useEffect(() => {
    const documents = getFilteredDocuments(
      selectedCategory === 'all' ? undefined : selectedCategory
    );
    setLocalDocuments(documents);
  }, [getFilteredDocuments, selectedCategory]);

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

  // ✅ FUNÇÃO PARA REORDENAR DOCUMENTOS (DRAG & DROP)
  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (!over || active.id === over.id || !canEdit) return;

    const oldIndex = localDocuments.findIndex(doc => doc.id === active.id);
    const newIndex = localDocuments.findIndex(doc => doc.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;

    // ✅ ATUALIZAR ESTADO LOCAL IMEDIATAMENTE
    const reorderedDocs = arrayMove(localDocuments, oldIndex, newIndex);
    setLocalDocuments(reorderedDocs);
    setIsReordering(true);
    
    try {
      // ✅ ENVIAR NOVA ORDEM PARA O BACKEND
      const documentsOrder = reorderedDocs.map((doc, index) => ({
        id: doc.id,
        ordem: index + 1
      }));
      
      const response = await fetch('/api/documents/reorder', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ documentsOrder })
      });

      if (!response.ok) {
        throw new Error('Erro ao salvar ordem');
      }
      
      toast({
        title: "Ordem atualizada",
        description: "A ordem dos documentos foi salva com sucesso",
        duration: 3000
      });
      
      // ✅ ATUALIZAR CONTEXTO
      await refreshDocuments();
      
    } catch (error) {
      console.error('❌ Erro ao reordenar:', error);
      
      // ✅ REVERTER EM CASO DE ERRO
      const originalDocs = getFilteredDocuments(
        selectedCategory === 'all' ? undefined : selectedCategory
      );
      setLocalDocuments(originalDocs);
      
      toast({
        title: "Erro ao reordenar",
        description: "Não foi possível salvar a nova ordem dos documentos",
        variant: "destructive"
      });
    } finally {
      setIsReordering(false);
    }
  };

  const handleNewDocument = () => {
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

  // ✅ ABRIR MODAL DE CONFIRMAÇÃO PARA EXCLUSÃO
  const handleDeleteDocument = (id: string) => {
    if (!canEdit) {
      toast({
        title: "Acesso Negado",
        description: "Apenas administradores e setor Administrativo podem excluir documentos.",
        variant: "destructive"
      });
      return;
    }

    const document = localDocuments.find(doc => doc.id === id);
    if (!document) return;

    setConfirmDialog({
      isOpen: true,
      documentId: id,
      documentTitle: document.title || document.fileName || 'Documento'
    });
  };

  // ✅ CONFIRMAR EXCLUSÃO
  const handleConfirmDelete = async () => {
    try {
      await deleteDocument(confirmDialog.documentId);
      toast({
        title: "Documento excluído",
        description: "O documento foi removido com sucesso.",
        duration: 3000
      });
    } catch (error) {
      toast({
        title: "Erro ao excluir",
        description: error instanceof Error ? error.message : "Erro ao excluir documento",
        variant: "destructive"
      });
    } finally {
      setConfirmDialog({ isOpen: false, documentId: '', documentTitle: '' });
    }
  };

  // ✅ FECHAR MODAL DE CONFIRMAÇÃO
  const handleCloseConfirmDialog = () => {
    setConfirmDialog({ isOpen: false, documentId: '', documentTitle: '' });
  };

  const handleFormSubmit = async (documentData: any) => {
    try {
      if (editingDocument) {
        await updateDocument(editingDocument.id, documentData);
        toast({
          title: "Documento atualizado",
          description: "As informações do documento foram atualizadas com sucesso.",
          duration: 3000
        });
      } else {
        await addDocument(documentData);
        toast({
          title: "Documento adicionado",
          description: "O novo documento foi criado com sucesso.",
          duration: 3000
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Erro ao salvar documento",
        variant: "destructive"
      });
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingDocument(null);
  };

  // ✅ ENCONTRAR DOCUMENTO SENDO ARRASTADO
  const draggedDocument = activeId ? localDocuments.find(doc => doc.id === activeId) : null;

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
            
            {/* ✅ Botões de ação */}
            <div className="flex items-center gap-2">
              {/* Botão de adicionar documento */}
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

            {/* ✅ INDICADOR DE REORDENAÇÃO */}
            {isReordering && (
              <div className="flex items-center text-sm text-rmh-primary">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-rmh-primary mr-2"></div>
                Salvando ordem...
              </div>
            )}
          </div>

          {/* Documents Grid com Drag & Drop */}
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rmh-primary"></div>
                <span className="ml-2 text-rmh-gray">Carregando documentos...</span>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Erro ao carregar documentos</h3>
                <p className="text-gray-500 mb-4">{error}</p>
                <Button onClick={() => window.location.reload()}>
                  Tentar Novamente
                </Button>
              </div>
            ) : localDocuments.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum documento encontrado</h3>
                <p className="text-gray-500 mb-4">
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
            ) : (
              /* ✅ GRID COM DRAG & DROP */
              <DndContext
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={localDocuments.map(doc => doc.id)}
                  strategy={rectSortingStrategy}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6">
                    {localDocuments.map((document) => (
                      <SortablePDFCard
                        key={document.id}
                        document={document}
                        canEdit={canEdit}
                        onEdit={handleEditDocument}
                        onDelete={handleDeleteDocument}
                      />
                    ))}
                  </div>
                </SortableContext>
                
                {/* ✅ OVERLAY DURANTE O DRAG */}
                <DragOverlay>
                  {draggedDocument ? (
                    <div className="transform rotate-3 shadow-2xl">
                      <PDFCard
                        document={draggedDocument}
                        onEdit={undefined}
                        onDelete={undefined}
                      />
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
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
          categories={categories}
          uploadFile={uploadFile}
        />
      )}

      {/* ✅ MODAL DE CONFIRMAÇÃO */}
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={handleCloseConfirmDialog}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        description={`Tem certeza que deseja excluir o documento "${confirmDialog.documentTitle}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="destructive"
      />
    </div>
  );
};

export default DocumentsPage;