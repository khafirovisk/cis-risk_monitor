# Paridade com o mockup sentinela-cis-demo.html — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levar Dashboard, Auditoria, Riscos e uma página nova de Relatório do app real (NestJS + Postgres + React) à paridade de funcionalidade e visual com o protótipo estático `sentinela-cis-demo.html`, usando os dados reais do Postgres em vez de `localStorage`.

**Architecture:** Agregações do Dashboard (KPIs, matriz de risco, espectro, insights, cruzamento) são calculadas no client a partir dos endpoints já existentes (`GET /controls`, `GET /assessments/:id`, `GET /risks`) — sem endpoint novo de agregação. Upload de evidência é real (multer + disco, não decorativo). Riscos passam a usar um modal completo em vez de `prompt()`, preenchendo campos que o backend já aceita (`controlNumbers`, `tasks`).

**Tech Stack:** NestJS 10 + Prisma 5 + Postgres (backend), React 18 + Vite + react-router-dom (frontend), Jest (testes backend), Playwright CLI (verificação visual manual, sem framework de teste no frontend).

## Global Constraints

- Sem "Importar JSON" em massa — só exportar (decidido no spec).
- Sem endpoint novo de agregação no backend — cálculo client-side (decidido no spec).
- Upload de evidência é real: multer + disco (`/app/uploads`, volume já existe no `docker-compose.yml`), limite de 10MB por arquivo (decidido no spec e nesta sessão).
- Sem selo "DEMO", sem `localStorage` — tudo via API real.
- Repositório: `C:\Users\LN-SDJIWOE1\projetos\cis-risk_monitor\.claude\worktrees\saml-local-auth` (branch `worktree-saml-local-auth`). Todos os caminhos de arquivo abaixo são relativos a essa raiz, a menos que indicado de outra forma.
- Convenção de tipagem do frontend: o código existente usa `any` liberalmente nas respostas de API (ex.: `useState<any>(null)`); siga o mesmo padrão nos arquivos novos, não introduza tipos estritos novos sem necessidade.
- Verificação do frontend (sem framework de teste): `cd frontend && npx tsc` (usa o `tsconfig.json` existente, `noEmit: true`) para pegar erros de tipo, e Playwright CLI (`npx playwright screenshot ...`) contra o app rodando em Docker para confirmar visualmente, como já vem sendo feito nesta sessão.

---

### Task 1: Sistema visual — classes CSS novas em `tokens.css`

**Files:**
- Modify: `frontend/src/styles/tokens.css`

**Interfaces:**
- Produces: todas as classes CSS consumidas pelas Tasks 4–7 (`.kpi`, `.gauge-*`, `.spectrum*`, `.spec-*`, `.matrix`, `.mx-*`, `.seg-track`/`.seg`, `.legend`, `.bar-row`/`.bar-label`/`.bar-track`/`.bar-fill`/`.bar-val`, `.pill` + variantes `.p-crit/.p-high/.p-med/.p-low/.p-info/.p-neutral` + `.dot`, `.tag`/`.tag.ig`, `.xrow`/`.xt`/`.xchips`/`.xchip`/`.prio-flag`, `.overdue`, `.td-muted`, `.sg*` (acordeão), `.q-label`/`.question`/`.examples`/`.evd-hint`, `details.official`, `.mat-scale`/`.mat-opt`, `textarea.evd`/`.file-row`/`.file-btn`/`.file-chip`/`.sg-save-row`/`.saved-note`, `.back-btn`, `.overlay`/`.modal*`/`.form-*`/`.ctrl-check*`/`.task-row`/`.task-done`/`.modal-actions`/`.rm`, `.ig-opts`/`.ig-opt`, `.btn.ghost`/`.btn.danger`/`.btn.sm`, `.card-pad`/`.card-sub`/`.card-eyebrow`/`.two-col`, variáveis `--crit-soft/--high-soft/--med-soft/--low-soft/--info-soft`).

- [ ] **Step 1: Acrescentar as variáveis "soft" de severidade ao `:root`**

Em `frontend/src/styles/tokens.css`, no bloco `:root{...}`, logo após a linha `--crit:#C22B2B; --high:#C2660F; --med:#927010; --low:#1E8A57; --info:#2E6AAF;`, adicionar:

```css
  --crit-soft:#FBE8E8; --high-soft:#FAEDDF; --med-soft:#F5EFD6; --low-soft:#E2F1E9; --info-soft:#E5EEF8;
```

(`--border-2` já existe no arquivo — não duplicar.)

- [ ] **Step 2: Acrescentar o restante das classes ao final do arquivo**

Anexar ao final de `frontend/src/styles/tokens.css`:

