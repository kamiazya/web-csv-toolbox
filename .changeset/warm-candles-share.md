---
"web-csv-toolbox": patch
---

This pull request integrates Deno, Node.js, and Browsers CI workflows as CI and adds Release and Prerelease workflows as CD. It also includes the integration of the doc workflow to the CD workflow. These changes aim to improve the development and deployment processes by automating the testing, building, and releasing of the software.

- **New Features**
	- Introduced Continuous Deployment (CD) workflow for automated build and release processes.
	- Automated package deployment to npm.
	- Automated pre-release publishing.
	- Automated deployment of documentation to GitHub Pages.
- **Refactor**
	- Improved Continuous Integration (CI) workflow to include building and testing across different environments and platforms.
- **Chores**
	- Updated workflow names for better clarity.
