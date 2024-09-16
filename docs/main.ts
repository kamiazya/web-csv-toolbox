import { Liquid } from "liquidjs";
import { readFile, writeFile } from "node:fs/promises";

const engine = new Liquid({
  root: ["src"],
  extname: ".md",
});

async function generateREADMEs() {
  await Promise.all(
    ["web-csv-toolbox", "parser", "wasm", "shared", "common"]
      .map((name) => ({
        path: new URL(
          import.meta.resolve(`../packages/${name}/README.md`, import.meta.url),
        ).pathname,
        contents: (async function* () {
          const content = await readFile(
            new URL(`./src/README/${name}.md`, import.meta.url).pathname,
            "utf-8",
          );

          const packageInfo = JSON.parse(
            await readFile(
              new URL(`../packages/${name}/package.json`, import.meta.url)
                .pathname,
              "utf-8",
            ),
          );

          yield await engine.parseAndRender(content, packageInfo);
        })(),
      }))
      .map(async ({ path, contents }) => writeFile(path, contents)),
  );
}

await generateREADMEs();
