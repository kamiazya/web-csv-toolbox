/**
 * Default CSV Record Assembler.
 *
 * @remarks
 * This is an alias for {@link FlexibleCSVRecordAssembler}, which is the recommended
 * default implementation for CSV record assembly. It provides a good balance
 * between performance and memory efficiency.
 *
 * @example
 * ```typescript
 * import { DefaultCSVRecordAssembler } from 'web-csv-toolbox';
 *
 * const assembler = new DefaultCSVRecordAssembler<["name", "age"]>({
 *   header: ["name", "age"]
 * });
 * // Assemble tokens into records
 * ```
 */
export { FlexibleCSVRecordAssembler as DefaultCSVRecordAssembler } from "./FlexibleCSVRecordAssembler.ts";
