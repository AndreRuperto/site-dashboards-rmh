import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, FileText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePDFs, PDFDocument } from '@/contexts/PDFContext';
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import PDFCard from '@/components/PDFCard';
import PDFForm from '@/components/PDFForm'; // O componente que criamos
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isAdmin } from '@/types';

const DocumentsPage = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<PDFDocument | null>(null);

  const { user } = useAuth();
  const { getFilteredDocuments, deleteDocument, addDocument, updateDocument, categories } = usePDFs();
  const { toast } = useToast();

  const filteredDocuments = getFilteredDocuments(
    selectedCategory === 'all' ? undefined : selectedCategory
  );

  // Verificação de permissão usando a função utilitária do types
  const userIsAdmin = user ? isAdmin(user) : false;

  const handleDeleteDocument = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este documento?')) {
      deleteDocument(id);
      toast({
        title: "Sucesso",
        description: "Documento excluído com sucesso"
      });
    }
  };

  const handleNewDocument = () => {
    setEditingDocument(null);
    setIsFormOpen(true);
  };

  const handleEditDocument = (document: PDFDocument) => {
    setEditingDocument(document);
    setIsFormOpen(true);
  };

  const handleFormSubmit = (documentData: Partial<PDFDocument>) => {
    try {
      if (editingDocument) {
        // Editando documento existente
        updateDocument(editingDocument.id, documentData);
        toast({
          title: "Sucesso",
          description: "Documento atualizado com sucesso"
        });
      } else {
        // Criando novo documento - ajustado para corresponder ao contexto
        const newDocument: Omit<PDFDocument, 'id' | 'uploadedAt'> = {
          title: documentData.title!,
          description: documentData.description || '',
          category: documentData.category!,
          fileName: documentData.fileName!,
          fileUrl: documentData.fileUrl!,
          uploadedBy: user?.email || '',
          isActive: true // Adicionado o campo isActive que estava faltando
        };
        
        addDocument(newDocument);
        toast({
          title: "Sucesso",
          description: "Documento adicionado com sucesso"
        });
      }
      
      setIsFormOpen(false);
      setEditingDocument(null);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao salvar documento",
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
                Documentos PDF
              </h1>
              <p className="text-rmh-gray mt-1">
                Acesse e organize os documentos da empresa
              </p>
            </div>
            
            {userIsAdmin && (
              <Button 
                onClick={handleNewDocument}
                className="bg-rmh-primary hover:bg-rmh-secondary"
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Documento
              </Button>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex-1">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full">
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
                onClick={() => setSelectedCategory('all')}
                className="border-rmh-primary text-rmh-primary hover:bg-rmh-primary hover:text-white"
              >
                Limpar Filtros
              </Button>
            )}
          </div>

          {/* Documents Grid */}
          <div className="space-y-4">
            {filteredDocuments.length > 0 ? (
              <>
                <div className="flex items-center space-x-2 text-sm text-rmh-gray">
                  <FileText className="h-4 w-4" />
                  <span>
                    {filteredDocuments.length} documento{filteredDocuments.length !== 1 ? 's' : ''} encontrado{filteredDocuments.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {filteredDocuments.map((document) => (
                    <PDFCard
                      key={document.id}
                      document={document}
                      onEdit={handleEditDocument}
                      onDelete={handleDeleteDocument}
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
                ) : userIsAdmin && (
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

      {/* Modal de Formulário */}
      <PDFForm
        isOpen={isFormOpen}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        document={editingDocument}
        categories={categories}
      />
    </div>
  );
};

export default DocumentsPage;