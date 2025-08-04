#!/usr/bin/env node

import {promises as fs} from 'fs';
import minimist from 'minimist';
import {unified} from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import {transformLinksToReferences, treeToMarkdown} from './transformer.js';
import packageJson from '../package.json' with { type: 'json' };

/**
 * Console interface for substitution
 */
export interface Console {
  log(message: string): void;
  error(message: string): void;
}

/**
 * Reads all content from a readable stream
 * @param stream - The readable stream to read from
 * @returns A promise that resolves to the stream content as a string
 */
async function readAll(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Logic for processing Markdown files
 * @param argv - Command line arguments parsed by minimist
 * @param logger - Console interface for output
 */
export async function run(
    argv: minimist.ParsedArgs,
    logger: Console = globalThis.console): Promise<void> {
  if (argv.help || argv.h) {
    logger.log(`mdreflink - Convert Markdown inline links to reference links

USAGE:
  mdreflink [OPTIONS] [FILE]

OPTIONS:
  -w, --write-in-place    Modify file in-place instead of writing to stdout
  -h, --help              Show this help message
  -v, --version           Show version information
  --stats                 Show transformation statistics

EXAMPLES:
  mdreflink document.md              # Output to stdout
  mdreflink -w document.md           # Modify file in-place
  cat file.md | mdreflink            # Process stdin
  mdreflink --stats document.md      # Show statistics
  mdreflink --help                   # Show this help
`);
    return;
  }

  if (argv.version || argv.v) {
    logger.log(packageJson.version);
    return;
  }

  const files = argv._;

  if (files.length > 1) {
    throw new Error('Only one file may be specified.');
  }

  const filePath = files[0];
  const writeInPlace = argv.w || argv['write-in-place'] || false;
  const useStdin = !filePath || filePath === '-';

  if (writeInPlace && useStdin) {
    throw new Error('The -w flag cannot be used with standard input.');
  }

  const input = useStdin ?
      await readAll(process.stdin) :
      await fs.readFile(filePath, 'utf8');

  const processor = unified()
      .use(remarkParse)
      .use(remarkFrontmatter, ['yaml', 'toml']);

  const tree = await processor.parse(input);

  const {tree: transformedTree, stats} = transformLinksToReferences(tree);

  const output = treeToMarkdown(transformedTree);

  if (argv.stats) {
    logger.error(`Links converted: ${stats.linksConverted}`);
    logger.error(`Conflicts found: ${stats.conflictsFound}`);
    logger.error(`Definitions added: ${stats.definitionsAdded}`);
  }

  if (writeInPlace) {
    if (input !== output) {
      await fs.writeFile(filePath, output, 'utf8');
    }
  } else {
    process.stdout.write(output);
  }
}

/**
 * Main entry point when run as a CLI tool
 */
export async function main() {
  try {
    const argv = minimist(process.argv.slice(2), {
      boolean: ['w', 'write-in-place', 'h', 'help', 'v', 'version', 'stats'],
      alias: {
        w: 'write-in-place',
        h: 'help',
        v: 'version',
      },
    });
    await run(argv);
  } catch (err: unknown) {
    const error = err as Error & {code?: string; path?: string};
    const message = error.code === 'ENOENT' ?
      `File not found at '${error.path}'.` :
      error.message || 'An unknown error occurred.';

    process.stderr.write(`Error: ${message}\n`);
    process.exit(1);
  }
}

main();
