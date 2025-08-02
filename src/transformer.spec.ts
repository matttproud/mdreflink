import {describe, it, expect} from 'vitest';
import {fromMarkdown} from 'mdast-util-from-markdown';
import {transformLinksToReferences, treeToMarkdown} from './transformer.js';
import {promises as fs} from 'fs';
import {readdirSync} from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {frontmatter} from 'micromark-extension-frontmatter';
import {frontmatterFromMarkdown} from 'mdast-util-frontmatter';

describe('transformLinksToReferences', () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const testDataDir = path.join(__dirname, '__fixtures__');
  const testFiles = readdirSync(testDataDir);

  // Create individual tests for each fixture file using toMatchFileSnapshot
  testFiles.forEach((file) => {
    describe(`fixture: ${file}`, () => {
      it('should transform correctly', async () => {
        const inputPath = path.join(testDataDir, file);
        const input = await fs.readFile(inputPath, 'utf8');

        const tree = fromMarkdown(input, {
          extensions: [frontmatter(['yaml', 'toml'])],
          mdastExtensions: [frontmatterFromMarkdown(['yaml', 'toml'])],
        });
        const {tree: transformedTree} = transformLinksToReferences(tree);
        const result = treeToMarkdown(transformedTree);

        // Normalize line endings for cross-platform compatibility.
        const normalizedResult = result.replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n');

        const snapshotFileName = `${file}.snap`;
        const snapshotPath = path.join(__dirname, '__snapshots__',
            snapshotFileName);
        await expect(normalizedResult).toMatchFileSnapshot(snapshotPath);
      });
    });
  });
});
