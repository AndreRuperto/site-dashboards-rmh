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
  uploadedByName?: string;
  fileSize?: number;
  mimeType?: string;
  downloadCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
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
    setIsLoading(true);
    setError(null);
    
    try {
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
      
      // ✅ MAPEAR documentos com conversões seguras para Date
      const documentsWithDates: PDFDocument[] = (data.documentos || []).map((doc: any) => ({
        id: doc.id,
        title: doc.titulo || doc.title,
        description: doc.descricao || doc.description || '',
        category: doc.categoria || doc.category,
        fileName: doc.nomeArquivo || doc.nome_arquivo || doc.fileName,
        fileUrl: doc.urlArquivo || doc.url_arquivo || doc.fileUrl,
        thumbnailUrl: doc.thumbnail_url || doc.thumbnailUrl,
        uploadedBy: doc.enviadoPor || doc.enviado_por || doc.uploadedBy,
        
        // ✅ CONVERSÕES SEGURAS para Date
        uploadedAt: (() => {
          if (doc.enviadoEm) return new Date(doc.enviadoEm);
          if (doc.enviado_em) return new Date(doc.enviado_em);
          if (doc.data_upload) return new Date(doc.data_upload);
          if (doc.uploadedAt) return new Date(doc.uploadedAt);
          return new Date(); // Fallback
        })(),
        
        createdAt: (() => {
          if (doc.criadoEm) return new Date(doc.criadoEm);
          if (doc.criado_em) return new Date(doc.criado_em);
          if (doc.createdAt) return new Date(doc.createdAt);
          return undefined; // Opcional
        })(),
        
        updatedAt: (() => {
          if (doc.atualizadoEm) return new Date(doc.atualizadoEm);
          if (doc.atualizado_em) return new Date(doc.atualizado_em);
          if (doc.updatedAt) return new Date(doc.updatedAt);
          return undefined; // Opcional
        })(),
        
        uploadedByName: doc.enviadoPorNome || doc.enviado_por_nome || doc.uploadedByName,
        isActive: doc.ativo ?? doc.isActive ?? true,
        downloadCount: doc.qtdDownloads || doc.qtd_downloads || doc.downloadCount || 0,
        mimeType: doc.tipoMime || doc.tipo_mime || doc.mimeType,
        fileSize: doc.tamanhoArquivo || doc.tamanho_arquivo || doc.fileSize
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
          ...documentData,
          id: `local_${Date.now()}`,
          uploadedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
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
      
      // ✅ CORRIGIDO: Backend retorna data.documento, não data.document
      const rawDoc = data.documento; // Removido || data.document porque backend sempre retorna data.documento

      // ✅ CONSTRUIR documento com conversões Date e mapeamento correto
      const newDocument: PDFDocument = {
        id: rawDoc?.id || `api_${Date.now()}`,
        title: rawDoc?.titulo || documentData.title,
        description: rawDoc?.descricao || documentData.description,
        category: rawDoc?.categoria || documentData.category,
        fileName: rawDoc?.nome_arquivo || documentData.fileName,
        fileUrl: rawDoc?.url_arquivo || documentData.fileUrl,
        thumbnailUrl: rawDoc?.thumbnail_url || documentData.thumbnailUrl, // ✅ CORRIGIDO
        uploadedBy: rawDoc?.enviado_por || documentData.uploadedBy,
        
        // ✅ CONVERSÕES SEGURAS para Date
        uploadedAt: (() => {
          if (rawDoc?.enviado_em) return new Date(rawDoc.enviado_em);
          if (rawDoc?.data_upload) return new Date(rawDoc.data_upload);
          return new Date();
        })(),
        
        createdAt: (() => {
          if (rawDoc?.criado_em) return new Date(rawDoc.criado_em);
          return new Date();
        })(),
        
        updatedAt: (() => {
          if (rawDoc?.atualizado_em) return new Date(rawDoc.atualizado_em);
          return new Date();
        })(),
        
        isActive: rawDoc?.ativo ?? documentData.isActive ?? true,
        uploadedByName: rawDoc?.enviado_por_nome,
        mimeType: rawDoc?.tipo_mime,
        fileSize: rawDoc?.tamanho_arquivo,
        downloadCount: rawDoc?.qtd_downloads || 0
      };

      setDocuments(prev => [newDocument, ...prev]);
      console.log(`✅ Documento "${documentData.title}" criado com sucesso`);
      
    } catch (err) {
      console.error('❌ Erro ao adicionar documento:', err);
      
      // ✅ CORRIGIDO: Fallback com thumbnailUrl incluída
      const fallbackDocument: PDFDocument = {
        ...documentData,
        id: `local_${Date.now()}`,
        uploadedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      };
      
      setDocuments(prev => [fallbackDocument, ...prev]);
      console.log('📄 Documento adicionado localmente (fallback)');
    }
  };

  // ✅ Função para atualizar documento
  const updateDocument = async (id: string, updates: Partial<PDFDocument>) => {
    try {
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        // ✅ Fallback local - manter tipos consistentes
        setDocuments(prev => 
          prev.map(doc => 
            doc.id === id ? { 
              ...doc, 
              ...updates,
              // ✅ Garantir que uploadedAt sempre existe como Date
              uploadedAt: updates.uploadedAt || doc.uploadedAt || new Date(),
              // ✅ Atualizar updatedAt como Date
              updatedAt: new Date()
            } : doc
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
      const rawDoc = data.document || data.documento;

      // ✅ CONSTRUIR documento com conversões seguras de tipos
      const updatedDocument: PDFDocument = {
        id: id,
        title: rawDoc?.titulo || rawDoc?.title || updates.title || 'Documento sem título',
        description: rawDoc?.descricao || rawDoc?.description || updates.description || '',
        category: rawDoc?.categoria || rawDoc?.category || updates.category || 'Geral',
        fileName: rawDoc?.nome_arquivo || rawDoc?.fileName || updates.fileName || 'arquivo.pdf',
        fileUrl: rawDoc?.url_arquivo || rawDoc?.fileUrl || updates.fileUrl || '',
        uploadedBy: rawDoc?.enviado_por || rawDoc?.uploadedBy || 'api@user.com',
        
        // ✅ CONVERSÕES SEGURAS para Date
        uploadedAt: (() => {
          if (rawDoc?.data_upload) return new Date(rawDoc.data_upload);
          if (rawDoc?.uploadedAt) return new Date(rawDoc.uploadedAt);
          if (updates.uploadedAt) return new Date(updates.uploadedAt);
          return new Date();
        })(),
        
        createdAt: (() => {
          if (rawDoc?.criado_em) return new Date(rawDoc.criado_em);
          if (rawDoc?.createdAt) return new Date(rawDoc.createdAt);
          return undefined; // Opcional na interface
        })(),
        
        updatedAt: new Date(), // ✅ Sempre definir como Date atual
        
        isActive: rawDoc?.ativo ?? rawDoc?.isActive ?? true,
        uploadedByName: rawDoc?.enviado_por_nome || rawDoc?.uploadedByName,
        mimeType: rawDoc?.tipo_mime || rawDoc?.mimeType,
        fileSize: rawDoc?.tamanho_arquivo || rawDoc?.fileSize,
        downloadCount: rawDoc?.qtd_downloads || rawDoc?.downloadCount,
        thumbnailUrl: rawDoc?.thumbnail_url || rawDoc?.thumbnailUrl
      };

      setDocuments(prev => 
        prev.map(doc => 
          doc.id === id ? updatedDocument : doc
        )
      );
      
      console.log(`✅ Documento "${id}" atualizado com sucesso`);
      
    } catch (err) {
      console.error('❌ Erro ao atualizar documento:', err);
      
      // ✅ Fallback: atualizar localmente com tipos corretos
      setDocuments(prev => 
        prev.map(doc => 
          doc.id === id ? { 
            ...doc, 
            ...updates,
            // ✅ Garantir tipos Date
            uploadedAt: updates.uploadedAt ? new Date(updates.uploadedAt) : doc.uploadedAt || new Date(),
            updatedAt: new Date()
          } : doc
        )
      );
      console.log('📄 Documento atualizado localmente (fallback)');
      
      throw err;
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
  const uploadFile = async (
    file: File,
    documentData: Partial<PDFDocument>,
    existingId?: string
  ): Promise<PDFDocument> => {
    try {
      const token = localStorage.getItem('authToken');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', documentData.title || '');
      formData.append('description', documentData.description || '');
      formData.append('category', documentData.category || '');

      let response: Response;

      if (existingId) {
        response = await fetch(`${API_BASE_URL}/api/documents/${existingId}/upload`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
      } else {
        response = await fetch(`${API_BASE_URL}/api/documents/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro no upload');
      }

      const data = await response.json();
      const rawDoc = data.documento || data.document;

      if (!rawDoc) {
        throw new Error('Resposta inválida: documento não encontrado na resposta do backend.');
      }

      const updatedDocument: PDFDocument = {
        id: existingId || rawDoc.id || `api_${Date.now()}`,
        title: rawDoc.titulo || documentData.title || file.name,
        description: rawDoc.descricao || documentData.description || '',
        category: rawDoc.categoria || documentData.category || 'Geral',
        fileName: rawDoc.nome_arquivo || file.name,
        fileUrl: rawDoc.url_arquivo,
        uploadedBy: rawDoc.enviado_por || 'api@user.com',
        uploadedAt: new Date(rawDoc.data_upload || Date.now()),
        isActive: rawDoc.ativo ?? true,
        mimeType: rawDoc.tipo_mime,
        fileSize: rawDoc.tamanho_arquivo
      };

      if (existingId) {
        setDocuments(prev =>
          prev.map(doc =>
            doc.id === existingId ? { ...doc, ...updatedDocument } : doc
          )
        );
      } else {
        setDocuments(prev => [updatedDocument, ...prev]);
      }

      console.log(`✅ ${existingId ? 'Atualizado' : 'Upload concluído'}: "${file.name}"`);
      return updatedDocument;

    } catch (err) {
      console.error('❌ Erro no upload:', err);

      const fallbackDoc: PDFDocument = {
        id: existingId || `local_${Date.now()}`,
        title: documentData.title || file.name,
        description: documentData.description || '',
        category: documentData.category || 'Geral',
        fileName: file.name,
        fileUrl: URL.createObjectURL(file),
        uploadedBy: 'local@user.com',
        uploadedAt: new Date(),
        isActive: true
      };

      if (existingId) {
        setDocuments(prev =>
          prev.map(doc =>
            doc.id === existingId ? { ...doc, ...fallbackDoc } : doc
          )
        );
      } else {
        setDocuments(prev => [fallbackDoc, ...prev]);
      }

      return fallbackDoc;
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