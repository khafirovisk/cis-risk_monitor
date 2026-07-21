# Paridade com o mockup `sentinela-cis-demo.html`

Data: 2026-07-21
Status: aprovado, aguardando plano de implementação

## Contexto

`C:\Users\LN-SDJIWOE1\Downloads\sentinela-cis-demo.html` é um protótipo estático
(HTML+CSS+JS, dados em `localStorage`) que mostra a visão completa do produto:
Dashboard rico, Auditoria com acordeão, Riscos com modal completo e uma página
de Relatório/export. O app real (NestJS + Postgres + React) hoje só tem uma
fração disso: Dashboard simples (gauge + barras), Auditoria sem acordeão nem
evidência, Riscos com `prompt()` no lugar de formulário, sem página de
Relatório.

O objetivo deste spec é levar o app real à paridade de funcionalidade e visual
com o mockup, usando os dados reais do Postgres em vez de `localStorage`.

## Não-objetivos

- **Importar JSON em massa**: o mockup permite substituir toda a avaliação e
  todos os riscos de uma vez (aceitável em uma demo local, arriscado em um
  banco real multiusuário). Fica de fora desta rodada — só exportar.
- **Agregação no backend**: KPIs, matriz de risco, espectro e insights são
  calculados no client a partir dos endpoints existentes, não em um endpoint
  novo de agregação. Com 153 salvaguardas e poucos riscos isso é suficiente;
  pode migrar para o backend depois se o volume justificar.
- **Selo "DEMO"** e qualquer coisa específica de protótipo local (localStorage,
  badge, texto "dados salvos neste navegador") não são portados.

## Decisões de arquitetura

1. **Cálculo client-side.** `Dashboard.tsx` passa a buscar `api.risks()` e o
   assessment completo com items (hoje só busca `summary()`), e computa KPIs,
   matriz de risco, distribuição, insights e cruzamento localmente — mesmo
   padrão que `Riscos.tsx` já usa para severidade.
2. **Upload real de evidência.** O schema já tem `Evidence` com `storageKey`
   pronto para armazenamento em disco; falta só o endpoint. Implementa-se
   upload de verdade (multer + volume `/app/uploads`, já provisionado no
   `docker-compose.yml`), não um placeholder que só guarda o nome do arquivo
   como no mockup.
3. **Riscos usa os campos que já existem.** `RisksService.create/update` já
   aceita `controlNumbers` e `tasks`; só falta o frontend expor isso em vez do
   `prompt()` atual.

## Sistema visual

`frontend/src/styles/tokens.css` já usa as mesmas variáveis de cor/fonte do
mockup (verde/amarelo Leo, mono para chrome). Não há redesign de base — só
acréscimo das classes de componentes novos conforme cada item abaixo é
implementado (`.kpi`, `.spectrum*`, `.matrix`/`.mx-*`, `.sg*` do acordeão,
`.mat-scale`, `.modal`/`.overlay`, `.task-row`, `.xrow`/`.xchip`,
`.file-chip`/`.file-row`, `.pill` com variantes `-soft` por severidade).

## 1. Dashboard (`frontend/src/pages/Dashboard.tsx`)

- Busca `api.risks()` e o assessment completo (`api.assessment(id)`) além do
  `summary()` já usado.
- **KPI row** (4 cards, mono): Maturidade CIS (`pct`/`avg`), Salvaguardas
  avaliadas (`answered/total`), Riscos ativos (status ABERTO/EM_TRATAMENTO),
  Tarefas em aberto (com contagem de atrasadas via `dueDate < hoje`).
- **Gauge**: reaproveita `components/Gauge.tsx` (já existe, já bate com o
  mockup).
- **`components/Spectrum.tsx`** (novo): 18 barras (uma por controle), altura
  proporcional à maturidade média; clique abre o controle em `/auditoria`.
- **Matriz de risco 5×5**: toggle Inerente/Residual, célula = contagem de
  riscos ativos por (probabilidade, impacto); cor por severidade
  (`crit/high/med/low`, mesmos limiares do mockup: `s=p*i`, `≥17` crítico,
  `≥10` alto, `≥5` médio, resto baixo).
- **Distribuição da avaliação**: barra segmentada (não avaliado / níveis 0–1 /
  2 / 3 / 4–5 / N/A).
- **Insights automáticos** — 5 regras portadas do mockup, cada uma navegando
  para a view relevante ao clicar:
  1. salvaguardas com maturidade ≥3 sem nenhuma evidência (texto ou arquivo);
  2. salvaguardas avaliadas há mais de 12 meses (`AssessmentItem.updatedAt`);
  3. riscos ativos com severidade ≥10 sem nenhuma tarefa;
  4. riscos ativos sem nenhum controle CIS vinculado;
  5. tarefas com `dueDate` vencido e não concluídas.
