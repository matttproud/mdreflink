import type {
  Root, Link, LinkReference, Definition, Node, RootContent,
  PhrasingContent, Text, Parents,
} from 'mdast';
import {visit} from 'unist-util-visit';
import {toString} from 'mdast-util-to-string';
import {toMarkdown, State, Info} from 'mdast-util-to-markdown';
import {frontmatterToMarkdown} from 'mdast-util-frontmatter';

/**
 * Preserves square brackets in non-link contexts.
 * @param node - The text node being processed
 * @param parent - The parent node
 * @param state - The markdown generation state
 * @param info - Context information about the current position
 * @returns The processed text with appropriate escaping
 */
const simpleTextHandler = (node: Text, parent: Parents | undefined,
    state: State, info: Info): string => {
  const isLinkContext = state.stack.includes('link') ||
      state.stack.includes('linkReference') ||
      state.stack.includes('definition');

  if (isLinkContext) {
    return state.safe(node.value, info);
  }

  // - Converts: "Text with \[brackets]" → "Text with [brackets]"
  // - Preserves: "Text with \*asterisks*" → "Text with \*asterisks*"
  const UNESCAPE_SQUARE_BRACKETS = /\\(\[|\])/g;

  // Hugo shortcode patterns - preserve angle brackets and percent signs.
  const HUGO_SHORTCODE_UNESCAPE = /\\([<%])/g;
  const containsHugoShortcode = /\{\{[<%].*?[%>]\}\}/.test(node.value);

  let result = state.safe(node.value, info);
  result = result.replace(UNESCAPE_SQUARE_BRACKETS, '$1');

  // If the text contains Hugo shortcodes, unescape the delimiters.
  if (containsHugoShortcode) {
    result = result.replace(HUGO_SHORTCODE_UNESCAPE, '$1');
  }

  return result;
};

/**
 * Preserves Hugo shortcodes in definition URLs.
 * @param node - The definition node being processed
 * @param parent - The parent node
 * @param state - The markdown generation state
 * @param info - Context information about the current position
 * @returns The processed definition with appropriate escaping
 */
const definitionHandler = (node: Definition, parent: Parents | undefined,
    state: State, info: Info): string => {
  // Preserve Hugo shortcodes in URLs like {{<ref>}} and {{% ref %}}.
  const HUGO_SHORTCODE_PATTERN = /\{\{[<%].*?[%>]\}\}/;
  const url = node.url;

  // If the URL contains Hugo shortcodes, don't escape them.
  if (HUGO_SHORTCODE_PATTERN.test(url)) {
    const safeTitle = node.title ? ` "${node.title}"` : '';
    return `[${node.identifier}]: ${url}${safeTitle}`;
  }

  // For non-Hugo URLs, manually construct the definition to avoid recursion.
  const safeUrl = state.safe(node.url, info);
  const safeTitle = node.title ? ` "${state.safe(node.title, info)}"` : '';
  return `[${node.identifier}]: ${safeUrl}${safeTitle}`;
};

const MARKDOWN_OPTIONS = {
  extensions: [frontmatterToMarkdown(['yaml', 'toml'])],
  tightDefinitions: true,
  fences: true,
  resourceLink: true,
  handlers: {
    text: simpleTextHandler,
    definition: definitionHandler,
  },
};

/**
 * Converts an mdast tree to markdown string using standard options.
 * @param tree - The mdast tree to convert
 * @returns The generated markdown string
 */
export function treeToMarkdown(tree: Root): string {
  return toMarkdown(tree, MARKDOWN_OPTIONS);
}

const DISALLOWED_INNER_LINK_ELEMENTS: string[] = [
  // Add element types here that should prevent reference link creation.
  // e.g., 'image', 'html', etc.
];

/**
 * Statistics about the transformation process.
 */
export interface TransformStats {
    linksConverted: number;
    conflictsFound: number;
    definitionsAdded: number;
}

/**
 * Check if a link contains disallowed content types.
 * @param linkNode - The link node to check
 * @returns True if the link contains disallowed content
 */
function hasDisallowedElements(linkNode: Link | LinkReference): boolean {
  let hasDisallowed = false;
  visit({type: 'root', children: linkNode.children}, (node: Node): boolean | void => { // eslint-disable-line max-len
    if (DISALLOWED_INNER_LINK_ELEMENTS.includes(node.type)) {
      hasDisallowed = true;
      return false; // Stop traversal.
    }
  });
  return hasDisallowed;
}

/**
 * Transform inline links to reference links in a markdown AST.
 * @param tree - The mdast tree to transform
 * @returns Object containing the transformed tree and statistics
 */
