// README.md
/*
# Backend Resend para Dashboards RMH

## Instalação:

1. Criar pasta backend:
```bash
mkdir backend
cd backend
```

2. Instalar dependências:
```bash
npm init -y
npm install express cors resend
npm install -D nodemon
```

3. Copiar código do server.js

4. Rodar servidor:
```bash
npm run dev
```

## Uso:

### Testar se está funcionando:
```bash
curl http://localhost:3001
```

### Enviar email de teste:
```bash
curl -X POST http://localhost:3001/send-test-email
```

### Enviar email de verificação:
```bash
curl -X POST http://localhost:3001/send-verification-email \
  -H "Content-Type: application/json" \
  -d '{"name":"André","email":"andre@teste.com","verificationToken":"abc123"}'
```

## Integração com Frontend:

No React, trocar a URL:
```javascript
const response = await fetch('http://localhost:3001/send-test-email', {
  method: 'POST'
});
```

## Deploy:

- Railway: `railway deploy`
- Render: conectar repositório
- Vercel: `vercel --prod`
- Heroku: `git push heroku main`

## Variáveis de ambiente para produção:

```
RESEND_API_KEY=re_BVk2fgSA_npWD4cQkwoAz9MFkgH4CdptG
PORT=3001
NODE_ENV=production
```
*/