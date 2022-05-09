import { parse, stringify } from './libs';

test("import { Func }, Test from './test.ts';", () => {
  expect(stringify(parse(["import { Func }, Test from './test.ts';"]))).toBe(
    "import Test, { Func } from './test.ts';",
  );
});

test("import * as Test from './test.ts';", () => {
  expect(stringify(parse(["import * as Test from './test.ts';"]))).toBe(
    "import * as Test from './test.ts';",
  );
});

test("import Test = require('./test.ts');", () => {
  expect(stringify(parse(["import Test = require('./test.ts');"]))).toBe(
    "import Test = require('./test.ts');",
  );
});