export function transformLinksToReferences(tree: Root): { tree: Root; stats: TransformStats } { // eslint-disable-line max-len
  const linkTextToUrls = new Map<string, Set<string>>();
  const existingDefs = new Map<string, Definition>();
  const stats: TransformStats = {
    linksConverted: 0,
    conflictsFound: 0,
    definitionsAdded: 0,
  };

  // Gather all existing link definitions.
  visit(tree, (node: Node): void => {
    if (node.type === 'definition') {
      existingDefs.set((node as Definition).identifier, node as Definition);
    }
  });

  // Gather all links: long form or reference.
  visit(tree, (node: Node): void => {
    if (node.type === 'link' || node.type === 'linkReference') {
      const linkNode = node as Link | LinkReference;
      const linkText = toString(linkNode);
      if (!linkText) return;

      if (hasDisallowedElements(linkNode)) return;

      let url: string | undefined;
      if (linkNode.type === 'link') {
        url = linkNode.url;
      } else {
        const def = existingDefs.get(linkNode.identifier);
        url = def?.url;
      }

      if (url) {
        if (!linkTextToUrls.has(linkText)) {
          linkTextToUrls.set(linkText, new Set());
        }
        linkTextToUrls.get(linkText)!.add(url);
      }
    }
  });

  // Identify conflicting link texts (same text, different URLs).
  const conflictingTexts = new Set(
      [...linkTextToUrls.entries()]
          .filter(([, urls]) => urls.size > 1)
          .map(([text]) => text),
  );
  stats.conflictsFound = conflictingTexts.size;

  // --- 2. Link Transformation Pass --- //
  // Mutate the tree to transform links into their final form.
  visit(tree, (node: Node, index: number | undefined, parent: Parents | undefined): void => { // eslint-disable-line max-len
    if (node.type !== 'link' && node.type !== 'linkReference') {
      return;
    }
    // Skip nodes that can't be replaced: root nodes (no parent) or
    // nodes not in a children array (no index).
    if (!parent || index === undefined) return;

    const linkNode = node as Link | LinkReference;
    const linkText = toString(linkNode);
    if (!linkText) return;

    if (hasDisallowedElements(linkNode)) return;

    // If it's a conflicting link, ensure it's an inline link.
    if (conflictingTexts.has(linkText)) {
      if (linkNode.type === 'linkReference') {
        const url = existingDefs.get(linkNode.identifier)?.url;
        if (url) {
          const newLink: Link = {
            type: 'link',
            url: url,
            children: linkNode.children as PhrasingContent[],
          };
          parent.children[index] = newLink;
        }
      }
      // If it's already a 'link', it's in the correct form.
    } else {
      // If it's not conflicting, ensure it's a shortcut reference.
      // Convert the link children to markdown text for the identifier.
      const identifier = toMarkdown({
        type: 'paragraph',
        children: linkNode.children,
      })
          .replace(/^\s+|\s+$/g, '').replace(/\n/g, ' ');
      const newRef: LinkReference = {
        type: 'linkReference',
        identifier: identifier,
        label: identifier,
        referenceType: 'shortcut',
        children: linkNode.children as PhrasingContent[],
      };
      parent.children[index] = newRef;

      // Only count as converted if we're converting from inline to reference.
      if (linkNode.type === 'link') {
        stats.linksConverted++;
      }
    }
  });

  // --- 3. Reconstruction and Definition Placement Pass --- //
  const newTreeChildren: RootContent[] = [];
  const sections: RootContent[][] = [];
  let currentSection: RootContent[] = [];

  // Remove all existing definitions; we will re-add them where appropriate.
  tree.children = tree.children.filter((node) => node.type !== 'definition');

  // Divide the transformed tree into sections by heading.
  for (const node of tree.children) {
    if (node.type === 'heading') {
      if (currentSection.length > 0) {
        sections.push(currentSection);
      }
      currentSection = [node];
    } else {
      currentSection.push(node);
    }
  }
  if (currentSection.length > 0) {
    sections.push(currentSection);
  }

  const definitionCreatedFor = new Set<string>();

  // Process each section to place definitions correctly.
  for (const section of sections) {
    newTreeChildren.push(...section);
    const defsForThisSection = new Map<string, Definition>();

    const sectionRoot: Root = {type: 'root', children: section};
    visit(sectionRoot, (node: Node): void => {
      if (node.type !== 'linkReference') {
        return;
      }
      const linkNode = node as LinkReference;
      // Use for both conflict checking and definition creation.
      const linkText = toString(linkNode);
      // Use the identifier from the linkReference.
      const linkIdentifier = linkNode.identifier;
      if (conflictingTexts.has(linkText) ||
          definitionCreatedFor.has(linkIdentifier)) {
        return;
      }

      // Skip links with disallowed content types.
      if (hasDisallowedElements(linkNode)) return;

      if (!defsForThisSection.has(linkIdentifier)) {
        const url = linkTextToUrls.get(linkText)?.values().next().value;
        if (url) {
          defsForThisSection.set(linkIdentifier, {
            type: 'definition',
            identifier: linkIdentifier,
            label: linkIdentifier,
            url: url,
          });
        }
      }
    });

    // Sort definitions lexicographically by identifier.
    const sortedIdentifiers = Array.from(defsForThisSection.keys()).sort();
    for (const id of sortedIdentifiers) {
      newTreeChildren.push(defsForThisSection.get(id)!);
      definitionCreatedFor.add(id);
      stats.definitionsAdded++;
    }
  }

  tree.children = newTreeChildren;
  return {tree, stats};
}
