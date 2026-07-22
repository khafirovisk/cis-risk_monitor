# Sentinela CIS — contexto de sessão (handoff)

> Este arquivo é lido automaticamente por qualquer sessão nova do Claude Code
> aberta neste diretório. Serve para retomar o trabalho sem perder contexto.
> Atualizado em 2026-07-22. Sidebar/Configurações, `install.sh`, README e todo
> o backlog de `docs/DESIGN-PARITY-TODO.md` (CSS, toggle IG1/IG2/IG3, riscos
> vinculados, sistema de toast, botão "Limpar tudo") foram **implementados e
> verificados** (35/35 testes backend, tsc limpo, Playwright). Ainda não
> commitado nem mesclado em `main` — ver `git status` neste worktree.
> Depois de rodar "Limpar tudo" durante a verificação, o banco de dev ficou
> **totalmente limpo** (0 riscos, 0/130 avaliadas) — não é mais "2/130", esse
> número antigo em qualquer nota anterior está desatualizado.

## O que é este projeto

"Sentinela CIS" — app interno (NestJS + Prisma + Postgres no backend, React +
Vite no frontend) para avaliação de maturidade CIS Controls v8.1.2 e registro
de riscos, com SSO SAML dinâmico + fallback de login local de emergência.

**Diretório de trabalho:** `C:\Users\LN-SDJIWOE1\projetos\cis-risk_monitor\.claude\worktrees\saml-local-auth`
**Branch:** `worktree-saml-local-auth`
**Repo principal (outro checkout, mesmo repositório):** `C:\Users\LN-SDJIWOE1\projetos\cis-risk_monitor` (branch `main`)

## Estado do branch/merge

- `worktree-saml-local-auth` está **mergeado em `main` e pushado pro origin**
  (GitHub `khafirovisk/cis-risk_monitor`) — `main` e `origin/main` em sincronia
  na última checagem. 35/35 testes backend passam e o frontend compila limpo.
  Fluxo de merge usado toda vez: `cd` pro checkout principal
  (`C:\Users\LN-SDJIWOE1\projetos\cis-risk_monitor`), `git merge
  worktree-saml-local-auth --no-edit`, rodar testes, e o `git push origin
  main` é executado pelo usuário (fica bloqueado pro assistente pelo
  classificador do modo auto).
- Uma stash foi deixada no checkout `main` com um rascunho antigo e
  abandonado do schema SAML (mensagem: "stale pre-worktree draft...") — pode
  ser descartada com segurança quando o usuário quiser (`git stash list` /
  `git stash drop` no checkout de `main`).
- Ledger detalhado de toda a execução (task por task, com todos os
  contratempos e correções): `.superpowers/sdd/progress.md` (dentro deste
  worktree — é scratch, git-ignorado, não existe no `main`). Vale ler se
  precisar entender uma decisão específica em detalhe.

## O que já foi entregue (dois planos completos)

1. **SAML dinâmico + login local** (`docs/superpowers/plans/2026-07-21-saml-local-auth.md`,
   15 tasks) — feito em sessão anterior a esta conversa. SSO configurável via
   tela web (`/admin/saml`, restrita a ADMIN), fallback de conta local
   (`admin`/`admin`, troca de senha obrigatória no 1º login), sessões
   persistidas no Postgres (`connect-pg-simple`, não mais `MemoryStore`).

2. **Paridade com o mockup `sentinela-cis-demo.html`**
   (`docs/superpowers/specs/2026-07-21-demo-parity-dashboard-design.md` +
   `docs/superpowers/plans/2026-07-21-demo-parity-dashboard.md`, 8 tasks,
   feito nesta conversa via subagent-driven-development) —
   - Dashboard rico: KPIs, gauge, espectro de 18 controles, matriz de risco
     inerente/residual, distribuição de maturidade, insights automáticos,
     prioridades risco×maturidade.
   - Auditoria: acordeão por salvaguarda, escala de maturidade em cards de
     rádio, texto oficial (EN) colapsável, **upload real de evidência**
     (multer + disco, endpoint `POST /assessments/:id/items/:sg/evidences`,
     `GET`/`DELETE /evidences/:id`).
   - Riscos: modal completo (`RiskForm.tsx`) substituindo o antigo
     `prompt()` — inerente/residual, controles vinculados, tarefas.
   - Relatório & export: página nova, tabela consolidada, export JSON
     client-side, impressão. Sem importar (decisão deliberada).
   - Revisão final do branch encontrou e corrigiu 1 bug real:
     `computeInsights()` não respeitava o escopo IG da avaliação (contava
     salvaguardas fora de escopo, gerando números inconsistentes com o
     resto do dashboard) — corrigido no commit `5cda3c4`.

Tudo isso está rodando via Docker Compose local: `postgres`, `api`, `web`.

## Em andamento agora (implementado e verificado, falta só commitar)

