import {
  ArrowRight,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSearch,
  Info,
  ListFilter,
  Minus,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Alert, AlertDescription } from "./ui/alert";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./ui/empty";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { IconButton } from "./IconButton";
import { changeLabels, PAGE_SIZE, pageDifferences } from "@/app/results";
import type { ChangeKind, JsonDifference, Mode, Risk } from "@/core/models";
interface Props {
  visible: boolean;
  hasResult: boolean;
  busy: boolean;
  onExport(): void;
  stale: boolean;
  mode: Mode;
  differences: readonly JsonDifference[];
  filtered: readonly JsonDifference[];
  risk: Risk | "all";
  kind: ChangeKind | "all";
  page: number;
  selected: string | null;
  onRisk(value: Risk | "all"): void;
  onKind(value: ChangeKind | "all"): void;
  onPage(page: number): void;
  onSelect(difference: JsonDifference): void;
  onExamples(): void;
}
export function RiskBadge({
  risk,
  children,
}: {
  risk: Risk;
  children?: React.ReactNode;
}) {
  return (
    <Badge variant={risk === "potential" ? "risk" : "info"}>
      {risk === "potential" ? <TriangleAlert /> : <Info />}
      {children ??
        (risk === "potential" ? "Potencial incompatibilidade" : "Informativa")}
    </Badge>
  );
}
function ChangeIcon({ difference }: { difference: JsonDifference }) {
  const Icon = difference.kind.endsWith("Added")
    ? Plus
    : difference.kind.endsWith("Removed")
      ? Minus
      : ArrowRightLeft;
  return (
    <span
      className="change-icon"
      data-risk={difference.risk}
      data-kind={difference.kind}
    >
      <Icon />
    </span>
  );
}
export function Inspector(p: Props) {
  const risks = p.differences.filter((d) => d.risk === "potential").length;
  const pages = Math.max(1, Math.ceil(p.filtered.length / PAGE_SIZE));
  return (
    <aside
      className="inspector"
      id="panel-differences"
      role="tabpanel"
      aria-label="Diferenças"
      hidden={!p.visible}
      inert={!p.visible}
    >
      <div className="inspector-top">
        <div className="inspector-titlebar">
          <div>
            <h2>Diferenças</h2>
            <p>
              {p.hasResult
                ? `${p.mode === "structural" ? "Estrutural" : "Conteúdo"} · arrays por índice`
                : "Nenhum resultado"}
            </p>
          </div>
          <IconButton
            label="Exportar relatório Markdown"
            disabled={p.busy || p.stale || !p.hasResult}
            onClick={p.onExport}
          >
            <Download />
          </IconButton>
        </div>
        <div className="inspector-overview">
          <strong className="big-count" data-testid="total-count">
            {String(p.hasResult ? p.differences.length : 0).padStart(2, "0")}
          </strong>
          <div>
            <strong>
              {p.hasResult
                ? p.differences.length
                  ? "diferenças identificadas"
                  : "Nenhuma diferença"
                : "Nenhuma comparação"}
            </strong>
            <span>
              {p.hasResult
                ? "entre os documentos"
                : "Carregue um exemplo para experimentar"}
            </span>
          </div>
        </div>
        <div className="risk-line">
          <RiskBadge risk="potential">{risks} potenciais</RiskBadge>
          <RiskBadge risk="informative">
            {p.differences.length - risks} informativas
          </RiskBadge>
        </div>
      </div>
      {p.stale && p.hasResult && (
        <Alert className="stale-alert">
          <TriangleAlert />
          <AlertDescription>
            Comparação desatualizada. A localização está indisponível.
          </AlertDescription>
        </Alert>
      )}
      <div className="inspector-filters">
        <ToggleGroup
          className="risk-filter"
          disabled={p.busy}
          type="single"
          value={p.risk}
          onValueChange={(value) => {
            if (value) p.onRisk(value as Risk | "all");
          }}
          aria-label="Filtrar por classificação"
        >
          <ToggleGroupItem value="all">Todas</ToggleGroupItem>
          <ToggleGroupItem value="potential">Potenciais</ToggleGroupItem>
          <ToggleGroupItem value="informative">Informativas</ToggleGroupItem>
        </ToggleGroup>
        <div className="kind-filter">
          <ListFilter aria-hidden="true" />
          <Select
            disabled={p.busy}
            value={p.kind}
            onValueChange={(value) => p.onKind(value as ChangeKind | "all")}
          >
            <SelectTrigger aria-label="Tipo de alteração">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              <SelectGroup>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {Object.entries(changeLabels).map(([value, text]) => (
                  <SelectItem value={value} key={value}>
                    {text}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <span>{p.filtered.length}</span>
        </div>
      </div>
      <div className="diff-list" data-testid="diff-list">
        {p.filtered.length ? (
          pageDifferences(p.filtered, p.page).map((d) => (
            <Button
              key={d.id}
              id={`difference-${p.differences.indexOf(d)}`}
              variant="row"
              className={p.selected === d.id ? "selected" : undefined}
              disabled={p.busy}
              onClick={() => p.onSelect(d)}
              aria-label={`${d.path || "(raiz)"} — ${changeLabels[d.kind]}`}
            >
              <span className="row-heading">
                <ChangeIcon difference={d} />
                <code title={d.path}>{d.path || "(raiz)"}</code>
                <ChevronRight className="row-chevron" />
              </span>
              <span className="diff-kind">{changeLabels[d.kind]}</span>
              <span className="diff-meta">
                {d.risk === "potential"
                  ? "Potencial incompatibilidade"
                  : "Informativa"}
              </span>
              <span className="diff-preview">
                {d.before && <code className="old-value">{d.before.text}</code>}
                {d.before && d.after && <ArrowRight />}
                {d.after && <code className="new-value">{d.after.text}</code>}
              </span>
            </Button>
          ))
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileSearch />
              </EmptyMedia>
              <EmptyTitle>
                {p.hasResult
                  ? p.differences.length
                    ? "Nenhuma diferença neste filtro"
                    : p.mode === "structural"
                      ? "Nenhuma diferença estrutural"
                      : "Nenhuma diferença encontrada"
                  : p.busy
                    ? "Comparando documentos…"
                    : "Pronto para comparar"}
              </EmptyTitle>
              <EmptyDescription>
                {p.hasResult
                  ? p.differences.length
                    ? "Tente outra classificação ou tipo de alteração."
                    : "Os documentos são equivalentes no modo selecionado."
                  : "Cole ou importe seus documentos, ou carregue um exemplo."}
              </EmptyDescription>
            </EmptyHeader>
            {!p.hasResult && (
              <Button
                variant="outline"
                disabled={p.busy}
                onClick={p.onExamples}
              >
                Carregar exemplo
              </Button>
            )}
          </Empty>
        )}
      </div>
      <div className="pagination">
        <span>
          {p.filtered.length
            ? `${p.page * PAGE_SIZE + 1}–${Math.min((p.page + 1) * PAGE_SIZE, p.filtered.length)} de ${p.filtered.length}`
            : "0 diferenças"}
        </span>
        <div>
          <IconButton
            label="Página anterior"
            disabled={p.busy || p.page === 0}
            onClick={() => p.onPage(p.page - 1)}
          >
            <ChevronLeft />
          </IconButton>
          <span>
            {p.page + 1} / {pages}
          </span>
          <IconButton
            label="Próxima página"
            disabled={p.busy || p.page + 1 >= pages}
            onClick={() => p.onPage(p.page + 1)}
          >
            <ChevronRight />
          </IconButton>
        </div>
      </div>
      <div className="inspector-bottom">
        <Info />
        <p>Amostras não comprovam compatibilidade de contrato.</p>
      </div>
    </aside>
  );
}
