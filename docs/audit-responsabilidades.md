# Auditoría de responsabilidades y bad smells — Alerting Bot

> Diagnóstico exhaustivo del estado del proyecto en el branch
> `Refactor-project-2`, cubriendo backend, frontera API, frontend,
> tipos y estructura. Cada hallazgo lleva evidencia (`fichero:línea` +
> extracto) y se etiqueta con el principio violado (SOLID, GRASP,
> taxonomía de smells de Fowler).
>
> Este documento es diagnóstico puro — **no aplica ningún cambio**.
> El plan de remediación priorizado está al final (§10).
>
> **Alcance auditado**: `server/**`, `app/**`, `shared/**`,
> `prisma/schema.prisma`, `nuxt.config.ts`, `i18n/locales/*.json`,
> `package.json`.

---

## 1. Resumen ejecutivo

### Scorecard por área

| Área | Salud | Comentario |
|---|---|---|
| **Backend — services / dispatchers / formatters** | 🟢 alta | Strategy + Factory bien aplicados, repos puros, pipeline limpio |
| **Frontera API (`server/api/*`)** | 🟠 media | `backend.ts` multi-verbo, cero validación, formas de error inconsistentes |
| **Repositorios** | 🟢 alta | Una asimetría (`getByToken` sin serializar) empaña un patrón por lo demás sólido |
| **Composables** | 🟠 media | ISP: `useAlertForm` expone helpers privados; `fetchAlerts` en 4 sitios |
| **Componentes** | 🔴 baja | ConditionEditor 1142 líneas / 9+ responsabilidades; 3 duplicaciones críticas |
| **Tipos + enums** | 🟢 alta | Patrón `as const` respetado; una FormattingStrategy fuera de `shared/types` |
| **Datos + schema** | 🟠 media | Typo `formating` propagado a 30 refs incl. BD; `alertParams: Json` sin validación |
| **Estructura / auto-imports** | 🟢 alta | Convenciones consistentes; `pathPrefix: false` sin colisiones actuales |
| **Herramientas de calidad** | 🔴 baja | Sin `typecheck` ni `test` en npm scripts |
| **i18n** | 🟠 media | ≥7 huecos con strings ingleses hardcoded |

### Top-5 hallazgos por impacto

1. **`ConditionEditor.vue` — 1142 líneas, 9+ responsabilidades** (F-1). SRP roto. Bloquea cualquier cambio en la UI de condiciones sin miedo a regresiones.
2. **Typo `formating` propagado a 30 referencias** (T-3.1). Incluye schema Prisma → coste alto de arreglar (migración) → decisión: documentar como deuda conocida O pagar la migración ahora.
3. **`TRIGGER_MODE_OPTIONS` duplicado en 2 ficheros + `triggerModeLabel` hardcoded en un 3º** (F-2). Añadir un modo obliga a editar 3 sitios. DRY roto, i18n ausente.
4. **`getByToken` no serializa BigInts** (B-3). Rompe la simetría con `getAll` / `getById` / `getActiveScheduled`. Un handler que lo consuma directamente puede fallar en JSON.stringify.
5. **Cero validación de input en la frontera API** (B-11). `POST /api/backend` acepta cualquier `readBody(event)`. Un payload malformado degrada silenciosamente en el service.

### Veredicto global

La arquitectura de dominio (services / repos / strategies) está **muy sana**
— es material de examen para Tema 5. Los problemas se concentran en (a) la
**capa de presentación** (Vue components que crecen sin abstracción) y (b) la
**frontera de entrada** (validación + errores inconsistentes). Fuera de eso,
la deuda es cosmética / documental (typos, i18n, dead code) y localizable.

---

## 2. Metodología y alcance

Auditoría en tres frentes lanzados en paralelo:

- **Backend + frontera API**: `server/api/`, `server/services/`, `server/repositories/`, `server/utils/`, `server/tasks/`, `server/clients/`, `server/db/`.
- **Frontend**: `app/components/`, `app/composables/`, `app/pages/`, `app/layouts/`, `app/utils/`, cobertura i18n.
- **Tipos + estructura**: `shared/`, `prisma/schema.prisma`, `nuxt.config.ts`, `tsconfig.json`, `package.json`, layout de carpetas.

### Criterios

Cada hallazgo se etiqueta con al menos uno de:

- **SOLID** (Tema 2): SRP · OCP · LSP · ISP · DIP.
- **GRASP** (Tema 2): Expert · Creator · Controller · Alta cohesión · Bajo acoplamiento.
- **DRY** — duplicación de conocimiento.
- **Taxonomía de smells** (Fowler): god function · dead code · stale comment · leaky abstraction · primitive obsession · shotgun surgery · feature envy · field repurposing · stringly-typed.

### Severidad

- **🔴 Alta**: bloquea, corrompe datos o suma deuda que se paga cada semana.
- **🟠 Media**: fricción real pero contenida, refactor cómodo.
- **🟢 Baja**: cosmético, higiénico, sin impacto operativo.

---

## 3. Mapa de responsabilidades

### 3.1 Backend

