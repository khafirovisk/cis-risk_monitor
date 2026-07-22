# Paridade de design com o mockup — pendências

Auditoria feita em 2026-07-22 comparando `docs/prototipo-demo.html` (mesmo
conteúdo do arquivo em `C:\Users\LN-SDJIWOE1\Downloads\sentinela-cis-demo.html`)
com o app real rodando em `http://localhost:8080`. Ainda **nada abaixo foi
implementado** — isto é só o backlog priorizado. Ver `CLAUDE.md` para
contexto geral do projeto.

## 1. CSS/estilo puro (baixo risco, mexe só em `tokens.css` na maioria)

- [ ] **Indicador de item ativo na sidebar.** Mockup: `.nav button.active::before{content:"";position:absolute;left:-12px;top:7px;bottom:7px;width:3px;border-radius:0 3px 3px 0;background:var(--accent);box-shadow:0 0 10px var(--accent)}` — barrinha verde com glow à esquerda do item ativo. Real (`tokens.css` linha ~26, `.nav a.active`) só muda background/cor/peso, sem a barra.
- [ ] **Sombra no brand-mark.** Mockup: `.brand-mark{...box-shadow:0 4px 14px rgba(0,0,0,.28),inset 0 0 0 1px rgba(255,255,255,.10)}`. Real (`tokens.css` linha ~22) não tem `box-shadow`.
- [ ] **Rodapé da sidebar sumiu para não-ADMIN.** Mockup sempre mostra `<div class="sidebar-foot">CIS Controls v8.1.2 (mar/2025).<br>Dados salvos neste navegador.</div>`. Real (`App.tsx` linhas ~49-55) só renderiza `.sidebar-foot` quando `role === 'ADMIN'`, e mesmo assim só tem o link de Configurações — texto de versão sumiu de vez. Ajustar: sempre mostrar um rodapé com o texto de versão (adaptar copy, já que "dados salvos no navegador" não se aplica mais); o link de Configurações continua condicional a ADMIN dentro desse rodapé.
- [ ] **Sem colapso responsivo da sidebar.** Mockup tem `@media(max-width:840px)` transformando a sidebar em barra horizontal. Real não tem nenhum breakpoint pra sidebar.
- [ ] **`.ctrl-card` sem hover/focus.** Mockup: `:hover{border-color:var(--accent)}` e `:focus-visible{outline:2px solid var(--accent);outline-offset:2px}`. Real (`tokens.css` linha ~46) não tem nenhum dos dois.
- [ ] **`.num` nunca foi definida.** Usada em 9 lugares (`Dashboard.tsx` linhas 125/232/249, `Riscos.tsx` 62/63/71, `Relatorio.tsx` 76/80, `SafeguardAccordion.tsx` 59) esperando `.num{font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1}` (mockup linha 48) — a classe é um no-op hoje, números não alinham em colunas.
- [ ] **Sem `:focus-visible` em lugar nenhum.** Mockup define anéis de foco verdes em nav, `.ctrl-card`, `.sg-head`, `.spec-col`, `.btn`, `.mat-opt input`, campos de formulário. Grep em `frontend/src` por `focus-visible` não retorna nada.
- [ ] **`prefers-reduced-motion` ausente.** Mockup: `@media(prefers-reduced-motion:reduce){.sg-caret,.toast,.bar-fill,.progress i{transition:none}}` (linha 336).
- [ ] **Fundo sem textura grid+glow.** Mockup: `body` com `background-image` de grid 36×36px + `body::before` com glow radial (linhas 42-45). Real `body` é `background:var(--bg)` liso.
- [ ] **`text-wrap:balance` no page-title** (mockup linha 73) ausente no real (`tokens.css` linha ~38).
- [ ] **`.ctrl-name` sem `line-height:1.3`** (mockup linha 119) — herda 1.55 do body, títulos de 2 linhas ficam com espaçamento maior que o mockup.
- [ ] **Rótulos do formulário SAML usam estilo errado.** `AdminSaml.tsx` usa `<label>` cru estilizado por `.local-login-form label` (sans, sentence-case) em vez do padrão `.form-field label`/`.form-full label` (mono, uppercase, letter-spaced) que `RiskForm.tsx` já usa corretamente.
- [ ] Pequenos desvios de tipografia (letter-spacing/font-size) — `.brand-sub`, `.nav-label`, `.kpi .label`, `.kpi .value` (peso 700 real vs 600 no mockup). Baixo impacto visual, listar mas não priorizar sozinho.

## 2. Conteúdo/copy faltando (mexe em JSX, não só CSS)

