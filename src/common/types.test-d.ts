import { describe, expectTypeOf, it } from "vitest";
import { CR, CRLF, LF } from "../constants";
import type {
  ExtractCSVHeader,
  Join,
  PickCSVHeader,
  Split,
} from "../utils/types";

const case1csv1 = '"na\nme,",age,city,zip';

const case1csv2 = `"name","age
","city","zi
p"
Alice,24,New York,10001
Bob,36,Los Angeles,90001`;

const case1csv3 = `"na"me","ag\ne
",city,"zi
p""
Alice,24,New York,10001
Bob,36,Los Angeles,90001`;

const case2csv1 = "'na\nme@'@age@city@zip";

const case2csv2 = `'name'@'age
'@'city'@'zi
p'
Alice@24@New York@10001
Bob@36@Los Angeles@90001`;

const case2csv3 = `'name'@'age

'@'c
ity'@'
zi
p'
Alice@'24'@'Ne
w York'@'10
001'
Bob@36@'Los Ange

les'@'9
0001'`;

const case2csv4 = `'name'@'age

'@'c
ity'@'
zi
p'`;

const case2csv5 = `'na${CR}me'@'age'@'ci${CR}${CRLF}ty'@'z${LF}ip'${CR}Alice@24@'New${CR}${LF} York'@10001${LF}Bob@'3${CRLF}6'@'Los Angeles'@'90${CRLF}001'`;

const case2csv6 = `'@name'@'age

'@'c
@ity@'@'
zi
p'
'Alice@'@'24'@'@Ne
w York'@'10
00@1'
Bob@36@'Lo@s Ange

les'@'@9
0001'`;

const case2csv7 = `'@name'@'a'g'e

'@'c
@i''ty@'@'
'zi
p''
'Al'ic'e@'@''24''@'@Ne
w Yo'r'k'@'10
00@1'
'Bob'@36@'Lo@s A'nge'

les'@'@9
0001'''`;

const case2csv8 =
  "'namdelimitere'delimiteragedelimitercitydelimiterzip\naadelimiterbbdelimiterccdelimiterdd\needelimiterffdelimiterggdelimiterhh";

const case2csv9 =
  "name@quotationa\ngequotation@city@zip\naa@quotationbb\nquotation@cc@dd\nee@quotationffquotation@gg@hh";

describe("Join", () => {
  describe("Generate new string by concatenating all of the elements in array", () => {
    it("Default", () => {
      expectTypeOf<Join<[]>>().toEqualTypeOf<"">();
      expectTypeOf<
        Join<["name", "age", "city", "zip"]>
      >().toEqualTypeOf<"name,age,city,zip">();
    });

    it("With different delimiter and quotation", () => {
      expectTypeOf<Join<[], "@", "$">>().toEqualTypeOf<"">();
      expectTypeOf<
        Join<["name", "age", "city", "zip"], "@", "$">
      >().toEqualTypeOf<"name@age@city@zip">();
    });

    it("Escape newlines and delimiters", () => {
      expectTypeOf<Join<[], "@", "$">>().toEqualTypeOf<"">();
      expectTypeOf<
        Join<["name", "a\nge", "city", "zip"]>
      >().toEqualTypeOf<'name,"a\nge",city,zip'>();
    });
  });
});

describe("Split", () => {
  describe("Generate a delimiter-separated tuple from a string", () => {
    it("Default", () => {
      expectTypeOf<Split<"">>().toEqualTypeOf<readonly string[]>();
      expectTypeOf<Split<"name,age,city,zip">>().toEqualTypeOf<
        readonly ["name", "age", "city", "zip"]
      >();
      expectTypeOf<Split<'"na"me","ag\ne",city,"zip""'>>().toEqualTypeOf<
        readonly ['na"me', "ag\ne", "city", 'zip"']
      >();
    });

    it("With different delimiter and quotation", () => {
      expectTypeOf<Split<"", "@", "$">>().toEqualTypeOf<readonly string[]>();
      expectTypeOf<
        Split<"$na$me$@$ag\ne$@city@$zip$$", "@", "$">
      >().toEqualTypeOf<readonly ["na$me", "ag\ne", "city", "zip$"]>();
      expectTypeOf<
        Split<'"name\r\n"\r\nage\r\ncity\r\nzip', "\r\n">
      >().toEqualTypeOf<readonly ["name\r\n", "age", "city", "zip"]>();
      expectTypeOf<
        Split<"namedelimiteragedelimitercitydelimiterzip", "delimiter">
      >().toEqualTypeOf<readonly ["name", "age", "city", "zip"]>();
      expectTypeOf<
        Split<"name,quotationa\ngequotation,city,zip", ",", "quotation">
      >().toEqualTypeOf<readonly ["name", "a\nge", "city", "zip"]>();
    });
  });
});