| Módulo | Posee | Salud |
|---|---|---|
| `alertRepository` | CRUD + serialización BigInt↔string, coerción de discussion_list | 🟠 (asimetría en `getByToken`) |
| `alertLogRepository` | Append de logs + tope 200 filas | 🟢 |
| `alertService` | Reglas de status (draft/inactive/active), regla "no-activate-without-bundles" | 🟢 |
| `notifierService` | Formatear + enviar a Olvid; delega formato al factory | 🟢 |
| `pollingDispatcher` | Orquestación de un ciclo (elige strategy → ejecuta → persiste → loguea) | 🟢 |
| `dispatcherFactory` | `Source → DispatchStrategy` (único switch OCP) | 🟢 |
| `pollingStrategy` / `monitoringStrategy` | Cómo se produce el `fired` por fuente | 🟢 |
| `formatterFactory` + `formatters/*` | `Formatting → cómo se renderiza el body` | 🟢 |
| `pollingEngine` (`server/utils/engine.ts`) | fetch + parse + `test()` (que persiste last-payload) | 🟠 (comentario miente sobre side-effects) |
| `heartbeat` (task) | Quién + cuándo — cron dueness | 🟠 (nombre engañoso; procesa Monitoring también) |
| `olvidClient` | Cliente SDK Olvid (send, discussions, photo). Singleton a nivel módulo | 🟢 |
| `backend.ts` handler | Los 5 métodos HTTP en un solo fichero | 🔴 |
| `webhooks/[token].ts` | 7 responsabilidades: rutear, auth-por-token, parse, persist, notify, log, error-map | 🟠 |

### 3.2 Frontend

| Composable | Posee | Consumido por |
|---|---|---|
| `useAlerts` | Lista global + discussions + fetch | 4 sitios (default layout, AlertView, AlertWizard, pages/[id]) |
| `useAlertForm` | Modelo del formulario, `fillFrom`, resolveDiscussions, helpers bundle | AlertView, AlertWizard, BundleEditDialog |
| `useAlertActions` | Save/delete/setStatus | AlertView, AlertWizard |
| `useWizardSteps` | Máquina de estados step + gates de avance | AlertWizard (único) |
| `useSourceBinding` | v-model del source picker con seed de defaults | StepGeneral (único) |
| `useDirtyGuard` | Dirty tracking + beforeunload | AlertWizard (único) |
| `useAlertLogs` | Fetch logs + estado expandido | AlertLogs (único) |
| `useConditionSummary` | Frase resumen de condition | AlertConditionSummary (único) |
| `useStatusMatchLabel` | Frase resumen de StatusMatch | AlertInputSummary |
| `useScheduleLabel` | Cron string → texto humano | AlertInputSummary, ScheduleEditor |
| `useFormatLabel` | i18n del enum Formatting | BundleEditDialog |
| `useBundleStatus` | Estado de un bundle (ready/no-dest/no-script) | BundleEditDialog, AlertBundleRow |
| `useTreeNode` | Reconoce forma del valor + compone path | JsonTreeNode, XmlTreeNode |
| `useSidebar` | Estado colapso sidebar | AlertSidebar (único) |
| `useCursorInsert` | Insertar en textarea en el caret | PayloadToolbar |
| `useFormatEditor{Payload,Polling,Preview}` | Estado del editor de formato de bundle | FormatEditor |

### 3.3 Huecos y responsabilidades duplicadas

- **`ConditionOperator` phrase-formatting**: existe en `useConditionSummary.ts` (i18n phrase) Y en `shared/polling/message.ts` (`lineFor` — ahora vía Strategy). Aún hay una duplicación semántica: dos sitios contienen la mapa operador→verbo humano.
- **Etiqueta de `TriggerMode`**: código en 3 sitios (`StepTrigger`, `StatusMatchEditor`, `AlertInputSummary`) — ver F-2.
- **`initials(title)`**: 2 implementaciones distintas — ver F-3.
- **`labelFor(source)` pattern**: 2 sitios idénticos — ver F-4.
- **Click-outside**: 4 sitios repiten `addEventListener("click", …)` + `contains` guard — ver F-13.
- **Sin nadie**: no hay validador de entrada en handlers API (B-11). No hay tests (T-10). No hay ADR de decisiones arquitectónicas.

---

## 4. Hallazgos — Backend

### B-1 · `backend.ts` es un monolito multi-verbo · 🟠
- **File**: [`server/api/backend.ts`](server/api/backend.ts) L2–96 (fichero entero).
- **Evidencia**:
  ```ts
  export default defineEventHandler(async (event) => {
    const method = event.node.req.method;
    if (method === "GET") { ... }
    if (method === "POST") { ... }
    if (method === "PUT") { ... }
    if (method === "PATCH") { ... }
    if (method === "DELETE") { ... }
  });
  ```
- **Principio**: SRP. Va contra la convención de Nitro (routing por fichero: `backend.get.ts`, `.post.ts`, …).
- **Remedio**: dividir en 5 ficheros por método.

### B-2 · Manejo de errores inconsistente · 🔴
- **Files**: 18 ocurrencias de `catch (error: any)` en 8 ficheros del backend — contradice la convención del proyecto (`useUnknownInCatchVariables: true` + helper `getErrorMessage`).
- **Formas de error mezcladas**:
  - `backend.ts`: `throw createError({ statusCode: 500, statusMessage: error.message })`.
  - `olvidClient.ts`: `catch → return false` (absorbe silenciosamente).
  - `notifierService.ts`: catch + log + fallback (customStrategy) — bien.
  - `webhooks/[token].ts`: catch + `createError` con status 400/500 mezclados.
- **Principio**: ISP (contrato de error no unificado) + convención del propio proyecto.
- **Remedio**: pasar todos a `catch (error: unknown)` + `getErrorMessage(error, fallback)`; decidir contrato único (throw createError con statusCode semántico vs return `{ok:false, error}`).

