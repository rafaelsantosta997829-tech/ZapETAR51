# ZapETAR — Aplicativo de Mensagens 1:1 em Tempo Real

**ZapETAR** é atualmente um aplicativo local-first de comunicação 1:1, desenvolvido com **React, TypeScript, Vite, Tailwind CSS, Express e SQLite**. A autenticação web ativa é local, por e-mail/senha com sessão HttpOnly; Firebase, Google Sign-In e Firestore não estão integrados neste runtime.

> **Cópia para Google AI Studio Build:** veja [AI_STUDIO_MIGRATION.md](AI_STUDIO_MIGRATION.md) antes de importar e [MIGRATION_INVENTORY.md](MIGRATION_INVENTORY.md) para o inventário. Esta cópia preserva o frontend, Express, SQLite, grupos, testes e fontes Android/firmware; nenhum banco local ou segredo foi copiado.

## Compatibilidade com instalações existentes

A renomeação atualiza a identidade exibida e os metadados do projeto, não os identificadores usados para localizar dados e serviços existentes:

- **Dados locais**: `%LOCALAPPDATA%\CONEXA\conexa.sqlite`, `conexa_mesh_store.db`, chaves web `conexa:*`/`conexa_*` e preferências Android `conexa_*` continuam iguais.
- **Sessões e configuração**: cookie `conexa_session`, rotas da API e variáveis `CONEXA_*` (incluindo `CONEXA_DB_PATH`, `CONEXA_EMAIL_FROM`, `CONEXA_DEMO_PASSWORD` e `CONEXA_GATEWAY_SECRET`) continuam iguais; `conexa` permanece username reservado.
- **Android e bridges**: namespace/application ID `com.conexa.offline.mesh`, `ConexaMeshService`, `ConexaMeshDatabase`, `ConexaNativeMesh` e os nomes de diretório existentes permanecem estáveis para instalações e integrações.
- **Rádio/rede**: `CONEXA/1`, `CONEXA_DISCOVER/1`, macros de firmware `CONEXA_*` e o endpoint TURN `turn.conexa.app` não foram renomeados; são contratos/configuração de rede existentes.
- **Histórico**: especificações e relatórios versionados (incluindo `docs/conexa-v*.md`) podem conservar “CONEXA” para descrever fielmente o estado registrado.

---

## 🚀 Principais Funcionalidades

- **Autenticação local**: cadastro/login por e-mail e senha, sessão HttpOnly em SQLite e logout server-side. Login Google não está disponível. Recuperação de senha só envia e-mail quando Resend estiver configurado; sem provedor, o app informa que nada foi enviado.
- **Identidade e Perfil Único**: Nome de exibição, `@username` exclusivo validado, bio, status personalizado e avatar.
- **Busca de Contatos**: Localize outros usuários na rede por nome ou `@username`, sem jamais expor e-mails ou dados privados sensíveis.
- **Conversas 1:1 Determinísticas**: Identificador único derivado da ordenação dos participantes (`uidA_uidB`), prevenindo duplicação de salas de chat.
- **Mensagens locais**: Mensagens são servidas pelo Express e persistidas no SQLite da instância local; a atualização web usa polling autenticado.
- **Ciclo Completo de Estados de Mensagem**:
  - `SENDING`: Mensagem em trânsito
  - `SENT` (✓): Persistida no servidor
  - `DELIVERED` (✓✓ cinza): Entregue ao destinatário
  - `READ` (✓✓ ciano): Lida pelo destinatário
  - `FAILED`: Falha com possibilidade de reenvio
- **Bloqueio de Usuários**: Bloquear/desbloquear contatos com validação nas rotas autenticadas do servidor local.
- **Denúncia e Moderação**: Sistema de reporte contra abuso, spam ou fraude com categorias estruturadas.
- **Painel Administrativo RBAC**: Área de gestão com métricas do sistema, lista de denúncias para moderação e suspensão de contas maliciosas.
- **Resiliência e Observabilidade**: Endpoints `/health`, `/ready` e `/status`, logging com `requestId` e `correlationId`.
- **Ambiente de Teste 1:1 Instantâneo**: Botões dedicados no login para alternar entre "Alice" e "Bob", facilitando a validação em tempo real entre duas abas do navegador.

