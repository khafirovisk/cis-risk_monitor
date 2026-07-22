# Paridade de design com o mockup — status

Auditoria original feita em 2026-07-22. **Todos os itens abaixo foram
implementados e verificados** (CSS, conteúdo, toggle IG, riscos vinculados,
sistema de toast, botão "Limpar tudo") na mesma data. Ver `CLAUDE.md` para
o estado geral do projeto.

## 1. CSS/estilo puro — feito

- [x] Indicador de item ativo na sidebar (barra verde com glow)
- [x] Sombra no brand-mark
- [x] Rodapé da sidebar sempre visível (texto de versão + link Configurações condicional a ADMIN)
- [x] Colapso responsivo da sidebar (`@media(max-width:840px)`)
- [x] `.ctrl-card` hover/focus-visible
- [x] `.num` (números tabulares) definida
- [x] `:focus-visible` em nav, ctrl-card, sg-head, spec-col, btn, mat-opt, campos de formulário
- [x] `prefers-reduced-motion`
- [x] Fundo com textura grid (o glow radial fica transparente, igual ao mockup — `--glow` nunca é sobrescrito lá também)
- [x] `text-wrap:balance` no page-title
- [x] `.ctrl-name{line-height:1.3}`
- [x] Rótulos do formulário SAML migrados para `.form-full label` (mono/uppercase), igual ao RiskForm
- [x] Ajustes finos de tipografia (brand-sub, nav-label, kpi label/value)

## 2. Conteúdo/copy — feito

- [x] Legenda de faixas do velocímetro (`.gauge-bands`) + `.pct-tag` com a faixa atual
- [x] Score + legenda do espectro de 18 controles
- [x] Cards de controle da Auditoria completos (contagem de salvaguardas + rodapé "X/Y avaliadas" + pill de nível)
- [x] "Maturidade geral" da Auditoria como card (`.aud-mat`)
- [x] Cabeçalho do detalhe do controle completo (título em inglês, %/pill/média, riscos vinculados)
- [x] Subtítulo função/ativo em cada salvaguarda (`FUNC_PT`/`ASSET_PT`)
- [x] Copy do empty-state de Riscos ("registrado" em vez de "cadastrado")
- [x] Botão "Limpar tudo" no Relatório (com confirmação, reseta avaliação + evidências + exclui riscos)
- [x] Sistema de toast (`lib/toast.ts` + `components/Toast.tsx`, montado uma vez em `App.tsx`) — usado em: salvar/excluir risco, validação de título vazio (com foco automático), salvar avaliação de salvaguarda, anexar/remover evidência, exportar JSON, limpar tudo

## 3. Decisões de produto — feito (confirmado com o usuário)

- [x] Toggle de escopo IG1/IG2/IG3 no Dashboard e na Auditoria — implementado como estado local de visualização (`lib/maturity.ts`: `igField`/`ctrlStats`/`assessmentStats`, compartilhado pelas duas páginas), não altera o que já foi respondido, só o que entra no cálculo/visão atual. `AssessmentsService.summary()` no backend não é mais usado por essas duas páginas (ficou sem chamadores, mas não foi removido — YAGNI, pode servir para outra coisa depois).
- [x] "Riscos vinculados" no detalhe do controle — Auditoria agora busca riscos e cruza pelo número do controle aberto.
- [x] Botão "Limpar tudo" — implementado com o mesmo cuidado do restante (confirmação explícita antes de apagar).
- [x] Copy de insights simplificada para citar só avaliação e riscos (módulos inexistentes já não eram mencionados desde o texto atual).

## Verificação feita

- `cd backend && npm test` → 35/35 passando
- `cd frontend && npx tsc` → só o erro conhecido e pré-existente (`ImportMeta.env`)
- Rebuild do container `web` + Playwright: sidebar, Dashboard, Auditoria (grid e detalhe), Riscos, Relatório conferidos visualmente
- Fluxo interativo: toggle IG mudando a contagem de salvaguardas em tela (IG1: 2 salvaguardas no controle 01 vs IG2: 4), risco vinculado aparecendo no detalhe do controle, toasts disparando em salvar risco/salvaguarda/validação, "Limpar tudo" testado de ponta a ponta (confirmado via API: 0 riscos, 0/130 avaliadas, 0 evidências após rodar)
- Nenhum erro de console/rede nas páginas testadas