### B-3 · `getByToken` no serializa (asimetría LSP) · 🔴
- **File**: [`server/repositories/alertRepository.ts:128–133`](server/repositories/alertRepository.ts).
- **Evidencia**:
  ```ts
  async getByToken(token: string) {
    return await prisma.alertTable.findUnique({
      where: { token },
      include: { bundles: true },
    });
  }
  ```
  Todas las otras lecturas (`getAll`, `getById`, `getActiveScheduled`) hacen `.map(serializeAlert)`.
- **Principio**: LSP (los métodos del mismo repo deben ser sustituibles en cuanto al shape que devuelven).
- **Remedio**: envolver el `findUnique` en `serializeAlert(...)` y actualizar callers.

### B-4 · Fallback duplicado (dead code) · 🟢
- **File**: [`server/utils/engine.ts:69`](server/utils/engine.ts).
- **Evidencia**: `const params = (alert?.alertParams ?? alert?.alertParams ?? {}) as any;` — el mismo campo dos veces como fallback.
- **Principio**: DRY / dead code.
- **Remedio**: simplificar a `(alert?.alertParams ?? {}) as PollingParams | MonitorParams`.

### B-5 · Comentario "side-effect-free" que miente · 🟠
- **File**: [`server/utils/engine.ts`](server/utils/engine.ts) L1–2 vs L81–107.
- **Evidencia**: la cabecera dice *"side-effect-free with respect to alert state (no bundle firing, no baseline persistence)"* pero `test()` llama `alertRepository.upsertLastAlertPayload(...)` y `upsertLastFailedPayload(...)`.
- **Principio**: stale comment (Fowler).
- **Remedio**: actualizar el comment para reflejar que `test()` sí persiste last-payload (para audit trail).

### B-6 · Campo `baselineValue` reutilizado para veredictos · 🟠
- **Files**: [`server/utils/types.ts:26`](server/utils/types.ts), [`server/utils/conditions/evaluator.ts:23`](server/utils/conditions/evaluator.ts).
- **Evidencia**: el shape `EvalResult` define `baselineValue?: any` pero el evaluator devuelve `verdicts` (array de veredictos) en ese campo.
- **Principio**: field repurposing / primitive obsession.
- **Remedio**: renombrar a `verdicts` (o `perFieldBreakdown`), tipar como `Verdict[]`.

### B-7 · `webhooks/[token].ts` — 7 responsabilidades · 🟠
- **File**: [`server/api/webhooks/[token].ts`](server/api/webhooks/[token].ts) L33–129 (129 líneas totales).
- **Responsabilidades**: routing → auth-por-token → parse body → persistir failure → notifier → log success/warning/error → error-mapping HTTP.
- **Principio**: SRP + god function.
- **Remedio**: extraer `verifyToken(token)`, `parseBody(event)`, `shouldNotify(alert)`, `handleError(alert, e)` — el handler queda como orquestador de 20 líneas.

### B-8 · JSON parser deshabilitado (dead code) · 🟢
- **File**: [`server/utils/parsers/index.ts:11`](server/utils/parsers/index.ts).
- **Evidencia**: `// [jsonParser.format]: jsonParser,` (comentado). Aun así el enum `PollingFormat.JSON` existe en `shared/types/polling.ts` — se puede seleccionar en el wizard.
- **Impacto**: una alerta polling con `format: JSON` falla con "No parser available for format JSON".
- **Principio**: dead code + inconsistencia enum ↔ registry.
- **Remedio**: o implementar JSON parser, o quitar el valor del enum.

### B-9 · Nombre de tarea Nitro engañoso · 🟢
- **File**: [`server/tasks/polling/heartbeat.ts:26`](server/tasks/polling/heartbeat.ts) + [`nuxt.config.ts`](nuxt.config.ts) scheduledTasks.
- **Evidencia**: task se llama `polling:heartbeat` pero desde M1c dispatcha también Monitoring.
- **Principio**: nomenclatura.
- **Remedio**: renombrar a `scheduled:heartbeat` (o `sources:heartbeat`) y actualizar la clave en `nuxt.config.ts`.

### B-10 · `_lastHash` referenciado pero nunca escrito ni leído · 🟢
- **File**: [`shared/types/polling.ts:55`](shared/types/polling.ts).
- **Evidencia**: el campo existe en `PollingParams._lastHash?: string` pero `grep -r "_lastHash"` solo lo encuentra en su declaración y en `useSourceBinding` (donde se preserva por si acaso). Nadie escribe ni lee.
- **Remedio**: eliminar el campo del tipo si no hay plan de implementación.

### B-11 · Cero validación de entrada en handlers · 🔴
- **Files**: [`server/api/backend.ts`](server/api/backend.ts), [`server/api/poll/test.post.ts`](server/api/poll/test.post.ts), [`server/api/poll/retrieve.post.ts`](server/api/poll/retrieve.post.ts), [`server/api/webhooks/[token].ts`](server/api/webhooks/[token].ts).
- **Evidencia**:
  ```ts
  // backend.ts POST
  const body = await readBody(event);
  const data = await alertService.createAlert(body); // body: any
  ```
- **Principio**: GRASP Controller — la frontera debe filtrar, no reenviar bruto.
- **Remedio**: introducir Zod (o Valibot) para validar la forma de `AlertModel` en creación / edición. Rechazar con 400 + detalle en `error.data.issues`.

### B-12 · Referencias comentadas a `triggerEngine` (dead code) · 🟢
- **File**: [`server/api/backend.ts`](server/api/backend.ts) L25, L44–45, L67–68, L85 — 7 líneas comentadas mencionando un `triggerEngine.register/unregister` que ya no existe.
- **Remedio**: eliminar; el refactor a `pollingDispatcher` + heartbeat lo hizo obsoleto.

