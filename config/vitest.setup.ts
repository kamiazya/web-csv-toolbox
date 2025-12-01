import fc from "fast-check";

fc.configureGlobal({
  // This is the default value, but we set it here to be explicit.
  endOnFailure: true,
});
