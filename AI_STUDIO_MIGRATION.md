# Migração do ZapETAR para Google AI Studio Build

## O que foi preparado

Esta cópia mantém a aplicação React/TypeScript/Vite, servidor Express, serviços, autenticação, conversas, grupos, uploads, testes, documentação, app Android offline e código do gateway/firmware. A estrutura e os caminhos relativos do projeto foram preservados.

O bundle de produção usa `PORT` e `HOST` do ambiente, e a instalação de produção continua sendo `npm ci`, `npm run build` e `npm start`. `node:sqlite` é um módulo integrado do Node; a aplicação não depende de um pacote SQLite nativo do npm. O workflow GitHub foi ajustado para usar Node 22.13 e validar lint, testes e build sem exigir arquivos Firebase que não fazem parte deste runtime.

## O que não foi copiado

- Banco local `data/conexa.sqlite` e seus arquivos WAL/SHM, além de outros bancos `*.sqlite`/`*.db`. Esses bancos podem conter e-mails, perfis, sessões, mensagens, grupos, mídia e outros dados privados. Nenhum banco/dado foi alterado ou copiado nesta preparação.
- `node_modules`, caches e resultados gerados de Android/Gradle, PlatformIO, Vite, Playwright e testes.
- `dist/`, bundle gerado `server.js`, APKs, ZIPs e artefatos de hardware/Android.
- Scripts QA temporários e relatórios de descoberta local de hardware.
- Arquivos `.env` reais e credenciais. A varredura da cópia não encontrou arquivos `.env` ativos nem chaves de API reconhecidas. Strings de credenciais presentes em testes são fixtures sintéticas e não são credenciais de serviço.

O arquivo `.env.example` contém apenas nomes de variáveis e valores vazios/de demonstração. Não coloque chaves nesse arquivo; use o ambiente local ou o gerenciador server-side de segredos da hospedagem.

## Importar pelo GitHub

