import React, { createContext, useContext, useState, useEffect } from 'react';

export interface PDFDocument {
  id: string;
  title: string;
  description: string;
  category: string;
  fileName: string;
  fileUrl: string;
  thumbnailUrl?: string;
  uploadedBy: string;
  uploadedAt: Date;
  isActive: boolean;
  // Campos adicionais do banco
  uploadedByName?: string;
  fileSize?: number;
  mimeType?: string;
  downloadCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface PDFContextType {
  documents: PDFDocument[];
  categories: string[];
  isLoading: boolean;
  error: string | null;
  
  // CRUD Operations
  addDocument: (document: Omit<PDFDocument, 'id' | 'uploadedAt' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateDocument: (id: string, updates: Partial<PDFDocument>) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  
  // Filtering & Search
  getFilteredDocuments: (category?: string, searchTerm?: string) => PDFDocument[];
  refreshDocuments: () => Promise<void>;
  
  // Upload functionality
  uploadFile: (file: File, documentData: Partial<PDFDocument>) => Promise<PDFDocument>;
}

const PDFContext = createContext<PDFContextType | undefined>(undefined);

// ✅ DADOS INICIAIS para fallback (caso a API falhe)
const initialDocuments: PDFDocument[] = [
  {
    id: '1',
    title: 'Código de Boas Práticas',
    description: 'Código de boas práticas 2023.docx',
    category: 'Documentos Internos',
    fileName: 'codigo-boas-praticas.pdf',
    fileUrl: '/documents/Roteiro de Estudos.pdf',
    uploadedBy: 'admin@resendemh.com.br',
    uploadedAt: new Date('2024-01-15'),
    isActive: true
  },
  {
    id: '2',
    title: 'Tabela Oficial dos Honorários',
    description: 'Tabela oficial dos honorários da RMH Advocacia',
    category: 'Financeiro',
    fileName: 'tabela-honorarios.pdf',
    fileUrl: '/documents/AniversariantesRMH.png',
    uploadedBy: 'admin@resendemh.com.br',
    uploadedAt: new Date('2024-01-10'),
    isActive: true
  },
  {
    id: '3',
    title: 'Regimento Interno - Plantão',
    description: 'Regimento interno para plantões',
    category: 'RH',
    fileName: 'regimento-plantao.pdf',
    fileUrl: '/lovable-uploads/sample-document.pdf',
    uploadedBy: 'admin@resendemh.com.br',
    uploadedAt: new Date('2024-01-05'),
    isActive: true
  },
  {
    id: '4',
    title: 'Manual de Procedimentos Jurídicos',
    description: 'Manual completo de procedimentos para advogados e estagiários',
    category: 'Documentos Internos',
    fileName: 'manual-procedimentos.pdf',
    fileUrl: '/documents/Roteiro de Estudos.pdf',
    uploadedBy: 'andre.macedo@resendemh.com.br',
    uploadedAt: new Date('2024-02-20'),
    isActive: true
  }
];

// Configuração da API
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export const PDFProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [documents, setDocuments] = useState<PDFDocument[]>(initialDocuments);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false); // ✅ Começar como false para mostrar dados iniciais
  const [error, setError] = useState<string | null>(null);

