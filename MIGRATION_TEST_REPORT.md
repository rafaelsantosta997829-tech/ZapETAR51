# Relatório de preparação da cópia

Data da execução: 2026-10-26.

Os comandos abaixo foram executados na cópia `conexa-google-ai-studio`; não foram apontados ao banco nem aos arquivos de build do projeto original.

## Resultados

- `npm ci --no-audit --no-fund`: **PASSOU**, dependências restauradas do `package-lock.json`.
- `npm run lint`: **PASSOU**, `tsc --noEmit` sem erros.
- `npm test`: **PASSOU**, 59 arquivos de teste e 413 testes.
- `npm run build`: **PASSOU**, Vite compilou 2176 módulos e esbuild gerou o bundle de servidor.
- `npm run clean`: **PASSOU**, script portátil do Node removeu `dist/` e `server.js` apenas na cópia.
- Smoke test em produção: **PASSOU**. `npm start` com `NODE_ENV=production`, porta loopback 3018 e `CONEXA_DB_PATH` temporário respondeu HTTP 200 em `/health`, `/ready` e `/`; a página servida continha ZapETAR. O processo foi encerrado e os três arquivos SQLite temporários foram removidos.
- Testes Android, firmware físico, gateway LAN físico e integrações externas reais: **não executados**; requerem ferramentas, hardware, configuração ou credenciais externas.
- Chamadas reais a serviços Gemini/Resend/mapas/TURN: **não executadas**; nenhuma credencial de serviço foi configurada nesta validação.

Notas:

- Vitest emitiu avisos do Node sobre `--localstorage-file` sem caminho válido em três workers; a suíte concluiu com sucesso, sem falhas.
- Vite avisa que alguns chunks comprimidos excedem 500 kB (principalmente o módulo OfflineMaps); o build concluiu com sucesso.
- Instalação usada: Node v25.8.2/npm 11.11.1 no Windows. A cópia e o workflow CI pedem Node 22.13+ para fornecer `node:sqlite`; CI Linux Node 22.13 não foi executado neste computador.
- Transparência sobre o original: no início da primeira tentativa, `npm ci` também foi executado uma vez a partir da pasta original antes de eu fixar o diretório da cópia. Isso pode ter atualizado o `node_modules` ignorado do original. Não alterei intencionalmente código-fonte, manifests, banco, dados ou builds do original durante esta preparação; os lockfiles original/cópia conferem. Como o `node_modules` original não tinha backup para comparação, não posso afirmar que ele permaneceu byte a byte intacto.