### B-13 · Log incorrecto en HTML parser · 🟢
- **File**: [`server/utils/parsers/html.ts`](server/utils/parsers/html.ts) ~L100.
- **Evidencia**: mensaje de error dice `"[xmlParser] parse failed"` — copiado del xml.ts.
- **Remedio**: cambiar a `"[htmlParser] parse failed"`.

### B-14 · Payload de Monitoring diverge del de Polling · 🟢
- **File**: [`server/services/dispatchers/monitoringStrategy.ts:72–76`](server/services/dispatchers/monitoringStrategy.ts).
- **Evidencia**: Polling entrega el payload parseado al notifier; Monitoring entrega `{status, url}`. Los templates Handlebars deben conocer la fuente para saber qué esperar.
- **Principio**: leaky abstraction menor.
- **Remedio**: documentar contrato de payload por Source en `docs/`, o normalizar (envelope común `{source, data}`).

### B-15 · Códigos HTTP siempre 500 · 🟢
- **Files**: todos los handlers en `server/api/`.
- **Evidencia**: `throw createError({ statusCode: 500, ... })` para cualquier error, incluidos validation errors (deberían ser 400) y not-found (404).
- **Remedio**: mapear semánticamente cuando se implemente B-11 (Zod → 400, no-found → 404, resto → 500).

---

## 5. Hallazgos — Frontera API (subconjunto de B)

Contratos que atraviesan la frontera cliente↔servidor:

| Aspecto | Estado | Referencia |
|---|---|---|
| Validación de entrada | ❌ ausente | B-11 |
| Forma de error unificada | ❌ inconsistente | B-2 |
| Status HTTP semánticos | ❌ todo 500 | B-15 |
| Serialización BigInt | ⚠️ asimétrica | B-3 |
| Rutas por método (Nitro conv.) | ❌ monolito | B-1 |
| Tipos compartidos client↔server | ✅ `#shared/types` funciona bien | — |
| Auto-imports servidor | ✅ | `nuxt.config.ts` |

**Riesgo compuesto**: sin validación + errores 500 opacos, un payload malformado del cliente degrada silenciosamente en el service. Es la primera cosa que un pentest o un usuario curioso encuentra.

---

## 6. Hallazgos — Frontend

### Inventario de componentes (>200 líneas)

| Componente | Líneas | Rol principal | Riesgo |
|---|---|---|---|
| `ConditionEditor.vue` | **1142** | Trigger polling: paths + operator + agg + preview | 🔴 |
| `TestPoll.vue` | 524 | Modal de test-poll con veredictos | 🟠 |
| `StatusMatchEditor.vue` | 463 | Trigger monitoring: codes/range/not-ok + trigger mode | 🟠 |
| `BundleEditDialog.vue` | 409 | Modal fusión: title + destinations + format + preview | 🟠 |
| `DiscussionSelector.vue` | 376 | Dropdown estilo WhatsApp con avatares | 🟠 |
| `AlertSidebar.vue` | 326 | Lista de alertas + filtro | 🟠 |
| `ScheduleEditor.vue` | 292 | Editor cron basic/advanced | 🟢 |
| `FormatEditor.vue` | 265 | Editor de plantilla Handlebars | 🟢 |
| `JsonTreeNodeExp.vue` | 263 | Tree JSON expandible | 🟢 |
| `JsonTreeNode.vue` | 256 | Tree JSON (post-rediseño natural) | 🟢 |
| `AlertWizard.vue` | 256 | Orquestador wizard 3 pasos | 🟠 |
| `AlertView.vue` | 254 | Vista de detalle (view mode) | 🟢 |

### F-1 · `ConditionEditor.vue` — 1142 líneas / 9+ responsabilidades · 🔴
- **File**: [`app/components/condition/ConditionEditor.vue`](app/components/condition/ConditionEditor.vue).
- **Responsabilidades**:
  1. Kind picker (None/Rule).
  2. Chips de watched fields + input manual.
  3. Validación de wildcards contra el snapshot.
  4. Fetch del source (`/api/poll/retrieve`) + parse.
  5. Modal picker con `XmlTreeNode`.
  6. Fila operator + aggregation.
  7. Input de value + gating por operator.
  8. Verdict preview + resumen pass/fail.
  9. Manejo de errores (network, validation, no-match).
- **Principio**: SRP + god component.
- **Remedio**: extraer `useConditionForm` composable (state + patches) + `ConditionKindPicker`, `WatchedFieldsChips`, `ConditionOperatorRow`, `ConditionVerdictSummary` como sub-componentes. Refactor grande (>1 día), impacto muy alto en mantenibilidad.

### F-2 · `TRIGGER_MODE_OPTIONS` duplicado + labels hardcoded · 🔴
- **Files**:
  - [`app/components/alert/wizard/steps/StepTrigger.vue`](app/components/alert/wizard/steps/StepTrigger.vue) L58–78 — array con label + hint hardcoded.
  - [`app/components/monitoring/StatusMatchEditor.vue`](app/components/monitoring/StatusMatchEditor.vue) L113–133 — array casi idéntico con hints ligeramente distintos.
  - [`app/components/alert/view/AlertInputSummary.vue`](app/components/alert/view/AlertInputSummary.vue) L74–81 — `switch` con `// todo i18n` explícito.
