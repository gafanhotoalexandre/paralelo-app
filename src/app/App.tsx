import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  BookOpen,
  LoaderCircle,
  ChevronRight,
  CircleHelp,
  Copy,
  Info,
  LockKeyhole,
  Play,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ArrayPolicy } from "@/components/ArrayPolicy";
import { IconButton } from "@/components/IconButton";
import { Inspector, RiskBadge } from "@/components/Inspector";
import { JsonEditor, type EditorHandle } from "@/components/JsonEditor";
import {
  examples,
  initialExample,
  type ExampleDocument,
} from "@/demo/examples";
import { useWorkbench } from "./useWorkbench";
import { changeLabels, filterDifferences, PAGE_SIZE } from "./results";
import type {
  ChangeKind,
  JsonDifference,
  Risk,
  Side,
  SourceRange,
} from "@/core/models";

type Panel = Side | "differences";
type Overlay = "examples" | "detail" | "help" | null;
function useViewport() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return width <= 720 ? "mobile" : width <= 1020 ? "tablet" : "desktop";
}
export function App() {
  const before = useRef<EditorHandle>(null);
  const after = useRef<EditorHandle>(null);
  const viewport = useViewport();
  const [example, setExample] = useState(initialExample);
  const [risk, setRisk] = useState<Risk | "all">("all");
  const [kind, setKind] = useState<ChangeKind | "all">("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<JsonDifference | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [sheetKind, setSheetKind] = useState<Exclude<Overlay, null>>("help");
  const [panel, setPanel] = useState<Panel>("before");
  const [expanded, setExpanded] = useState<Side | null>(null);
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const lastEditor = useRef<Side>("before");
  const lastTrigger = useRef<HTMLElement | null>(null);
  const pendingLocation = useRef<{ side: Side; range: SourceRange } | null>(
    null,
  );
  const refs = { before, after };
  function notify(message: string) {
    clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = setTimeout(() => setNotice(""), 4500);
  }
  useEffect(() => () => clearTimeout(noticeTimer.current), []);
  const workbench = useWorkbench(refs, notify);
  const { mode, result, stale, busy, issues, operationError } = workbench;
  const hasResult = result !== null;
  const comparedMode = result?.mode ?? mode;
  const differences = result?.differences ?? [];
  const filtered = filterDifferences(differences, risk, kind);
  const selectedIndex = selected
    ? filtered.findIndex((d) => d.id === selected.id)
    : -1;
  useEffect(() => {
    if (!result) return;
    setRisk("all");
    setKind("all");
    setPage(0);
    setSelected(null);
    setOverlay(null);
    setExpanded(null);
    if (window.innerWidth <= 1020) setPanel("differences");
  }, [result]);
  useEffect(() => {
    const side = issues.some((e) => e.side === "before")
      ? "before"
      : issues.some((e) => e.side === "after")
        ? "after"
        : null;
    if (!side) return;
    setExpanded(null);
    setPanel(side);
    lastEditor.current = side;
    requestAnimationFrame(() => refs[side].current?.focus());
  }, [issues]);
  function open(which: Exclude<Overlay, null>) {
    lastTrigger.current = document.activeElement as HTMLElement;
    setSheetKind(which);
    setOverlay(which);
  }
  function loadExample(next: ExampleDocument) {
    if (!workbench.setDocuments(next.before, next.after)) return;
    setExample(next);
    setOverlay(null);
    void workbench.compare();
  }
  function clear() {
    if (busy) return;
    workbench.clear();
    setSelected(null);
    setRisk("all");
    setKind("all");
    setPage(0);
    setExpanded(null);
    setPanel("before");
    requestAnimationFrame(() => before.current?.focus());
  }
  async function copy(text: string, message = "Conteúdo copiado.") {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("unavailable");
      await navigator.clipboard.writeText(text);
      notify(message);
    } catch {
      notify(
        "A cópia não está disponível neste navegador. Selecione o texto e copie pelo teclado.",
      );
    }
  }
  function locate(side: Side) {
    const snapshot = selected?.[side];
    if (!snapshot || !workbench.canLocate(side, snapshot)) {
      notify("Compare novamente para localizar esta diferença.");
      return;
    }
    pendingLocation.current = { side, range: snapshot.range };
    setExpanded(null);
    setPanel(side);
    lastEditor.current = side;
    setOverlay(null);
  }
  function navigate(offset: number) {
    const index = selectedIndex + offset,
      next = filtered[index];
    if (next) {
      setSelected(next);
      setPage(Math.floor(index / PAGE_SIZE));
    }
  }
  function changePanel(value: string) {
    setExpanded(null);
    if (value === "documents") setPanel(lastEditor.current);
    else {
      setPanel(value as Panel);
      if (value !== "differences") lastEditor.current = value as Side;
    }
  }
  function visible(side: Side) {
    if (expanded) return expanded === side;
    if (viewport === "desktop") return true;
    if (panel === "differences") return false;
    return viewport === "tablet" || panel === side;
  }
  function errorFor(side: Side) {
    return issues
      .filter((e) => e.side === side)
      .map((e) => e.message)
      .join(" ");
  }
  return (
    <TooltipProvider delayDuration={350}>
      <div
        className="app"
        onKeyDown={(event) => {
          if (
            overlay ||
            busy ||
            event.repeat ||
            event.nativeEvent.isComposing ||
            (event.target instanceof HTMLElement &&
              event.target.closest('[role="dialog"], [role="listbox"]'))
          )
            return;
          if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault();
            void workbench.compare();
          }
          if (event.key === "Escape" && expanded) setExpanded(null);
        }}
      >
        <a className="skip-link" href="#workbench">
          Ir para a bancada
        </a>
        <header className="topbar">
          <a href="#" className="brand" aria-label="Paralelo — início">
            <img
              className="brand-mark"
              src="/brand-mark.svg"
              alt=""
              aria-hidden="true"
            />
            <span>Paralelo</span>
          </a>
          <span className="brand-caption">JSON / comparação</span>
          <div className="top-right">
            <span className="signature">
              uma ferramenta de <strong>Alexandre Martins</strong>
            </span>
            <Button
              variant="ghost"
              aria-label="Como funciona"
              disabled={Boolean(busy)}
              onClick={() => open("help")}
            >
              <CircleHelp data-icon="inline-start" />
              <span>Como funciona</span>
            </Button>
          </div>
        </header>
        <section className="work-heading">
          <div>
            <h1>Comparar documentos</h1>
            <p>Diferenças na estrutura e no conteúdo de duas respostas JSON.</p>
          </div>
          <Badge variant="preview">
            {busy
              ? "Processando…"
              : stale && result
                ? "Resultado desatualizado"
                : result
                  ? "Comparação concluída"
                  : "Pronto para comparar"}
          </Badge>
        </section>
        <div className="command" aria-label="Ferramentas de comparação">
          <div className="command-left">
            <span className="control-label">Modo</span>
            <ToggleGroup
              type="single"
              value={mode}
              disabled={Boolean(busy)}
              onValueChange={(value) => {
                if (value) workbench.setMode(value as "structural" | "content");
              }}
              aria-label="Modo de comparação"
            >
              <ToggleGroupItem value="structural">Estrutural</ToggleGroupItem>
              <ToggleGroupItem value="content">Conteúdo</ToggleGroupItem>
            </ToggleGroup>
            <ArrayPolicy disabled={Boolean(busy)} />
          </div>
          <div className="command-right">
            <Button
              variant="outline"
              disabled={Boolean(busy)}
              onClick={() => open("examples")}
            >
              <BookOpen data-icon="inline-start" />
              <span>Exemplos</span>
            </Button>
            <Button
              variant="outline"
              disabled={Boolean(busy)}
              onClick={workbench.swap}
              aria-label="Inverter documentos"
            >
              <ArrowRightLeft data-icon="inline-start" />
              <span className="action-label">Inverter</span>
            </Button>
            <Button
              variant="ghost"
              disabled={Boolean(busy)}
              onClick={clear}
              aria-label="Limpar documentos"
            >
              <Trash2 data-icon="inline-start" />
              <span className="action-label">Limpar</span>
            </Button>
            <Button
              disabled={Boolean(busy)}
              onClick={() => {
                void workbench.compare();
              }}
            >
              <Play data-icon="inline-start" />
              Comparar<kbd>↵</kbd>
            </Button>
          </div>
        </div>
        <div className="operation-feedback" aria-live="polite">
          {busy ? (
            <>
              <LoaderCircle className="processing-spinner" />
              <span>
                {busy === "compare"
                  ? "Comparando documentos…"
                  : busy === "format"
                    ? "Formatando JSON…"
                    : busy === "markdown"
                      ? "Gerando relatório…"
                      : "Importando documento…"}
              </span>
              <Button variant="ghost" size="sm" onClick={workbench.cancel}>
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <Info />
              <span>
                {operationError ||
                  issues
                    .filter((e) => !e.side)
                    .map((e) => e.message)
                    .join(" ") ||
                  "Até 1 MiB por documento. A análise compara amostras JSON."}
              </span>
            </>
          )}
        </div>
        <Tabs
          value={
            viewport === "tablet" && panel !== "differences"
              ? "documents"
              : panel
          }
          onValueChange={changePanel}
          className="workspace-tabs"
        >
          <TabsList aria-label="Áreas da bancada">
            {viewport === "tablet" ? (
              <TabsTrigger value="documents" aria-controls="documents">
                Documentos
              </TabsTrigger>
            ) : (
              <>
                <TabsTrigger value="before" aria-controls="editor-before">
                  Original
                </TabsTrigger>
                <TabsTrigger value="after" aria-controls="editor-after">
                  Atualizado
                </TabsTrigger>
              </>
            )}
            <TabsTrigger value="differences" aria-controls="panel-differences">
              Diferenças <span className="tab-count">{differences.length}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <main
          id="workbench"
          className="bench"
          data-expanded={expanded ?? ""}
          tabIndex={-1}
        >
          <section
            className="documents"
            id="documents"
            role="tabpanel"
            aria-label="Documentos"
            hidden={!visible("before") && !visible("after")}
          >
            <JsonEditor
              ref={before}
              side="before"
              initialText={initialExample.before}
              visible={visible("before")}
              expanded={expanded === "before"}
              stale={stale || !hasResult}
              busy={Boolean(busy)}
              error={errorFor("before")}
              onFormat={() => {
                void workbench.format("before");
              }}
              onImport={(file) => {
                void workbench.importFile("before", file);
              }}
              onChange={() => workbench.changed("before")}
              onFocus={() => {
                lastEditor.current = "before";
              }}
              onExpand={() =>
                setExpanded(expanded === "before" ? null : "before")
              }
              onCopy={(text) => {
                void copy(text);
              }}
              onNotice={notify}
            />
            <JsonEditor
              ref={after}
              side="after"
              initialText={initialExample.after}
              visible={visible("after")}
              expanded={expanded === "after"}
              stale={stale || !hasResult}
              busy={Boolean(busy)}
              error={errorFor("after")}
              onFormat={() => {
                void workbench.format("after");
              }}
              onImport={(file) => {
                void workbench.importFile("after", file);
              }}
              onChange={() => workbench.changed("after")}
              onFocus={() => {
                lastEditor.current = "after";
              }}
              onExpand={() =>
                setExpanded(expanded === "after" ? null : "after")
              }
              onCopy={(text) => {
                void copy(text);
              }}
              onNotice={notify}
            />
          </section>
          <Inspector
            visible={
              !expanded && (viewport === "desktop" || panel === "differences")
            }
            hasResult={hasResult}
            busy={Boolean(busy)}
            onExport={() => {
              void workbench.exportMarkdown();
            }}
            stale={stale}
            mode={comparedMode}
            differences={differences}
            filtered={filtered}
            risk={risk}
            kind={kind}
            page={page}
            selected={selected?.id ?? null}
            onRisk={(value) => {
              setRisk(value);
              setPage(0);
            }}
            onKind={(value) => {
              setKind(value);
              setPage(0);
            }}
            onPage={setPage}
            onSelect={(difference) => {
              setSelected(difference);
              open("detail");
            }}
            onExamples={() => open("examples")}
          />
        </main>
        <footer className="foot">
          <span>
            <LockKeyhole />
            Processamento local. Seus JSONs não são enviados.
          </span>
          <span className="footer-status">
            {stale && hasResult
              ? "Resultado desatualizado"
              : hasResult
                ? "Resultado atualizado"
                : "Pronto para comparar"}
            <kbd>Ctrl / ⌘ + Enter</kbd>
          </span>
        </footer>
        <Sheet
          open={overlay !== null}
          onOpenChange={(value) => {
            if (!value) setOverlay(null);
          }}
        >
          <SheetContent
            side={sheetKind === "examples" ? "left" : "right"}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              const target = pendingLocation.current;
              pendingLocation.current = null;
              if (target)
                requestAnimationFrame(() =>
                  refs[target.side].current?.locate(target.range),
                );
              else if (sheetKind === "detail" && selected)
                document
                  .getElementById(`difference-${differences.indexOf(selected)}`)
                  ?.focus();
              else if (lastTrigger.current?.isConnected)
                lastTrigger.current.focus();
            }}
          >
            <SheetHeader>
              <SheetTitle>
                {sheetKind === "examples"
                  ? "Carregar exemplo"
                  : sheetKind === "help"
                    ? "Como funciona"
                    : "Detalhe da diferença"}
              </SheetTitle>
              <SheetDescription>
                {sheetKind === "examples"
                  ? "Substitui os dois documentos e apresenta o resultado no modo selecionado."
                  : sheetKind === "help"
                    ? "O que você pode experimentar nesta bancada."
                    : `Diferença ${selectedIndex + 1} de ${filtered.length} no filtro atual.`}
              </SheetDescription>
            </SheetHeader>
            <div className="drawer-body">
              {sheetKind === "examples" && (
                <>
                  <p className="drawer-intro">
                    Dados fictícios para explorar a interface.
                  </p>
                  <div className="example-list">
                    {examples.map((item) => (
                      <Button
                        variant="row"
                        className="example-card"
                        key={item.id}
                        onClick={() => loadExample(item)}
                      >
                        <span className="example-letter">{item.letter}</span>
                        <span>
                          <strong>{item.title}</strong>
                          <span>{item.subtitle}</span>
                          <small>
                            {item.id === example.id
                              ? "Exemplo atual"
                              : "Carregar cenário"}
                          </small>
                        </span>
                        <ChevronRight />
                      </Button>
                    ))}
                  </div>
                </>
              )}
              {sheetKind === "help" && (
                <div className="help-content">
                  <section>
                    <h3>Comece pelos exemplos</h3>
                    <p>
                      Carregue um cenário fictício para comparar
                      automaticamente. Para seus documentos, escolha Estrutural
                      ou Conteúdo e clique em Comparar.
                    </p>
                  </section>
                  <section>
                    <h3>Leia por diferença</h3>
                    <p>
                      Combine os filtros, abra um item e localize seu valor em
                      cada documento. No modo Conteúdo, a configuração de
                      serviço também permite experimentar a paginação.
                    </p>
                  </section>
                  <section>
                    <h3>Edite com liberdade</h3>
                    <p>
                      Os editores são reais. Você pode digitar, importar UTF-8,
                      copiar, desfazer e ampliar. Alterações tornam o resultado
                      anterior desatualizado. Compare novamente para atualizar o
                      resultado.
                    </p>
                  </section>
                  <section>
                    <h3>Arrays e classificações</h3>
                    <p>
                      A análise compara arrays por índice. Reordenações podem
                      gerar diferenças. “Informativa” não garante
                      compatibilidade; uma amostra não comprova quebra de
                      contrato.
                    </p>
                  </section>
                  <section className="help-local">
                    <LockKeyhole />
                    <div>
                      <h3>Documentos neste navegador</h3>
                      <p>
                        Sem armazenamento, histórico ou envio dos seus JSONs.
                        Formate cada documento separadamente e exporte todas as
                        diferenças em Markdown.
                      </p>
                    </div>
                  </section>
                </div>
              )}
              {sheetKind === "detail" && selected && (
                <>
                  <div className="detail-classification">
                    <RiskBadge risk={selected.risk} />
                    <span>{changeLabels[selected.kind]}</span>
                  </div>
                  <h3 className="detail-path">{selected.path || "(raiz)"}</h3>
                  <p className="detail-description">{selected.description}</p>
                  <div className="value-grid">
                    {(["before", "after"] as const).map((side) => (
                      <section className="value-panel" key={side}>
                        <h4>{side === "before" ? "Original" : "Atualizado"}</h4>
                        <pre className={selected[side] ? undefined : "absent"}>
                          {selected[side]?.text ?? "Ausente"}
                        </pre>
                        {selected[side]?.truncated && (
                          <p className="preview-note">
                            Prévia truncada em 512 caracteres. Localizar
                            seleciona o valor completo.
                          </p>
                        )}
                      </section>
                    ))}
                  </div>
                  <div className="detail-actions">
                    <Button
                      variant="outline"
                      disabled={Boolean(busy) || stale || !selected.before}
                      onClick={() => locate("before")}
                    >
                      Localizar no original
                    </Button>
                    <Button
                      variant="outline"
                      disabled={Boolean(busy) || stale || !selected.after}
                      onClick={() => locate("after")}
                    >
                      Localizar no atualizado
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        void copy(selected.path, "JSON Pointer copiado.");
                      }}
                    >
                      <Copy data-icon="inline-start" />
                      Copiar caminho
                    </Button>
                  </div>
                  <p className="detail-note">
                    {stale
                      ? "Os documentos mudaram. A localização está indisponível para este resultado."
                      : selected.risk === "potential"
                        ? "Esta evidência merece atenção, mas não comprova quebra de contrato."
                        : "A classificação informativa não garante compatibilidade com todos os consumidores."}
                  </p>
                </>
              )}
            </div>
            <SheetFooter>
              {sheetKind === "detail" ? (
                <div className="detail-navigation">
                  <IconButton
                    label="Diferença anterior"
                    disabled={selectedIndex <= 0}
                    onClick={() => navigate(-1)}
                  >
                    <ArrowLeft />
                  </IconButton>
                  <span>
                    {selectedIndex + 1} / {filtered.length}
                  </span>
                  <IconButton
                    label="Próxima diferença"
                    disabled={
                      selectedIndex < 0 || selectedIndex >= filtered.length - 1
                    }
                    onClick={() => navigate(1)}
                  >
                    <ArrowRight />
                  </IconButton>
                </div>
              ) : (
                <span className="drawer-footer-note">
                  {sheetKind === "examples"
                    ? "O modo selecionado será preservado."
                    : "Paralelo · processamento local"}
                </span>
              )}
              <SheetClose asChild>
                <Button variant="outline">
                  Fechar <kbd>Esc</kbd>
                </Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
        <div
          className="notification"
          role="status"
          aria-live="polite"
          data-visible={Boolean(notice)}
        >
          {notice && (
            <>
              <Info />
              <span>{notice}</span>
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