```css

/* ===== paridade com o mockup: componentes novos ===== */
.card-pad{padding:16px 18px}
.card-sub{font-size:12px;color:var(--ink-3);margin:0 0 12px}
.card-eyebrow{display:block;font-size:9.5px;letter-spacing:.17em;text-transform:uppercase;color:var(--accent);margin-bottom:6px}
.two-col{grid-template-columns:1fr 1fr}
@media(max-width:1050px){.two-col{grid-template-columns:1fr}}
.page-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px;flex-wrap:wrap}

.kpi{position:relative;overflow:hidden;padding:15px 16px 14px}
.kpi::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--accent),transparent 82%)}
.kpi .sub{font-size:11.5px;color:var(--ink-3);margin-top:2px}

.gauge-card{padding:18px 20px}
.gauge-wrap{display:flex;align-items:center;gap:28px;flex-wrap:wrap;justify-content:center;margin-top:8px}
.gauge-info{flex:1;min-width:200px}
.gauge-info .lead{font-family:var(--font-mono);font-size:13px;color:var(--ink-2);margin-bottom:10px}
.gauge-info .lead b{color:var(--ink);font-size:15px}

.spectrum-card{padding:18px 20px 16px}
.spectrum-top{display:flex;justify-content:space-between;align-items:baseline;gap:14px;flex-wrap:wrap}
.spectrum{display:grid;grid-template-columns:repeat(18,1fr);gap:5px;align-items:end;height:150px;margin-top:16px;
  background:repeating-linear-gradient(to top,transparent 0,transparent calc(20% - 1px),var(--border) calc(20% - 1px),var(--border) 20%)}
.spec-col{display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%;gap:7px;background:none;border:none;cursor:pointer;padding:0;font-family:inherit}
.spec-track{width:100%;height:100%;display:flex;align-items:flex-end;border-radius:4px;background:var(--surface-2)}
.spec-bar{width:100%;border-radius:4px 4px 2px 2px;min-height:3px;transition:filter .12s}
.spec-lbl{font-size:10px;color:var(--ink-3);font-weight:600;font-family:var(--font-mono)}
.spec-col:hover .spec-lbl{color:var(--ink)}
.spec-col:hover .spec-bar{filter:brightness(1.18) saturate(1.08)}
@media(max-width:720px){ .spectrum{gap:3px;height:120px} .spec-lbl{font-size:8px} }

.matrix{display:grid;grid-template-columns:auto repeat(5,1fr);gap:4px;max-width:460px;margin:18px auto 0}
.mx-cell{height:48px;min-width:0;border-radius:5px;display:grid;place-items:center;font-weight:700;font-size:14px;font-family:var(--font-mono)}
.mx-cell.empty{opacity:.35;font-weight:400}
.mx-axis{display:grid;place-items:center;font-size:10px;color:var(--ink-3);text-transform:uppercase;letter-spacing:.1em;font-family:var(--font-mono)}
.mx-y{writing-mode:vertical-rl;transform:rotate(180deg)}
.matrix + .legend{justify-content:center}

.legend{display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;font-size:11.5px;color:var(--ink-2)}
.legend span{display:inline-flex;align-items:center;gap:6px}
.legend i{width:9px;height:9px;border-radius:2px;display:inline-block}
.seg-track{display:flex;height:12px;border-radius:6px;overflow:hidden;gap:2px}
.seg{height:100%}

.bar-row{display:grid;grid-template-columns:230px 1fr 84px;align-items:center;gap:10px;padding:5px 0;border:none;background:none;width:100%;font-family:inherit;font-size:inherit;color:inherit;text-align:left;cursor:pointer;border-radius:6px}
.bar-row:hover{background:var(--surface-2)}
.bar-label{font-size:12.5px;color:var(--ink-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar-track{height:8px;background:var(--surface-2);border-radius:4px;overflow:hidden}
.bar-fill{height:100%;border-radius:4px;background:var(--accent)}
.bar-val{font-size:12px;font-weight:600;text-align:right;color:var(--ink-2);font-family:var(--font-mono)}

.pill .dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.p-crit{background:var(--crit-soft);color:var(--crit)} .p-crit .dot{background:var(--crit)}
.p-high{background:var(--high-soft);color:var(--high)} .p-high .dot{background:var(--high)}
.p-med{background:var(--med-soft);color:var(--med)}    .p-med .dot{background:var(--med)}
.p-low{background:var(--low-soft);color:var(--low)}    .p-low .dot{background:var(--low)}
.p-info{background:var(--info-soft);color:var(--info)} .p-info .dot{background:var(--info)}
.p-neutral{background:var(--surface-2);color:var(--ink-2)} .p-neutral .dot{background:var(--ink-3)}
.tag{display:inline-block;font-size:10.5px;font-weight:600;padding:1px 7px;border-radius:5px;border:1px solid var(--border-2);color:var(--ink-2);white-space:nowrap;text-transform:uppercase;letter-spacing:.04em}
.tag.ig{background:var(--accent-soft);color:var(--accent);border-color:transparent}
.td-muted{color:var(--ink-3);font-size:12px}
.overdue{color:var(--crit);font-weight:600}

.xrow{display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--border)}
.xrow:last-child{border-bottom:none}
.xrow .xt{flex:1;min-width:0}
.xrow .xt b{font-size:13px}
.xchips{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}
.xchip{font-size:10.5px;font-weight:600;padding:1px 7px;border-radius:4px;border:1px solid transparent;font-family:var(--font-mono)}
.prio-flag{font-size:11px;font-weight:700;color:var(--crit);background:var(--crit-soft);border:1px solid var(--crit);border-radius:4px;padding:1px 7px;white-space:nowrap}

.back-btn{background:none;border:none;color:var(--accent);font-size:13px;font-weight:600;cursor:pointer;padding:0;font-family:inherit;margin-bottom:10px}
.back-btn:hover{text-decoration:underline}

.sg{border:1px solid var(--border);border-radius:var(--radius);background:var(--surface);box-shadow:var(--shadow);margin-bottom:12px;overflow:hidden}
.sg-head{display:flex;align-items:center;gap:12px;width:100%;padding:13px 16px;background:none;border:none;cursor:pointer;font-family:inherit;font-size:inherit;color:inherit;text-align:left}
.sg-head:hover{background:var(--surface-2)}
.sg-id{font-weight:700;color:var(--accent);font-size:13px;min-width:34px;font-family:var(--font-mono)}
.sg-title{flex:1;font-weight:600;font-size:13.5px;min-width:0}
.sg-badges{display:flex;gap:5px;align-items:center;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end}
.sg-caret{color:var(--ink-3);flex-shrink:0;transition:transform .15s}
.sg.open .sg-caret{transform:rotate(90deg)}
.sg-body{padding:16px 18px 18px;border-top:1px solid var(--border)}

.q-label{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-3);font-weight:700;margin:14px 0 6px}
.q-label:first-child{margin-top:0}
.question{font-size:14px;font-weight:600;line-height:1.55;background:var(--accent-soft);border-left:3px solid var(--accent);padding:10px 14px;border-radius:0 8px 8px 0}
.examples{margin:0;padding-left:20px;color:var(--ink-2)}
.examples li{margin-bottom:5px}
.evd-hint{font-size:12.5px;color:var(--ink-2);background:var(--surface-2);border-radius:8px;padding:8px 12px}
details.official{margin-top:10px}
details.official summary{font-size:12px;color:var(--ink-3);cursor:pointer}
details.official p{font-size:12.5px;color:var(--ink-2);margin:6px 0 0}

.mat-scale{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
.mat-opt{position:relative}
.mat-opt input{position:absolute;opacity:0;pointer-events:none}
.mat-opt label{display:block;border:1px solid var(--border-2);border-radius:8px;padding:8px 10px;cursor:pointer;font-size:12px;color:var(--ink-2);height:100%}
.mat-opt label b{display:block;font-size:12.5px;color:var(--ink);margin-bottom:1px}
.mat-opt label:hover{border-color:var(--accent)}
.mat-opt input:checked + label{border-color:var(--accent);background:var(--accent-soft)}
.mat-opt input:checked + label b{color:var(--accent)}

textarea.evd, input.fld, select.fld, textarea.fld{width:100%;border:1px solid var(--border-2);border-radius:8px;background:var(--surface);color:var(--ink);font-family:inherit;font-size:13px;padding:9px 12px}
textarea.evd{min-height:74px;resize:vertical}
textarea.fld{min-height:60px;resize:vertical}
.file-row{display:flex;align-items:center;gap:10px;margin-top:8px;flex-wrap:wrap}
.file-btn{background:var(--surface-2);border:1px dashed var(--border-2);border-radius:8px;padding:7px 14px;font-size:12.5px;color:var(--ink-2);cursor:pointer;font-family:inherit;display:inline-block}
.file-btn:hover{border-color:var(--accent);color:var(--accent)}
.file-chip{display:inline-flex;align-items:center;gap:6px;background:var(--surface-2);border:1px solid var(--border);border-radius:6px;padding:3px 8px;font-size:11.5px;color:var(--ink-2)}
.file-chip a{color:inherit;text-decoration:none}
.file-chip button{background:none;border:none;color:var(--ink-3);cursor:pointer;padding:0;font-size:12px;font-family:inherit}
.file-chip button:hover{color:var(--crit)}
.sg-save-row{display:flex;align-items:center;gap:12px;margin-top:14px}
.saved-note{font-size:12px;color:var(--low)}

.ig-opts{display:flex;gap:6px}
.ig-opt{background:var(--surface);border:1px solid var(--border-2);border-radius:7px;padding:5px 13px;font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-2);cursor:pointer;font-family:var(--font-mono)}
.ig-opt.active{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}

.btn.ghost{background:var(--surface);color:var(--ink-2);border:1px solid var(--border-2)}
.btn.danger{background:var(--crit-soft);color:var(--crit);border:1px solid var(--crit)}
.btn.sm{padding:5px 11px;font-size:12px}

.overlay{position:fixed;inset:0;background:rgba(10,16,22,.5);display:none;align-items:flex-start;justify-content:center;padding:4vh 16px;z-index:50}
.overlay.open{display:flex}
.modal{background:var(--surface);border:1px solid var(--border);border-radius:12px;max-width:760px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:var(--shadow)}
.modal-head{display:flex;justify-content:space-between;gap:12px;padding:18px 20px 0;align-items:flex-start}
.modal-close{background:var(--surface-2);border:1px solid var(--border);border-radius:6px;width:28px;height:28px;cursor:pointer;color:var(--ink-2);font-size:14px;flex-shrink:0;font-family:inherit}
.modal-close:hover{color:var(--ink)}
.modal-body{padding:12px 20px 20px}
.form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px 12px;align-items:end}
.form-field{display:flex;flex-direction:column;justify-content:flex-end}
.form-field label,.form-full label{display:block;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-3);font-weight:700;margin-bottom:5px;line-height:1.35}
.form-full{margin-top:12px}
.ctrl-check-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:4px;max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:8px}
.ctrl-check{display:flex;align-items:flex-start;gap:7px;font-size:12.5px;color:var(--ink-2);padding:3px 4px;border-radius:5px;cursor:pointer;line-height:1.3}
.ctrl-check:hover{background:var(--surface-2)}
.ctrl-check input{accent-color:var(--accent);margin-top:2px}
.task-row{display:grid;grid-template-columns:24px 1fr 150px 130px 28px;gap:8px;align-items:center;margin-bottom:6px}
.task-row input[type=checkbox]{accent-color:var(--accent);width:16px;height:16px}
.task-row .rm{background:none;border:none;color:var(--ink-3);cursor:pointer;font-size:14px;font-family:inherit}
.task-row .rm:hover{color:var(--crit)}
.task-done input.fld{text-decoration:line-through;color:var(--ink-3)}
.modal-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:18px;flex-wrap:wrap}
@media(max-width:840px){ .task-row{grid-template-columns:24px 1fr 28px;grid-auto-rows:auto} .task-row input[type=date],.task-row input.fld:nth-child(3){grid-column:2} }

@media print{
  .sidebar,.btn,.back-btn{display:none}
  .main{padding:0}
  .card,.sg{box-shadow:none;break-inside:avoid}
}
```

- [ ] **Step 3: Verificar que o build do frontend continua passando**

Run: `cd frontend && npx tsc`
Expected: sem saída (sem erros) — mudança é só CSS, não deveria afetar TypeScript.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/styles/tokens.css
git commit -m "style: adiciona classes CSS do mockup (kpi, gauge, espectro, matriz, acordeao, modal)"
```

---

### Task 2: Backend — upload real de evidência (multer + disco)

**Files:**
- Modify: `backend/package.json` (adiciona `multer` em `dependencies` e `@types/multer` em `devDependencies`)
- Modify: `.gitignore` (raiz do repo) — adiciona `backend/uploads/`
- Create: `backend/src/evidences/evidences.service.ts`
- Create: `backend/src/evidences/evidences.service.spec.ts`
- Create: `backend/src/evidences/evidences.controller.ts`
- Create: `backend/src/evidences/evidences.controller.spec.ts`
- Create: `backend/src/evidences/evidences.module.ts`
- Modify: `backend/src/assessments/assessments.service.ts` (novo método `ensureItem`)
- Modify: `backend/src/assessments/assessments.controller.ts` (novo endpoint de upload)
- Modify: `backend/src/assessments/assessments.controller.spec.ts` (novo arquivo — controller não tinha spec)
- Modify: `backend/src/assessments/assessments.module.ts` (importa `EvidencesModule`)

**Interfaces:**
- Consumes: `PrismaService` (já existe, `@Global()` via `PrismaModule`), `AuthenticatedGuard` (`backend/src/auth/authenticated.guard.ts`, já existe).
- Produces: `EvidencesService.saveMany(itemId: string, files: Express.Multer.File[], uploadedBy?: string): Promise<Evidence[]>`, `EvidencesService.findOne(id: string): Promise<Evidence | null>`, `EvidencesService.filePath(evidence: {storageKey: string}): string`, `EvidencesService.remove(evidence: {id: string; storageKey: string}): Promise<void>`. Rotas HTTP: `POST /api/assessments/:id/items/:safeguardId/evidences` (multipart, campo `files`), `GET /api/evidences/:id`, `DELETE /api/evidences/:id`. `AssessmentsService.ensureItem(assessmentId: string, safeguardId: string): Promise<AssessmentItem>`.

- [ ] **Step 1: Adicionar `multer` e `@types/multer` ao `package.json` do backend**

Em `backend/package.json`, dentro de `"dependencies"`, inserir a linha `"multer": "^2.0.2",` entre `"express-session": "^1.18.0",` e `"passport": "^0.7.0",` (ordem alfabética já usada no arquivo):

```json
    "express-session": "^1.18.0",
    "multer": "^2.0.2",
    "passport": "^0.7.0",
```

Dentro de `"devDependencies"`, inserir a linha `"@types/multer": "^1.4.12",` entre `"@types/jest": "^29.5.12",` e `"@types/node": "^20.14.0",`:

```json
    "@types/jest": "^29.5.12",
    "@types/multer": "^1.4.12",
    "@types/node": "^20.14.0",
```

- [ ] **Step 2: Instalar as dependências localmente**

Run: `cd backend && npm install`
Expected: instala sem erro; `backend/node_modules/multer` e `backend/node_modules/@types/multer` presentes.

- [ ] **Step 3: Ignorar a pasta de uploads local no git**

No `.gitignore` da raiz do repo (`C:\Users\LN-SDJIWOE1\projetos\cis-risk_monitor\.claude\worktrees\saml-local-auth\.gitignore`), adicionar uma linha:

```
backend/uploads/
```

- [ ] **Step 4: Escrever o teste falho do `EvidencesService`**

Criar `backend/src/evidences/evidences.service.spec.ts`:

```typescript
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { EvidencesService } from './evidences.service';

function makeFile(name: string, content: string): Express.Multer.File {
  return {
    originalname: name,
    mimetype: 'text/plain',
    size: Buffer.byteLength(content),
    buffer: Buffer.from(content),
  } as Express.Multer.File;
}