- **Evidencia**: mismo mapa `TriggerMode → label` en 3 sitios distintos, ninguno usa i18n.
- **Principio**: DRY + shotgun surgery (añadir un TriggerMode nuevo = editar 3 sitios).
- **Remedio**: extraer a `useTriggerModeOptions()` composable + claves `wizard.triggerMode.labels.*` y `.hints.*` en i18n.

### F-3 · `initials(title)` duplicado con implementaciones distintas · 🟠
- **Files**:
  - [`app/components/alert/AlertSidebar.vue`](app/components/alert/AlertSidebar.vue) L34–37 — primeros 3 chars.
  - [`app/components/bundle/DiscussionSelector.vue`](app/components/bundle/DiscussionSelector.vue) L88–92 — iniciales por palabra (hasta 2).
- **Evidencia**: dos algoritmos, mismo propósito visual (fallback de avatar).
- **Principio**: DRY + inconsistencia UX.
- **Remedio**: extraer a `~/utils/initials.ts`; decidir un solo algoritmo o parametrizar (`strategy: "prefix" | "words"`).

### F-4 · `labelFor(source)` con i18n-fallback duplicado · 🟠
- **Files**:
  - [`app/components/input-source/InputSourceSelector.vue`](app/components/input-source/InputSourceSelector.vue) — helper local.
  - [`app/components/alert/wizard/steps/StepGeneral.vue`](app/components/alert/wizard/steps/StepGeneral.vue) — `computed sourceLabel`, misma lógica.
- **Remedio**: extraer a `useSourceLabel()` en composables.

### F-5–F-9 · Huecos i18n con strings ingleses hardcoded · 🟠

Tabla completa:

| String | File:line | Sugerencia clave |
|---|---|---|
| `"Every time" / "Once" / "Once + on recovery"` | StepTrigger:65-77, StatusMatchEditor:120-132, AlertInputSummary:76-81 | `wizard.triggerMode.labels.*` |
| Todos los hints de trigger mode | StepTrigger/StatusMatchEditor | `wizard.triggerMode.hints.*` |
| `"Must be an HTTP code between 100 and 599."` | StatusMatchEditor:77 | `monitorEditor.match.codesValidation.range` |
| `"Already added."` | StatusMatchEditor:81 | `monitorEditor.match.codesValidation.duplicate` |
| `"Status logs"` | AlertLogs.vue:45 | `editor.view.dividers.statusLogs` |
| `"No polls recorded yet."` | AlertLogs.vue:48 | `editor.logs.empty` |
| `"Configuration"` | AlertInputSummary.vue:98 | `editor.view.blocks.configuration` |
| `"Edit bundle"` | AlertBundleRow.vue:71 | `bundleCard.editTitle` (ya existe en i18n, no se usa) |
| `"No destinations" / "Custom format set but no script" / "Ready"` | useBundleStatus.ts:19-29 | `bundleStatus.*` (composable marca `// Pure — no i18n yet`) |

### F-10 · Click-outside repetido en 4 componentes · 🟠
- **Files**: `InputSourceSelector.vue`, `DiscussionSelector.vue`, `ui/Select.vue`, `ui/LanguageToggle.vue`.
- **Evidencia**: mismo patrón `addEventListener("click") + containerRef.contains(target)` copiado.
- **Remedio**: `useClickOutside(refEl, callback)` composable. ~4h de refactor, ~40 líneas ahorradas.

### F-11 · `fetchAlerts()` invocado desde 4 sitios (refetch storm) · 🟠
- **Files**: `default.layout`, `AlertView.vue`, `AlertWizard.vue`, `pages/alerts/[id].vue`.
- **Evidencia**: cada mount o navegación dispara refetch. Sin caché ni deduplicación.
- **Remedio**: usar `useState` de Nuxt con TTL o `useAsyncData` para SWR. Alternativamente aceptarlo si el volumen es bajo.

### F-12 · Prop drilling redundante en `BundleEditDialog` · 🟠
- **File**: [`app/components/bundle/BundleEditDialog.vue`](app/components/bundle/BundleEditDialog.vue) L30–43.
- **Evidencia**: recibe `alertContext` (contiene `input`), `alertParams` (derivable de `alertContext`), `inputSource` (== `alertContext.input`). Tres props para el mismo eje de información.
- **Principio**: ISP.
- **Remedio**: consolidar a `alertContext` únicamente y derivar el resto internamente.

### F-13 · `useWizardSteps` exporta aliases transicionales · 🟢
- **File**: [`app/composables/useWizardSteps.ts`](app/composables/useWizardSteps.ts) L160–161.
- **Evidencia**:
  ```ts
  isPollingConfigComplete: isSourceConfigComplete,  // alias
  isConditionComplete: isTriggerComplete,            // alias
  ```
- **Principio**: transitional-alias smell — dos nombres para lo mismo.
- **Remedio**: `grep` los consumers de los nombres viejos, migrar, eliminar aliases.

### F-14 · `JsonTreeNode` vs `JsonTreeNodeExp` (código muerto) · 🟢
- **Files**: `app/components/payload/JsonTreeNode.vue`, `JsonTreeNodeExp.vue`.
- **Evidencia**: `PayloadPanel.vue:112–127` usa `JsonTreeNodeExp` con `JsonTreeNode` comentado a lado. `ConditionEditor.vue` usa solo `XmlTreeNode` para todos los formatos.
- **Remedio**: si `JsonTreeNode` no está en uso, eliminarlo. Si es fallback, documentarlo.

### F-15 · `useBundleStatus` español-only marcada como TODO · 🟢
- **File**: [`app/composables/useBundleStatus.ts`](app/composables/useBundleStatus.ts) L19–29.
- **Evidencia**: labels hardcoded + comment `// Pure — no i18n yet`.
- **Remedio**: cablear vía `useI18n()`.