  // ✅ Função para buscar documentos da API
  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const token = localStorage.getItem('authToken');
      if (!token) {
        console.log('📄 Sem token - usando dados locais');
        setDocuments(initialDocuments);
        setCategories(
          Array.from(new Set(initialDocuments.filter(doc => doc.isActive).map(doc => doc.category))).sort()
        );
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/documents`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.log('📄 Token inválido - usando dados locais');
          setDocuments(initialDocuments);
          setCategories(
            Array.from(new Set(initialDocuments.filter(doc => doc.isActive).map(doc => doc.category))).sort()
          );
          return;
        }
        throw new Error('Erro ao buscar documentos');
      }

      const data = await response.json();

      const documentsWithDates = (data.documentos || []).map((doc: any) => ({
        id: doc.id,
        title: doc.titulo,
        description: doc.descricao,
        category: doc.categoria,
        fileName: doc.nomeArquivo,
        fileUrl: doc.urlArquivo,
        uploadedAt: new Date(doc.enviadoEm),
        createdAt: doc.criadoEm,
        updatedAt: doc.atualizadoEm,
        uploadedBy: doc.enviadoPor,
        uploadedByName: doc.enviadoPorNome,
        isActive: doc.ativo,
        downloadCount: doc.qtdDownloads,
        mimeType: doc.tipoMime,
        size: doc.tamanhoArquivo
      }));

      setDocuments(documentsWithDates);
      if (data.categorias) setCategories(data.categorias);

    } catch (err) {
      console.error('❌ Erro ao buscar documentos da API:', err);
      setError(null);
      setDocuments(initialDocuments);
      setCategories(
        Array.from(new Set(initialDocuments.filter(doc => doc.isActive).map(doc => doc.category))).sort()
      );
    } finally {
      setIsLoading(false);
    }
  };


  // ✅ Função para adicionar documento
  const addDocument = async (documentData: Omit<PDFDocument, 'id' | 'uploadedAt' | 'createdAt' | 'updatedAt'>) => {
    try {
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        const newDocument: PDFDocument = {
          id: `local_${Date.now()}`,
          title: documentData.title || 'Documento sem título',
          description: documentData.description || '',
          category: documentData.category || 'Geral',
          fileName: documentData.fileName || 'arquivo.pdf',
          fileUrl: documentData.fileUrl || URL.createObjectURL(new Blob()), // Fallback
          uploadedBy: 'local@user.com',
          uploadedAt: new Date(),
          isActive: true
        };

        setDocuments(prev => [newDocument, ...prev]);
        console.log('📄 Documento adicionado localmente');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/documents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(documentData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao criar documento');
      }

      const data = await response.json();
      const newDocument = {
        ...data.document,
        uploadedAt: new Date(data.document.uploadedAt || data.document.uploaded_at)
      };

      setDocuments(prev => [newDocument, ...prev]);
      
      console.log(`✅ Documento "${documentData.title}" criado com sucesso`);
      
    } catch (err) {
      console.error('❌ Erro ao adicionar documento:', err);
      
      // ✅ Fallback: adicionar localmente mesmo se a API falhar
      const newDocument: PDFDocument = {
        ...documentData,
        id: `local_${Date.now()}`,
        uploadedAt: new Date()
      };
      setDocuments(prev => [newDocument, ...prev]);
      console.log('📄 Documento adicionado localmente (fallback)');
    }
  };

  // ✅ Função para atualizar documento
  const updateDocument = async (id: string, updates: Partial<PDFDocument>) => {
    try {
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        // ✅ Fallback local
        setDocuments(prev => 
          prev.map(doc => 
            doc.id === id ? { ...doc, ...updates } : doc
          )
        );
        console.log('📄 Documento atualizado localmente');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/documents/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar documento');
      }

      const data = await response.json();
      const updatedDocument = {
        ...data.document,
        uploadedAt: new Date(data.document.uploadedAt || data.document.uploaded_at)
      };

      setDocuments(prev => 
        prev.map(doc => 
          doc.id === id ? updatedDocument : doc
        )
      );
      
      console.log(`✅ Documento "${id}" atualizado com sucesso`);
      
    } catch (err) {
      console.error('❌ Erro ao atualizar documento:', err);
      
      // ✅ Fallback: atualizar localmente
      setDocuments(prev => 
        prev.map(doc => 
          doc.id === id ? { ...doc, ...updates } : doc
        )
      );
      console.log('📄 Documento atualizado localmente (fallback)');
    }
  };

  // ✅ Função para deletar documento
  const deleteDocument = async (id: string) => {
    try {
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        // ✅ Fallback local
        setDocuments(prev => prev.filter(doc => doc.id !== id));
        console.log('📄 Documento excluído localmente');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/documents/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao excluir documento');
      }

      setDocuments(prev => prev.filter(doc => doc.id !== id));
      
      console.log(`✅ Documento "${id}" excluído com sucesso`);
      
    } catch (err) {
      console.error('❌ Erro ao deletar documento:', err);
      
      // ✅ Fallback: excluir localmente
      setDocuments(prev => prev.filter(doc => doc.id !== id));
      console.log('📄 Documento excluído localmente (fallback)');
    }
  };

  // ✅ Função para upload de arquivo
  const uploadFile = async (file: File, documentData: Partial<PDFDocument>): Promise<PDFDocument> => {
    try {
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        // ✅ Simular upload local
        const newDocument: PDFDocument = {
          id: `local_${Date.now()}`,
          title: documentData.title || file.name,
          description: documentData.description || '',
          category: documentData.category || 'Geral',
          fileName: file.name,
          fileUrl: URL.createObjectURL(file), // URL local para desenvolvimento
          uploadedBy: 'local@user.com',
          uploadedAt: new Date(),
          isActive: true
        };
        
        setDocuments(prev => [newDocument, ...prev]);
        console.log('📄 Upload simulado localmente');
        return newDocument;
      }

      // Criar FormData para upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', documentData.title || '');
      formData.append('description', documentData.description || '');
      formData.append('category', documentData.category || '');

      const response = await fetch(`${API_BASE_URL}/api/documents/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
          // NÃO incluir Content-Type para FormData
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro no upload');
      }

