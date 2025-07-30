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
  visibilidade?: string;
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
  uploadFile: (file: File, documentData: Partial<PDFDocument>, existingId?: string, thumbnail?: File) => Promise<PDFDocument>; // ✅ Adicionar thumbnail
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
    console.log('🚀 fetchDocuments iniciado');
    console.log('📊 Documentos atuais antes da busca:', documents.length);
    
    setIsLoading(true);
    setError(null);
          
    try {
      const token = localStorage.getItem('authToken');
      console.log('🔑 Token status:', {
        exists: !!token,
        length: token?.length,
        prefix: token?.substring(0, 20) + '...'
      });
              
      if (!token) {
        console.log('❌ Sem token - usando dados locais');
        setDocuments(initialDocuments);
        setCategories(
          Array.from(new Set(initialDocuments.filter(doc => doc.isActive).map(doc => doc.category))).sort()
        );
        return;
      }

      const url = `${API_BASE_URL}/api/documents`;
      console.log('🌐 Fazendo requisição para:', url);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Response recebida:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.log('❌ Token inválido (401) - limpando localStorage');
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          
          // ✅ NÃO usar dados hardcoded quando token é inválido
          setError('Sessão expirada. Por favor, faça login novamente.');
          setDocuments([]);
          setCategories([]);
          
          // ✅ Redirecionar para login se necessário
          if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login';
          }
          return;
        }
        
        // ✅ Pegar texto da resposta para erro mais detalhado
        const errorText = await response.text();
        console.error('❌ Erro HTTP:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      // ✅ VALIDAR SE A RESPOSTA É JSON VÁLIDO
      let data;
      try {
        const responseText = await response.text();
        console.log('📦 Response text (primeiros 200 chars):', responseText.substring(0, 200));
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ Erro ao parsear JSON:', parseError);
        console.error('📄 Response text completo:', await response.text());
        throw new Error('Resposta da API não é JSON válido');
      }

      console.log('📦 Dados parseados:', {
        success: data.success,
        documentosCount: data.documentos?.length || 0,
        categoriasCount: data.categorias?.length || 0
      });

      // ✅ VALIDAR ESTRUTURA DA RESPOSTA
      if (!data.documentos || !Array.isArray(data.documentos)) {
        console.error('❌ Estrutura de resposta inválida:', data);
        throw new Error('Resposta da API não contém array de documentos');
      }
              
      // ✅ MAPEAR documentos com validação individual
      const documentsWithDates: PDFDocument[] = data.documentos.map((doc: any, index: number) => {
        console.log(`📄 Mapeando documento ${index + 1}:`, {
          id: doc.id,
          title: doc.titulo,
          category: doc.categoria
        });

        return {
          id: doc.id?.toString() || `doc_${Date.now()}_${index}`, // ✅ GARANTIR STRING
          title: doc.titulo || doc.title || 'Documento sem título',
          description: doc.descricao || doc.description || '',
          category: doc.categoria || doc.category || 'Sem categoria',
          fileName: doc.nomeArquivo || doc.nome_arquivo || doc.fileName || 'arquivo',
          fileUrl: doc.urlArquivo || doc.url_arquivo || doc.fileUrl || '',
          thumbnailUrl: doc.thumbnail_url || doc.thumbnailUrl,
          uploadedBy: doc.enviadoPor || doc.enviado_por || doc.uploadedBy || '',
          visibilidade: doc.visibilidade || 'todos',
                  
          // ✅ CONVERSÕES SEGURAS para Date com validação
          uploadedAt: (() => {
            const dateFields = [doc.enviadoEm, doc.enviado_em, doc.criado_em, doc.data_upload, doc.uploadedAt];
            for (const field of dateFields) {
              if (field) {
                const date = new Date(field);
                if (!isNaN(date.getTime())) return date;
              }
            }
            return new Date(); // Fallback seguro
          })(),
                  
          createdAt: (() => {
            const dateFields = [doc.criadoEm, doc.criado_em, doc.createdAt];
            for (const field of dateFields) {
              if (field) {
                const date = new Date(field);
                if (!isNaN(date.getTime())) return date;
              }
            }
            return undefined;
          })(),
                  
          updatedAt: (() => {
            const dateFields = [doc.atualizadoEm, doc.atualizado_em, doc.updatedAt];
            for (const field of dateFields) {
              if (field) {
                const date = new Date(field);
                if (!isNaN(date.getTime())) return date;
              }
            }
            return undefined;
          })(),
                  
          uploadedByName: doc.enviadoPorNome || doc.enviado_por_nome || doc.uploadedByName,
          isActive: doc.ativo ?? doc.isActive ?? true,
          downloadCount: parseInt(doc.qtdDownloads || doc.qtd_downloads || doc.downloadCount || '0'),
          mimeType: doc.tipoMime || doc.tipo_mime || doc.mimeType,
          fileSize: parseInt(doc.tamanhoArquivo || doc.tamanho_arquivo || doc.fileSize || '0')
        };
      });

      console.log('✅ Documentos mapeados com sucesso:', {
        total: documentsWithDates.length,
        primeiros3: documentsWithDates.slice(0, 3).map(d => ({ id: d.id, title: d.title }))
      });

      setDocuments(documentsWithDates);
      
      if (data.categorias && Array.isArray(data.categorias)) {
        setCategories(data.categorias);
        console.log('✅ Categorias definidas:', data.categorias);
      } else {
        // ✅ Extrair categorias dos documentos
        const extractedCategories = Array.from(
          new Set(documentsWithDates.filter(doc => doc.isActive).map(doc => doc.category))
        ).sort();
        setCategories(extractedCategories);
        console.log('✅ Categorias extraídas dos documentos:', extractedCategories);
      }

      console.log('🎉 fetchDocuments concluído com sucesso!');
      
    } catch (err) {
      console.error('❌ Erro completo ao buscar documentos:', err);
      
      // ✅ DEFINIR ERRO PARA O USUÁRIO
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido ao carregar documentos';
      setError(errorMessage);
      
      // ✅ NÃO usar dados hardcoded em caso de erro real
      // Deixar vazio para mostrar o erro ao usuário
      setDocuments([]);
      setCategories([]);
      
      console.log('📄 Estado definido como vazio devido ao erro');
      
    } finally {
      setIsLoading(false);
      console.log('🏁 fetchDocuments finalizado');
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
        body: JSON.stringify({
          title: documentData.title,
          description: documentData.description,
          category: documentData.category,
          fileName: documentData.fileName,
          fileUrl: documentData.fileUrl,
          thumbnailUrl: documentData.thumbnailUrl,
          visibilidade: documentData.visibilidade || 'todos' // ✅ ADICIONAR
        })
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
        visibilidade: rawDoc?.visibilidade || documentData.visibilidade || 'todos',
        
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
        // Fallback local
        setDocuments(prev => 
          prev.map(doc => 
            doc.id === id ? { 
              ...doc, 
              ...updates,
              thumbnailUrl: updates.thumbnailUrl || doc.thumbnailUrl, // ✅ MANTER THUMBNAIL
              updatedAt: new Date()
            } : doc
          )
        );
        return;
      }

      const response = await fetch(`/api/documents/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar documento');
      }

      const data = await response.json();
      const rawDoc = data.documento;

      if (rawDoc) {
        const updatedDocument: PDFDocument = {
          id,
          title: rawDoc.titulo || updates.title,
          description: rawDoc.descricao || updates.description,
          category: rawDoc.categoria || updates.category,
          fileName: rawDoc.nome_arquivo || updates.fileName,
          fileUrl: rawDoc.url_arquivo || updates.fileUrl,
          visibilidade: rawDoc.visibilidade || updates.visibilidade,
          thumbnailUrl: updates.thumbnailUrl || rawDoc.thumbnail_url, // ✅ PRIORIZAR A NOVA THUMBNAIL
          uploadedBy: rawDoc.enviado_por || updates.uploadedBy,
          uploadedAt: new Date(rawDoc.enviado_em || Date.now()),
          isActive: rawDoc.ativo ?? true,
          uploadedByName: rawDoc.enviado_por_nome || updates.uploadedByName,
          mimeType: rawDoc.tipo_mime || updates.mimeType,
          fileSize: rawDoc.tamanho_arquivo || updates.fileSize,
          downloadCount: rawDoc.qtd_downloads || updates.downloadCount
        };

        setDocuments(prev => 
          prev.map(doc => 
            doc.id === id ? updatedDocument : doc
          )
        );
      }
      
    } catch (err) {
      console.error('❌ Erro ao atualizar documento:', err);
      
      // Fallback local
      setDocuments(prev => 
        prev.map(doc => 
          doc.id === id ? { 
            ...doc, 
            ...updates,
            updatedAt: new Date()
          } : doc
        )
      );
      
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
    existingId?: string,
    thumbnail?: File // ✅ Adicionar parâmetro thumbnail
  ): Promise<PDFDocument> => {
    try {
      const token = localStorage.getItem('authToken');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', documentData.title || '');
      formData.append('description', documentData.description || '');
      formData.append('category', documentData.category || '');
      formData.append('visibilidade', documentData.visibilidade || 'todos');

      // ✅ ADICIONAR THUMBNAIL SE FORNECIDA
      if (thumbnail) {
        formData.append('thumbnail', thumbnail);
        console.log('📎 Thumbnail adicionada ao FormData:', thumbnail.name);
      }

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
        thumbnailUrl: rawDoc.thumbnail_url, // ✅ INCLUIR THUMBNAIL URL
        uploadedBy: rawDoc.enviado_por || 'api@user.com',
        uploadedAt: new Date(rawDoc.data_upload || Date.now()),
        isActive: rawDoc.ativo ?? true,
        mimeType: rawDoc.tipo_mime,
        fileSize: rawDoc.tamanho_arquivo,
        visibilidade: rawDoc.visibilidade || documentData.visibilidade || 'todos'
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

      console.log(`✅ ${existingId ? 'Documento atualizado' : 'Documento criado'} com sucesso:`, {
        id: updatedDocument.id,
        title: updatedDocument.title,
        thumbnailUrl: updatedDocument.thumbnailUrl,
        temThumbnail: !!thumbnail
      });

      return updatedDocument;

    } catch (error) {
      console.error('❌ Erro no upload:', error);
      throw error;
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