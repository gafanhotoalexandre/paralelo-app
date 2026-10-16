import {
  useEffect,
  useLayoutEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import {
  Compartment,
  EditorState,
  StateEffect,
  StateField,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  type DecorationSet,
} from "@codemirror/view";
import {
  bracketMatching,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { json } from "@codemirror/lang-json";
import { tags } from "@lezer/highlight";
import { Braces, Copy, Maximize2, Minimize2, Upload } from "lucide-react";
import { IconButton } from "./IconButton";
import type { Side, SourceRange } from "@/core/models";

export interface EditorHandle {
  getText(): string;
  setText(text: string): void;
  focus(): void;
  locate(range: SourceRange): void;
}
interface Props {
  ref: Ref<EditorHandle>;
  side: Side;
  initialText: string;
  visible: boolean;
  expanded: boolean;
  stale: boolean;
  busy: boolean;
  processing: boolean;
  error?: string;
  onFormat(): void;
  onImport(file: File): void;
  onChange(): void;
  onFocus(): void;
  onExpand(): void;
  onCopy(text: string): void;
}
const locateEffect = StateEffect.define<SourceRange>();
const locatedRange = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, transaction) {
    const range = transaction.effects.find((e) => e.is(locateEffect));
    if (range?.is(locateEffect)) {
      const { from, to } = range.value;
      const decorations = [
        Decoration.mark({ class: "cm-located-value" }).range(from, to),
      ];
      const startLine = transaction.state.doc.lineAt(from).number;
      const endLine = transaction.state.doc.lineAt(
        Math.max(from, to - 1),
      ).number;
      for (let n = startLine; n <= Math.min(endLine, startLine + 199); n++)
        decorations.push(
          Decoration.line({ class: "cm-located-line" }).range(
            transaction.state.doc.line(n).from,
          ),
        );
      return Decoration.set(decorations, true);
    }
    return transaction.docChanged || transaction.selection
      ? Decoration.none
      : value;
  },
  provide: (field) => EditorView.decorations.from(field),
});
const editorTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "12.5px", color: "#42565a" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
    lineHeight: "25px",
    overflow: "auto",
    overscrollBehavior: "contain",
  },
  ".cm-content": {
    padding: "16px 0 80px",
    minHeight: "100%",
    tabSize: "2",
    caretColor: "#184b50",
  },
  ".cm-line": { padding: "0 17px 0 13px" },
  ".cm-gutters": {
    backgroundColor: "#fafbf9",
    color: "#5d706d",
    borderRight: "1px solid #edf0ec",
    minWidth: "42px",
  },
  ".cm-gutterElement": { padding: "0 10px 0 8px" },
  ".cm-activeLineGutter": { backgroundColor: "#eaf1ed", color: "#256569" },
  ".cm-activeLine": { backgroundColor: "#f6f9f6" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection":
    { backgroundColor: "#cce1dc !important" },
  ".cm-located-line": { backgroundColor: "#edf4ef" },
  ".cm-located-value": { backgroundColor: "#d5e6dd", borderRadius: "2px" },
});

