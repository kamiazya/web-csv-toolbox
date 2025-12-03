import fc from "fast-check";

fc.configureGlobal({
  // Set to true to stop property tests on first failure (default is false).
  // This speeds up test runs by avoiding unnecessary iterations after a counterexample is found.
  endOnFailure: true,
});
