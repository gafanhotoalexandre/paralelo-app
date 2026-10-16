import { StrictMode, useImperativeHandle, useRef, type Ref } from "react";
import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { App } from "./App";
import type { EditorHandle } from "@/components/JsonEditor";
const observed = vi.hoisted(() => ({
  run: vi.fn(),
  file: undefined as File | undefined,
}));
vi.mock("@/workers/client", async () => {
  const { compareJson } = await import("@/core/comparison"),
    { formatJson } = await import("@/core/formatting"),
    { generateMarkdown } = await import("@/core/markdown");
  return {
    WorkerFailure: class extends Error {},
    ComparisonWorkerClient: class {
      async run(job: import("@/workers/protocol").WorkerRequest) {
        await observed.run(job);
        return {
          id: 1,
          revision: job.revision,
          operation: job.operation,
          response:
            job.operation === "compare"
              ? compareJson(job.request)
              : job.operation === "format"
                ? formatJson(job.request)
                : generateMarkdown(job.result),
        };
      }
      dispose() {}
      cancel() {}
    },
  };
});
vi.mock("@/components/JsonEditor", () => ({
  JsonEditor: (props: {
    ref: Ref<EditorHandle>;
    side: string;
    initialText: string;
    visible: boolean;
    busy: boolean;
    error?: string;
    onFormat(): void;
    onImport(file: File): void;
    onChange(): void;
  }) => {
    const text = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(props.ref, () => ({
      getText: () => text.current!.value,
      setText(value) {
        if (text.current!.value === value) return;
        text.current!.value = value;
        props.onChange();
      },
      focus() {
        text.current!.focus();
      },
      locate() {},
    }));
    const label = props.side === "before" ? "original" : "atualizado";
    return (
      <div hidden={!props.visible}>
        <textarea
          aria-label={`JSON ${label}`}
          ref={text}
          defaultValue={props.initialText}
          onChange={props.onChange}
          readOnly={props.busy}
        />
        <button
          disabled={props.busy}
          onClick={() => props.onImport(observed.file!)}
        >
          Importar JSON {label}
        </button>
        <button disabled={props.busy} onClick={props.onFormat}>
          Formatar JSON {label}
        </button>
        {props.error && <div role="alert">{props.error}</div>}
      </div>
    );
  },
}));
beforeAll(() => {
  Object.defineProperty(window, "innerWidth", { value: 1440, writable: true });
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});
afterEach(() => {
  cleanup();
  observed.run.mockReset();
  observed.file = undefined;
});
async function loaded() {
  await waitFor(() =>
    expect(screen.getByTestId("total-count")).toHaveTextContent("05"),
  );
}
describe("real operations integrated with the workbench", () => {
  it("compares initially once even in StrictMode; mode changes require an explicit new comparison", async () => {
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    await loaded();
    expect(
      observed.run.mock.calls.filter(([job]) => job.operation === "compare"),
    ).toHaveLength(1);
    fireEvent.click(screen.getByRole("radio", { name: "Conteúdo" }));
    expect(screen.getByTestId("total-count")).toHaveTextContent("05");
    fireEvent.click(screen.getByRole("button", { name: /^Comparar/ }));
    await waitFor(() =>
      expect(screen.getByTestId("total-count")).toHaveTextContent("07"),
    );
  });
  it("compares arbitrary input, reports invalid input and retains only a stale previous result", async () => {
    render(<App />);
    await loaded();
    fireEvent.change(screen.getByLabelText("JSON original"), {
      target: { value: '{"x":1}' },
    });
    fireEvent.change(screen.getByLabelText("JSON atualizado"), {
      target: { value: '{"x":2}' },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Conteúdo" }));
    fireEvent.click(screen.getByRole("button", { name: /^Comparar/ }));
    await waitFor(() =>
      expect(screen.getByTestId("total-count")).toHaveTextContent("01"),
    );
    fireEvent.change(screen.getByLabelText("JSON original"), {
      target: { value: '{"SECRET":' },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Comparar/ }));
    expect(await screen.findByRole("alert", { name: "" })).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen
          .getAllByRole("alert")
          .some((e) => e.textContent?.includes("JSON inválido")),
      ).toBe(true),
    );
    expect(screen.getByTestId("total-count")).toHaveTextContent("01");
    expect(
      screen.getByRole("button", { name: "Exportar relatório Markdown" }),
    ).toBeDisabled();
  });
  it("loads an example with one automatic comparison and preserves the selected mode", async () => {
    render(<App />);
    await loaded();
    fireEvent.click(screen.getByRole("radio", { name: "Conteúdo" }));
    fireEvent.click(screen.getByRole("button", { name: "Exemplos" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Configuração de serviço/ }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("total-count")).toHaveTextContent("32"),
    );
    expect(
      observed.run.mock.calls.filter(([job]) => job.operation === "compare"),
    ).toHaveLength(2);
  });
  it("formats only one side without rounding a large integer", async () => {
    render(<App />);
    await loaded();
    const after = (
      screen.getByLabelText("JSON atualizado") as HTMLTextAreaElement
    ).value;
    fireEvent.change(screen.getByLabelText("JSON original"), {
      target: { value: '{"id":9007199254740993}' },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Formatar JSON original" }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("JSON original")).toHaveValue(
        '{\n  "id": 9007199254740993\n}',
      ),
    );
    expect(screen.getByLabelText("JSON atualizado")).toHaveValue(after);
    expect(
      screen.getByRole("button", { name: "Exportar relatório Markdown" }),
    ).toBeDisabled();
  });
  it("allows cancellation and another operation without losing text", async () => {
    observed.run.mockImplementationOnce(() => new Promise(() => {}));
    render(<App />);
    const cancel = await screen.findByRole("button", { name: "Cancelar" });
    const text = (screen.getByLabelText("JSON original") as HTMLTextAreaElement)
      .value;
    fireEvent.click(cancel);
    expect(screen.getByLabelText("JSON original")).toHaveValue(text);
    expect(screen.getByRole("status")).toHaveTextContent("Operação cancelada");
    fireEvent.click(screen.getByRole("button", { name: /^Comparar/ }));
    await loaded();
  });
});