describe("ExtractCSVHeader", () => {
  describe("Extract a CSV header string from a CSVString", () => {
    it("Default", () => {
      expectTypeOf<ExtractCSVHeader<"">>().toEqualTypeOf<"">();
      expectTypeOf<ExtractCSVHeader<ReadableStream<"">>>().toEqualTypeOf<"">();

      expectTypeOf<
        ExtractCSVHeader<typeof case1csv1>
      >().toEqualTypeOf<'"na\nme,",age,city,zip'>();
      expectTypeOf<
        ExtractCSVHeader<ReadableStream<typeof case1csv1>>
      >().toEqualTypeOf<'"na\nme,",age,city,zip'>();

      expectTypeOf<
        ExtractCSVHeader<typeof case1csv2>
      >().toEqualTypeOf<'"name","age\n","city","zi\np"'>();
      expectTypeOf<
        ExtractCSVHeader<ReadableStream<typeof case1csv2>>
      >().toEqualTypeOf<'"name","age\n","city","zi\np"'>();

      expectTypeOf<
        ExtractCSVHeader<typeof case1csv2>
      >().toEqualTypeOf<'"name","age\n","city","zi\np"'>();
      expectTypeOf<
        ExtractCSVHeader<ReadableStream<typeof case1csv2>>
      >().toEqualTypeOf<'"name","age\n","city","zi\np"'>();

      expectTypeOf<
        ExtractCSVHeader<typeof case1csv3>
      >().toEqualTypeOf<'"na"me","ag\ne\n",city,"zi\np""'>();
      expectTypeOf<
        ExtractCSVHeader<ReadableStream<typeof case1csv3>>
      >().toEqualTypeOf<'"na"me","ag\ne\n",city,"zi\np""'>();
    });

    it("With different delimiter and quotation", () => {
      expectTypeOf<ExtractCSVHeader<"", "@", "$">>().toEqualTypeOf<"">();
      expectTypeOf<
        ExtractCSVHeader<ReadableStream<"">, "@", "$">
      >().toEqualTypeOf<"">();

      expectTypeOf<
        ExtractCSVHeader<typeof case2csv1, "@", "'">
      >().toEqualTypeOf<"'na\nme@'@age@city@zip">();
      expectTypeOf<
        ExtractCSVHeader<ReadableStream<typeof case2csv1>, "@", "'">
      >().toEqualTypeOf<"'na\nme@'@age@city@zip">();

      expectTypeOf<
        ExtractCSVHeader<typeof case2csv2, "@", "'">
      >().toEqualTypeOf<"'name'@'age\n'@'city'@'zi\np'">();
      expectTypeOf<
        ExtractCSVHeader<ReadableStream<typeof case2csv2>, "@", "'">
      >().toEqualTypeOf<"'name'@'age\n'@'city'@'zi\np'">();

      expectTypeOf<
        ExtractCSVHeader<typeof case2csv3, "@", "'">
      >().toEqualTypeOf<"'name'@'age\n\n'@'c\nity'@'\nzi\np'">();
      expectTypeOf<
        ExtractCSVHeader<ReadableStream<typeof case2csv3>, "@", "'">
      >().toEqualTypeOf<"'name'@'age\n\n'@'c\nity'@'\nzi\np'">();

      expectTypeOf<
        ExtractCSVHeader<typeof case2csv4, "@", "'">
      >().toEqualTypeOf<"'name'@'age\n\n'@'c\nity'@'\nzi\np'">();
      expectTypeOf<
        ExtractCSVHeader<ReadableStream<typeof case2csv4>, "@", "'">
      >().toEqualTypeOf<"'name'@'age\n\n'@'c\nity'@'\nzi\np'">();

      expectTypeOf<
        ExtractCSVHeader<typeof case2csv5, "@", "'">
      >().toEqualTypeOf<"'na\rme'@'age'@'ci\r\r\nty'@'z\nip'">();
      expectTypeOf<
        ExtractCSVHeader<ReadableStream<typeof case2csv5>, "@", "'">
      >().toEqualTypeOf<"'na\rme'@'age'@'ci\r\r\nty'@'z\nip'">();

      expectTypeOf<
        ExtractCSVHeader<typeof case2csv6, "@", "'">
      >().toEqualTypeOf<"'@name'@'age\n\n'@'c\n@ity@'@'\nzi\np'">();
      expectTypeOf<
        ExtractCSVHeader<ReadableStream<typeof case2csv6>, "@", "'">
      >().toEqualTypeOf<"'@name'@'age\n\n'@'c\n@ity@'@'\nzi\np'">();

      expectTypeOf<
        ExtractCSVHeader<typeof case2csv7, "@", "'">
      >().toEqualTypeOf<"'@name'@'a'g'e\n\n'@'c\n@i''ty@'@'\n'zi\np''">();
      expectTypeOf<
        ExtractCSVHeader<ReadableStream<typeof case2csv7>, "@", "'">
      >().toEqualTypeOf<"'@name'@'a'g'e\n\n'@'c\n@i''ty@'@'\n'zi\np''">();

      expectTypeOf<
        ExtractCSVHeader<typeof case2csv8, "delimiter", "'">
      >().toEqualTypeOf<"'namdelimitere'delimiteragedelimitercitydelimiterzip">();
      expectTypeOf<
        ExtractCSVHeader<ReadableStream<typeof case2csv8>, "delimiter", "'">
      >().toEqualTypeOf<"'namdelimitere'delimiteragedelimitercitydelimiterzip">();

      expectTypeOf<
        ExtractCSVHeader<typeof case2csv9, "@", "quotation">
      >().toEqualTypeOf<"name@quotationa\ngequotation@city@zip">();
      expectTypeOf<
        ExtractCSVHeader<ReadableStream<typeof case2csv9>, "@", "quotation">
      >().toEqualTypeOf<"name@quotationa\ngequotation@city@zip">();
    });
  });
});

