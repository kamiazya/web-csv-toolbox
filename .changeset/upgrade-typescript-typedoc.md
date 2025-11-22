---
"web-csv-toolbox": patch
---

chore: upgrade TypeScript to 5.9.3 and typedoc to 0.28.14 with enhanced documentation

**Developer Experience Improvements:**

- Upgraded TypeScript from 5.8.3 to 5.9.3
- Upgraded typedoc from 0.28.5 to 0.28.14
- Enabled strict type checking options (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- Enhanced TypeDoc configuration with version display, improved sorting, and navigation
- Integrated all documentation markdown files with TypeDoc using native `projectDocuments` support
- Added YAML frontmatter to all documentation files for better organization

**Type Safety Enhancements:**

- Added explicit `| undefined` to all optional properties for stricter type checking
- Added proper undefined checks for array/object indexed access
- Improved TextDecoderOptions usage to avoid explicit undefined values

**Documentation Improvements:**

- Enhanced TypeDoc navigation with categories, groups, and folders
- Added sidebar and navigation links to GitHub and npm
- Organized documentation into Tutorials, How-to Guides, Explanation, and Reference sections
- Improved documentation discoverability with YAML frontmatter grouping

**Breaking Changes:** None - all changes are backward compatible
