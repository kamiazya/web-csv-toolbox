import { fc } from "@fast-check/vitest";

fc.configureGlobal({
  endOnFailure: true,
  // This is the default value, but we set it here to be explicit.
});