---

## 📐 Arquitetura do Sistema

```mermaid
flowchart TD
    subgraph Cliente [Frontend React + TypeScript]
        UI[Interface Responsiva Tailwind]
        AuthContext[Auth Context & State]
        ChatContext[Chat Context & Realtime Listeners]
    end

    subgraph Backend [Node.js + Express]
        Server[server.ts]
        HealthCheck[/health, /ready, /status]
        ObsLogger[Request Logger Middleware]
    end

    subgraph Local [Persistência local]
        Auth[SQLite users and sessions]
        Store[(SQLite messages and media)]
        Browser[(IndexedDB and localStorage)]
    end

    UI --> AuthContext
    UI --> ChatContext
    AuthContext --> Auth
    ChatContext --> Server
    Server --> Store
    UI --> Browser
    Server --> HealthCheck
    Server --> ObsLogger
```

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide React, Motion.
- **Backend / Observabilidade**: Node.js 22.13+ recomendado, Express, tsx, esbuild. `node:sqlite` é usado sem dependência SQLite nativa adicional.
- **Persistência & Auth atuais**: SQLite local, scrypt para senhas, cookies HttpOnly; IndexedDB/localStorage para ferramentas locais.
- **Testes**: Vitest (testes unitários e auditoria de segurança).

---

## 📦 Estrutura de Pastas

```text
/
├── server/database.ts             # Esquema SQLite local
├── server/localApi.ts             # Rotas locais autenticadas
├── security_spec.md              # Especificação de segurança e Dirty Dozen
├── server.ts                     # Servidor Express full-stack e observabilidade
├── src/
│   ├── App.tsx                   # Layout principal e orquestrador
│   ├── main.tsx                  # Ponto de entrada React
│   ├── types/                    # Modelos de domínio TypeScript
│   ├── lib/                      # Utilitários de domínio
│   ├── utils/                    # Validação, identificadores e anti-spam
│   ├── services/                 # Auth, Chat, mídia e ferramentas locais
│   ├── context/                  # Contextos de Autenticação e Chat
│   └── components/               # Componentes modulares de UI
│       ├── auth/
│       ├── chat/
│       ├── conversations/
│       ├── search/
│       ├── profile/
│       ├── settings/
│       ├── reports/
│       ├── admin/
│       └── common/
├── tests/                        # Bateria de testes automatizados
└── docs/                         # Documentação técnica detalhada
```

---

## ⚙️ Variáveis de Ambiente

Use [.env.example](.env.example) como referência. O projeto não carrega `.env` automaticamente: exporte as variáveis no shell ou configure valores/segredos server-side na hospedagem. Nunca preencha este template com credenciais reais.

```env
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
```

---

## 🏃 Como Executar Localmente

1. **Instalar dependências**:

   ```bash
   npm ci
   ```

2. **Iniciar servidor de desenvolvimento**:

   ```bash
   npm run dev
   ```

   Acesse `http://localhost:3000`.

3. **Executar testes unitários e de segurança**:

   ```bash
   npm test
   ```

4. **Compilar para produção**:
   ```bash
   npm run build
   npm start
   ```

---

## 🛡️ Segurança atual

O runtime web atual não consulta Firestore nem aplica `firestore.rules`. As rotas Express aplicam autenticação por cookie e autorização por usuário/função; veja [docs/security.md](docs/security.md) e [docs/tool-readiness-inventory.md](docs/tool-readiness-inventory.md). A recuperação por e-mail requer `RESEND_API_KEY`, `CONEXA_EMAIL_FROM` e um `APP_URL` seguro. Sem eles, nenhum e-mail é enviado e a UI informa a indisponibilidade.

Especificação histórica do modelo Firestore: [security_spec.md](security_spec.md). Ela não deve ser tratada como evidência de controles ativos no runtime local.
