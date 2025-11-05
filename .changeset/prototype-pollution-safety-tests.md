---
"web-csv-toolbox": patch
---

Add regression tests and documentation for prototype pollution safety

This changeset adds comprehensive tests and documentation to ensure that CSVRecordAssembler does not cause prototype pollution when processing CSV headers with dangerous property names.

**Security Verification:**
- Verified that `Object.fromEntries()` is safe from prototype pollution attacks
- Confirmed that dangerous property names (`__proto__`, `constructor`, `prototype`) are handled safely
- Added 8 comprehensive regression tests in `CSVRecordAssembler.prototype-safety.test.ts`

**Test Coverage:**
- Tests with `__proto__` as CSV header
- Tests with `constructor` as CSV header
- Tests with `prototype` as CSV header
- Tests with multiple dangerous property names
- Tests with multiple records
- Tests with quoted fields
- Baseline tests documenting `Object.fromEntries()` behavior

**Documentation:**
- Added detailed safety comments to all `Object.fromEntries()` usage in CSVRecordAssembler
- Documented why the implementation is safe from prototype pollution
- Added references to regression tests for verification

**Conclusion:**
The AI security report suggesting prototype pollution vulnerability was a false positive. `Object.fromEntries()` creates own properties (not prototype properties), making it inherently safe from prototype pollution attacks. This changeset provides regression tests to prevent future concerns and documents the safety guarantees.
