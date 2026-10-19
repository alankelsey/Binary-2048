const { expect, test } = require("@playwright/test");

test("concise reporter fixture", () => {
  expect(2 + 2).toBe(4);
});
