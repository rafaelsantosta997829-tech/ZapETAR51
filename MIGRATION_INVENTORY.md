# Inventário da cópia de migração

Raiz copiada: `C:\Users\Kalebi\Desktop\conexa`  
Destino: `C:\Users\Kalebi\Desktop\conexa-google-ai-studio`  
Escopo inicial: **319 arquivos de código/configuração/documentação**, estrutura preservada.

## Arquivos preservados por área

| Caminho/área | Arquivos | Conteúdo |
|---|---:|---|
| `src/` | 126 | Frontend React/TypeScript, componentes, autenticação, chats privados/em grupo, permissões, uploads, IA, WebRTC, ferramentas e recursos offline do navegador |
| `server/` | 11 | Express API, SQLite/esquema, sessões, mensagens/grupos, uploads, assistente Gemini, mapas, PDF e recuperação de senha |
| `tests/` | 65 | Vitest, testes de API, autenticação, autorização, segurança, grupos, mídia e E2E Playwright |
| `docs/` | 22 | Arquitetura, implantação, banco, segurança, testes, recursos e validações existentes |
| `conexa-offline-android/` | 51 | Fontes/configuração do app Android Kotlin, Gradle Wrapper e documentação |
| `conexa-gateway/` | 19 | Gateway Python, testes, protocolo e código/configuração/documentação de firmware |
| `scripts/` | 8 | Scripts de bootstrap/QA/manutenção mantidos; temporários QA ocultos excluídos |
| `public/` | 1 | Recursos estáticos |
| `shared/` | 1 | Recursos comuns ao app |
| `.github/` | 1 | Workflow de validação CI atualizado |
| `.vscode/` | 1 | Configuração versionada do workspace |
| Raiz | 13 | HTML/metadados, README, configuração Vite/TypeScript/Playwright, npm e bun lockfiles, servidor e especificação de segurança |

## Superfícies preservadas

- **Web:** React 19, TypeScript, Vite 8, Tailwind, Express 4, polling autenticado, health/readiness e API.
- **Dados/auth:** SQLite e migrações, scrypt, cookie HttpOnly, sessões, perfis, mensagens, recibos, mídia, grupos, cargos, regras, auditoria, denúncias e recursos.
- **IA/integrações:** configuração do assistente Gemini, e-mail opcional Resend, mapas, TURN/WebRTC. Nenhuma credencial real foi incluída.
- **Cliente/dispositivo:** Android offline Nearby/Room, gateway Python para LAN, serial/rádio e firmware. Foram mantidos os fontes, não binários/builds.
- **Qualidade:** testes e documentação preservados; CI da cópia verifica Node 22.13, lint, suíte Vitest e build.

## Arquivos excluídos da árvore original

A varredura contabilizou **14.142 arquivos** no projeto original: 319 copiados e 13.823 excluídos.

| Categoria excluída | Arquivos | Motivo |
|---|---:|---|
| `node_modules/` | 10.219 | Dependências instaláveis por `npm ci`; não versionar |
| Pastas `build/` (inclui saídas Android) | 3.144 | Artefatos de compilação; fontes Android preservadas |
| `artifacts/` | 373 | Imagens de sistema/artefatos grandes de validação |
| `dist/` | 39 | Build web reproduzível com `npm run build` |
| `data/` | 3 | SQLite privado e arquivos WAL/SHM; sem autorização para copiar dados pessoais |
| `.gradle/` | 23 | Cache Gradle |
| `__pycache__/` | 11 | Cache Python |
| `test-results/` | 3 | Capturas/resultados locais |
| Arquivos temporários/gerados individuais | 7 | QA temporário, ZIP/APK, relatório local e bundle de servidor gerado |
| **Total excluído** | **13.823** | Inclui os diretórios e os arquivos individuais acima |

O destino inicial não contém `.env` real, banco SQLite, APK, ZIP, `dist/`, build Gradle ou cache PlatformIO. `node_modules/` usado durante a validação foi removido antes de preparar o Git.

## Configuração de ambiente fornecida

`.env.example` contém nomes e valores vazios/defaults não secretos para porta/host, SQLite, Gemini desativado, Resend, mapas, TURN, MuPDF e gateway LAN. O projeto não carrega esse arquivo automaticamente. Segredos devem ser configurados fora do Git, no ambiente server-side do host.
