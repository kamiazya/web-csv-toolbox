import { beforeAll, describe, expect, it } from "vitest";
import { loadWASM } from "./loadWASM.ts";
import { parseStringToArraySyncWASM } from "./parseStringToArraySyncWASM.ts";

describe("parseStringToArraySyncWASM", async () => {
  beforeAll(async () => {
    await loadWASM();
  });

  it("should parse CSV string to record of arrays", async () => {
    const csv = "a,b,c\n1,2,3";

    const result = parseStringToArraySyncWASM(csv);
    expect(result).toEqual([{ a: "1", b: "2", c: "3" }]);
  });
});
