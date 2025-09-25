import type { Root, LinkReference, Definition, Text, Parents } from "mdast";
import { toMarkdown, State, Info } from "mdast-util-to-markdown";
import { frontmatterToMarkdown } from "mdast-util-frontmatter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";
import { Config } from "./config.js";
import { AstInfoCollector } from "./ast-info-collector.js";
import { AstTransformer } from "./ast-transformer.js";

/**
 * Creates a unified processor for parsing Markdown.
 * @returns A unified processor.
 */
function createProcessor() {
  return unified().use(remarkParse).use(remarkFrontmatter, ["yaml", "toml"]);
}

/**
 * Parses a Markdown string into an AST.
 * @param markdown The Markdown content to parse.
 * @returns The parsed `Root` node of the AST.
 */
export function parseMarkdown(markdown: string): Root {
  const processor = createProcessor();
  const root = processor.parse(markdown) as Root;
  return root;
}

const simpleTextHandler = (
  node: Text,
  parent: Parents | undefined,
  state: State,
  info: Info,
): string => {
  const isLinkContext =
    state.stack.includes("link") ||
    state.stack.includes("linkReference") ||
    state.stack.includes("definition");

  if (isLinkContext) {
    return state.safe(node.value, info);
  }

  const UNESCAPE_SQUARE_BRACKETS = /\\(\[|\\])/g;
  const HUGO_SHORTCODE_UNESCAPE = /\\([<%])/g;
  const containsHugoShortcode = /\{\{[<%].*?[%>]\}\}/.test(node.value);

  let result = state.safe(node.value, info);
  result = result.replace(UNESCAPE_SQUARE_BRACKETS, "$1");

  if (containsHugoShortcode) {
    result = result.replace(HUGO_SHORTCODE_UNESCAPE, "$1");
  }

  return result;
};

const definitionHandler = (
  node: Definition,
  parent: Parents | undefined,
  state: State,
  info: Info,
): string => {
  const HUGO_SHORTCODE_PATTERN = /\{\{[<%].*?[%>]\}\}/;
  const url = node.url;

  if (HUGO_SHORTCODE_PATTERN.test(url)) {
    const safeTitle = node.title ? ` "${node.title}"` : "";
    return `[${node.identifier}]: ${url}${safeTitle}`;
  }

  if (url.startsWith("#")) {
    const safeTitle = node.title ? ` "${state.safe(node.title, info)}"` : "";
    return `[${node.identifier}]: ${url}${safeTitle}`;
  }

  const safeUrl = state.safe(node.url, info);
  const safeTitle = node.title ? ` "${state.safe(node.title, info)}"` : "";
  return `[${node.identifier}]: ${safeUrl}${safeTitle}`;
};

const customLinkReferenceHandler = (
  node: LinkReference,
  parent: Parents | undefined,
  state: State,
  info: Info,
): string => {
  const exit = state.enter("linkReference");
  const text = state.containerPhrasing(node, {
    ...info,
    before: "[",
    after: "]",
  });
  exit();

  if (node.referenceType === "shortcut") {
    return `[${text}]`;
  }

  const reference = state.safe(node.label || node.identifier, info);
  if (node.referenceType === "collapsed") {
    return `[${text}][${reference || ""}]`;
  }

  return `[${text}][${reference}]`;
};

const MARKDOWN_OPTIONS = {
  extensions: [frontmatterToMarkdown(["yaml", "toml"])],
  tightDefinitions: true,
  fences: true,
  resourceLink: true,
  handlers: {
    text: simpleTextHandler,
    definition: definitionHandler,
    linkReference: customLinkReferenceHandler,
  },
};

/**
 * Converts an AST to a Markdown string.
 * @param tree The `Root` node of the AST to convert to Markdown.
 * @returns The Markdown content.
 */
export function treeToMarkdown(tree: Root): string {
  return toMarkdown(tree, MARKDOWN_OPTIONS);
}

export interface TransformStats {
  linksConverted: number;
  conflictsFound: number;
  definitionsAdded: number;
}

/**
 * Transforms inline links to reference links in an AST.
 * @param tree The `Root` node of the AST to transform.
 * @param config The configuration for the transformation.
 * @returns An object containing the transformed tree and statistics.
 */
export function transformLinksToReferences(
  tree: Root,
  config?: Config,
): { tree: Root; stats: TransformStats } {
  const collector = new AstInfoCollector();
  collector.collect(tree);

  const transformer = new AstTransformer(tree, collector, config);
  const stats = transformer.transform();

  return { tree, stats };
}

/**
 * Transforms inline links to reference links in a Markdown string.
 * @param markdown The Markdown content to transform.
 * @param config The configuration for the transformation.
 * @returns An object containing the transformed content and statistics.
 */
export function transformMarkdownToReferences(
  markdown: string,
  config?: Config,
): { content: string; stats: TransformStats } {
  const tree = parseMarkdown(markdown);
  const { tree: transformedTree, stats } = transformLinksToReferences(
    tree,
    config,
  );
  const content = treeToMarkdown(transformedTree);
  return { content, stats };
}