describe("PickCSVHeader", () => {
  describe("Generates a delimiter-separated tuple of CSV headers from a CSVString", () => {
    it("Default", () => {
      expectTypeOf<PickCSVHeader<"">>().toEqualTypeOf<readonly string[]>();
      expectTypeOf<PickCSVHeader<ReadableStream<"">>>().toEqualTypeOf<
        readonly string[]
      >();

      expectTypeOf<PickCSVHeader<typeof case1csv1>>().toEqualTypeOf<
        readonly ["na\nme,", "age", "city", "zip"]
      >();
      expectTypeOf<
        PickCSVHeader<ReadableStream<typeof case1csv1>>
      >().toEqualTypeOf<readonly ["na\nme,", "age", "city", "zip"]>();

      expectTypeOf<PickCSVHeader<typeof case1csv2>>().toEqualTypeOf<
        readonly ["name", "age\n", "city", "zi\np"]
      >();
      expectTypeOf<
        PickCSVHeader<ReadableStream<typeof case1csv2>>
      >().toEqualTypeOf<readonly ["name", "age\n", "city", "zi\np"]>();

      expectTypeOf<PickCSVHeader<typeof case1csv2>>().toEqualTypeOf<
        readonly ["name", "age\n", "city", "zi\np"]
      >();
      expectTypeOf<
        PickCSVHeader<ReadableStream<typeof case1csv2>>
      >().toEqualTypeOf<readonly ["name", "age\n", "city", "zi\np"]>();

      expectTypeOf<PickCSVHeader<typeof case1csv3>>().toEqualTypeOf<
        readonly ['na"me', "ag\ne\n", "city", 'zi\np"']
      >();
      expectTypeOf<
        PickCSVHeader<ReadableStream<typeof case1csv3>>
      >().toEqualTypeOf<readonly ['na"me', "ag\ne\n", "city", 'zi\np"']>();
    });

    it("With different delimiter and quotation", () => {
      expectTypeOf<PickCSVHeader<"", "@", "$">>().toEqualTypeOf<
        readonly string[]
      >();
      expectTypeOf<PickCSVHeader<ReadableStream<"">, "@", "$">>().toEqualTypeOf<
        readonly string[]
      >();

      expectTypeOf<PickCSVHeader<typeof case2csv1, "@", "'">>().toEqualTypeOf<
        readonly ["na\nme@", "age", "city", "zip"]
      >();
      expectTypeOf<
        PickCSVHeader<ReadableStream<typeof case2csv1>, "@", "'">
      >().toEqualTypeOf<readonly ["na\nme@", "age", "city", "zip"]>();

      expectTypeOf<PickCSVHeader<typeof case2csv2, "@", "'">>().toEqualTypeOf<
        readonly ["name", "age\n", "city", "zi\np"]
      >();
      expectTypeOf<
        PickCSVHeader<ReadableStream<typeof case2csv2>, "@", "'">
      >().toEqualTypeOf<readonly ["name", "age\n", "city", "zi\np"]>();

      expectTypeOf<PickCSVHeader<typeof case2csv3, "@", "'">>().toEqualTypeOf<
        readonly ["name", "age\n\n", "c\nity", "\nzi\np"]
      >();
      expectTypeOf<
        PickCSVHeader<ReadableStream<typeof case2csv3>, "@", "'">
      >().toEqualTypeOf<readonly ["name", "age\n\n", "c\nity", "\nzi\np"]>();

      expectTypeOf<PickCSVHeader<typeof case2csv4, "@", "'">>().toEqualTypeOf<
        readonly ["name", "age\n\n", "c\nity", "\nzi\np"]
      >();
      expectTypeOf<
        PickCSVHeader<ReadableStream<typeof case2csv4>, "@", "'">
      >().toEqualTypeOf<readonly ["name", "age\n\n", "c\nity", "\nzi\np"]>();

      expectTypeOf<PickCSVHeader<typeof case2csv5, "@", "'">>().toEqualTypeOf<
        readonly ["na\rme", "age", "ci\r\r\nty", "z\nip"]
      >();
      expectTypeOf<
        PickCSVHeader<ReadableStream<typeof case2csv5>, "@", "'">
      >().toEqualTypeOf<readonly ["na\rme", "age", "ci\r\r\nty", "z\nip"]>();

      expectTypeOf<PickCSVHeader<typeof case2csv6, "@", "'">>().toEqualTypeOf<
        readonly ["@name", "age\n\n", "c\n@ity@", "\nzi\np"]
      >();
      expectTypeOf<
        PickCSVHeader<ReadableStream<typeof case2csv6>, "@", "'">
      >().toEqualTypeOf<readonly ["@name", "age\n\n", "c\n@ity@", "\nzi\np"]>();

      expectTypeOf<PickCSVHeader<typeof case2csv7, "@", "'">>().toEqualTypeOf<
        readonly ["@name", "a'g'e\n\n", "c\n@i''ty@", "\n'zi\np'"]
      >();
      expectTypeOf<
        PickCSVHeader<ReadableStream<typeof case2csv7>, "@", "'">
      >().toEqualTypeOf<
        readonly ["@name", "a'g'e\n\n", "c\n@i''ty@", "\n'zi\np'"]
      >();

      expectTypeOf<
        PickCSVHeader<typeof case2csv8, "delimiter", "'">
      >().toEqualTypeOf<readonly ["namdelimitere", "age", "city", "zip"]>();
      expectTypeOf<
        PickCSVHeader<ReadableStream<typeof case2csv8>, "delimiter", "'">
      >().toEqualTypeOf<readonly ["namdelimitere", "age", "city", "zip"]>();

      expectTypeOf<
        PickCSVHeader<typeof case2csv9, "@", "quotation">
      >().toEqualTypeOf<readonly ["name", "a\nge", "city", "zip"]>();
      expectTypeOf<
        PickCSVHeader<ReadableStream<typeof case2csv9>, "@", "quotation">
      >().toEqualTypeOf<readonly ["name", "a\nge", "city", "zip"]>();
    });
  });
});