**Atualização:** as 4 mudanças abaixo (tokens.css, App.tsx, Configuracoes.tsx
novo, AdminSaml.tsx) já foram feitas, `npx tsc` limpo (só o erro conhecido de
`ImportMeta.env`), container `web` rebuildado e testado visualmente via
Playwright — sidebar com seções/ícones/botão de engrenagem, hub
`/configuracoes`, e os checkboxes do formulário SAML corrigidos, tudo
conferido. **Falta apenas revisar e commitar** (`git status` vai mostrar
`frontend/src/styles/tokens.css`, `frontend/src/App.tsx`,
`frontend/src/pages/AdminSaml.tsx` modificados +
`frontend/src/pages/Configuracoes.tsx` novo). Nenhum teste automatizado
backend foi afetado (mudança é só frontend).

**Cuidado ao rodar `docker compose` neste trabalho:** em algum momento desta
sessão um comando rodou por engano a partir do checkout `main` (em vez deste
worktree) e criou um projeto Docker Compose paralelo e quebrado chamado
`cis-risk_monitor` (nome vem do diretório onde o comando roda — Compose usa
o basename do cwd como nome do projeto por padrão). Isso não afetou o app
real (`saml-local-auth-*`), mas exigiu limpeza manual. **Sempre `cd` para o
caminho absoluto deste worktree antes de rodar `docker compose`**, não
confie em "cd relativo" entre chamadas de Bash — o cwd nem sempre persiste
como esperado entre chamadas separadas.

**Cuidado com dados de teste no Postgres:** mais de uma vez nesta sessão,
scripts de verificação (Playwright) interativos criaram risco(s) de teste
e/ou avaliaram salvaguardas de teste e esqueceram de limpar depois. Sempre
que for rodar um teste interativo contra `/riscos` ou `/auditoria`, confirme
o estado antes (`curl http://localhost:8080/api/risks` deve retornar `[]`,
e o resumo da avaliação padrão — id `cmrv3a1l1000013cxstchg3rm` — deve
mostrar `answered: 2, pct: 1` como baseline) e depois (mesmo comando) para
garantir que voltou exatamente ao mesmo estado.

## Histórico (já resolvido, não precisa retomar)

O usuário mandou dois prints de referência e pediu para:

1. **Reestruturar a sidebar** para bater com o mockup: seções agrupadas
   ("Visão geral", "Conformidade & risco", "Saída"), ícones por item
   (Dashboard ◧, Auditoria ▤, Riscos ⚠, Relatório ✎). **Decisão já tomada
   com o usuário:** o badge "DEMO" do mockup NÃO deve ser replicado (é um
   app real, não uma demo) — assumi isso sem perguntar, mas fica registrado
   aqui caso ele reclame.
2. **Botão de "Configurações" na lateral com o SAML dentro.** Pergunta feita
   e respondida pelo usuário: **página hub `/configuracoes`** (não dropdown)
   — um botão de engrenagem no rodapé da sidebar (visível só para ADMIN,
   mesma regra de hoje) leva a uma página nova que lista seções de
   configuração; hoje só tem uma: "Configuração do SSO (SAML)", que linka
   para a tela já existente `/admin/saml` (mantida como está, só deixa de
   ser um item direto do menu principal).
3. **Corrigir o layout quebrado do formulário SAML** — os dois checkboxes
   ("Habilitado" e "Exigir asserções assinadas") aparecem centralizados
   acima do texto em vez de alinhados ao lado, porque `AdminSaml.tsx` reusa
   `className="local-login-form"` cujo CSS (`.local-login-form label{
   display:flex;flex-direction:column}`) foi pensado para inputs de texto
   (label em cima, campo embaixo), não para checkbox+texto lado a lado.

**Plano concreto (já lido os arquivos, ainda não editei nada):**

- `frontend/src/styles/tokens.css`: adicionar `.nav-label` (cabeçalho de
  seção), `.nav .ico`, atualizar `.nav a` para `display:flex;align-items:center;gap:10px`
  (ícone + texto), estilo para o botão de configurações no rodapé da
  sidebar, e uma classe nova `.checkbox-row{display:flex;align-items:center;gap:8px}`
  para os checkboxes do SAML.
- `frontend/src/App.tsx`: reestruturar o `<div className="nav">` com os
  labels de seção + ícones por link; mover o link "Config. SAML" para fora
  do nav principal, substituindo por um botão/link de engrenagem no rodapé
  da sidebar (`role === 'ADMIN'`) apontando para `/configuracoes`; adicionar
  a rota `/configuracoes` (nova) mantendo `/admin/saml` como está.
- **Novo arquivo** `frontend/src/pages/Configuracoes.tsx`: hub simples
  listando opções de configuração (hoje só um item/card linkando para
  `/admin/saml`).
- `frontend/src/pages/AdminSaml.tsx`: trocar os dois `<label>` de checkbox
  para `<label className="checkbox-row">`.

Depois de implementar: `cd frontend && npx tsc` (só deve mostrar o erro
conhecido e pré-existente de `client.ts(1,26)` sobre `ImportMeta.env`),
rebuildar o container `web` (`docker compose build web && docker compose up
-d web`) e conferir visualmente (Playwright ou no navegador).

## Gotchas importantes aprendidos nesta sessão

