import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  BookOpen,
  Check,
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
import { examples, initialExample } from "@/demo/examples";
import {
  changeLabels,
  differencesForMode,
  filterDifferences,
  isCurrentDemo,
  PAGE_SIZE,
  type ChangeKind,
  type DemoDifference,
  type DemoExample,
  type Mode,
  type Risk,
  type Side,
  type SourceRange,
} from "@/demo/model";

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
  const [mode, setMode] = useState<Mode>("structural");
  const [comparedMode, setComparedMode] = useState<Mode>("structural");
  const [hasResult, setHasResult] = useState(true);
  const [stale, setStale] = useState(false);
  const [risk, setRisk] = useState<Risk | "all">("all");
  const [kind, setKind] = useState<ChangeKind | "all">("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<DemoDifference | null>(null);
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
  const differences = hasResult
    ? differencesForMode(example, comparedMode)
    : [];
  const filtered = filterDifferences(differences, risk, kind);
  const selectedIndex = selected
    ? filtered.findIndex((d) => d.id === selected.id)
    : -1;
  function notify(message: string) {
    clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = setTimeout(() => setNotice(""), 4500);
  }
  useEffect(() => () => clearTimeout(noticeTimer.current), []);
  function open(which: Exclude<Overlay, null>) {
    lastTrigger.current = document.activeElement as HTMLElement;
    setSheetKind(which);
    setOverlay(which);
  }
  function texts() {
    return {
      before: before.current?.getText() ?? "",
      after: after.current?.getText() ?? "",
    };
  }
  function resetResult() {
    setRisk("all");
    setKind("all");
    setPage(0);
    setSelected(null);
    setStale(false);
    setHasResult(true);
    setExpanded(null);
  }
  function loadExample(next: DemoExample) {
    before.current?.setText(next.before);
    after.current?.setText(next.after);
    setExample(next);
    setComparedMode(mode);
    resetResult();
    setOverlay(null);
    if (viewport !== "desktop") setPanel("differences");
    notify(`Exemplo “${next.title}” carregado.`);
  }
  function compareDemo() {
    if (!isCurrentDemo(example, texts(), mode, mode)) {
      notify(
        "A comparação livre ainda não está disponível. Carregue um exemplo para explorar os resultados.",
      );
      return;
    }
    setComparedMode(mode);
    resetResult();
    if (viewport !== "desktop") setPanel("differences");
    notify("Resultado demonstrativo atualizado.");
  }
  function edit() {
    setStale(true);
  }
  function selectMode(value: string) {
    if (value && value !== mode) {
      setMode(value as Mode);
      setStale(true);
    }
  }
  function swap() {
    const current = texts();
    before.current?.setText(current.after);
    after.current?.setText(current.before);
    setStale(true);
    notify("Documentos invertidos. O resultado anterior está desatualizado.");
  }
  function clear() {
    before.current?.setText("");
    after.current?.setText("");
    setHasResult(false);
    setStale(false);
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
    if (
      !snapshot ||
      stale ||
      !isCurrentDemo(example, texts(), mode, comparedMode)
    ) {
      notify("A localização exige os documentos originais do exemplo.");
      return;
    }
    pendingLocation.current = { side, range: snapshot.range };
    setExpanded(null);
    setPanel(side);
    lastEditor.current = side;
    setOverlay(null);
  }
  function navigate(offset: number) {
    const index = selectedIndex + offset;
    const next = filtered[index];
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
  return (
    <TooltipProvider delayDuration={350}>
      <div
        className="app"
        onKeyDown={(event) => {
          if (overlay || event.nativeEvent.isComposing) return;
          if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault();
            compareDemo();
          }
          if (event.key === "Escape" && expanded) setExpanded(null);
        }}
      >
        <a className="skip-link" href="#workbench">
          Ir para a bancada
        </a>
        <header className="topbar">
          <a href="#" className="brand" aria-label="Paralelo — início">
            <img className="brand-mark" src="/brand-mark.svg" alt="" aria-hidden="true" />
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
          <Badge variant="preview">Prévia de interface</Badge>
        </section>
        <div className="command" aria-label="Ferramentas de comparação">
          <div className="command-left">
            <span className="control-label">Modo</span>
            <ToggleGroup
              type="single"
              value={mode}
              onValueChange={selectMode}
              aria-label="Modo de comparação"
            >
              <ToggleGroupItem value="structural">Estrutural</ToggleGroupItem>
              <ToggleGroupItem value="content">Conteúdo</ToggleGroupItem>
            </ToggleGroup>
            <ArrayPolicy />
          </div>
          <div className="command-right">
            <Button variant="outline" onClick={() => open("examples")}>
              <BookOpen data-icon="inline-start" />
              <span>Exemplos</span>
            </Button>
            <Button
              variant="outline"
              onClick={swap}
              aria-label="Inverter documentos"
            >
              <ArrowRightLeft data-icon="inline-start" />
              <span className="action-label">Inverter</span>
            </Button>
            <Button
              variant="ghost"
              onClick={clear}
              aria-label="Limpar documentos"
            >
              <Trash2 data-icon="inline-start" />
              <span className="action-label">Limpar</span>
            </Button>
            <Button onClick={compareDemo}>
              <Play data-icon="inline-start" />
              Comparar<kbd>↵</kbd>
            </Button>
          </div>
        </div>
        <div className="demo-notice">
          <Info />
          <span>
            Resultados demonstrativos. A comparação de documentos livres, a
            formatação e a exportação entram após a aprovação desta bancada.
          </span>
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
              onChange={edit}
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
              onChange={edit}
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
                ? "Exemplo carregado"
                : "Documentos vazios"}
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
              else lastTrigger.current?.focus();
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
                      Os três cenários apresentam diferenças fixas para você
                      avaliar a experiência. Escolha Estrutural ou Conteúdo e
                      clique em Comparar para reapresentar o cenário nesse modo.
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
                      anterior desatualizado. A comparação de textos livres
                      ainda não está implementada.
                    </p>
                  </section>
                  <section>
                    <h3>Arrays e classificações</h3>
                    <p>
                      A análise planejada compara arrays por índice.
                      Reordenações podem gerar diferenças. “Informativa” não
                      garante compatibilidade; uma amostra não comprova quebra
                      de contrato.
                    </p>
                  </section>
                  <section className="help-local">
                    <LockKeyhole />
                    <div>
                      <h3>Documentos neste navegador</h3>
                      <p>
                        Sem armazenamento, histórico ou envio dos seus JSONs.
                        Formatação e relatório Markdown ficam para a etapa do
                        motor.
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
                      </section>
                    ))}
                  </div>
                  <div className="detail-actions">
                    <Button
                      variant="outline"
                      disabled={stale || !selected.before}
                      onClick={() => locate("before")}
                    >
                      Localizar no original
                    </Button>
                    <Button
                      variant="outline"
                      disabled={stale || !selected.after}
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
                    : "Paralelo · prévia de interface"}
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
              <Check />
              <span>{notice}</span>
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