      const data = await response.json();
      const newDocument = {
        ...data.document,
        uploadedAt: new Date(data.document.uploadedAt || data.document.uploaded_at)
      };

      setDocuments(prev => [newDocument, ...prev]);
      
      console.log(`✅ Upload concluído: "${file.name}"`);
      
      return newDocument;
      
    } catch (err) {
      console.error('❌ Erro no upload:', err);
      
      // ✅ Fallback: criar documento local
      const newDocument: PDFDocument = {
        id: `local_${Date.now()}`,
        title: documentData.title || file.name,
        description: documentData.description || '',
        category: documentData.category || 'Geral',
        fileName: file.name,
        fileUrl: URL.createObjectURL(file),
        uploadedBy: 'local@user.com',
        uploadedAt: new Date(),
        isActive: true
      };
      
      setDocuments(prev => [newDocument, ...prev]);
      console.log('📄 Upload simulado localmente (fallback)');
      return newDocument;
    }
  };

  // ✅ Filtrar documentos
  const getFilteredDocuments = (category?: string, searchTerm?: string) => {
    return documents.filter(doc => {
      if (!doc.isActive) return false;
      
      if (category && category !== 'all' && doc.category !== category) {
        return false;
      }
      
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          doc.title.toLowerCase().includes(term) ||
          doc.description.toLowerCase().includes(term) ||
          doc.category.toLowerCase().includes(term) ||
          doc.fileName.toLowerCase().includes(term)
        );
      }
      
      return true;
    });
  };

  // ✅ Refresh documentos
  const refreshDocuments = async () => {
    await fetchDocuments();
  };

  // ✅ Tentar carregar da API na inicialização (com fallback)
  useEffect(() => {
    fetchDocuments();
  }, []);

  const contextValue: PDFContextType = {
    documents,
    categories,
    isLoading,
    error,
    addDocument,
    updateDocument,
    deleteDocument,
    getFilteredDocuments,
    refreshDocuments,
    uploadFile
  };

  return (
    <PDFContext.Provider value={contextValue}>
      {children}
    </PDFContext.Provider>
  );
};

export const usePDFs = () => {
  const context = useContext(PDFContext);
  if (!context) {
    throw new Error('usePDFs must be used within a PDFProvider');
  }
  return context;
};