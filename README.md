# MDREFLINK

mdreflink rewrites Markdown files to use reference-style links. It finds all
inline links, such as `[text](href)`, and converts them to the shortcut
reference format, `[text]`.

A link's definition is placed at the end of the first section in which the
link's link text appears. Definitions are collected, de-duplicated, and sorted
lexicographically by their link text within their respective sections.

The program is a command-line tool that reads from standard input or a file
and writes to standard output or back to the source file.

## Installation

Install [globally] using [npm]:

```bash
npm install -g mdreflink
```

Or run directly without npm installation using [npx]:

```bash
npx mdreflink document.md
```

This [npx] approach is beneficial when you want to use `mdreflink`
occasionally without permanently installing it on your system, or when you
want to ensure you're always using the latest version without managing
updates manually.

[globally]: https://docs.npmjs.com/downloading-and-installing-packages-globally
[npm]: https://docs.npmjs.com/
[npx]: https://docs.npmjs.com/cli/v10/commands/npx

## Usage

The `mdreflink` tool operates in several modes.

**Read from a file, write to standard output:**\
Provide a file path as an argument. The formatted content is written to
stdout.

```bash
mdreflink document.md > formatted.md
```

**Read from standard input, write to standard output:**\
If no file path is given, or if the path is `-`, the program reads from
stdin.

```bash
mdreflink < document.md > formatted.md
```

**Modify a file in-place:**\
The `-w` flag instructs the program to modify the Markdown file directly.

```bash
mdreflink -w document.md
```

**Note:** The in-place flag is invalid when reading from standard input.

## Developer and Maintainer Instructions

Note that I am not a fluent JavaScript or TypeScript developer, so I am
providing this mostly for posterity for myself. This was probably my deepest
foray into that ecosystem for a project.

### Notes

This tool was initially developed through — drum roll — vibe coding the initial
project specification and heavily hand iterating on the output. It taught me
a lot about a complex and ornate ecosystem that I otherwise knew little about.

This was my first time really vibe coding a project. If you see something
curious or suboptimal, please flag it. At this point, will be developing this
exclusively by hand.

[![CI](https://github.com/matttproud/mdreflink/actions/workflows/ci.yml/badge.svg)](https://github.com/matttproud/mdreflink/actions/workflows/ci.yml)
[![Security](https://github.com/matttproud/mdreflink/actions/workflows/security.yml/badge.svg)](https://github.com/matttproud/mdreflink/actions/workflows/security.yml)
[![Cross-Platform](https://github.com/matttproud/mdreflink/actions/workflows/compatibility.yml/badge.svg)](https://github.com/matttproud/mdreflink/actions/workflows/compatibility.yml)
[![Package Health](https://github.com/matttproud/mdreflink/actions/workflows/package-check.yml/badge.svg)](https://github.com/matttproud/mdreflink/actions/workflows/package-check.yml)

[![npm version](https://badge.fury.io/js/mdreflink.svg)](https://badge.fury.io/js/mdreflink)
[![npm downloads](https://img.shields.io/npm/dm/mdreflink.svg)](https://www.npmjs.com/package/mdreflink)
[![Node.js Version](https://img.shields.io/node/v/mdreflink)](https://nodejs.org/)

[![codecov](https://codecov.io/gh/matttproud/mdreflink/branch/main/graph/badge.svg)](https://codecov.io/gh/matttproud/mdreflink)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

### Development Setup

A Node.js environment is required for development. After cloning the
repository, install the project dependencies:

```bash
npm install
```

This command installs libraries necessary for TypeScript compilation,
code execution, and testing.

### Building

To compile the TypeScript source code into JavaScript, run the build
script:

```bash
npm run build
```

This command uses the TypeScript compiler (tsc) to transpile the source
files from `src/` into the `dist/` directory, as specified in
`tsconfig.json`, and then uses esbuild to bundle the sources and transitive
dependencies into a CLI executable.

### Testing

To run the general test suite:

```bash
npm test
```

To update the test golden files ("snapshots"):

```bash
npm run test:update
```

Smoke testing can be achieved with:

```bash
npm test test:e2e
```

To run tests with coverage reporting:

```bash
npm run coverage
```

### Developer Workflows

For local development, after building, you can link the package to make
the `mdreflink` command available globally:

```bash
npm link
```

```bash
mdreflink document.md
```

To uninstall the global link:

```bash
npm unlink -g mdreflink
```

For local development without npm link, you can also run directly:

```bash
node dist/index.js document.md > formatted.md
```

### Package Validation

To validate the package configuration before publishing:

```bash
npm run lint:package
```

This runs [publint] to check for common packaging issues.

To preview what will be published:

```bash
npm pack
```

This creates a tarball showing exactly what files will be included in the
published package. Remember to clean up the generated .tgz file
afterward.

### Release Tagging

This project uses automated releases triggered by Git tags. Tags must follow the `v{version}` format (e.g., `v1.2.3`) to match JavaScript ecosystem conventions.

**To create a new release:**

1. Update the version in `package.json`:

   ```bash
   npm version patch  # or minor, major
   ```

2. Create an annotated tag with release notes:

   ```bash
   git tag -a v1.2.3 -m "Release v1.2.3

   - Add feature X
   - Fix bug Y
   - Update dependencies"
   ```

3. Push the tag to trigger automated release:
   ```bash
   git push origin v1.2.3
   ```

The GitHub Actions workflow will automatically:

- Run all tests (unit and e2e)
- Validate the package
- Publish to npm with provenance
- Create a GitHub release

**Note:** The tag version (without 'v' prefix) must exactly match the version in `package.json` or the release will fail.

[publint]: https://publint.dev/