export function JsonEditor(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const callbacks = useRef(props);
  useLayoutEffect(() => {
    callbacks.current = props;
  });
  const [configuration] = useState(() => new Compartment());
  const fileInput = useRef<HTMLInputElement>(null);
  const [metrics, setMetrics] = useState({
    line: 1,
    lines: props.initialText.split("\n").length,
    length: props.initialText.length,
  });
  const label = props.side === "before" ? "original" : "atualizado";
  useEffect(() => {
    const instance = new EditorView({
      parent: container.current!,
      state: EditorState.create({
        doc: props.initialText,
        extensions: [
          configuration.of([
            EditorState.readOnly.of(false),
            EditorView.editable.of(true),
          ]),
          lineNumbers(),
          history(),
          drawSelection(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          indentOnInput(),
          bracketMatching(),
          json(),
          syntaxHighlighting(
            HighlightStyle.define([
              { tag: tags.propertyName, color: "#315c7f" },
              { tag: tags.string, color: "#945139" },
              { tag: tags.number, color: "#326a72" },
              { tag: tags.bool, color: "#775a99" },
              { tag: tags.null, color: "#93612a" },
            ]),
          ),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.lineWrapping,
          editorTheme,
          locatedRange,
          EditorView.contentAttributes.of({
            "aria-label": `JSON ${label}`,
            spellcheck: "false",
            autocapitalize: "off",
            autocorrect: "off",
            "data-testid": `code-${props.side}`,
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) callbacks.current.onChange();
            if (update.docChanged || update.selectionSet)
              setMetrics({
                line: update.state.doc.lineAt(update.state.selection.main.head)
                  .number,
                lines: update.state.doc.lines,
                length: update.state.doc.length,
              });
          }),
          EditorView.domEventHandlers({
            focus: () => {
              callbacks.current.onFocus();
              return false;
            },
          }),
        ],
      }),
    });
    view.current = instance;
    return () => {
      instance.destroy();
      view.current = null;
    };
    // Initial document belongs to the mounted EditorView; subsequent updates use transactions.
  }, []);
  useEffect(() => {
    if (props.visible) view.current?.requestMeasure();
  }, [props.visible, props.expanded]);
  useEffect(() => {
    view.current?.dispatch({
      effects: configuration.reconfigure([EditorState.readOnly.of(props.busy)]),
    });
  }, [props.busy, configuration]);
  useEffect(() => {
    const content = view.current?.contentDOM;
    if (!content) return;
    content.setAttribute("aria-readonly", String(props.busy));
    content.setAttribute("aria-invalid", String(Boolean(props.error)));
    if (props.error)
      content.setAttribute("aria-describedby", `error-${props.side}`);
    else content.removeAttribute("aria-describedby");
  }, [props.busy, props.error, props.side]);
  useImperativeHandle(
    props.ref,
    () => ({
      getText: () => view.current?.state.doc.toString() ?? "",
      setText(text) {
        const v = view.current;
        if (v && v.state.doc.toString() !== text)
          v.dispatch({
            changes: { from: 0, to: v.state.doc.length, insert: text },
            selection: { anchor: 0 },
          });
      },
      focus: () => view.current?.focus(),
      locate(range) {
        const v = view.current;
        if (
          !v ||
          range.from < 0 ||
          range.to > v.state.doc.length ||
          range.from >= range.to
        )
          return;
        v.dispatch({
          selection: { anchor: range.from, head: range.to },
          effects: [
            locateEffect.of(range),
            EditorView.scrollIntoView(range.from, { y: "start", yMargin: 38 }),
          ],
        });
        v.focus();
      },
    }),
    [],
  );
  return (
    <article
      className="editor"
      id={`editor-${props.side}`}
      role="tabpanel"
      data-testid={`editor-${props.side}`}
      hidden={!props.visible}
      inert={!props.visible}
      aria-labelledby={`title-${props.side}`}
    >
      <header className="editor-header">
        <div className="editor-label">
          <span className="editor-number">
            {props.side === "before" ? "01" : "02"}
          </span>
          <div>
            <h2 id={`title-${props.side}`}>JSON {label}</h2>
          </div>
        </div>
        <div className="editor-tools">
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            disabled={props.busy}
            data-operation-disabled={props.busy}
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) props.onImport(file);
              event.target.value = "";
            }}
          />
          <IconButton
            label={`Importar JSON ${label}`}
            disabled={props.busy}
            data-operation-disabled={props.busy}
            onClick={() => fileInput.current?.click()}
          >
            <Upload />
          </IconButton>
          <IconButton
            label={`Formatar JSON ${label}`}
            onClick={props.onFormat}
            disabled={props.busy}
            data-operation-disabled={props.busy}
          >
            <Braces />
          </IconButton>
          <IconButton
            label={`Copiar JSON ${label}`}
            disabled={props.busy}
            data-operation-disabled={props.busy}
            onClick={() =>
              props.onCopy(view.current?.state.doc.toString() ?? "")
            }
          >
            <Copy />
          </IconButton>
          <IconButton
            label={`${props.expanded ? "Restaurar" : "Ampliar"} editor ${label}`}
            disabled={props.busy}
            data-operation-disabled={props.busy}
            onClick={props.onExpand}
          >
            {props.expanded ? <Minimize2 /> : <Maximize2 />}
          </IconButton>
        </div>
      </header>
      {props.error && (
        <div className="editor-error" id={`error-${props.side}`} role="alert">
          {props.error}
        </div>
      )}
      <div className="editor-code" ref={container} />
      <footer className="editor-footer">
        <span className="editor-state">
          <i />
          {metrics.length === 0
            ? "Sem conteúdo"
            : props.processing
              ? "Processando…"
              : props.error
                ? "Verifique o JSON"
                : props.stale
                  ? "Não comparado"
                  : "Comparado"}
        </span>
        <span>
          Ln {metrics.line} / {metrics.lines}
        </span>
      </footer>
    </article>
  );
}