1. Publique esta cópia em um repositório GitHub **privado** se o código ou os requisitos de privacidade pedirem. Não inclua o banco do computador.
2. Abra Google AI Studio em [Build mode](https://aistudio.google.com/apps).
3. No botão `+` / **Add files**, escolha **Import from GitHub** e autorize o acesso ao repositório apropriado.
4. Selecione o repositório e importe a raiz, onde estão `package.json`, `server.ts` e `src/`.
5. Primeiro peça ao AI Studio para executar e revisar a aplicação sem trocar backend, banco, autenticação ou provedores. Compare o resultado com este código-fonte antes de aceitar mudanças.

Importar o repositório não publica por si só o serviço. O deploy/compartilhamento do AI Studio é uma etapa distinta e pode criar recursos adicionais.

## Limitações importantes antes de produção

### SQLite e persistência

O backend abre `CONEXA_DB_PATH` se definido; sem ele usa `%LOCALAPPDATA%\\CONEXA\\conexa.sqlite` no Windows ou `$XDG_DATA_HOME/conexa/conexa.sqlite` (com fallback `$HOME/.local/share/conexa/conexa.sqlite`) em outros ambientes. O banco cria o esquema ao iniciar, incluindo tabelas de contas, sessões, mensagens, grupos, recibos, mídia e auditoria; há também migrações explícitas para desafios e mensagens históricas de enquetes.

Um disco local de container/preview não deve ser considerado armazenamento durável entre reinícios, novas instâncias ou escalonamento horizontal. Não há PostgreSQL/Cloud SQL/Firestore nem armazenamento de objetos integrados neste runtime. Antes de usar com usuários ou dados que precisem persistir, projete e teste uma migração de banco persistente, mídia e sessões; não habilite múltiplas instâncias com SQLite local.

Uma migração autorizada do banco privado é uma operação separada e manual: pare a aplicação que o utiliza, faça um backup consistente (incluindo WAL por meio do SQLite Backup API/`.backup`, não copiando apenas um arquivo ativo), proteja o backup, transfira-o por canal aprovado e teste em uma instância isolada. Revise retenção, dados pessoais e políticas antes de qualquer importação. Nenhum comando de exportação/importação de dados foi executado nesta preparação.

### Login, cookies, e-mail e domínio

- O login atual é local por e-mail/senha, usando scrypt, sessões server-side SQLite e cookie `conexa_session`. Firebase Auth, Google Sign-In e Firestore não estão integrados. O bootstrap Firebase do AI Studio não migra automaticamente essas contas.
- Sessões locais não são automaticamente compartilhadas entre instâncias; reinicializar a base pode invalidar sessões. Produção requer armazenamento transacional persistente e gestão de sessão compatível com o domínio HTTPS/escala.
- Cookies são `HttpOnly` e `SameSite=Lax`; valide `Secure`, domínio, proxy HTTPS e proteções CSRF conforme o domínio real antes do deploy público. Não confie no preview para certificar esses controles.
- Recuperação de senha envia e-mail somente com `RESEND_API_KEY`, `CONEXA_EMAIL_FROM` verificado e `APP_URL` HTTPS correto. Sem esses valores a recuperação não envia e-mail.

### IA, mapas e comunicação

- O assistente configurável no servidor suporta Gemini (`gemini-2.5-flash`) e vem desativado por padrão. Forneça `GEMINI_API_KEY` somente em configuração secreta server-side, selecione `AI_PROVIDER=gemini` e habilite conscientemente `AI_ENABLED=true`. Não foi adicionada chave nem provedor pago.
- A disponibilidade/custo/quota de Gemini depende do plano e das regras atuais do fornecedor; não é garantida por este código.
- Busca/rota de mapas do backend precisa de endpoints compatíveis configurados (`MAP_GEOCODING_URL`, `MAP_ROUTING_URL` e contato correspondente). A camada visual ainda usa tiles públicos OpenStreetMap; respeite os termos/limites do provedor.
- Chamadas WebRTC podem usar STUN público; TURN real exige URL e segredo (`TURN_URL`, `TURN_SECRET`). Sem TURN, redes restritivas podem impedir chamadas.
- E-mail via Resend e qualquer API externa exigem domínio, credenciais e quotas do respectivo provedor.

### Recursos locais que não são deploy web

Ferramentas do navegador que usam `localStorage`, IndexedDB, File System Access API, fala, notificações ou armazenamento local continuam limitadas ao navegador e ao dispositivo. O código Kotlin/Android Nearby/Room, o gateway Python LAN, porta serial, firmware SX1262/ESP32 e testes com hardware foram preservados como projetos separados. Eles não se tornam serviços executáveis no runtime web do AI Studio. O arquivo de configuração da placa requer dados reais do hardware antes de compilar firmware.

`MUTOOL_PATH` pode apontar para MuPDF local; sem um executável compatível no host Linux, operações PDF que o exijam podem ficar indisponíveis.

## Comandos validados

Requisitos: Node.js 22.13+ (ou uma versão 22.x mais recente) e npm; rede necessária para baixar dependências.

```sh
npm ci
npm run lint
npm test
npm run build
npm start
```

O modo local de desenvolvimento continua disponível em `npm run dev`. Testes E2E Playwright não fazem parte do relatório padrão desta migração; podem depender de Chromium e de um servidor/conta de QA isolados.

## Inventário da cópia

Inventário por área, após instalação das dependências:

- `src/`: 126 arquivos — UI React, contexto, autenticação, serviços, ferramentas, chamadas, offline e modelos.
- `server/`: 11 arquivos — Express API, SQLite, grupos, e-mail, mapas, PDF e assistente.
- `tests/`: 65 arquivos — testes unitários, API, segurança e E2E.
- `docs/`: 22 arquivos — arquitetura, implantação, segurança, testes, funcionalidades e validações históricas.
- `conexa-offline-android/`: 51 arquivos-fonte/documentação/build config incluídos — app Android nativo offline.
- `conexa-gateway/`: 19 arquivos-fonte/documentação/configuração incluídos — gateway Python e firmware.
- `scripts/`: 8 scripts de manutenção/QA não temporários.
- Também preservados: `public/`, `shared/`, `.github/`, `.vscode/`, `README.md`, `security_spec.md`, `package.json`, `package-lock.json`, `bun.lock`, `tsconfig.json`, `vite.config.ts`, Playwright config, metadados e entrada HTML.

Foram copiados **319 arquivos do projeto**. Foram excluídos **7 arquivos individuais**: dois validadores `.tmp-offline-validate`, o ZIP do Android, o relatório de descoberta física, o bundle gerado `server.js` e dois scripts QA ocultos. Também foram omitidos diretórios gerados/locais inteiros — `node_modules`, `dist`, `artifacts`, `data`, `test-results`, `.gradle`, `build`, `.pio`, `__pycache__`, virtualenvs, coverage e caches Playwright —, além de conteúdo em `*.sqlite`, `*.db`, APKs/ZIPs e credenciais cobertas pelo `.gitignore`. As pastas-fonte Android e firmware foram mantidas; só os outputs de build/cache foram excluídos.

Na leitura da árvore original havia 14.142 arquivos no total: 319 copiados e 13.823 excluídos (inclui conteúdo gerado/cache e os 7 arquivos individuais acima). A exclusão de `data/` removeu exatamente 3 arquivos SQLite/WAL/SHM; esses dados não foram copiados.

`MIGRATION_TEST_REPORT.md` registra as verificações realizadas na cópia. `node_modules`, builds, a base de smoke test e `.git` são arquivos gerados localmente, não itens do inventário inicial de 319 arquivos.

## Resultado da preparação

Veja [MIGRATION_TEST_REPORT.md](MIGRATION_TEST_REPORT.md) para comandos executados e resultados efetivos na cópia.
