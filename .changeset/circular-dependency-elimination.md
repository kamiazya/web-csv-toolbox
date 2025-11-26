---
"web-csv-toolbox": patch
---

chore: eliminate circular dependencies and improve code quality

This patch improves the internal code structure by eliminating all circular dependencies and adding tooling to prevent future issues.

**Changes:**

- Introduced `madge` for circular dependency detection and visualization
- Eliminated circular dependencies:
  - `common/types.ts` ⇄ `utils/types.ts`: Merged type definitions into `common/types.ts`
  - `parseFile.ts` ⇄ `parseFileToArray.ts`: Refactored to use direct dependencies
- Fixed import paths in test files to consistently use `.ts` extension
- Added npm scripts for dependency analysis:
  - `check:circular`: Detect circular dependencies
  - `graph:main`: Visualize main entry point dependencies
  - `graph:worker`: Visualize worker entry point dependencies
  - `graph:json`, `graph:summary`, `graph:orphans`, `graph:leaves`: Various analysis tools
- Added circular dependency check to CI pipeline (`.github/workflows/.build.yaml`)
- Updated `.gitignore` to exclude generated dependency graph files

**Impact:**

- No runtime behavior changes
- Better maintainability and code structure
- Faster build times due to cleaner dependency graph
- Automated prevention of circular dependency introduction

**Breaking Changes:** None - this is purely an internal refactoring with no API changes.
