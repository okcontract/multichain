import { expect, test } from "bun:test";

import {
  type CellArray,
  Sheet,
  SheetProxy,
  cellify,
  uncellify
} from "@okcontract/cells";

import { mapArrayRec } from "./mapArrayRec";

test("mapArrayRec array", async () => {
  const sheet = new Sheet();
  const proxy = new SheetProxy(sheet);
  const arr = cellify(proxy, [1, 2, [3, [4]]]) as CellArray<number>;
  const fl = mapArrayRec(proxy, arr, (x: number) => x + 1);
  await expect(uncellify(fl)).resolves.toEqual([2, 3, [4, [5]]]);
});
