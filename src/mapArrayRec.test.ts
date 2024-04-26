import { expect, test } from "vitest";

import {
  type CellArray,
  Sheet,
  SheetProxy,
  uncellify
} from "@okcontract/cells";

import { mapArrayRec } from "./mapArrayRec";

test("mapArrayRec array", async () => {
  const sheet = new Sheet();
  const proxy = new SheetProxy(sheet);
  const arr = proxy.new([
    proxy.new(1),
    proxy.new(2),
    proxy.new([proxy.new(3), proxy.new([proxy.new(4)])])
  ]) as CellArray<number>;
  const fl = mapArrayRec(proxy, arr, (x: number) => x + 1);
  await expect(uncellify(fl)).resolves.toEqual([2, 3, [4, [5]]]);
});