it("ignores a delayed import after cancellation and another document action", async () => {
  render(<App />);
  await loaded();
  let release!: (buffer: ArrayBuffer) => void;
  observed.file = {
    size: 2,
    arrayBuffer: () =>
      new Promise<ArrayBuffer>((resolve) => {
        release = resolve;
      }),
  } as File;
  fireEvent.click(
    screen.getByRole("button", { name: "Importar JSON original" }),
  );
  fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
  fireEvent.click(screen.getByRole("button", { name: "Limpar documentos" }));
  await act(async () => {
    release(new TextEncoder().encode("{}").buffer);
    await Promise.resolve();
  });
  expect(screen.getByLabelText("JSON original")).toHaveValue("");
  expect(screen.getByTestId("total-count")).toHaveTextContent("00");
});

it("keeps the current result, filter and detail selection for repeated comparisons and the same example", async () => {
  render(<App />);
  await loaded();
  fireEvent.click(screen.getByRole("radio", { name: /^Potenciais$/ }));
  fireEvent.click(
    screen.getByRole("button", { name: "/ativo — Tipo alterado" }),
  );
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  // Closing by the actual control also exercises the retained selection.
  if (screen.queryByRole("dialog"))
    fireEvent.click(screen.getByRole("button", { name: /Fechar/ }));
  for (let i = 0; i < 5; i++)
    fireEvent.click(screen.getByRole("button", { name: /^Comparar/ }));
  expect(observed.run).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("radio", { name: /^Potenciais$/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  expect(document.getElementById("difference-1")).toHaveClass("selected");
  fireEvent.click(screen.getByRole("button", { name: "Exemplos" }));
  fireEvent.click(screen.getByRole("button", { name: /Cadastro de cliente/ }));
  expect(observed.run).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("radio", { name: /^Potenciais$/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  expect(screen.getByRole("status")).not.toHaveTextContent(
    "Comparação concluída",
  );
});

it("locks immediately but shows processing only after 150 ms, clearing the timer on completion", async () => {
  render(<App />);
  await loaded();
  vi.useFakeTimers();
  try {
    let release!: () => void;
    observed.run.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    fireEvent.change(screen.getByLabelText("JSON original"), {
      target: { value: "null" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Comparar/ }));
    expect(screen.getByRole("button", { name: /^Comparar/ })).toBeDisabled();
    expect(screen.getByLabelText("JSON original")).toHaveAttribute("readonly");
    expect(
      screen.queryByRole("button", { name: "Cancelar" }),
    ).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(149));
    expect(
      screen.queryByRole("button", { name: "Cancelar" }),
    ).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeVisible();
    await act(async () => {
      release();
      await Promise.resolve();
    });
    expect(
      screen.queryByRole("button", { name: "Cancelar" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Comparar/ })).toBeEnabled();
  } finally {
    vi.useRealTimers();
  }
});

it.each([
  ["ASCII at limit", '"' + "a".repeat(1048574) + '"', true],
  ["ASCII over limit", '"' + "a".repeat(1048575) + '"', false],
  ["Unicode at limit", '"' + "😀".repeat(262143) + 'aa"', true],
  ["Unicode over limit", '"' + "😀".repeat(262143) + 'aaa"', false],
] as const)(
  "checks UTF-8 before dispatching to the worker: %s",
  async (_, text, valid) => {
    render(<App />);
    await loaded();
    observed.run.mockClear();
    fireEvent.change(screen.getByLabelText("JSON original"), {
      target: { value: text },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Comparar/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^Comparar/ })).toBeEnabled(),
    );
    expect(observed.run).toHaveBeenCalledTimes(valid ? 1 : 0);
    if (!valid)
      expect(
        screen
          .getAllByRole("alert")
          .some((e) => e.textContent?.includes("1 MiB em UTF-8")),
      ).toBe(true);
    expect(screen.getByLabelText("JSON original")).toHaveValue(text);
  },
);

it("formatting an already formatted document preserves its current result and filter", async () => {
  render(<App />);
  await loaded();
  fireEvent.click(screen.getByRole("radio", { name: "Informativas" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Formatar JSON original" }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Formatar JSON original" }),
    ).toBeEnabled(),
  );
  expect(
    screen.getByRole("button", { name: "Exportar relatório Markdown" }),
  ).toBeEnabled();
  expect(screen.getByRole("radio", { name: "Informativas" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  fireEvent.click(screen.getByRole("button", { name: /^Comparar/ }));
  expect(
    observed.run.mock.calls.filter(([job]) => job.operation === "compare"),
  ).toHaveLength(1);
});
