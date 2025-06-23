# 📋 TODO - Sistema de Dashboards RMH

## ✅ CONCLUÍDOS

### 🔧 Controle de Usuários
- [x] Melhorar a página de controle de usuário
- [x] Adicionar usuários via admin (envio automático de email)
- [x] Funcionalidade de mudar setor
- [x] Revogar acesso de usuários
- [x] Corrigir "Coordenador pode virar coordenador"
- [x] Adicionar cartões de estatísticas CLT/Associado e Estagiário

---

## 🚧 EM DESENVOLVIMENTO

### 📊 Sistema de Dashboards

#### 🎯 Reestruturação de Níveis de Acesso
- [ ] **Backend**: Implementar nova lógica de visibilidade
  ```sql
  tipo_visibilidade: 'geral' | 'coordenadores' | 'admin'
  ```
- [ ] **Frontend**: Atualizar tipos e interfaces
- [ ] **Roteamento**: Proteger página `/dashboards` (apenas coordenadores + admins)

#### 👥 Níveis de Usuário
- [ ] **👤 Usuário**
  - Dashboard geral da empresa (página inicial)
  - Documentos
  - Organograma
  - Newsletter
  
- [ ] **👑 Coordenador**
  - Tudo do usuário +
  - Aba de dashboards do setor
  - Criar/editar dashboards do seu setor
  - Excluir dashboards do seu setor
  
- [ ] **🔧 Admin**
  - Tudo do coordenador +
  - Acesso total a todos os dashboards
  - Controle de usuários
  - Configurações do sistema

#### 🏠 Página Inicial
- [ ] Dashboard geral do escritório (para todos)
- [ ] Introdução/boas-vindas
- [ ] Links rápidos por tipo de usuário

#### 🧭 Header/Navegação
- [ ] Melhorar seção de dashboards no header
- [ ] Adaptar menu por tipo de usuário
- [ ] Dashboards não é mais página principal

---

## 🐛 BUGS & AJUSTES CRÍTICOS

### ⚠️ Funcionalidades Quebradas
- [ ] **CRÍTICO**: Não consegue adicionar dashboard
- [ ] **Botão reativar** não funciona
- [ ] **Usuários revogados** não mostram aviso visual

### 🔐 Controle de Acesso
- [ ] Cada pessoa só vê dashboards do seu setor (implementar filtros)
- [ ] Coordenadores: acesso restrito ao próprio setor

### 📧 Sistema de Email
- [ ] Arrumar template de email para estagiários
- [ ] Corrigir página de validação de email
- [ ] Estagiário cadastrado pelo admin aparece com status indefinido (NULL em aprovado_admin)

---

## 💡 MELHORIAS PROPOSTAS

### 🗂️ Gestão de Tokens Expirados
**Problema atual**: Tokens expirados são excluídos automaticamente

**✨ Solução proposta**: Sistema de controle manual

#### 🏗️ Estrutura do Banco
```sql
ALTER TABLE usuarios ADD COLUMN status_verificacao VARCHAR(50) DEFAULT 'pendente';
ALTER TABLE usuarios ADD COLUMN data_expiracao TIMESTAMP;
ALTER TABLE usuarios ADD COLUMN tentativas_reenvio INTEGER DEFAULT 0;
```

#### 📋 Nova Aba: "Tokens Expirados"
```
┌─ TOKENS EXPIRADOS (23) ────────────────┐
│                                        │
│ 👤 João Silva - joao@email.com         │
│    📅 Expirou há 2 dias | 🔄 0 reenvios │
│    [Reenviar Código] [Excluir]         │
│                                        │
│ 👤 Maria Santos - maria@empresa.com    │
│    📅 Expirou há 5 dias | 🔄 1 reenvio  │
│    [Reenviar Código] [Excluir]         │
│                                        │
└────────────────────────────────────────┘
```

#### ⚡ Funcionalidades
- [ ] **Reenviar código individual**
- [ ] **Excluir usuário definitivamente**
- [ ] **Ações em lote**:
  - Reenviar para selecionados
  - Excluir selecionados
  - Limpar tokens antigos (>30 dias)

#### 📊 Vantagens
- ✅ Controle administrativo total
- ✅ Evita perda de cadastros legítimos
- ✅ Insights sobre abandono do processo
- ✅ Melhor experiência do usuário

---

## 🔍 INVESTIGAÇÕES NECESSÁRIAS

### 🔐 Sistema de Tokens
- [ ] **Verificar**: Tokens expirados são realmente excluídos do banco?
- [ ] **Analisar**: Como funciona a limpeza automática atual?
- [ ] **Definir**: Política de retenção de dados

### 📊 Power BI Embed
- [ ] **Confirmar**: `powerbi_report_id` + `powerbi_group_id` = embed seguro?
- [ ] **Testar**: Funcionalidade de dashboards seguros
- [ ] **Documentar**: Diferença entre público vs seguro

---

## 🎯 PRIORIDADES

### 🔥 ALTA PRIORIDADE
1. **Corrigir impossibilidade de adicionar dashboard**
2. **Implementar níveis de acesso corretos**
3. **Corrigir status indefinido de estagiários**

### 📈 MÉDIA PRIORIDADE
4. **Implementar gestão de tokens expirados**
5. **Melhorar templates de email**
6. **Reestruturar página inicial**

### 🌟 BAIXA PRIORIDADE
7. **Melhorias de UX no header**
8. **Documentação do sistema**
9. **Otimizações de performance**

---

## 📝 NOTAS TÉCNICAS

### 🏗️ Arquitetura de Visibilidade
```typescript
// Frontend
export type TipoVisibilidade = 'geral' | 'coordenadores' | 'admin';

// Backend - Lógica de acesso
if (user.tipo_usuario === 'admin') {
  // Vê todos os dashboards
} else if (user.is_coordenador) {
  // Vê 'geral' + 'coordenadores' do seu setor
} else {
  // Vê apenas 'geral'
}
```

### 🔄 Status de Usuários
```
pendente_verificacao → aguardando_aprovacao → ativo
                   ↓
              token_expirado (nova aba)
```

### 📧 Fluxo de Email
```
Admin adiciona → Email enviado → Token gerado → Usuário valida → Ativo
                              ↓
                         Token expira → Aba "Expirados"
```

---

*Última atualização: 22/06/2025*