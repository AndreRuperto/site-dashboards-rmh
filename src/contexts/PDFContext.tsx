import React, { createContext, useContext, useState } from 'react';

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
}

interface PDFContextType {
  documents: PDFDocument[];
  addDocument: (document: Omit<PDFDocument, 'id' | 'uploadedAt'>) => void;
  updateDocument: (id: string, updates: Partial<PDFDocument>) => void;
  deleteDocument: (id: string) => void;
  getFilteredDocuments: (category?: string) => PDFDocument[];
  categories: string[];
}

const PDFContext = createContext<PDFContextType | undefined>(undefined);

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

export const PDFProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [documents, setDocuments] = useState<PDFDocument[]>(initialDocuments);

  const addDocument = (document: Omit<PDFDocument, 'id' | 'uploadedAt'>) => {
    const newDocument: PDFDocument = {
      ...document,
      id: Math.random().toString(36).substr(2, 9),
      uploadedAt: new Date()
    };
    setDocuments(prev => [...prev, newDocument]);
  };

  const updateDocument = (id: string, updates: Partial<PDFDocument>) => {
    setDocuments(prev => prev.map(doc => 
      doc.id === id ? { ...doc, ...updates } : doc
    ));
  };

  const deleteDocument = (id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
  };

  const getFilteredDocuments = (category?: string) => {
    return documents.filter(doc => {
      if (!doc.isActive) return false;
      if (category && category !== 'all' && doc.category !== category) return false;
      return true;
    });
  };

  const categories = Array.from(new Set(documents.map(doc => doc.category)));

  const contextValue: PDFContextType = {
    documents,
    addDocument,
    updateDocument,
    deleteDocument,
    getFilteredDocuments,
    categories
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