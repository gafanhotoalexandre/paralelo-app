import { expect, it } from "vitest";
import fixtures from "@/test/fixtures/examples.json";
import { compareJson } from "@/core/comparison";
import { filterDifferences, pageDifferences } from "./results";
for (const fixture of fixtures)
  for (const mode of ["structural", "content"] as const)
    it(`${fixture.id}: engine matches the reviewed example in ${mode}`, () => {
      const response = compareJson({
        before: fixture.before,
        after: fixture.after,
        mode,
      });
      expect(response.status).toBe("success");
      if (response.status !== "success") return;
      const expected = fixture.differences.filter(
        (d) => mode === "content" || d.kind !== "ValueChanged",
      );
      expect(
        response.result.differences.map((d) => [d.path, d.kind, d.risk]),
      ).toEqual(expected.map((d) => [d.path, d.kind, d.risk]));
      for (const d of response.result.differences) {
        const reference = expected.find((e) => e.path === d.path)!;
        for (const side of ["before", "after"] as const) {
          expect(d[side] === null).toBe(reference[side] === null);
          if (d[side])
            expect(JSON.parse(d[side]!.text)).toEqual(
              JSON.parse(reference[side]!.text),
            );
        }
      }
    });
it("keeps intersection filtering and pagination independent from the engine", () => {
  const fixture = fixtures[2]!,
    response = compareJson({
      before: fixture.before,
      after: fixture.after,
      mode: "content",
    });
  if (response.status !== "success") throw new Error("Expected result");
  expect(pageDifferences(response.result.differences, 0)).toHaveLength(25);
  expect(pageDifferences(response.result.differences, 1)).toHaveLength(7);
  expect(
    filterDifferences(
      response.result.differences,
      "potential",
      "PropertyAdded",
    ),
  ).toHaveLength(0);
});