### F-16 · CSS: tokens vs hex mezclados · 🟢
- **Files**: `AlertLogs.vue`, `AlertBundleRow.vue`, `LoadTemplate.vue`, `DiscussionSelector.vue`.
- **Evidencia**:
  ```css
  /* Buen patrón — token con fallback: */
  background: color-mix(in srgb, var(--color-danger, #ef4444) 12%, transparent);

  /* Anti-patrón — hex directo: */
  background: #1e1e22;
  border: 1px solid #3f3f46;
  ```
- **Remedio**: mover los hex del editor de código a tokens (`--color-code-bg`, `--color-code-border`) — así soportan `prefers-color-scheme`.

### F-17 · Componentes de árbol XML/JSON — click zones y selección · 🟢
- **Files**: `XmlTreeNode.vue`, `JsonTreeNode.vue`.
- **Estado**: recién rediseñados en esta sesión. Usan `useTreeNode` composable compartido. Emit de paths correctos con `.#text` y `.@_attr`. Selección visible por-attr y por-text. Documentado aquí como *"lo que estaba mal ya se arregló"*.

---

## 7. Hallazgos — Tipos, enums e interfaces

### T-1 · Censo de `any` · 🟠
**62 ocurrencias** de `: any` / `as any` a través de `shared/` + `server/` + `app/`.

**Justificadas (JSON payload es genuinamente polimórfico)**:
- `shared/types/condition.ts` — `observed: any; baseline?: any` en Verdict.
- `shared/condition/pathExpand.ts` — walker genérico.
- `shared/polling/message.ts` — formateo agnóstico.

**Perezosas (evitables)**:
- `app/composables/useAlertForm.ts` — `(a as any).alertParams`, `b.discussion_list as any`. Ya hay accessors tipados (`getPollingParams`, `getMonitorParams`).
- `app/components/alert/AlertWizard.vue` L99 — `const ap: any = { ...(form.value.alertParams ?? {}) }`. Pollutes dirty-check.
- `server/services/notifierService.ts` — `alert: any, bundle: any, payload: any` en signatures.
- `server/services/alertService.ts` — `data: any` en `createAlert / updateAlert`. Justo la frontera donde debería haber validación (B-11).

### T-2 · Patrón `const X = {...} as const` — consistencia ✅ · 🟢
Todos los enums (Source, AlertStatus, Formatting, PollingFormat, TriggerMode, ConditionKind, ConditionOperator, ConditionAggregation, LogStatus) siguen el patrón. **Zero drift**. Ningún `enum` de TS a la vista.

### T-3 · Inconsistencias de naming

#### T-3.1 · Typo `formating` propagado a 30 refs en 14 ficheros · 🔴
- **Origin**: `prisma/schema.prisma` L38 `formating String` — la columna DB está mal escrita.
- **Propagación**: `Bundle.formating` en el modelo → `BundleModel.formating` en el tipo → 30 usos en composables + componentes + repos + services + templates.
- **Coste de arreglar**: migración SQL renaming column + regen Prisma client + find/replace en 30 sitios.
- **Recomendación**: pagar el coste ahora que aún es viable, o documentar como deuda-conocida en `docs/` y aceptarlo.

#### T-3.2 · Prop `alertaInicial` en español · 🟢
- **File**: [`app/components/alert/AlertWizard.vue`](app/components/alert/AlertWizard.vue) L29.
- **Evidencia**: `alertaInicial?: AlertModel | null` — resto del código es inglés.
- **Remedio**: renombrar a `initialAlert`. Cambio trivial.

#### T-3.3 · Fichero `statusLog.ts` contiene tipo `AlertLog` · 🟢
- **File**: `shared/types/statusLog.ts` exporta `AlertLog`.
- **Remedio**: renombrar a `alertLog.ts` (o mantener por historia; anotar).

#### T-3.4 · Columna `discussion_list` snake_case en un mar camelCase · 🟢
- **File**: `prisma/schema.prisma` L37.
- **Resto**: `alertId`, `createdAt`, `custom_script` (también snake), `alertParams`. Mezcla dentro del propio schema.
- **Remedio**: migración a `discussionList` si se hace la limpieza de `formating`.

### T-4 · Ubicación de interfaces Strategy

Cuatro interfaces Strategy en el proyecto:

| Interface | Ubicación | Justificación |
|---|---|---|
| `DispatchStrategy` | ✅ `shared/types/dispatchStrategy.ts` | Compartida por dispatcher + tests futuros |
| `OperatorStrategy` | ✅ `shared/types/operatorStrategy.ts` | Compartida por evaluator (client+server) |
| `AggregatorStrategy` | ✅ `shared/types/aggregatorStrategy.ts` | Ídem |
| `FormattingStrategy` | ⚠️ `server/services/formatters/formattingStrategy.ts` | **Fuera de `shared/types` — asimetría** |

**T-4.1 · `FormattingStrategy` fuera de `shared/types` · 🟢**  
Justificable si es server-only, pero rompe la simetría del catálogo Strategy. Migrar a `shared/types/formattingStrategy.ts` para consistencia; el server lo importa igual.

**T-4.2 · `EvalResult` (server) vs `EvaluationResult` (shared) — duplicación conceptual · 🟢**  
`shared/types/condition.ts` define `EvaluationResult` (resultado completo con verdicts). `server/utils/types.ts` define `EvalResult` (subset). Ambos coexisten y confunden.  
**Remedio**: documentar por qué existen los dos (uno completo, otro para el test panel) o fusionar.