describe('EvidencesService', () => {
  let prisma: any;
  let service: EvidencesService;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'evidences-test-'));
    process.env.UPLOADS_DIR = tmpDir;
    prisma = { evidence: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() } };
    service = new EvidencesService(prisma);
  });

  afterEach(async () => {
    delete process.env.UPLOADS_DIR;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('grava o arquivo no disco e cria o registro Evidence', async () => {
    prisma.evidence.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'ev1', ...data }));

    const [created] = await service.saveMany('item1', [makeFile('relatorio.txt', 'conteudo')], 'auditor@empresa.com');

    expect(created.filename).toBe('relatorio.txt');
    expect(created.itemId).toBe('item1');
    expect(created.uploadedBy).toBe('auditor@empresa.com');
    const written = await fs.readFile(path.join(tmpDir, created.storageKey), 'utf-8');
    expect(written).toBe('conteudo');
  });

  it('sanitiza nomes de arquivo com separadores de caminho', async () => {
    prisma.evidence.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'ev2', ...data }));

    const [created] = await service.saveMany('item1', [makeFile('../../etc/passwd', 'x')]);

    expect(created.filename).toBe('.._.._etc_passwd');
    expect(created.storageKey).not.toMatch(/[/\\]/);
  });

  it('remove apaga o arquivo do disco e a linha no banco', async () => {
    prisma.evidence.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'ev3', ...data }));
    const [created] = await service.saveMany('item1', [makeFile('a.txt', 'y')]);
    prisma.evidence.delete.mockResolvedValue(created);

    await service.remove(created);

    expect(prisma.evidence.delete).toHaveBeenCalledWith({ where: { id: created.id } });
    await expect(fs.readFile(path.join(tmpDir, created.storageKey))).rejects.toThrow();
  });
});
```

- [ ] **Step 5: Rodar o teste e confirmar que falha (o módulo ainda não existe)**

Run: `cd backend && npx jest evidences.service`
Expected: FAIL com `Cannot find module './evidences.service'`.

- [ ] **Step 6: Implementar `EvidencesService`**

Criar `backend/src/evidences/evidences.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';

function uploadsDir() {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
}

@Injectable()
export class EvidencesService {
  constructor(private prisma: PrismaService) {}

  async saveMany(itemId: string, files: Express.Multer.File[], uploadedBy?: string) {
    const dir = uploadsDir();
    await fs.mkdir(dir, { recursive: true });
    const created = [];
    for (const file of files) {
      const safeName = file.originalname.replace(/[/\\]/g, '_');
      const storageKey = `${randomUUID()}-${safeName}`;
      await fs.writeFile(path.join(dir, storageKey), file.buffer);
      created.push(
        await this.prisma.evidence.create({
          data: {
            itemId,
            filename: safeName,
            storageKey,
            mime: file.mimetype,
            size: file.size,
            uploadedBy,
          },
        }),
      );
    }
    return created;
  }

  findOne(id: string) {
    return this.prisma.evidence.findUnique({ where: { id } });
  }

  filePath(evidence: { storageKey: string }) {
    return path.join(uploadsDir(), evidence.storageKey);
  }

  async remove(evidence: { id: string; storageKey: string }) {
    await fs.unlink(this.filePath(evidence)).catch(() => {});
    await this.prisma.evidence.delete({ where: { id: evidence.id } });
  }
}
```

- [ ] **Step 7: Rodar o teste e confirmar que passa**

Run: `cd backend && npx jest evidences.service`
Expected: PASS (3 testes).

- [ ] **Step 8: Escrever o teste falho do `EvidencesController`**

Criar `backend/src/evidences/evidences.controller.spec.ts`:

```typescript
import { NotFoundException } from '@nestjs/common';
import { EvidencesController } from './evidences.controller';

