import { parseIsoDuration } from "../src/lib/youtube.ts";

const cases: Array<[string, number]> = [
  ["PT3M33S", 213],
  ["PT1H2M3S", 3723],
  ["PT20M47S", 1247],
  ["PT58S", 58],
  ["P1DT2H", 93600],
  ["PT0S", 0],
  ["P0D", 0],
  ["", 0],
  ["garbage", 0],
];
let pass = 0, fail = 0;
for (const [input, expected] of cases) {
  const got = parseIsoDuration(input);
  const ok = got === expected;
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${JSON.stringify(input).padEnd(12)} -> ${String(got).padStart(6)}  (expected ${expected})`);
}
console.log(`\n${pass} passed, ${fail} failed`);
