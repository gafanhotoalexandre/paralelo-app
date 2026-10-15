import { describe, expect, it } from "vitest";
import { examples, initialExample } from "./examples";
import {
  differencesForMode,
  filterDifferences,
  isCurrentDemo,
  pageDifferences,
} from "./model";

describe("authored demonstration fixtures", () => {
  it("every saved range selects the entire documented value, with no external whitespace", () => {
    for (const example of examples)
      for (const difference of example.differences)
        for (const side of ["before", "after"] as const) {
          const snapshot = difference[side];
          if (!snapshot) continue;
          const token = example[side].slice(
            snapshot.range.from,
            snapshot.range.to,
          );
          expect(token, `${example.id}:${difference.path}:${side}`).toBe(
            token.trim(),
          );
          expect(JSON.parse(token)).toEqual(JSON.parse(snapshot.text));
          const segments = difference.path
            .slice(1)
            .split("/")
            .map((s) => s.replaceAll("~1", "/").replaceAll("~0", "~"));
          let value: unknown = JSON.parse(example[side]);
          for (const segment of segments)
            value = (value as Record<string, unknown>)[segment];
          expect(JSON.parse(token)).toEqual(value);
        }
  });
  it("shows only authored structural differences until content is selected and compared", () => {
    expect(
      differencesForMode(initialExample, "structural").map((d) => d.path),
    ).toEqual(["/apelido", "/ativo", "/cpf", "/documento", "/telefone"]);
    expect(differencesForMode(initialExample, "content")).toHaveLength(7);
  });
  it("keeps null directional and distinct from absence in the demonstration", () => {
    const find = (path: string) =>
      initialExample.differences.find((d) => d.path === path)!;
    expect(find("/apelido").risk).toBe("informative");
    expect(find("/apelido").before?.text).toBe("null");
    expect(find("/telefone").risk).toBe("potential");
    expect(find("/telefone").after?.text).toBe("null");
    expect(find("/cpf").after).toBeNull();
  });
  it("combines classification and change type by intersection", () => {
    const differences = differencesForMode(initialExample, "content");
    expect(
      filterDifferences(differences, "potential", "NullChanged").map(
        (d) => d.path,
      ),
    ).toEqual(["/telefone"]);
    expect(
      filterDifferences(differences, "informative", "PropertyRemoved"),
    ).toEqual([]);
  });
  it("paginates all 32 configuration differences without losing or repeating items", () => {
    const differences = differencesForMode(examples[2]!, "content");
    expect(differences).toHaveLength(32);
    expect(pageDifferences(differences, 0)).toHaveLength(25);
    expect(pageDifferences(differences, 1)).toHaveLength(7);
    expect([
      ...pageDifferences(differences, 0),
      ...pageDifferences(differences, 1),
    ]).toEqual(differences);
  });
  it("rejects stale revisions and modes even if their old results remain visible", () => {
    const texts = {
      before: initialExample.before,
      after: initialExample.after,
    };
    expect(
      isCurrentDemo(initialExample, texts, "structural", "structural"),
    ).toBe(true);
    expect(
      isCurrentDemo(
        initialExample,
        { ...texts, before: texts.before + " " },
        "structural",
        "structural",
      ),
    ).toBe(false);
    expect(isCurrentDemo(initialExample, texts, "content", "structural")).toBe(
      false,
    );
  });
});