- **NODE_ENV do `.env` da raiz do worktree está em `development`** (bypass
  de autenticação ativo — qualquer requisição sem sessão vira um admin fake
  `dev@local`). Isso é proposital para facilitar dev local. **Não mude para
  `production` sem avisar o usuário**: o cookie de sessão usa
  `secure: isProd` em `backend/src/main.ts`, e como este ambiente Docker
  roda tudo em HTTP puro (sem TLS), em modo produção o Express se recusa a
  emitir o cookie de sessão — login e troca de senha quebram silenciosamente
  (a tela mostra "senha atual incorreta" mesmo não sendo isso). Se um dia
  precisar testar o fluxo de auth "como produção" localmente, a forma certa
  é desacoplar o `secure` do cookie do `NODE_ENV` via uma env var própria
  (ex.: `COOKIE_SECURE`), não mudar o `NODE_ENV` direto.
- **Sempre que mudar código do backend, rebuilde e reinicie o container
  `api`** (`docker compose build api && docker compose up -d api`) antes de
  testar — ele NÃO recarrega sozinho, e mais de uma vez nesta sessão um
  teste falhou silenciosamente porque o container estava rodando uma imagem
  antiga sem as rotas novas.
- **A conta local `admin` já foi resetada várias vezes nesta sessão** porque
  scripts de verificação automatizados (Playwright) completavam sem querer
  o fluxo obrigatório de troca de senha no primeiro login e não anotavam a
  senha nova. Estado atual conhecido: usuário `admin`, senha `admin`,
  `mustChangePassword: true`. **Se for testar login via script automatizado,
  ou você evita completar a troca de senha, ou anota a senha nova em algum
  lugar** — não deixe isso se perder de novo. Para resetar na unha, veja o
  script SQL usado (arquivo temporário, já apagado, mas o padrão foi: gerar
  hash com `docker exec saml-local-auth-api-1 node -e "console.log(require('bcryptjs').hashSync('admin', 12))"`,
  escrever um `.sql` com `UPDATE "LocalAccount" SET "passwordHash"='<hash>', "mustChangePassword"=true, "failedAttempts"=0, "lockedUntil"=NULL WHERE username='admin';`,
  copiar para o container do postgres com `docker cp` e rodar com
  `psql -f` — **nunca interpole o hash bcrypt (`$2a$12$...`) direto numa
  string de shell entre aspas duplas**, o `$2a`/`$12` são interpretados como
  variáveis posicionais do shell e corrompem o hash. Sempre via arquivo.
- **`npx playwright` funciona neste ambiente** (Chromium já baixado em
  `C:\Users\LN-SDJIWOE1\AppData\Local\ms-playwright`). Para rodar scripts
  Node que fazem `require('playwright')` diretamente (não via CLI), é
  preciso setar `NODE_PATH` apontando pro cache do npx onde o pacote foi
  instalado (procure com
  `find "/c/Users/LN-SDJIWOE1/AppData/Local/npm-cache/_npx" -maxdepth 3 -iname "playwright"`
  — o hash do diretório pode mudar).
- Backend roda testes com `cd backend && npm test` (Jest, 35 testes, todos
  devem passar). Convenção de teste: `new ServiceClass(mockPrisma)` /
  `new Controller(mockService)` com `jest.fn()`, sem bootstrap do NestJS
  TestingModule — ver `backend/src/auth/*.spec.ts` como referência.
- Frontend não tem framework de teste — verificação é `npx tsc` (só deve
  aparecer o erro conhecido de `ImportMeta.env`) + verificação visual via
  Playwright/navegador.
- App acessível em **http://localhost:8080** (nginx do container `web`
  serve o SPA e faz proxy de `/api` pro container `api`).

## Recomendações registradas mas não implementadas (aceitas como trade-off, não são bugs)

- `evCount` (contagem de evidências) duplicado em 3 arquivos
  (`SafeguardAccordion.tsx`, `lib/insights.ts`, `Relatorio.tsx`) — poderia
  virar um helper único em `lib/`.
- Upload de evidência não é transacional (`evidences.service.ts`
  `saveMany`): se o `prisma.evidence.create` falhar no meio de um lote,
  arquivos já escritos em disco ficam órfãos. Aceitável para uma ferramenta
  de baixo volume, mas vale revisar se o uso crescer.
- Dashboard/Riscos/Relatório buscam tudo (`controls`+`assessment`+`risks`)
  e recalculam no client a cada carregamento — decisão deliberada do spec
  (sem endpoint de agregação novo), mas é o primeiro ponto a mover pro
  backend se o volume de dados crescer bastante.
- `GET /evidences/:id` não tem escopo por avaliação/dono — qualquer usuário
  autenticado pode baixar qualquer evidência por id. Consistente com a
  postura atual (só `AuthenticatedGuard`, sem `RolesGuard` extra), mas é uma
  decisão consciente, não um descuido.
- Não existe hoje nenhuma tela de gestão de usuários/acessos dentro do app
  — quem tem acesso e com qual papel (`ADMIN`/`AUDITOR`/`LEITOR`) é definido
  pelo atributo `role` da resposta SAML do IdP. O usuário perguntou sobre
  isso; ficou combinado que por enquanto é só informativo, sem trabalho
  pedido ainda.
