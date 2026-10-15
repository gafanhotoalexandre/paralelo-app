// Input tokens have already passed strict JSON grammar validation.
// Numeric value never passes through Number, parseFloat or exponent expansion.
export function canonicalNumber(token: string): string {
  const negative = token[0] === "-";
  const unsigned = negative ? token.slice(1) : token;
  const exponentIndex = unsigned.search(/[eE]/);
  const mantissa =
    exponentIndex < 0 ? unsigned : unsigned.slice(0, exponentIndex);
  const point = mantissa.indexOf(".");
  const fractionLength = point < 0 ? 0 : mantissa.length - point - 1;
  const digits = mantissa.replace(".", "").replace(/^0+/, "");
  if (!digits) return "0"; // Avoid expensive exponents when the mantissa is zero.
  const significant = digits.replace(/0+$/, "");
  const exponentText =
    exponentIndex < 0 ? "0" : unsigned.slice(exponentIndex + 1);
  const exponent =
    BigInt(exponentText) -
    BigInt(fractionLength) +
    BigInt(digits.length - significant.length);
  return `${negative ? "-" : ""}${significant}e${exponent}`;
}
