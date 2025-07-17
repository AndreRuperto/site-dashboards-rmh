# Use uma imagem base do Node.js com Chrome
FROM ghcr.io/puppeteer/puppeteer:21.11.0

# Configurar variáveis de ambiente
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    NODE_ENV=production

# Atualizar e instalar dependências do sistema para Sharp e outras libs
USER root
RUN apt-get update && apt-get install -y \
    # Dependências para Sharp (processamento de imagens)
    libvips-dev \
    libvips-tools \
    # Dependências para build de pacotes nativos
    python3 \
    make \
    g++ \
    # cross-env equivalent (though not needed in Docker)
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Configurar diretório de trabalho
WORKDIR /usr/src/app

# Copiar package.json do frontend para instalar dependências
COPY package*.json ./

# Instalar dependências do frontend (necessárias para o build)
RUN npm ci

# Copiar código do frontend
COPY . .

# Executar o mesmo comando que você usa localmente: npm run deploy:prod
# Isso vai fazer: npm run clean:dist && cross-env VITE_ENV_FILE=.env1 vite build --outDir=./backend/dist --emptyOutDir
RUN npm run deploy:prod

# Verificar se o build foi criado
RUN ls -la backend/dist/

# Agora ir para o backend e instalar suas dependências de produção
WORKDIR /usr/src/app/backend

# Copiar package.json do backend
COPY backend/package*.json ./

# Instalar APENAS dependências de produção do backend
RUN npm ci --only=production && npm cache clean --force

# Copiar código do backend (server.js e outros arquivos necessários)
COPY backend/server.js ./
COPY backend/.env1 ./.env1

# Criar diretórios necessários que o server.js espera
RUN mkdir -p uploads temp dist/documents

# Verificar estrutura final
RUN echo "=== Estrutura Final ===" && \
    ls -la && \
    echo "=== Conteúdo dist ===" && \
    ls -la dist/ && \
    echo "=== Arquivos backend ===" && \
    ls -la

# Expor a porta
EXPOSE 3001

# Criar usuário não-root para segurança
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /home/pptruser/Downloads \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser /usr/src/app

# Mudar para usuário não-root
USER pptruser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Comando para iniciar - o mesmo que você usa no Railway atualmente
CMD ["npm", "start"]