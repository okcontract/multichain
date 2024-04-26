import { expect, test } from "bun:test";

test("using UInt8Array as map keys", () => {
  const map = new Map();

  const buffer1 = new Uint8Array([1, 2, 3]);
  const buffer2 = new Uint8Array([1, 2, 3]);

  map.set(buffer1, "foo");

  expect(map.get(buffer1)).toBe("foo");
  expect(map.get(buffer2)).toBeUndefined();
});
