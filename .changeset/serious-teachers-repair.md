---
"web-csv-toolbox": patch
---

Fixes a test failure in the Lexer class and improves the escapeField function. 

Additionally, the escapeField function has been refactored to handle common options and improve performance. 

The occurrences utility has also been added to count the number of occurrences of a substring in a string. These changes address the issue #54 and improve the overall reliability and efficiency of the codebase.

- **New Features**
	- Enhanced filtering capability with validation checks.
	- Improved field escaping logic for data processing.

- **Refactor**
	- Optimized substring occurrence calculations with caching.