- [ ] **Legenda de faixas do velocímetro.** Mockup mostra uma lista `.gauge-bands` (5 faixas com cor+label+intervalo) ao lado do SVG, mais um `.pct-tag` com o nome da faixa atual. `Dashboard.tsx` (linhas 136-142) só renderiza o parágrafo `.lead`. `GAUGE_BANDS` já existe em `frontend/src/lib/maturity.ts` — é só faltar renderizar.
- [ ] **Score + legenda do espectro de 18 controles.** Mockup: `.spectrum-score` ("média geral X% · Y/5 · N/18 controles") + `.spectrum-legend` (5 níveis com cor). `Dashboard.tsx` (linhas 145-154) não renderiza nenhum dos dois.
- [ ] **Cards de controle da Auditoria incompletos.** Mockup tem 5 elementos por card: número, nome, **contagem de salvaguardas no escopo**, %+progresso, **rodapé com "X/Y avaliadas" + pill de nível**. Real (`Auditoria.tsx` linhas 49-56) só tem 3 (falta os dois em negrito).
- [ ] **"Maturidade geral" da Auditoria virou texto solto.** Mockup é um card (`.card.card-pad.aud-mat`) com número grande mono cor-de-destaque. Real (`Auditoria.tsx` linhas 38-41) é uma frase em `<p className="page-sub">`, sem card, sem destaque.
- [ ] **Cabeçalho do detalhe do controle incompleto.** Mockup mostra: linha com título em inglês acima do H1, e no canto direito um bloco com %/pill/"X/Y avaliadas · média Z/5", mais uma linha "**Riscos vinculados:**" se algum risco referenciar o controle. Real (`Auditoria.tsx` linhas 61-64) só tem o H1 + descrição — nada disso.
- [ ] **Subtítulo da salvaguarda (função/ativo).** Mockup: `<small>{Função} · {Ativo}</small>` sob o título de cada salvaguarda. O dado já existe no schema (`Safeguard.assetClass`/`securityFunction`), só não é lido/exibido em `SafeguardAccordion.tsx` (linha 60).
- [ ] **Copy do empty-state de Riscos** — mockup diz "registrado", real diz "cadastrado" (`Riscos.tsx` linha 46). Cosmético, trivial.
- [ ] **Botão "Limpar tudo" sumiu do Relatório** junto com o "Importar" — só o Importar tinha sido decidido explicitamente como fora de escopo (risco de apagar dados reais). Confirmar se "Limpar tudo" deve voltar (com o mesmo cuidado) ou ficar fora também.
- [ ] **Sistema de toast/notificação inteiro ausente.** Mockup usa toast pra quase toda ação (salvar salvaguarda, salvar/excluir risco, anexar evidência, exportar JSON, validação de formulário — ex.: "Informe o título do risco" com foco automático no campo). Grep em `frontend/src` por `toast`/`Toast` não retorna nada. Efeito prático: `RiskForm.tsx` `save()` (linha ~50) simplesmente não faz nada se o título estiver vazio, sem avisar o usuário; salvar/excluir risco e exportar JSON não dão nenhuma confirmação visual. Esta é a maior lacuna de UX real da lista — vale um componente `Toast` compartilhado (`frontend/src/components/Toast.tsx` + um hook/contexto simples) usado nos pontos citados.

## 3. Decisão de produto (não é só estilo)

- [ ] **Toggle de escopo IG1/IG2/IG3** no Dashboard e na Auditoria — mockup deixa trocar o escopo em tempo real; hoje o escopo é fixo por avaliação, definido na criação (no banco). Decisão já adiada uma vez (YAGNI) — só re-flagando porque a auditoria pediu pra listar tudo.
- [ ] **"Riscos vinculados" no detalhe do controle** — feature de verdade (não só CSS): precisa a Auditoria buscar riscos e cruzar com `RiskControl` pelo número do controle atual.
- [ ] **Texto de insights menciona módulos inexistentes** ("exceções, políticas, controles internos, parceiros e incidentes") — nem o mockup nem o schema real implementam essas 5 coisas; parece copy aspiracional. Sugestão: cortar a menção pra bater com o que existe de verdade (avaliação + riscos).

## Como retomar

Nenhuma dessas mudanças foi commitada — este arquivo é só o backlog. Ao
retomar, dá pra tratar como um plano informal: seção 1 é segura de fazer
direto (mexe só em CSS), seção 2 precisa tocar componentes React mas sem
ambiguidade de design, seção 3 precisa confirmar com o usuário antes de
implementar (são decisões de produto, não só "copiar o mockup").
