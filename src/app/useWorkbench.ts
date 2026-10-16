import { useEffect, useRef, useState, type RefObject } from "react";
import type { EditorHandle } from "@/components/JsonEditor";
import type {
  JsonComparisonResult,
  Mode,
  ProcessingIssue,
  Side,
  Snapshot,
} from "@/core/models";
import { LIMITS, utf8Length } from "@/core/limits";
import { ComparisonWorkerClient, WorkerFailure } from "@/workers/client";
import type { WorkerOperation } from "@/workers/protocol";
interface Editors {
  before: RefObject<EditorHandle | null>;
  after: RefObject<EditorHandle | null>;
}
export function useWorkbench(
  editors: Editors,
  notify: (message: string) => void,
) {
  const [mode, setModeState] = useState<Mode>("structural");
  const [result, setResult] = useState<JsonComparisonResult | null>(null);
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState<WorkerOperation | "import" | null>(null);
  const [processing, setProcessing] = useState(false);
  const processingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [issues, setIssues] = useState<readonly ProcessingIssue[]>([]);
  const [operationError, setOperationError] = useState("");
  const client = useRef<ComparisonWorkerClient | null>(null);
  const revision = useRef(0),
    comparedRevision = useRef<number | null>(null),
    generation = useRef(0);
  const staleBeforeOperation = useRef(false);
  const locked = useRef(false),
    mounted = useRef(false);
  function changed(side: Side) {
    revision.current++;
    setStale(true);
    setIssues((previous) =>
      previous.some((issue) => !issue.side || issue.side === side)
        ? previous.filter((issue) => issue.side && issue.side !== side)
        : previous,
    );
    setOperationError("");
  }
  function setMode(value: Mode) {
    if (locked.current || value === mode) return;
    revision.current++;
    setModeState(value);
    setStale(true);
    setIssues([]);
    setOperationError("");
  }
  function start(operation: WorkerOperation | "import") {
    if (locked.current || !client.current) return null;
    locked.current = true;
    staleBeforeOperation.current = stale;
    const id = ++generation.current;
    setBusy(operation);
    processingTimer.current = setTimeout(() => {
      if (mounted.current && generation.current === id) setProcessing(true);
    }, 150);
    setIssues([]);
    setOperationError("");
    return id;
  }
  function end(id: number) {
    if (mounted.current && generation.current === id) {
      clearTimeout(processingTimer.current);
      locked.current = false;
      setProcessing(false);
      setBusy(null);
    }
  }
  function failed(error: unknown, id: number) {
    if (!mounted.current || generation.current !== id) return;
    const text =
      error instanceof WorkerFailure && error.reason === "cancelled"
        ? "Operação cancelada. Os JSONs foram preservados."
        : error instanceof WorkerFailure && error.reason === "timeout"
          ? "A operação ultrapassou 10 segundos e foi interrompida. Os JSONs foram preservados."
          : "Não foi possível concluir o processamento. Os JSONs foram preservados. Tente novamente.";
    setOperationError(text);
    notify(text);
  }
  function read(side: Side) {
    return editors[side].current?.getText() ?? "";
  }
  function oversized(documents: Partial<Record<Side, string>>) {
    const errors = (Object.keys(documents) as Side[])
      .filter((side) => utf8Length(documents[side]!) > LIMITS.documentBytes)
      .map((side) => ({
        code: "documentSize" as const,
        side,
        message: "O JSON ultrapassa 1 MiB em UTF-8.",
      }));
    if (errors.length) {
      setIssues(errors);
      return true;
    }
    return false;
  }
  async function compare(selectedMode: Mode = mode) {
    if (
      locked.current ||
      (result &&
        !stale &&
        comparedRevision.current === revision.current &&
        result.mode === selectedMode)
    )
      return;
    const id = start("compare");
    if (id === null) return;
    const sourceRevision = revision.current;
    try {
      const documents = { before: read("before"), after: read("after") };
      if (oversized(documents)) {
        setStale(true);
        return;
      }
      const response = await client.current!.run({
        operation: "compare",
        revision: sourceRevision,
        request: {
          ...documents,
          mode: selectedMode,
        },
      });
      if (
        !mounted.current ||
        id !== generation.current ||
        revision.current !== sourceRevision
      )
        return;
      if (response.operation !== "compare") return;
      if (response.response.status === "success") {
        setResult(response.response.result);
        comparedRevision.current = sourceRevision;
        setStale(false);
      } else {
        setIssues(response.response.errors);
        setStale(true);
      }
    } catch (error) {
      if (generation.current === id) setStale(true);
      failed(error, id);
    } finally {
      end(id);
    }
  }
  async function format(side: Side) {
    const id = start("format");
    if (id === null) return;
    const sourceRevision = revision.current;
    try {
      const text = read(side);
      if (oversized({ [side]: text })) return;
      const response = await client.current!.run({
        operation: "format",
        revision: sourceRevision,
        request: { text, side },
      });
      if (
        !mounted.current ||
        id !== generation.current ||
        revision.current !== sourceRevision ||
        response.operation !== "format"
      )
        return;
      if (response.response.status === "success") {
        if (response.response.text !== read(side)) {
          editors[side].current?.setText(response.response.text);
          notify(
            "JSON formatado. Compare novamente para atualizar o resultado.",
          );
        }
      } else setIssues(response.response.errors);
    } catch (error) {
      failed(error, id);
    } finally {
      end(id);
    }
  }
  async function importFile(side: Side, file: File) {
    const id = start("import");
    if (id === null) return;
    try {
      if (file.size > LIMITS.documentBytes) {
        setIssues([
          {
            code: "documentSize",
            side,
            message: "O arquivo ultrapassa 1 MiB. O JSON foi preservado.",
          },
        ]);
        return;
      }
      const text = new TextDecoder("utf-8", { fatal: true }).decode(
        await file.arrayBuffer(),
      );
      if (!mounted.current || generation.current !== id) return;
      if (text !== read(side)) {
        editors[side].current?.setText(text);
        notify("JSON importado. Compare para atualizar o resultado.");
      }
    } catch {
      if (mounted.current && generation.current === id)
        setIssues([
          {
            code: "unicode",
            side,
            message:
              "Não foi possível ler o arquivo como UTF-8. O JSON foi preservado.",
          },
        ]);
    } finally {
      end(id);
    }
  }
  function setDocuments(before: string, after: string) {
    if (locked.current) return false;
    editors.before.current?.setText(before);
    editors.after.current?.setText(after);
    setIssues((previous) => (previous.length ? [] : previous));
    setOperationError("");
    return true;
  }
  function clear() {
    if (!setDocuments("", "")) return;
    setResult(null);
    setStale(false);
    comparedRevision.current = null;
  }
  function swap() {
    if (locked.current) return;
    const a = read("before"),
      b = read("after");
    if (a === b) return;
    setDocuments(b, a);
    setStale(true);
    notify("JSONs invertidos. Compare para atualizar o resultado.");
  }
  async function exportMarkdown() {
    if (!result || stale || comparedRevision.current !== revision.current)
      return;
    const id = start("markdown");
    if (id === null) return;
    try {
      const response = await client.current!.run({
        operation: "markdown",
        result,
        revision: revision.current,
      });
      if (
        !mounted.current ||
        id !== generation.current ||
        response.operation !== "markdown"
      )
        return;
      if (response.response.status !== "success") {
        setIssues(response.response.errors);
        return;
      }
      const url = URL.createObjectURL(
        new Blob([response.response.markdown], {
          type: "text/markdown;charset=utf-8",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "paralelo-relatorio.md";
      try {
        document.body.append(link);
        link.click();
      } finally {
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      notify("Relatório Markdown exportado.");
    } catch (error) {
      failed(error, id);
    } finally {
      end(id);
    }
  }
  function canLocate(side: Side, snapshot: Snapshot) {
    if (
      !result ||
      stale ||
      locked.current ||
      comparedRevision.current !== revision.current
    )
      return false;
    const text = read(side);
    return (
      snapshot.range.from >= 0 &&
      snapshot.range.to <= text.length &&
      text.slice(
        snapshot.range.from,
        snapshot.range.from + snapshot.text.length,
      ) === snapshot.text
    );
  }
  function cancel() {
    if (!locked.current) return;
    generation.current++;
    client.current?.cancel();
    clearTimeout(processingTimer.current);
    locked.current = false;
    setProcessing(false);
    setBusy(null);
    const text = "Operação cancelada. Os JSONs foram preservados.";
    setOperationError(text);
    notify(text);
  }
  useEffect(() => {
    const instance = new ComparisonWorkerClient();
    client.current = instance;
    mounted.current = true;
    let active = true;
    // StrictMode cleans up its first setup before this microtask, avoiding a duplicate initial job.
    queueMicrotask(() => {
      if (active) void compare("structural");
    });
    return () => {
      active = false;
      clearTimeout(processingTimer.current);
      mounted.current = false;
      generation.current++;
      locked.current = false;
      instance.dispose();
      client.current = null;
    };
  }, []);
  return {
    mode,
    setMode,
    result,
    stale,
    displayStale: busy ? staleBeforeOperation.current : stale,
    busy,
    processing,
    issues,
    operationError,
    changed,
    compare,
    format,
    importFile,
    setDocuments,
    clear,
    swap,
    exportMarkdown,
    canLocate,
    cancel,
  };
}
