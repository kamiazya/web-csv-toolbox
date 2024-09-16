### Works on Node.js

| Versions | Status |
| -------- | ------ |
| 20.x     | ✅     |
| 18.x     | ✅     |


### Works on Browser

| OS      | Chrome | FireFox | Default       |
| ------- | ------ | ------- | ------------- |
| Windows | ✅     | ✅      | ✅ (Edge)     |
| macos   | ✅     | ✅      | ⬜ (Safari *) |
| Linux   | ✅     | ✅      | -             |

> **\* To Be Tested**:  [I couldn't launch Safari in headless mode](https://github.com/vitest-dev/vitest/blob/main/packages/browser/src/node/providers/webdriver.ts#L39-L41) on GitHub Actions, so I couldn't verify it, but it probably works.

### Others

- Verify that JavaScript is executable on the Deno.