### T-5 · Uniones discriminadas

**T-5.1 · `AlertParams` con discriminador externo · 🟠**  
`type AlertParams = PollingParams | MonitorParams | undefined`. El discriminador (`alert.input`) vive **fuera** de la union. TS no puede narrowear sin el accessor.

- Buenos usos: `getPollingParams(alert)` / `getMonitorParams(alert)` — 30+ call sites.
- Malos usos: `(a as any).alertParams` — 15+ call sites (ver T-1).

**Remedio**: mantener el diseño (una migración a discriminador interno cambiaría la BD), pero introducir un lint rule o code-review que rechace lecturas de `alertParams` sin accessor.

**T-5.2 · `StatusMatch` con discriminador interno · 🟢**  
`type StatusMatch = { kind: "codes"; ... } | { kind: "range"; ... } | { kind: "not-ok" }`. Contraste positivo: TS narrow forzoso, cero `as any` en call sites.

### T-6 · Runtime state en tipos de config · 🟠

Los campos `_lastFired`, `_lastStatus`, `_baseline`, `_lastPolledAt`, `_lastHash` viven **dentro** de `PollingParams` / `MonitorParams` — el mismo shape que edita el usuario en el wizard.

**Riesgos**:
- **Dirty-check pollution**: `useDirtyGuard` hace `JSON.stringify(form)` y compara. Cada poll muta runtime fields → el form aparece "dirty" sin que el usuario haya tocado nada.
- **UI debe ignorarlos**: sin garantía de tipo. Un `v-model` sobre `alertParams` los expondría.
- **Persistencia acoplada**: la misma columna JSON almacena config editable + estado runtime.

**Remedio (rebañable, no urgente)**: separar `PollingConfig` de `PollingRuntime`; el store persiste ambos pero el form solo lee/edita `PollingConfig`.

### T-7 · Schema Prisma — observaciones

- **T-7.1 · `input String?`** — free-text sin enum ni FK. Documentado en un comment del schema; aceptable dada la cantidad limitada de sources.
- **T-7.2 · `alertParams Json?`** — sin validación DB. Cualquier row corrupto degrada silenciosamente vía `migrateCondition`.
- **T-7.3 · `AlertLog` 200-row cap en repo, no en DB** — riesgo bajo (el índice `(alertId, createdAt DESC)` ayuda a lecturas) pero un bug en `alertLogRepository.insert` rompería el cap. Aceptable con nota.
- **T-7.4 · `token String? @unique @default(uuid())`** — nullable + unique + default UUID. Combinación rara. Si algún row escribe `null`, el UNIQUE puede quejarse. **Remedio**: cambiar a `token String @unique @default(uuid())`.
- **T-7.5 · Sin índice en `input`** — el heartbeat filtra `WHERE input IN (Polling, Monitoring) AND status = Active` cada minuto. Índice compuesto `(status, input)` aceleraría.

---

## 8. Hallazgos — Estructura del proyecto

### T-8.1 · Auto-imports con `pathPrefix: false` · 🟢

`nuxt.config.ts` mapea:
```ts
{ path: "~/components/ui", pathPrefix: false },
{ path: "~/components/alert", pathPrefix: false },
{ path: "~/components/alert/view", pathPrefix: false },
{ path: "~/components/alert/wizard", pathPrefix: false },
{ path: "~/components/alert/wizard/steps", pathPrefix: false },
{ path: "~/components/input-source", pathPrefix: false },
{ path: "~/components/bundle", pathPrefix: false },
{ path: "~/components/bundle/format-editor", pathPrefix: false },
{ path: "~/components/condition", pathPrefix: false },
{ path: "~/components/monitoring", pathPrefix: false },
{ path: "~/components/payload", pathPrefix: false },
```

**Riesgo**: dos ficheros con el mismo nombre en carpetas distintas → el segundo silenciosamente pierde. **Colisión actual**: cero (verificado). **Mitigación**: eslint rule custom o revisión en cada PR.

### T-8.2 · `shared/polling/matcher.ts` en carpeta polling pero es exclusivo de Monitoring · 🟢

El matcher HTTP-status vive en `shared/polling/`. Confuso. **Remedio**: mover a `shared/monitoring/` o renombrar el folder de polling a `shared/scheduled/`.

### T-8.3 · Frontera `shared/polling` vs `shared/condition` · 🟢

