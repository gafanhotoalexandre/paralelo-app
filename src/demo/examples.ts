import fixtures from "./fixtures.json";
import type { DemoExample } from "./model";
// Authored fixtures only. No comparison or parsing of user documents happens here.
export const examples = fixtures as readonly DemoExample[];
export const initialExample = examples[0]!;
