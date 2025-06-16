// src/utils/apiInterceptor.ts
// Configuração da API
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://rmh.up.railway.app'
  : 'http://localhost:3001'

// Interceptor para requisições (intercepta 401 e faz logout automático)
export const setupAPIInterceptor = () => {
  // Interceptar fetch global para tratar 401
  const originalFetch = window.fetch;
  
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    
    // Se receber 401 em qualquer requisição, fazer logout
    if (response.status === 401) {
      // Verificar se a requisição é para nossa API
      const isApiRequest = API_BASE_URL 
        ? response.url.includes(API_BASE_URL)
        : response.url.includes('/api');
      
      if (isApiRequest) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        
        // Só redirecionar se não estiver já na página de login
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    }
    
    return response;
  };
};