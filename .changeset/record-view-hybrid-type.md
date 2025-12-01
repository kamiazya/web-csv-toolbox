---
"web-csv-toolbox": patch
---

Introduce `CSVRecordView<Header>` (object + named-tuple intersection) and a dedicated `outputFormat: 'record-view'` assembler so opt-in callers receive hybrid records (array indices + header keys) instead of plain objects.