describe('EvidencesController', () => {
  it('download: lança 404 quando a evidência não existe', async () => {
    const svc = { findOne: jest.fn().mockResolvedValue(null) } as any;
    const controller = new EvidencesController(svc);
    const res = { setHeader: jest.fn(), sendFile: jest.fn() } as any;

    await expect(controller.download('nope', res)).rejects.toThrow(NotFoundException);
  });

  it('download: envia o arquivo com os headers certos', async () => {
    const evidence = { id: 'ev1', filename: 'foto.png', mime: 'image/png', storageKey: 'abc-foto.png' };
    const svc = {
      findOne: jest.fn().mockResolvedValue(evidence),
      filePath: jest.fn().mockReturnValue('/app/uploads/abc-foto.png'),
    } as any;
    const controller = new EvidencesController(svc);
    const res = { setHeader: jest.fn(), sendFile: jest.fn() } as any;

    await controller.download('ev1', res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(res.sendFile).toHaveBeenCalledWith('/app/uploads/abc-foto.png');
  });

  it('remove: apaga a evidência existente', async () => {
    const evidence = { id: 'ev1', storageKey: 'abc-foto.png' };
    const svc = { findOne: jest.fn().mockResolvedValue(evidence), remove: jest.fn().mockResolvedValue(undefined) } as any;
    const controller = new EvidencesController(svc);

    const result = await controller.remove('ev1');

    expect(svc.remove).toHaveBeenCalledWith(evidence);
    expect(result).toEqual({ ok: true });
  });

  it('remove: lança 404 quando a evidência não existe', async () => {
    const svc = { findOne: jest.fn().mockResolvedValue(null) } as any;
    const controller = new EvidencesController(svc);
    await expect(controller.remove('nope')).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 9: Rodar o teste e confirmar que falha**

Run: `cd backend && npx jest evidences.controller`
Expected: FAIL com `Cannot find module './evidences.controller'`.

- [ ] **Step 10: Implementar `EvidencesController` e `EvidencesModule`**

Criar `backend/src/evidences/evidences.controller.ts`:

```typescript
import { Controller, Delete, Get, NotFoundException, Param, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { EvidencesService } from './evidences.service';
import { AuthenticatedGuard } from '../auth/authenticated.guard';

@Controller('evidences')
@UseGuards(AuthenticatedGuard)
export class EvidencesController {
  constructor(private svc: EvidencesService) {}

  @Get(':id')
  async download(@Param('id') id: string, @Res() res: Response) {
    const evidence = await this.svc.findOne(id);
    if (!evidence) throw new NotFoundException('Evidência não encontrada');
    res.setHeader('Content-Type', evidence.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(evidence.filename)}"`);
    res.sendFile(this.svc.filePath(evidence));
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const evidence = await this.svc.findOne(id);
    if (!evidence) throw new NotFoundException('Evidência não encontrada');
    await this.svc.remove(evidence);
    return { ok: true };
  }
}
```

Criar `backend/src/evidences/evidences.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { EvidencesService } from './evidences.service';
import { EvidencesController } from './evidences.controller';

@Module({
  providers: [EvidencesService],
  controllers: [EvidencesController],
  exports: [EvidencesService],
})
export class EvidencesModule {}
```

- [ ] **Step 11: Rodar o teste e confirmar que passa**

Run: `cd backend && npx jest evidences.controller`
Expected: PASS (4 testes).

- [ ] **Step 12: Adicionar `ensureItem` ao `AssessmentsService`**

Em `backend/src/assessments/assessments.service.ts`, adicionar o método logo após `getWithItems`:

```typescript
  // Garante que o AssessmentItem exista (para anexar evidência sem alterar maturidade/na)
  ensureItem(assessmentId: string, safeguardId: string) {
    return this.prisma.assessmentItem.upsert({
      where: { assessmentId_safeguardId: { assessmentId, safeguardId } },
      update: {},
      create: { assessmentId, safeguardId },
    });
  }
```

- [ ] **Step 13: Escrever o teste falho do endpoint de upload no `AssessmentsController`**

Criar `backend/src/assessments/assessments.controller.spec.ts` (arquivo novo — o controller não tinha spec):

```typescript
import { AssessmentsController } from './assessments.controller';

describe('AssessmentsController - uploadEvidences', () => {
  it('garante o item da avaliação e delega o upload ao EvidencesService', async () => {
    const svc = { ensureItem: jest.fn().mockResolvedValue({ id: 'item1' }) } as any;
    const evidences = { saveMany: jest.fn().mockResolvedValue([{ id: 'ev1' }]) } as any;
    const controller = new AssessmentsController(svc, evidences);
    const files = [{ originalname: 'a.txt', buffer: Buffer.from('x'), mimetype: 'text/plain', size: 1 }] as any;
    const req = { user: { email: 'auditor@empresa.com' } } as any;

    const result = await controller.uploadEvidences('assess1', '1.1', files, req);

    expect(svc.ensureItem).toHaveBeenCalledWith('assess1', '1.1');
    expect(evidences.saveMany).toHaveBeenCalledWith('item1', files, 'auditor@empresa.com');
    expect(result).toEqual([{ id: 'ev1' }]);
  });
});
```

- [ ] **Step 14: Rodar o teste e confirmar que falha**

Run: `cd backend && npx jest assessments.controller`
Expected: FAIL — `AssessmentsController` ainda não aceita `EvidencesService` no construtor nem tem `uploadEvidences`.

- [ ] **Step 15: Implementar o endpoint de upload no `AssessmentsController`**

Substituir o conteúdo de `backend/src/assessments/assessments.controller.ts` por:

```typescript
import {
  Body, Controller, Get, Param, Post, Put, Req, UseGuards, UseInterceptors, UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { AssessmentsService } from './assessments.service';
import { EvidencesService } from '../evidences/evidences.service';
import { AuthenticatedGuard } from '../auth/authenticated.guard';

@Controller('assessments')
@UseGuards(AuthenticatedGuard)
export class AssessmentsController {
  constructor(private svc: AssessmentsService, private evidences: EvidencesService) {}

  @Get()
  list() {
    return this.svc.list();
  }

  @Post()
  create(@Body() body: { name: string; scopeIg?: number }, @Req() req: Request) {
    return this.svc.create({ ...body, createdBy: (req.user as any)?.email });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.getWithItems(id);
  }

  @Get(':id/summary')
  summary(@Param('id') id: string) {
    return this.svc.summary(id);
  }

  @Put(':id/items/:safeguardId')
  setItem(
    @Param('id') id: string,
    @Param('safeguardId') safeguardId: string,
    @Body() body: { maturity?: number | null; na?: boolean; evidenceText?: string },
    @Req() req: Request,
  ) {
    return this.svc.setItem(id, safeguardId, { ...body, updatedBy: (req.user as any)?.email });
  }

  @Post(':id/items/:safeguardId/evidences')
  @UseInterceptors(FilesInterceptor('files', 10, { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadEvidences(
    @Param('id') id: string,
    @Param('safeguardId') safeguardId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: Request,
  ) {
    const item = await this.svc.ensureItem(id, safeguardId);
    return this.evidences.saveMany(item.id, files ?? [], (req.user as any)?.email);
  }
}
```

- [ ] **Step 16: Registrar `EvidencesModule` em `AssessmentsModule`**

Substituir o conteúdo de `backend/src/assessments/assessments.module.ts` por:

```typescript
import { Module } from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import { AssessmentsController } from './assessments.controller';
import { EvidencesModule } from '../evidences/evidences.module';

@Module({
  imports: [EvidencesModule],
  providers: [AssessmentsService],
  controllers: [AssessmentsController],
})
export class AssessmentsModule {}
```

- [ ] **Step 17: Rodar todos os testes do backend e confirmar que passam**

Run: `cd backend && npm test`
Expected: PASS em todos os `*.spec.ts` (os já existentes em `auth/` + os 8 novos de `evidences`/`assessments`).

- [ ] **Step 18: Commit**

```bash
git add backend/package.json backend/package-lock.json .gitignore backend/src/evidences backend/src/assessments
git commit -m "feat(backend): upload real de evidencia (multer + disco) nos itens de avaliacao"
```

---

### Task 3: Frontend — API client + helpers compartilhados de risco/insights

**Files:**
- Modify: `frontend/src/api/client.ts`
- Create: `frontend/src/lib/risk.ts`
- Create: `frontend/src/lib/insights.ts`

**Interfaces:**
- Consumes: `BASE` (já existe em `client.ts`), `req<T>` (já existe em `client.ts`).
- Produces: `api.uploadEvidences(assessmentId, safeguardId, files: File[]): Promise<any[]>`, `api.deleteEvidence(id): Promise<void>`, `api.evidenceUrl(id): string` — consumidos pela Task 5. `sevKey(s: number): 'crit'|'high'|'med'|'low'`, `SEV_LABEL`, `STATUS_LABEL`, `STATUS_OPTIONS`, `STATUS_PILL_CLASS`, `isActive(status: string): boolean`, `taskStats(tasks): {total, done, overdue}` de `lib/risk.ts` — consumidos pelas Tasks 4 e 6. `computeInsights(controls, itemsById, risks): InsightItem[]` de `lib/insights.ts` — consumido pela Task 6.

- [ ] **Step 1: Adicionar os métodos de evidência ao `api` client**

Em `frontend/src/api/client.ts`, adicionar dentro do objeto `api` (após `setItem`):

```typescript
  uploadEvidences: (assessmentId: string, safeguardId: string, files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    return fetch(`${BASE}/assessments/${assessmentId}/items/${safeguardId}/evidences`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    }).then(async (res) => {
      if (!res.ok) throw Object.assign(new Error(`API ${res.status}`), { status: res.status });
      return res.json();
    });
  },
  deleteEvidence: (id: string) => req<void>(`/evidences/${id}`, { method: 'DELETE' }),
  evidenceUrl: (id: string) => BASE + '/evidences/' + id,
```

(Não usa `req()` para o upload porque `req()` fixa `Content-Type: application/json`, o que quebraria o `multipart/form-data` — o navegador precisa definir o boundary sozinho.)

- [ ] **Step 2: Criar `lib/risk.ts`**

Criar `frontend/src/lib/risk.ts`:

```typescript
// Severidade de risco: mesmos limiares do mockup (s = probabilidade * impacto).
export const sevKey = (s: number): 'crit' | 'high' | 'med' | 'low' =>
  s >= 17 ? 'crit' : s >= 10 ? 'high' : s >= 5 ? 'med' : 'low';

export const SEV_LABEL: Record<string, string> = { crit: 'Crítico', high: 'Alto', med: 'Médio', low: 'Baixo' };

export const STATUS_LABEL: Record<string, string> = {
  ABERTO: 'Aberto', EM_TRATAMENTO: 'Em tratamento', MITIGADO: 'Mitigado', ACEITO: 'Aceito',
};
export const STATUS_OPTIONS = ['ABERTO', 'EM_TRATAMENTO', 'MITIGADO', 'ACEITO'] as const;
export const STATUS_PILL_CLASS: Record<string, string> = {
  ABERTO: 'p-crit', EM_TRATAMENTO: 'p-info', MITIGADO: 'p-low', ACEITO: 'p-neutral',
};

export const isActive = (status: string) => status === 'ABERTO' || status === 'EM_TRATAMENTO';

export function taskStats(tasks: { done: boolean; dueDate?: string | null }[]) {
  const todayISO = new Date().toISOString().slice(0, 10);
  const open = tasks.filter((t) => !t.done);
  const overdue = open.filter((t) => t.dueDate && String(t.dueDate).slice(0, 10) < todayISO);
  return { total: tasks.length, done: tasks.length - open.length, overdue: overdue.length };
}
```

- [ ] **Step 3: Criar `lib/insights.ts`**

Criar `frontend/src/lib/insights.ts`:

```typescript
import { isActive, taskStats } from './risk';

export type InsightItem = { sev: 'crit' | 'high' | 'med'; text: string; view: 'auditoria' | 'riscos' };

// Porta as 5 regras do mockup para os dados reais (controles com salvaguardas,
// items da avaliação por safeguardId, e riscos com tasks/controls).
export function computeInsights(controls: any[], itemsById: Record<string, any>, risks: any[]): InsightItem[] {
  const items: InsightItem[] = [];

  let semEvidencia = 0;
  controls.forEach((c) => c.safeguards.forEach((s: any) => {
    const it = itemsById[s.id];
    const evCount = (it?.evidenceText?.trim() ? 1 : 0) + (it?.evidences?.length || 0);
    if (it && typeof it.maturity === 'number' && it.maturity >= 3 && !evCount) semEvidencia++;
  }));
  if (semEvidencia) {
    items.push({ sev: 'high', text: `${semEvidencia} salvaguarda(s) com nível ≥ 3 declarado sem nenhuma evidência registrada`, view: 'auditoria' });
  }

  let antigas = 0;
  const umAnoAtras = new Date();
  umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1);
  controls.forEach((c) => c.safeguards.forEach((s: any) => {
    const it = itemsById[s.id];
    if (it?.updatedAt && new Date(it.updatedAt) < umAnoAtras) antigas++;
  }));
  if (antigas) {
    items.push({ sev: 'med', text: `${antigas} salvaguarda(s) avaliada(s) há mais de 12 meses — reavalie`, view: 'auditoria' });
  }

  const ativos = risks.filter((r) => isActive(r.status));

  const semTarefa = ativos.filter((r) => r.probResidual * r.impactResidual >= 10 && !(r.tasks || []).length).length;
  if (semTarefa) {
    items.push({ sev: 'crit', text: `${semTarefa} risco(s) alto/crítico sem nenhuma tarefa de tratamento`, view: 'riscos' });
  }

  const semControle = ativos.filter((r) => !(r.controls || []).length).length;
  if (semControle) {
    items.push({ sev: 'med', text: `${semControle} risco(s) ativo(s) sem controle CIS vinculado — o crosswalk fica cego`, view: 'riscos' });
  }

  let atrasadas = 0;
  risks.forEach((r) => { atrasadas += taskStats(r.tasks || []).overdue; });
  if (atrasadas) {
    items.push({ sev: 'high', text: `${atrasadas} tarefa(s) de tratamento de risco com prazo vencido`, view: 'riscos' });
  }

  const order = { crit: 0, high: 1, med: 2 };
  return items.sort((a, b) => order[a.sev] - order[b.sev]);
}
```

- [ ] **Step 4: Verificar tipos**

Run: `cd frontend && npx tsc`
Expected: sem saída (sem erros).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/lib/risk.ts frontend/src/lib/insights.ts
git commit -m "feat(frontend): api de evidencias + helpers compartilhados de risco e insights"
```

---

### Task 4: Frontend — Riscos com modal completo (`RiskForm`)

**Files:**
- Create: `frontend/src/components/RiskForm.tsx`
- Modify: `frontend/src/pages/Riscos.tsx`

**Interfaces:**
- Consumes: `api.risks()`, `api.controls()`, `api.createRisk(body)`, `api.updateRisk(id, body)`, `api.deleteRisk(id)` (todos já existem em `api/client.ts`); `sevKey`, `SEV_LABEL`, `STATUS_LABEL`, `STATUS_OPTIONS`, `STATUS_PILL_CLASS`, `taskStats` de `../lib/risk` (Task 3).
- Produces: componente `RiskForm` usado só por `Riscos.tsx` nesta rodada.

- [ ] **Step 1: Criar `RiskForm.tsx`**

Criar `frontend/src/components/RiskForm.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { STATUS_LABEL, STATUS_OPTIONS } from '../lib/risk';

const PROB_LABELS = ['1 · Rara', '2 · Improvável', '3 · Possível', '4 · Provável', '5 · Quase certa'];
const IMP_LABELS = ['1 · Insignificante', '2 · Menor', '3 · Moderado', '4 · Maior', '5 · Severo'];

type TaskDraft = { description: string; assignee: string; dueDate: string; done: boolean };

export function RiskForm({
  risk, controls, onClose, onSaved,
}: {
  risk: any | null; controls: any[]; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState(risk?.title || '');
  const [description, setDescription] = useState(risk?.description || '');
  const [probInherent, setProbInherent] = useState(risk?.probInherent ?? 3);
  const [impactInherent, setImpactInherent] = useState(risk?.impactInherent ?? 3);
  const [probResidual, setProbResidual] = useState(risk?.probResidual ?? 3);
  const [impactResidual, setImpactResidual] = useState(risk?.impactResidual ?? 3);
  const [ownerName, setOwnerName] = useState(risk?.ownerName || '');
  const [status, setStatus] = useState(risk?.status || 'ABERTO');
  const [selectedControls, setSelectedControls] = useState<number[]>(
    (risk?.controls || []).map((rc: any) => rc.control.number),
  );
  const [tasks, setTasks] = useState<TaskDraft[]>(
    (risk?.tasks || []).map((t: any) => ({
      description: t.description,
      assignee: t.assignee || '',
      done: t.done,
      dueDate: t.dueDate ? String(t.dueDate).slice(0, 10) : '',
    })),
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function toggleControl(n: number) {
    setSelectedControls((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n]));
  }
  function addTask() { setTasks((t) => [...t, { description: '', assignee: '', dueDate: '', done: false }]); }
  function updateTask(i: number, patch: Partial<TaskDraft>) {
    setTasks((t) => t.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function removeTask(i: number) { setTasks((t) => t.filter((_, idx) => idx !== i)); }

  async function save() {
    if (!title.trim()) return;
    const body = {
      title: title.trim(),
      description: description.trim() || undefined,
      probInherent, impactInherent, probResidual, impactResidual,
      ownerName: ownerName.trim() || undefined,
      status,
      controlNumbers: selectedControls,
      tasks: tasks.filter((t) => t.description.trim()).map((t) => ({
        description: t.description.trim(),
        assignee: t.assignee.trim() || undefined,
        dueDate: t.dueDate || undefined,
        done: t.done,
      })),
    };
    if (risk) await api.updateRisk(risk.id, body);
    else await api.createRisk(body);
    onSaved();
  }

  async function remove() {
    if (!risk) return;
    if (!confirm(`Excluir o risco "${risk.title}" e suas tarefas?`)) return;
    await api.deleteRisk(risk.id);
    onSaved();
  }

  return (
    <div className="overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-head">
          <h2 className="page-title" style={{ fontSize: 17 }}>{risk ? 'Editar risco' : 'Novo risco'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">✕</button>
        </div>
        <div className="modal-body">
          <div className="form-full" style={{ marginTop: 0 }}>
            <label htmlFor="rf-titulo">Título do risco</label>
            <input className="fld" id="rf-titulo" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Ransomware nos servidores de arquivos" />
          </div>
          <div className="form-full">
            <label htmlFor="rf-desc">Descrição</label>
            <textarea className="fld" id="rf-desc" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o cenário de risco, ativos afetados e consequências" />
          </div>
          <div className="form-grid" style={{ marginTop: 12 }}>
            <div className="form-field">
              <label htmlFor="rf-prob">Probabilidade (inerente)</label>
              <select className="fld" id="rf-prob" value={probInherent} onChange={(e) => setProbInherent(+e.target.value)}>
                {PROB_LABELS.map((l, i) => <option key={i} value={i + 1}>{l}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="rf-imp">Impacto (inerente)</label>
              <select className="fld" id="rf-imp" value={impactInherent} onChange={(e) => setImpactInherent(+e.target.value)}>
                {IMP_LABELS.map((l, i) => <option key={i} value={i + 1}>{l}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="rf-prob-r">Probabilidade (residual)</label>
              <select className="fld" id="rf-prob-r" value={probResidual} onChange={(e) => setProbResidual(+e.target.value)}>
                {PROB_LABELS.map((l, i) => <option key={i} value={i + 1}>{l}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="rf-imp-r">Impacto (residual)</label>
              <select className="fld" id="rf-imp-r" value={impactResidual} onChange={(e) => setImpactResidual(+e.target.value)}>
                {IMP_LABELS.map((l, i) => <option key={i} value={i + 1}>{l}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="rf-resp">Responsável pelo risco</label>
              <input className="fld" id="rf-resp" value={ownerName} onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Ex.: Infraestrutura" />
            </div>
            <div className="form-field">
              <label htmlFor="rf-status">Status</label>
              <select className="fld" id="rf-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </div>
          </div>
          <p className="td-muted" style={{ margin: '8px 0 0' }}>
            O <b>inerente</b> é o risco sem controles; o <b>residual</b> é o risco atual, considerando os controles CIS vinculados e o plano de tratamento.
          </p>
          <div className="form-full">
            <label>Controles CIS vinculados (mitigam este risco)</label>
            <div className="ctrl-check-grid">
              {controls.map((c) => (
                <label className="ctrl-check" key={c.number}>
                  <input type="checkbox" checked={selectedControls.includes(c.number)} onChange={() => toggleControl(c.number)} />
                  <span><b>{String(c.number).padStart(2, '0')}</b> {c.titlePt}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="form-full">
            <label>Tarefas do plano de tratamento</label>
            {tasks.map((t, i) => (
              <div className={`task-row${t.done ? ' task-done' : ''}`} key={i}>
                <input type="checkbox" checked={t.done} onChange={(e) => updateTask(i, { done: e.target.checked })} title="Concluída" />
                <input className="fld" value={t.description} onChange={(e) => updateTask(i, { description: e.target.value })} placeholder="Descrição da tarefa" />
                <input className="fld" value={t.assignee} onChange={(e) => updateTask(i, { assignee: e.target.value })} placeholder="Responsável" />
                <input className="fld" type="date" value={t.dueDate} onChange={(e) => updateTask(i, { dueDate: e.target.value })} title="Prazo" />
                <button className="rm" title="Remover tarefa" onClick={() => removeTask(i)}>✕</button>
              </div>
            ))}
            <button className="btn ghost sm" onClick={addTask} style={{ marginTop: 4 }}>+ Adicionar tarefa</button>
          </div>
          <div className="modal-actions">
            {risk && <button className="btn danger" style={{ marginRight: 'auto' }} onClick={remove}>Excluir risco</button>}
            <button className="btn ghost" onClick={onClose}>Cancelar</button>
            <button className="btn" onClick={save}>Salvar risco</button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Reescrever `Riscos.tsx` para usar o modal**

Substituir o conteúdo de `frontend/src/pages/Riscos.tsx` por:

```tsx
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { sevKey, SEV_LABEL, STATUS_LABEL, STATUS_PILL_CLASS, taskStats } from '../lib/risk';
import { RiskForm } from '../components/RiskForm';

export function Riscos() {
  const [risks, setRisks] = useState<any[]>([]);
  const [controls, setControls] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  async function load() {
    const [rs, cs] = await Promise.all([api.risks(), api.controls()]);
    setRisks(rs);
    setControls(cs);
  }
  useEffect(() => { load().catch(console.error); }, []);

  function openNew() { setEditing(null); setFormOpen(true); }
  function openEdit(r: any) { setEditing(r); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditing(null); }
  async function afterSave() { closeForm(); await load(); }

  const pill = (s: number) => {
    const k = sevKey(s);
    return <span className={`pill p-${k}`}><span className="dot" />{SEV_LABEL[k]} ({s})</span>;
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Registro de riscos</h1>
          <p className="page-sub">Registre os riscos mapeados, atribua impacto, probabilidade, responsável, tarefas com prazos e vincule aos controles CIS que os mitigam.</p>
        </div>
        <button className="btn" onClick={openNew}>+ Novo risco</button>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr><th>Risco</th><th>Inerente</th><th>Residual</th><th>Responsável</th><th>Status</th><th>Controles CIS</th><th>Tarefas</th></tr>
          </thead>
          <tbody>
            {risks.length === 0 && (
              <tr><td colSpan={7} style={{ color: 'var(--ink-3)' }}>Nenhum risco cadastrado ainda. Clique em <b>+ Novo risco</b> para começar.</td></tr>
            )}
            {[...risks].sort((a, b) => b.probResidual * b.impactResidual - a.probResidual * a.impactResidual).map((r) => {
              const si = r.probInherent * r.impactInherent;
              const sr = r.probResidual * r.impactResidual;
              const ts = taskStats(r.tasks || []);
              return (
                <tr key={r.id} className="clickable" onClick={() => openEdit(r)}>
                  <td style={{ minWidth: 220 }}>
                    <b>{r.title}</b>
                    {r.description && (
                      <div className="td-muted" style={{ maxWidth: '46ch' }}>
                        {r.description.length > 110 ? r.description.slice(0, 110) + '…' : r.description}
                      </div>
                    )}
                  </td>
                  <td>{pill(si)}<div className="td-muted num" style={{ marginTop: 2 }}>P{r.probInherent} × I{r.impactInherent}</div></td>
                  <td>{pill(sr)}<div className="td-muted num" style={{ marginTop: 2 }}>P{r.probResidual} × I{r.impactResidual}</div></td>
                  <td style={{ color: 'var(--ink-3)' }}>{r.ownerName || '—'}</td>
                  <td><span className={`pill ${STATUS_PILL_CLASS[r.status] || 'p-neutral'}`}><span className="dot" />{STATUS_LABEL[r.status] || r.status}</span></td>
                  <td>
                    {(r.controls || []).length
                      ? r.controls.map((rc: any) => <span key={rc.control.number} className="tag ig">C{String(rc.control.number).padStart(2, '0')}</span>)
                      : <span className="td-muted">—</span>}
                  </td>
                  <td className="num">
                    {ts.done}/{ts.total}
                    {ts.overdue > 0 && <div className="overdue">⚠ {ts.overdue} atrasada(s)</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {formOpen && <RiskForm risk={editing} controls={controls} onClose={closeForm} onSaved={afterSave} />}
    </>
  );
}
```

- [ ] **Step 3: Verificar tipos**

Run: `cd frontend && npx tsc`
Expected: sem saída (sem erros).

- [ ] **Step 4: Verificar visualmente via Docker + Playwright**

Rebuildar e subir o container do frontend, depois:

```bash
docker compose build web && docker compose up -d web
npx playwright screenshot --full-page --wait-for-timeout=2000 http://localhost:8080/riscos /tmp/riscos.png
```

Expected: tabela com colunas Risco/Inerente/Residual/Responsável/Status/Controles CIS/Tarefas; botão "+ Novo risco" abre o modal com todos os campos ao clicar (verificar via `chromium-cli`/script Playwright interativo: `click`, `screenshot`).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/RiskForm.tsx frontend/src/pages/Riscos.tsx
git commit -m "feat(frontend): modal completo de risco (inerente/residual, controles, tarefas)"
```

---

### Task 5: Frontend — Auditoria com acordeão, escala de rádio e upload de evidência

**Files:**
- Create: `frontend/src/components/SafeguardAccordion.tsx`
- Modify: `frontend/src/pages/Auditoria.tsx`

**Interfaces:**
- Consumes: `api.setItem`, `api.uploadEvidences`, `api.deleteEvidence`, `api.evidenceUrl` (Tasks 3 e existentes).
- Produces: componente `SafeguardAccordion` usado só por `Auditoria.tsx` nesta rodada.

- [ ] **Step 1: Criar `SafeguardAccordion.tsx`**

Criar `frontend/src/components/SafeguardAccordion.tsx`:

```tsx
import { useState } from 'react';
import { api } from '../api/client';

const LEVELS = [
  { v: 0, nome: '0 · Inexistente', desc: 'Nada implementado' },
  { v: 1, nome: '1 · Inicial', desc: 'Esforços pontuais, sem processo' },
  { v: 2, nome: '2 · Documentado', desc: 'Política definida, aplicação parcial' },
  { v: 3, nome: '3 · Implementado', desc: 'Aplicado na maior parte do ambiente' },
  { v: 4, nome: '4 · Gerenciado', desc: 'Medido e monitorado com indicadores' },
  { v: 5, nome: '5 · Otimizado', desc: 'Automatizado, melhoria contínua' },
];

function levelPill(m: number | null | undefined, na: boolean) {
  if (na) return <span className="pill p-neutral"><span className="dot" />N/A</span>;
  if (m == null) return <span className="pill p-neutral"><span className="dot" />Não avaliado</span>;
  const cls = m <= 1 ? 'p-crit' : m === 2 ? 'p-high' : m === 3 ? 'p-med' : 'p-low';
  return <span className={`pill ${cls}`}><span className="dot" />Nível {m}</span>;
}

export function SafeguardAccordion({
  safeguard, item, assessmentId, onSaved,
}: {
  safeguard: any; item: any; assessmentId: string; onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [maturity, setMaturity] = useState<number | null>(item?.maturity ?? null);
  const [na, setNa] = useState<boolean>(!!item?.na);
  const [evidenceText, setEvidenceText] = useState(item?.evidenceText || '');
  const [uploading, setUploading] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  async function save() {
    await api.setItem(assessmentId, safeguard.id, { maturity: na ? null : maturity, na, evidenceText });
    setSavedAt(new Date().toLocaleTimeString('pt-BR'));
    onSaved();
  }

  async function onFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      await api.uploadEvidences(assessmentId, safeguard.id, Array.from(files));
      onSaved();
    } finally {
      setUploading(false);
    }
  }

  async function removeEvidence(id: string) {
    await api.deleteEvidence(id);
    onSaved();
  }

  const evCount = (item?.evidenceText?.trim() ? 1 : 0) + (item?.evidences?.length || 0);

  return (
    <div className={`sg${open ? ' open' : ''}`}>
      <button className="sg-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="sg-id num">{safeguard.code}</span>
        <span className="sg-title">{safeguard.titlePt}</span>
        <span className="sg-badges">
          {['ig1', 'ig2', 'ig3'].filter((k) => safeguard[k]).map((k) => <span key={k} className="tag ig">{k.toUpperCase()}</span>)}
          {evCount > 0 && <span className="tag">📎 {evCount}</span>}
          {levelPill(item?.maturity, !!item?.na)}
        </span>
        <span className="sg-caret">›</span>
      </button>
      {open && (
        <div className="sg-body">
          <div className="q-label">Pergunta do auditor</div>
          <div className="question">{safeguard.questionPt}</div>
          <details className="official">
            <summary>Texto oficial da salvaguarda (EN): {safeguard.titleEn}</summary>
            <p>{safeguard.descriptionEn}</p>
          </details>

          <div className="q-label">Como alcançar a conformidade — exemplos práticos</div>
          <ul className="examples">{safeguard.examplesPt.map((e: string, i: number) => <li key={i}>{e}</li>)}</ul>

          <div className="q-label">Evidências típicas aceitas em auditoria</div>
          <div className="evd-hint">{safeguard.evidenceHintPt}</div>

          <div className="q-label">Nível de maturidade</div>
          <div className="mat-scale">
            {LEVELS.map((l) => (
              <div className="mat-opt" key={l.v}>
                <input
                  type="radio"
                  name={`m-${safeguard.id}`}
                  id={`m-${safeguard.id}-${l.v}`}
                  checked={!na && maturity === l.v}
                  onChange={() => { setNa(false); setMaturity(l.v); }}
                />
                <label htmlFor={`m-${safeguard.id}-${l.v}`}><b>{l.nome}</b>{l.desc}</label>
              </div>
            ))}
            <div className="mat-opt">
              <input
                type="radio"
                name={`m-${safeguard.id}`}
                id={`m-${safeguard.id}-na`}
                checked={na}
                onChange={() => setNa(true)}
              />
              <label htmlFor={`m-${safeguard.id}-na`}><b>N/A</b>Não se aplica ao ambiente</label>
            </div>
          </div>

          <div className="q-label">Evidências</div>
          <textarea
            className="evd"
            value={evidenceText}
            onChange={(e) => setEvidenceText(e.target.value)}
            placeholder="Descreva as evidências: links para políticas, nº de chamados, prints, relatórios..."
          />
          <div className="file-row">
            <label className="file-btn">
              + Anexar arquivo
              <input type="file" multiple style={{ display: 'none' }} disabled={uploading} onChange={(e) => onFiles(e.target.files)} />
            </label>
            {(item?.evidences || []).map((f: any) => (
              <span className="file-chip" key={f.id}>
                <a href={api.evidenceUrl(f.id)} target="_blank" rel="noreferrer">📄 {f.filename}</a>
                <button title="Remover" onClick={() => removeEvidence(f.id)}>✕</button>
              </span>
            ))}
          </div>
          <div className="sg-save-row">
            <button className="btn" onClick={save}>Salvar avaliação</button>
            {savedAt && <span className="saved-note">Salvo às {savedAt}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Reescrever `Auditoria.tsx` para usar o acordeão**

Substituir o conteúdo de `frontend/src/pages/Auditoria.tsx` por:

```tsx
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { LEVEL_COLOR } from '../lib/maturity';
import { ensureAssessment } from './useAssessment';
import { SafeguardAccordion } from '../components/SafeguardAccordion';

export function Auditoria() {
  const [assessmentId, setId] = useState<string>('');
  const [controls, setControls] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [open, setOpen] = useState<any>(null);
  const [items, setItems] = useState<Record<string, any>>({});

  async function reload(id: string) {
    setSummary(await api.summary(id));
    const a = await api.assessment(id);
    const map: Record<string, any> = {};
    a.items.forEach((it: any) => (map[it.safeguardId] = it));
    setItems(map);
  }

  useEffect(() => {
    (async () => {
      const a = await ensureAssessment();
      setId(a.id);
      setControls(await api.controls());
      await reload(a.id);
    })().catch(console.error);
  }, []);

  const pctOf = (n: number) => summary?.controls.find((c: any) => c.number === n)?.pct ?? null;

  if (!controls.length) return <p className="page-sub">Carregando…</p>;

  return (
    <>
      <h1 className="page-title">Auditoria — CIS Controls v8.1.2</h1>
      <p className="page-sub">
        Maturidade geral: <b>{summary?.pct ?? '—'}%</b> · média {summary?.avg != null ? summary.avg.toFixed(1) : '—'}/5
        {' '}· {summary?.answered}/{summary?.total} avaliadas (IG{summary?.scopeIg}).
      </p>

      {!open ? (
        <div className="grid ctrl-grid">
          {controls.map((c) => {
            const pct = pctOf(c.number);
            const col = LEVEL_COLOR(pct == null ? null : Math.round((pct / 100) * 5));
            return (
              <div className="card ctrl-card" key={c.number} onClick={() => setOpen(c)}>
                <span className="ctrl-num">CONTROLE {String(c.number).padStart(2, '0')}</span>
                <span className="ctrl-name">{c.titlePt}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="ctrl-pct" style={{ color: pct != null ? col : 'var(--ink-3)' }}>{pct != null ? pct + '%' : '—'}</span>
                  <span className="progress" style={{ flex: 1 }}><i style={{ width: `${pct ?? 0}%`, background: col }} /></span>
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          <button className="back-btn" onClick={() => setOpen(null)}>← Voltar à auditoria</button>
          <h2 className="page-title" style={{ fontSize: 18 }}>{String(open.number).padStart(2, '0')} · {open.titlePt}</h2>
          <p className="page-sub">{open.descPt}</p>
          {open.safeguards.map((s: any) => (
            <SafeguardAccordion
              key={s.id}
              safeguard={s}
              item={items[s.id]}
              assessmentId={assessmentId}
              onSaved={() => reload(assessmentId)}
            />
          ))}
        </div>
      )}
    </>
  );
}
```

(Nota: a classe `.back-btn` substitui o botão inline que existia antes, mantendo a mesma ação `onClick={() => setOpen(null)}`.)

- [ ] **Step 3: Verificar tipos**

Run: `cd frontend && npx tsc`
Expected: sem saída (sem erros).

- [ ] **Step 4: Verificar visualmente via Docker + Playwright**

```bash
docker compose build web && docker compose up -d web
npx playwright screenshot --full-page --wait-for-timeout=2000 http://localhost:8080/auditoria /tmp/auditoria-cards.png
```

Abrir um controle (via script Playwright com `click` no primeiro `.ctrl-card`), confirmar que as salvaguardas aparecem fechadas (acordeão), que clicar no cabeçalho expande, que a escala de maturidade aparece como cards de rádio, que "Salvar avaliação" persiste (recarregar a página e conferir que o nível continua marcado), e que anexar um arquivo de teste aparece na lista com opção de remover.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/SafeguardAccordion.tsx frontend/src/pages/Auditoria.tsx
git commit -m "feat(frontend): acordeao de salvaguardas com escala de radio e upload de evidencia"
```

---

### Task 6: Frontend — Dashboard rico (KPIs, espectro, matriz, distribuição, insights, prioridades)

**Files:**
- Create: `frontend/src/components/Spectrum.tsx`
- Create: `frontend/src/components/RiskMatrix.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx`

**Interfaces:**
- Consumes: `api.summary`, `api.controls`, `api.assessment`, `api.risks` (já existem); `LEVEL_COLOR`, `matPct` de `../lib/maturity` (já existem); `isActive`, `sevKey`, `SEV_LABEL`, `taskStats` de `../lib/risk` (Task 3); `computeInsights` de `../lib/insights` (Task 3); `Gauge` de `../components/Gauge` (já existe).
- Produces: componentes `Spectrum` e `RiskMatrix`, usados só por `Dashboard.tsx` nesta rodada.

- [ ] **Step 1: Criar `Spectrum.tsx`**

Criar `frontend/src/components/Spectrum.tsx`:

```tsx
import { LEVEL_COLOR } from '../lib/maturity';

export function Spectrum({
  controls, statsFor, onSelect,
}: {
  controls: any[];
  statsFor: (c: any) => { avg: number | null; answered: number; total: number };
  onSelect: (c: any) => void;
}) {
  return (
    <div className="spectrum" role="img" aria-label="Espectro de maturidade dos 18 controles CIS">
      {controls.map((c) => {
        const st = statsFor(c);
        const h = st.avg != null ? Math.max(6, (st.avg / 5) * 100) : 3;
        const col = st.avg != null ? LEVEL_COLOR(Math.round(st.avg)) : 'var(--ink-3)';
        return (
          <button
            key={c.number}
            className="spec-col"
            title={`Controle ${String(c.number).padStart(2, '0')} · ${c.titlePt} — maturidade ${st.avg != null ? st.avg.toFixed(1) : 'n/a'}/5 (${st.answered}/${st.total} avaliadas)`}
            onClick={() => onSelect(c)}
          >
            <span className="spec-track">
              <span className="spec-bar" style={{ height: `${h}%`, background: col, opacity: st.avg == null ? 0.35 : 1 }} />
            </span>
            <span className="spec-lbl">{String(c.number).padStart(2, '0')}</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Criar `RiskMatrix.tsx`**

Criar `frontend/src/components/RiskMatrix.tsx`:

```tsx
import { sevKey, SEV_LABEL } from '../lib/risk';

export function RiskMatrix({ counts }: { counts: Record<string, number> }) {
  const cells = [];
  for (let p = 5; p >= 1; p--) {
    for (let i = 1; i <= 5; i++) {
      const s = p * i;
      const k = sevKey(s);
      const n = counts[`${p}-${i}`] || 0;
      cells.push(
        <div
          key={`${p}-${i}`}
          className={`mx-cell${n ? '' : ' empty'}`}
          style={{ background: `var(--${k}-soft)`, color: `var(--${k})` }}
          title={`Prob. ${p} × Impacto ${i} = ${s} (${SEV_LABEL[k]}) — ${n} risco(s)`}
        >
          {n || '·'}
        </div>,
      );
    }
  }
  return (
    <div className="matrix">
      <div className="mx-axis mx-y" style={{ gridRow: '1 / 6' }}>Probabilidade →</div>
      {cells}
      <div />
      {[1, 2, 3, 4, 5].map((i) => <div key={i} className="mx-axis">{i === 3 ? 'Impacto →' : i}</div>)}
    </div>
  );
}
```

- [ ] **Step 3: Reescrever `Dashboard.tsx`**

Substituir o conteúdo de `frontend/src/pages/Dashboard.tsx` por:

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Gauge } from '../components/Gauge';
import { Spectrum } from '../components/Spectrum';
import { RiskMatrix } from '../components/RiskMatrix';
import { LEVEL_COLOR } from '../lib/maturity';
import { isActive, sevKey, SEV_LABEL, taskStats } from '../lib/risk';
import { computeInsights } from '../lib/insights';
import { ensureAssessment } from './useAssessment';

const igField = (ig: number) => (ig === 1 ? 'ig1' : ig === 3 ? 'ig3' : 'ig2');

export function Dashboard() {
  const [sum, setSum] = useState<any>(null);
  const [controls, setControls] = useState<any[]>([]);
  const [itemsById, setItemsById] = useState<Record<string, any>>({});
  const [risks, setRisks] = useState<any[]>([]);
  const [matrixMode, setMatrixMode] = useState<'inerente' | 'residual'>('residual');
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const a = await ensureAssessment();
      const [s, cs, full, rs] = await Promise.all([
        api.summary(a.id), api.controls(), api.assessment(a.id), api.risks(),
      ]);
      setSum(s);
      setControls(cs);
      setRisks(rs);
      const map: Record<string, any> = {};
      full.items.forEach((it: any) => (map[it.safeguardId] = it));
      setItemsById(map);
    })().catch(console.error);
  }, []);

  if (!sum) return <p className="page-sub">Carregando…</p>;

  const ig = igField(sum.scopeIg);
  const scopedSafeguards = (c: any) => c.safeguards.filter((s: any) => s[ig]);

  function ctrlStats(c: any) {
    const sgs = scopedSafeguards(c);
    let answered = 0, applicable = 0, total = 0;
    sgs.forEach((s: any) => {
      const it = itemsById[s.id];
      if (it?.na) return;
      applicable++;
      if (it && typeof it.maturity === 'number') { answered++; total += it.maturity; }
    });
    return { total: sgs.length, answered, applicable, avg: applicable ? total / applicable : null };
  }

  const activeRisks = risks.filter((r) => isActive(r.status));
  const sevAltos = activeRisks.filter((r) => r.probResidual * r.impactResidual >= 10).length;
  let overdueTotal = 0, openTasks = 0;
  risks.forEach((r) => {
    const ts = taskStats(r.tasks || []);
    overdueTotal += ts.overdue;
    openTasks += ts.total - ts.done;
  });

  const kpis = [
    { label: 'Maturidade CIS', value: sum.pct != null ? sum.pct + '%' : '—', sub: sum.avg != null ? `média ${sum.avg.toFixed(1)}/5 · IG${sum.scopeIg}` : `escopo IG${sum.scopeIg}` },
    { label: 'Salvaguardas avaliadas', value: `${sum.answered}/${sum.total}`, sub: `${Math.round((sum.answered / Math.max(sum.total, 1)) * 100)}% do escopo` },
    { label: 'Riscos ativos', value: activeRisks.length, sub: `${sevAltos} altos/críticos (residual)` },
    { label: 'Tarefas em aberto', value: openTasks, sub: overdueTotal ? <span className="overdue">{overdueTotal} em atraso</span> : 'nenhuma em atraso' },
  ];

  const matrixCounts: Record<string, number> = {};
  activeRisks.forEach((r) => {
    const p = matrixMode === 'residual' ? r.probResidual : r.probInherent;
    const i = matrixMode === 'residual' ? r.impactResidual : r.impactInherent;
    const k = `${p}-${i}`;
    matrixCounts[k] = (matrixCounts[k] || 0) + 1;
  });

  const dist = { none: 0, low01: 0, l2: 0, l3: 0, high45: 0, na: 0 };
  let total = 0;
  controls.forEach((c) => scopedSafeguards(c).forEach((s: any) => {
    total++;
    const it = itemsById[s.id];
    if (!it || (it.maturity == null && !it.na)) { dist.none++; return; }
    if (it.na) { dist.na++; return; }
    const m = it.maturity;
    if (m <= 1) dist.low01++;
    else if (m === 2) dist.l2++;
    else if (m === 3) dist.l3++;
    else dist.high45++;
  }));
  const distSegs = [
    { n: dist.none, color: 'var(--surface-2)', label: 'Não avaliado' },
    { n: dist.low01, color: 'var(--crit)', label: 'Nível 0–1' },
    { n: dist.l2, color: 'var(--high)', label: 'Nível 2' },
    { n: dist.l3, color: 'var(--med)', label: 'Nível 3' },
    { n: dist.high45, color: 'var(--low)', label: 'Nível 4–5' },
    { n: dist.na, color: 'var(--border-2)', label: 'N/A' },
  ];

  const insights = computeInsights(controls, itemsById, risks);

  const sortedByPriority = [...activeRisks].sort(
    (a, b) => b.probResidual * b.impactResidual - a.probResidual * a.impactResidual,
  );
  function avgMaturityForRisk(r: any) {
    const nums = (r.controls || [])
      .map((rc: any) => ctrlStats(controls.find((c) => c.number === rc.control.number) || { safeguards: [] }).avg)
      .filter((v: any) => v != null);
    return nums.length ? nums.reduce((s: number, v: number) => s + v, 0) / nums.length : null;
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Visão geral — maturidade &amp; riscos</h1>
          <p className="page-sub">Avaliação de maturidade CIS Controls v8.1.2 integrada ao registro de riscos: veja onde os riscos mais severos encontram controles menos maduros.</p>
        </div>
      </div>

      <div className="grid kpis">
        {kpis.map((k) => (
          <div className="card kpi" key={k.label}>
            <div className="label">{k.label}</div>
            <div className="value num">{k.value}</div>
            <div className="sub">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="card gauge-card" style={{ marginTop: 14 }}>
        <span className="card-eyebrow">Maturidade geral</span>
        <h2 className="card-title">Índice de maturidade CIS Controls v8.1.2</h2>
        <div className="gauge-wrap">
          <Gauge pct={sum.pct} />
          <div className="gauge-info">
            <div className="lead">
              {sum.avg != null ? <>média <b>{sum.avg.toFixed(1)}</b> / 5 · <b>{sum.pct}%</b> de maturidade</> : 'nenhuma salvaguarda aplicável no escopo'}
              <div style={{ marginTop: 4 }}>{sum.answered}/{sum.total} salvaguardas avaliadas no escopo IG{sum.scopeIg}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card spectrum-card" style={{ marginTop: 14 }}>
        <div className="spectrum-top">
          <div>
            <span className="card-eyebrow">Espectro de maturidade</span>
            <h2 className="card-title">Cobertura dos 18 controles CIS</h2>
            <p className="card-sub" style={{ marginBottom: 0 }}>Cada barra é um controle (01–18); a altura mostra a maturidade média das salvaguardas no escopo. Clique para auditar.</p>
          </div>
        </div>
        <Spectrum controls={controls} statsFor={ctrlStats} onSelect={() => navigate('/auditoria')} />
      </div>

      <div className="grid two-col" style={{ marginTop: 14 }}>
        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div>
              <h2 className="card-title">Matriz de riscos</h2>
              <p className="card-sub">Riscos ativos por probabilidade × impacto</p>
            </div>
            <div className="ig-opts">
              <button className={`ig-opt${matrixMode === 'inerente' ? ' active' : ''}`} onClick={() => setMatrixMode('inerente')}>Inerente</button>
              <button className={`ig-opt${matrixMode === 'residual' ? ' active' : ''}`} onClick={() => setMatrixMode('residual')}>Residual</button>
            </div>
          </div>
          <RiskMatrix counts={matrixCounts} />
          <div className="legend">
            <span><i style={{ background: 'var(--low)' }} />Baixo (1–4)</span>
            <span><i style={{ background: 'var(--med)' }} />Médio (5–9)</span>
            <span><i style={{ background: 'var(--high)' }} />Alto (10–16)</span>
            <span><i style={{ background: 'var(--crit)' }} />Crítico (17–25)</span>
          </div>
        </div>
        <div className="card card-pad">
          <h2 className="card-title">Distribuição da avaliação CIS</h2>
          <p className="card-sub">Salvaguardas no escopo, por nível de maturidade</p>
          <div className="seg-track">
            {distSegs.filter((s) => s.n > 0).map((s) => (
              <div key={s.label} className="seg" style={{ width: `${(s.n / Math.max(total, 1)) * 100}%`, background: s.color }} title={`${s.label}: ${s.n}`} />
            ))}
          </div>
          <div className="legend">
            {distSegs.map((s) => <span key={s.label}><i style={{ background: s.color }} />{s.label} ({s.n})</span>)}
          </div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginTop: 14 }}>
        <h2 className="card-title">Insights automáticos</h2>
        <p className="card-sub">Inconsistências e pendências detectadas cruzando avaliação e riscos — clique para ir até o módulo.</p>
        {insights.length === 0 ? (
          <p className="td-muted" style={{ margin: '4px 0' }}>✅ Nenhuma inconsistência detectada nos dados registrados até aqui.</p>
        ) : insights.map((it, i) => (
          <button key={i} className="bar-row" style={{ gridTemplateColumns: '26px 1fr auto' }} onClick={() => navigate('/' + it.view)}>
            <span>{it.sev === 'crit' ? '⛔' : it.sev === 'high' ? '⚠️' : 'ℹ️'}</span>
            <span className="bar-label" style={{ whiteSpace: 'normal' }}>{it.text}</span>
            <span className="td-muted">abrir →</span>
          </button>
        ))}
      </div>

      <div className="card card-pad" style={{ marginTop: 14 }}>
        <h2 className="card-title">Prioridades: riscos × maturidade dos controles</h2>
        <p className="card-sub">Riscos ordenados por severidade, com a maturidade dos controles CIS vinculados. Severidade alta + controle imaturo = prioridade de tratamento.</p>
        {sortedByPriority.length === 0 ? (
          <p className="td-muted" style={{ margin: '6px 0' }}>Nenhum risco ativo registrado. Cadastre riscos na aba <b>Riscos</b> e vincule aos controles CIS.</p>
        ) : sortedByPriority.map((r) => {
          const sev = r.probResidual * r.impactResidual;
          const avgM = avgMaturityForRisk(r);
          const prio = sev >= 10 && (avgM == null || avgM < 3);
          const k = sevKey(sev);
          return (
            <div className="xrow" key={r.id}>
              <div className="xt">
                <b>{r.title}</b>
                <div className="xchips">
                  {(r.controls || []).length === 0 ? <span className="td-muted">Nenhum controle vinculado</span> : r.controls.map((rc: any) => {
                    const m = ctrlStats(controls.find((c) => c.number === rc.control.number) || { safeguards: [] }).avg;
                    const col = LEVEL_COLOR(m == null ? null : Math.round(m));
                    return (
                      <span key={rc.control.number} className="xchip" style={{ color: m == null ? 'var(--ink-3)' : col, borderColor: m == null ? 'var(--border-2)' : col }}>
                        C{String(rc.control.number).padStart(2, '0')} · {m != null ? m.toFixed(1) : 'não avaliado'}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span className={`pill p-${k}`}><span className="dot" />{SEV_LABEL[k]} ({sev})</span>
                <div className="td-muted num" style={{ marginTop: 3 }}>maturidade média: {avgM != null ? avgM.toFixed(1) : '—'}</div>
                {prio && <div style={{ marginTop: 4 }}><span className="prio-flag">⚑ Prioridade</span></div>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card card-pad" style={{ marginTop: 14 }}>
        <h2 className="card-title">Maturidade por controle</h2>
        <p className="card-sub">Média das salvaguardas avaliadas (escala 0–5) — clique para abrir o controle</p>
        {controls.map((c) => {
          const st = ctrlStats(c);
          return (
            <button key={c.number} className="bar-row" onClick={() => navigate('/auditoria')}>
              <span className="bar-label" title={c.titlePt}>{String(c.number).padStart(2, '0')} · {c.titlePt}</span>
              <span className="bar-track"><span className="bar-fill" style={{ width: `${st.avg != null ? (st.avg / 5) * 100 : 0}%`, background: LEVEL_COLOR(st.avg == null ? null : Math.round(st.avg)) }} /></span>
              <span className="bar-val num">{st.avg != null ? st.avg.toFixed(1) : '—'} · {st.answered}/{st.total}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
```

- [ ] **Step 4: Verificar tipos**

Run: `cd frontend && npx tsc`
Expected: sem saída (sem erros).

- [ ] **Step 5: Verificar visualmente via Docker + Playwright**

```bash
docker compose build web && docker compose up -d web
npx playwright screenshot --full-page --wait-for-timeout=2500 http://localhost:8080/ /tmp/dashboard-rico.png
```

Expected: KPIs, gauge, espectro de 18 barras, matriz de risco (vazia se não há riscos ainda), distribuição, "nenhuma inconsistência" (se nada foi avaliado ainda) ou insights reais, "nenhum risco ativo" ou lista de prioridades, e as barras por controle. Cadastrar um risco de teste em `/riscos` vinculado a um controle e conferir que ele aparece na matriz e nas prioridades do Dashboard.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Spectrum.tsx frontend/src/components/RiskMatrix.tsx frontend/src/pages/Dashboard.tsx
git commit -m "feat(frontend): dashboard rico (kpis, espectro, matriz de risco, distribuicao, insights, prioridades)"
```

---

### Task 7: Frontend — Página de Relatório & export

**Files:**
- Create: `frontend/src/pages/Relatorio.tsx`
- Modify: `frontend/src/App.tsx` (rota + item de menu)

**Interfaces:**
- Consumes: `api.controls`, `api.assessment`, `api.risks` (já existem); `ensureAssessment` de `./useAssessment` (já existe).

- [ ] **Step 1: Criar `Relatorio.tsx`**

Criar `frontend/src/pages/Relatorio.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { ensureAssessment } from './useAssessment';

function levelText(m: number | null | undefined, na: boolean) {
  if (na) return 'N/A';
  if (m == null) return 'Não avaliado';
  return `Nível ${m}`;
}

export function Relatorio() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [exportPayload, setExportPayload] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const a = await ensureAssessment();
      const [controls, full, risks] = await Promise.all([api.controls(), api.assessment(a.id), api.risks()]);
      const itemsById: Record<string, any> = {};
      full.items.forEach((it: any) => (itemsById[it.safeguardId] = it));
      const list: any[] = [];
      controls.forEach((c: any) => c.safeguards.forEach((s: any) => {
        const it = itemsById[s.id];
        const evCount = (it?.evidenceText?.trim() ? 1 : 0) + (it?.evidences?.length || 0);
        list.push({
          code: s.code,
          titlePt: s.titlePt,
          controlTitle: c.titlePt,
          igs: ['ig1', 'ig2', 'ig3'].filter((k) => s[k]).map((k) => k.toUpperCase()),
          maturity: it?.maturity ?? null,
          na: !!it?.na,
          evCount,
          updatedAt: it?.updatedAt || null,
        });
      }));
      setRows(list);
      setExportPayload({
        versao: 'CIS v8.1.2', escopo: 'IG' + a.scopeIg, exportadoEm: new Date().toISOString(),
        avaliacao: full, riscos: risks,
      });
    })().catch(console.error);
  }, []);

  function exportJSON() {
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sentinela-cis-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (!rows) return <p className="page-sub">Carregando…</p>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Relatório da avaliação</h1>
          <p className="page-sub">Consolidado por salvaguarda no escopo selecionado. O export em JSON inclui a avaliação CIS e o registro de riscos.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={exportJSON}>Exportar JSON</button>
          <button className="btn ghost" onClick={() => window.print()}>Imprimir</button>
        </div>
      </div>
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Salvaguarda</th><th>IG</th><th>Maturidade</th><th>Evidências</th><th>Atualizado</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code}>
                <td><b className="num">{r.code}</b> {r.titlePt}<div className="td-muted">{r.controlTitle}</div></td>
                <td>{r.igs.map((g: string) => <span key={g} className="tag ig">{g}</span>)}</td>
                <td>{levelText(r.maturity, r.na)}</td>
                <td>{r.evCount ? `📎 ${r.evCount}` : <span className="td-muted">—</span>}</td>
                <td className="td-muted num">{r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('pt-BR') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Adicionar a rota e o item de menu em `App.tsx`**

Em `frontend/src/App.tsx`, adicionar o import:

```typescript
import { Relatorio } from './pages/Relatorio';
```

Adicionar o link de menu logo após `<NavLink to="/riscos">Riscos</NavLink>`:

```tsx
          <NavLink to="/relatorio">Relatório &amp; export</NavLink>
```

Adicionar a rota logo após a rota `/riscos`:

```tsx
          <Route path="/relatorio" element={<ProtectedRoute><Relatorio /></ProtectedRoute>} />
```

- [ ] **Step 3: Verificar tipos**

Run: `cd frontend && npx tsc`
Expected: sem saída (sem erros).

- [ ] **Step 4: Verificar visualmente via Docker + Playwright**

```bash
docker compose build web && docker compose up -d web
npx playwright screenshot --full-page --wait-for-timeout=2000 http://localhost:8080/relatorio /tmp/relatorio.png
```

Expected: tabela consolidada por salvaguarda; clicar em "Exportar JSON" dispara o download de um `.json` com `avaliacao` e `riscos`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Relatorio.tsx frontend/src/App.tsx
git commit -m "feat(frontend): pagina de relatorio consolidado com export JSON e impressao"
```

---

### Task 8: Verificação end-to-end final

**Files:** nenhum (só verificação).

- [ ] **Step 1: Rebuildar e subir a stack completa**

```bash
docker compose build api web
docker compose up -d api web
```

- [ ] **Step 2: Rodar toda a suíte de testes do backend**

Run: `cd backend && npm test`
Expected: PASS em todos os specs.

- [ ] **Step 3: Percorrer as 5 telas com Playwright e revisar cada screenshot**

```bash
npx playwright screenshot --full-page --wait-for-timeout=2500 http://localhost:8080/ /tmp/e2e-dashboard.png
npx playwright screenshot --full-page --wait-for-timeout=2000 http://localhost:8080/auditoria /tmp/e2e-auditoria.png
npx playwright screenshot --full-page --wait-for-timeout=2000 http://localhost:8080/riscos /tmp/e2e-riscos.png
npx playwright screenshot --full-page --wait-for-timeout=2000 http://localhost:8080/relatorio /tmp/e2e-relatorio.png
```

Ler cada imagem gerada (ferramenta `Read`) e confirmar visualmente contra o mockup `sentinela-cis-demo.html`: KPIs/gauge/espectro/matriz/insights/prioridades no Dashboard; acordeão funcionando na Auditoria; modal completo em Riscos; tabela + export em Relatório.

- [ ] **Step 4: Fluxo interativo — cadastrar um risco, avaliar uma salvaguarda, anexar evidência**

Usar um script Playwright interativo (via `chromium-cli` se disponível, ou o driver `_electron`/Playwright adaptado usado nesta sessão) para: abrir `/riscos` → "+ Novo risco" → preencher título, selecionar 1 controle, adicionar 1 tarefa com prazo passado → salvar → confirmar que aparece na tabela com a tag do controle e "⚠ 1 atrasada(s)". Depois abrir `/auditoria`, avaliar uma salvaguarda do mesmo controle com nível 4 e anexar um arquivo de teste. Voltar ao Dashboard e confirmar que a matriz de risco, o cruzamento de prioridades e o espectro refletem os dados novos.

- [ ] **Step 5: Checar console do navegador em cada tela**

Run (via Playwright/`chromium-cli`): `console --errors` em cada uma das 4 páginas.
Expected: sem erros não tratados.

- [ ] **Step 6: Relatar ao usuário**

Resumir o que foi verificado (specs backend passando, 4 telas conferidas visualmente, fluxo interativo ponta-a-ponta) e apontar qualquer divergência encontrada em relação ao mockup antes de considerar o trabalho concluído.
