import { expect, test } from "vitest";

import {
  type CellArray,
  Sheet,
  SheetProxy,
  _cellify,
  _uncellify
} from "@okcontract/cells";

import { mapArrayRec } from "./mapArrayRec";

test("mapArrayRec array", async () => {
  const sheet = new Sheet();
  const proxy = new SheetProxy(sheet);
  const arr = _cellify(proxy, [1, 2, [3, [4]]]) as CellArray<number>;
  const fl = mapArrayRec(proxy, arr, (x: number) => x + 1);
  await expect(_uncellify(fl)).resolves.toEqual([2, 3, [4, [5]]]);
});