- **Cruzamento riscos × maturidade**: riscos ativos ordenados por severidade
  residual, mostrando a maturidade média dos controles vinculados e uma
  flag "Prioridade" quando severidade ≥10 e maturidade média <3 (ou nula).

## 2. Auditoria — detalhe do controle (`frontend/src/pages/Auditoria.tsx`)

- Acordeão por salvaguarda (hoje todas ficam expandidas simultaneamente).
- Escala de maturidade como cards de rádio (0–5 + N/A, com descrição curta de
  cada nível), substituindo o `<select>` atual.
- Bloco colapsável (`<details>`) "Texto oficial (EN)" usando `titleEn` /
  `descriptionEn` do `Safeguard` (já existem no schema, não usados hoje).
- Campo de evidência em texto (`evidenceText`, o endpoint `PUT
  /assessments/:id/items/:safeguardId` já aceita) — hoje o formulário nem
  mostra esse campo.
- **Upload de evidência real**: anexar (múltiplos arquivos), listar com nome
  e tamanho, baixar, remover.

## 3. Riscos (`frontend/src/pages/Riscos.tsx`)

Substitui o `prompt()` por um modal (`components/RiskForm.tsx`, novo) com:
título, descrição, probabilidade/impacto inerente e residual (selects 1–5),
responsável, status (`ABERTO`/`EM_TRATAMENTO`/`MITIGADO`/`ACEITO`, com rótulo
em PT), checklist dos 18 controles CIS vinculados, e lista de tarefas
(descrição, responsável, prazo, concluída) com adicionar/remover linha.
Botão "Excluir risco" quando editando. Todos os campos já são aceitos por
`RisksService.create/update` — é só o frontend passar a enviá-los.

## 4. Relatório & export (nova página)

- Rota `/relatorio` + item de menu em `App.tsx` (visível pra todos os papéis,
  igual às outras abas).
- `frontend/src/pages/Relatorio.tsx` (novo): tabela consolidada por
  salvaguarda no escopo atual (nível, evidências — texto + contagem de
  arquivos, atualizado em).
- Botão **Exportar JSON** (avaliação + riscos, montado no client a partir dos
  dados já carregados) e **Imprimir** (`window.print()`, com regras de print
  no CSS escondendo sidebar/botões, como no mockup).
- Sem importar (decidido nas perguntas de escopo).

## 5. Backend — upload de evidências (novo)

Novo módulo `backend/src/evidences/` (ou controller dentro de
`assessments/`, a decidir no plano):

- `POST /assessments/:id/items/:safeguardId/evidences` — multipart
  (`FilesInterceptor`), `multer.diskStorage` gravando em `/app/uploads`
  (volume já existe no `docker-compose.yml`), nome de arquivo
  `${uuid}-${originalname}`, limite de 10MB por arquivo. Cria uma linha
  `Evidence` por arquivo (`filename`, `storageKey`, `mime`, `size`,
  `uploadedBy`). Cria o `AssessmentItem` se ainda não existir (mesmo upsert
  do `setItem`).
- `GET /evidences/:id` — autenticado, faz stream do arquivo do disco com
  `Content-Disposition` usando o `filename` original.
- `DELETE /evidences/:id` — remove a linha e apaga o arquivo do disco.
- Adiciona `multer` e `@types/multer` como dependências explícitas do
  backend (hoje só vêm transitivos via `@nestjs/platform-express`).

## Testes

- **Backend**: specs Jest para os três endpoints novos (upload aceita
  arquivo e cria `Evidence`; download retorna o conteúdo certo; delete remove
  linha e arquivo), seguindo o padrão dos `*.spec.ts` já existentes em
  `backend/src/auth/`.
- **Frontend**: sem framework de teste configurado no projeto. Verificação
  segue manual, via Playwright/screenshots no app rodando em Docker (mesmo
  processo já usado nesta sessão), cobrindo o caminho principal de cada tela
  nova/alterada.

## Riscos e limitações conhecidas

- Upload de evidência grava no volume Docker `uploads`; não há hoje
  antivírus/scan de conteúdo nem verificação de tipo MIME além do limite de
  tamanho — aceitável para uso interno, mas vale registrar como limitação.
- Cálculo client-side do Dashboard busca todos os items/risks a cada
  carregamento da página; com o volume atual (153 salvaguardas, dezenas de
  riscos) isso é desprezível, mas não escala indefinidamente.
