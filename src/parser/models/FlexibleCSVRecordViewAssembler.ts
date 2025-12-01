import type {
  AnyToken,
  CSVRecordAssemblerAssembleOptions,
  CSVRecordAssemblerCommonOptions,
  CSVRecordView,
} from "@/core/types.ts";
import { FlexibleCSVObjectRecordAssembler } from "@/parser/models/FlexibleCSVObjectRecordAssembler.ts";

/**
 * Experimental assembler that returns {@link CSVRecordView} records.
 *
 * Internally delegates to {@link FlexibleCSVObjectRecordAssembler} in record-view mode
 * but exposes a dedicated type so that hybrid array/object access is explicit.
 */
export class FlexibleCSVRecordViewAssembler<
  Header extends ReadonlyArray<string>,
> {
  #assembler: FlexibleCSVObjectRecordAssembler<Header>;

  constructor(options: CSVRecordAssemblerCommonOptions<Header> = {}) {
    this.#assembler = new FlexibleCSVObjectRecordAssembler<Header>(
      options,
      true,
    );
  }

  public *assemble(
    input?: AnyToken | Iterable<AnyToken>,
    options?: CSVRecordAssemblerAssembleOptions,
  ): IterableIterator<CSVRecordView<Header>> {
    yield* this.#assembler.assemble(input, options) as IterableIterator<
      CSVRecordView<Header>
    >;
  }
}
