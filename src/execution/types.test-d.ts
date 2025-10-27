import { assertType, expectTypeOf } from "vitest";
import type {
  ExecutionOptions,
  ExecutionStrategy,
  ParseOptions,
} from "../common/types.ts";

// ExecutionStrategy type tests
expectTypeOf<ExecutionStrategy>().toEqualTypeOf<"worker" | "wasm">();

// ExecutionOptions type tests
expectTypeOf<ExecutionOptions>().toMatchTypeOf<{
  execution?: ExecutionStrategy[];
  workerURL?: string | URL;
}>();

// ParseOptions should include ExecutionOptions
expectTypeOf<ParseOptions>().toMatchTypeOf<ExecutionOptions>();

// Valid execution arrays
expectTypeOf<ExecutionStrategy[]>().toMatchTypeOf<[]>();
expectTypeOf<ExecutionStrategy[]>().toMatchTypeOf<["worker"]>();
expectTypeOf<ExecutionStrategy[]>().toMatchTypeOf<["wasm"]>();
expectTypeOf<ExecutionStrategy[]>().toMatchTypeOf<["worker", "wasm"]>();

// ParseOptions with execution
const options1: ParseOptions = { execution: [] };
const options2: ParseOptions = { execution: ["worker"] };
const options3: ParseOptions = { execution: ["wasm"] };
const options4: ParseOptions = { execution: ["worker", "wasm"] };
const options5: ParseOptions = {
  execution: ["worker"],
  workerURL: "/custom-worker.js",
};
const options6: ParseOptions = {
  execution: ["worker"],
  workerURL: new URL("/worker.js", "https://example.com"),
};

assertType<ParseOptions>(options1);
assertType<ParseOptions>(options2);
assertType<ParseOptions>(options3);
assertType<ParseOptions>(options4);
assertType<ParseOptions>(options5);
assertType<ParseOptions>(options6);

// Combined with other options
const options7: ParseOptions = {
  execution: ["worker"],
  delimiter: ",",
  quotation: '"',
};

assertType<ParseOptions>(options7);

// Invalid values should not compile (uncomment to test)
// const invalid1: ParseOptions = { execution: ["invalid"] };
// const invalid2: ParseOptions = { execution: "worker" }; // should be array
