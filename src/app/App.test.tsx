import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { useImperativeHandle, useRef } from "react";
import { afterEach } from "vitest";
import { App } from "./App";
import type { EditorHandle } from "@/components/JsonEditor";
import type { Ref } from "react";

vi.mock("@/components/JsonEditor", () => ({
  JsonEditor: (props: {
    ref: Ref<EditorHandle>;
    side: string;
    initialText: string;
    visible: boolean;
    onChange(): void;
  }) => {
    const text = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(props.ref, () => ({
      getText: () => text.current!.value,
      setText(value) {
        text.current!.value = value;
        props.onChange();
      },
      focus() {
        text.current!.focus();
      },
      locate() {},
    }));
    return (
      <textarea
        hidden={!props.visible}
        aria-label={`JSON ${props.side === "before" ? "original" : "atualizado"}`}
        ref={text}
        defaultValue={props.initialText}
        onChange={props.onChange}
      />
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
afterEach(cleanup);
describe("demonstration workbench", () => {
  it("starts with a structural example and keeps old results until explicit comparison", () => {
    render(<App />);
    expect(screen.getByTestId("total-count")).toHaveTextContent("05");
    fireEvent.click(screen.getByRole("radio", { name: "Conteúdo" }));
    expect(screen.getByTestId("total-count")).toHaveTextContent("05");
    expect(
      screen.getByText(
        "Comparação desatualizada. A localização está indisponível.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Comparar/ }));
    expect(screen.getByTestId("total-count")).toHaveTextContent("07");
  });
  it("does not invent a comparison for edited documents, and disables locating the old result", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("JSON original"), {
      target: { value: '{"custom": true}' },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Comparar/ }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "A comparação livre ainda não está disponível",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "/ativo — Tipo alterado" }),
    );
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("button", { name: "Localizar no original" }),
    ).toBeDisabled();
  });
  it("preserves mode when loading another example and resets filters", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("radio", { name: "Conteúdo" }));
    fireEvent.click(screen.getByRole("radio", { name: "Potenciais" }));
    fireEvent.click(screen.getByRole("button", { name: "Exemplos" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Configuração de serviço/ }),
    );
    expect(screen.getByRole("radio", { name: "Conteúdo" })).toHaveAttribute(
      "data-state",
      "on",
    );
    expect(screen.getByTestId("total-count")).toHaveTextContent("32");
    expect(screen.getByRole("radio", { name: "Todas" })).toHaveAttribute(
      "data-state",
      "on",
    );
  });
  it("clears documents and results together", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Limpar documentos" }));
    expect(screen.getByLabelText("JSON original")).toHaveValue("");
    expect(screen.getByLabelText("JSON atualizado")).toHaveValue("");
    expect(screen.getByTestId("total-count")).toHaveTextContent("00");
  });
});