`shared/polling/`: message.ts, scheduler.ts, matcher.ts.  
`shared/condition/`: conditionEvaluator.ts, migrate.ts, pathExpand.ts, operators/*, aggregators/*.

Nombres OK pero la línea es fina. `message.ts` mezcla polling+monitoring (via el notifier). **Aceptable** como está.

### T-8.4 · `server/utils` vs `server/services` — frontera difusa · 🟢

`server/utils/engine.ts` orquesta fetch + parse + evaluate — es un servicio disfrazado de utility. Bajo impacto. Puede reubicarse en `server/services/pollingEngine.ts` si se toca en un refactor futuro.

### T-9 · Templates de payload (registry pattern) · 🟢

`shared/payloadTemplates/index.ts` — 6 templates JSON (GitHub push/issue/PR/workflow, GitLab pipeline, Grafana, Sentry). Registry limpio. **Sano**.

### T-10 · `package.json` scripts — falta typecheck y test · 🔴

| Script | Existe |
|---|---|
| `dev` | ✅ |
| `build` | ✅ |
| `generate` | ✅ |
| `preview` | ✅ |
| `lint` / `lint:fix` | ✅ |
| `prettier` / `prettier:check` | ✅ |
| **`typecheck`** | ❌ |
| **`test`** | ❌ |

`tsconfig.json` tiene `strict: true` + `useUnknownInCatchVariables: true` — la configuración está bien; solo falta el script que lo ejecute.

**Remedio**:
```json
"typecheck": "nuxi typecheck",
"test": "vitest"
```
Y en CI: `npm run lint && npm run typecheck && npm run test`.

---

## 9. Lo que está sano (patrones a preservar)

Materia de examen — estos son ejemplos concretos de aplicación correcta:

- **Strategy + Factory (Tema 5)** — `dispatcherFactory` + `pollingStrategy`/`monitoringStrategy`; `formatterFactory` + `unformatted/simple/custom/pollingDefault`; `operatorFactory` + 5 estrategias; `aggregatorFactory` + 6 estrategias. Cada uno es un ejemplo distinto del mismo patrón, aplicado a un enum diferente. **OCP en su forma más limpia**.
- **Repository puro (Tema 4)** — `alertRepository` / `alertLogRepository` no contienen reglas de negocio. Las reglas viven en `alertService` (Tema 2 GRASP Expert).
- **Composables con contratos claros** — `useAlertForm` posee el modelo; `useAlertActions` las mutaciones; `useDirtyGuard` la vigilancia. División smart/dumb clara en la mayoría de casos.
- **Auto-imports funcionando** — `nuxt.config.ts` bien configurado; el server no importa `alertRepository` manualmente en ningún fichero.
- **Accessors tipados** — `getPollingParams(alert)` / `getMonitorParams(alert)` reducen `as any` en el 90% de call sites.
- **`useTreeNode` composable compartido** — extracción reciente que elimina duplicación entre XmlTreeNode y JsonTreeNode.
- **AlertLog cap enforced in repo** — el 200-row cap se documenta y se aplica en `alertLogRepository.insert`.
- **`olvidClient` singleton** — instancia única a nivel módulo (una alegación anterior sobre "per-call" era errónea).
- **Registry de templates de payload** — single source of truth, no drift detectado.

---

## 10. Plan de remediación priorizado

Ordenado por (impacto × facilidad). El "coste" es horas gruesas, el "impacto" cualitativo.

| # | Hallazgo | Categoría | Coste | Impacto | Depende de |
|---|---|---|---|---|---|
| 1 | **F-2** · Extraer `TRIGGER_MODE_OPTIONS` + i18n | DRY + i18n | 2h | Alto | — |
| 2 | **B-4** · Quitar fallback duplicado en engine.ts | Dead code | 5min | Bajo pero fácil | — |
| 3 | **B-3** · `getByToken` con `serializeAlert` | LSP | 30min | Alto | — |
| 4 | **T-10** · Añadir scripts `typecheck` y `test` | Higiene | 30min | Alto | — |
| 5 | **F-5..F-9** · Batch de claves i18n hardcoded | i18n | 3h | Medio | — |
| 6 | **F-10** · `useClickOutside()` composable | DRY | 4h | Medio | — |
| 7 | **B-2** · Migrar `catch (error: any)` → `unknown + getErrorMessage` | Convención | 2h | Medio | — |
| 8 | **B-11** · Validación Zod en handlers | Seguridad | 6h | Alto | — |
| 9 | **B-15** · Códigos HTTP semánticos | API | 1h | Bajo | B-11 |
| 10 | **F-1** · Descomposición ConditionEditor en 5 sub-componentes | SRP | 2 días | Muy alto | — |
| 11 | **T-6** · Separar `PollingConfig` de `PollingRuntime` | Coupling | 6h | Medio | (schema) |
| 12 | **T-3.1** · Rename `formating` → `formatting` (si se paga la migración) | Naming | 4h | Bajo pero visible | migración BD |

**Camino corto recomendado (1-2 días de trabajo)**: 1, 2, 3, 4, 5, 7 — cierra ~80% del ruido cosmético + añade quality gates + un fix LSP concreto. Deja el refactor grande (10) para una sesión dedicada.

---

## 11. Anexo — Anclaje al temario de TDS

Mapeo de categorías de hallazgo al temario de *Tecnologías de Desarrollo Software* para que el documento sirva como material de estudio:

| Hallazgos | Tema | Sección |
|---|---|---|
| B-1, B-7, F-1, F-11 | Tema 2 | SOLID §SRP — "una razón para cambiar" |
| B-8, F-13, F-14, T-6 | Tema 5 | Patrones — reconocer código obsoleto vs vivo |
| B-3 | Tema 2 | SOLID §LSP — sustituibilidad entre métodos del mismo repo |
| B-11 | Tema 2 | GRASP Controller — la frontera debe filtrar |
| F-2, F-3, F-4, F-10 | Tema 6 | Taller de patrones — DRY como precursor de Strategy |
| T-1, T-5.1 | Tema 3 | POO — narrowing seguro vs `any` como escape |
| T-2, T-5.2 | Tema 3 | Patrones idiomáticos TS — `as const` + discriminated unions |
| T-4.1, T-4.2 | Tema 4 | Modelado de datos — placement y duplicación conceptual |
| T-7 | Tema 4 | Representación de datos — schema como contrato |
| §9 (todo el catálogo) | Tema 5 | Strategy + Factory + Repository + Registry — ejemplos vivos |
| T-10 | Tema 1 | SDLC — quality gates |

Cada hallazgo cita el fichero exacto — cualquiera de ellos sirve como ejemplo para una respuesta de examen "cita una violación de X en un proyecto real".
