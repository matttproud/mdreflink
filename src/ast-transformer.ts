import type {
  Root,
  Link,
  LinkReference,
  Definition,
  Node,
  RootContent,
  Heading,
} from "mdast";
import { toString } from "mdast-util-to-string";
import { toMarkdown } from "mdast-util-to-markdown";
import { Config } from "./config.js";
import {
  AstInfoCollector,
  LinkItem,
  LinkIdentifier,
  normalizeIdentifier,
  normalizeLinkName,
  extractLinkTextLiteral,
} from "./ast-info-collector.js";
import { TransformStats } from "./transformer.js";

export class AstTransformer {
  constructor(
    private tree: Root,
    private info: AstInfoCollector,
    private config?: Config,
  ) {}

  public transform(): TransformStats {
    const stats: TransformStats = {
      linksConverted: 0,
      conflictsFound: 0,
      definitionsAdded: 0,
    };

    const linkIdToUrls = new Map<number, Set<string>>();
    const allLinkItems = [...this.info.linksById.values()].flat();

    for (const linkItem of allLinkItems) {
      if (!linkIdToUrls.has(linkItem.id)) {
        linkIdToUrls.set(linkItem.id, new Set());
      }

      let url: string | undefined;
      if (linkItem.elem.type === "link") {
        url = linkItem.elem.url;
      } else {
        const defId = normalizeIdentifier(linkItem.elem.identifier);
        const defItem = this.info.definitionsByIdentifier.get(defId);
        url = defItem?.elem.url;
      }

      if (!url) {
        continue;
      }
      linkIdToUrls.get(linkItem.id)!.add(url);
    }

    const conflictingLinkIds = new Set(
      [...linkIdToUrls.entries()]
        .filter(([, urls]) => urls.size > 1)
        .map(([id]) => id),
    );
    stats.conflictsFound = conflictingLinkIds.size;

    if (this.config?.columnWidth) {
      this.reflowLinks(
        allLinkItems,
        conflictingLinkIds,
        this.config.columnWidth,
      );
    }

    this.transformLinks(allLinkItems, conflictingLinkIds, stats);
    this.manageDefinitions(this.tree, conflictingLinkIds, linkIdToUrls, stats);

    return stats;
  }

  private reflowLinks(
    allLinkItems: LinkItem[],
    conflictingLinkIds: Set<number>,
    columnWidth: number,
  ) {
    const linksByLine = new Map<number, LinkItem[]>();
    for (const item of allLinkItems) {
      if (!item.elem.position) {
        continue;
      }
      const line = item.elem.position.start.line;
      if (!linksByLine.has(line)) {
        linksByLine.set(line, []);
      }
      linksByLine.get(line)!.push(item);
    }

    for (const [, links] of linksByLine.entries()) {
      links.sort(
        (a, b) =>
          (a.elem.position?.start.column ?? 0) -
          (b.elem.position?.start.column ?? 0),
      );

      let currentColumn = 0;
      let lastEndCol = 1;

      for (const linkItem of links) {
        const isConflicting = conflictingLinkIds.has(linkItem.id);
        if (
          isConflicting ||
          linkItem.elem.type !== "link" ||
          !linkItem.elem.position
        ) {
          continue;
        }

        const linkStartCol = linkItem.elem.position.start.column;
        currentColumn += linkStartCol - lastEndCol;

        const linkText = extractLinkTextLiteral(linkItem.elem);
        const transformedLinkLength = `[${linkText}]`.length;

        if (currentColumn + transformedLinkLength > columnWidth) {
          const availableWidth = columnWidth - currentColumn - "[]".length;
          this.reflowLinkNode(linkItem.elem as Link, availableWidth);
        }

        const newLinkText = toMarkdown({
          type: "paragraph",
          children: linkItem.elem.children,
        }).trim();
        const lastLineOfLink = newLinkText.substring(
          newLinkText.lastIndexOf("\n") + 1,
        );
        currentColumn += `[${lastLineOfLink}]`.length;
        lastEndCol = linkItem.elem.position.end.column;
      }
    }
  }

  private reflowLinkNode(link: Link, availableWidth: number): void {
    if (!link.children.every((c) => c.type === "text")) {
      return;
    }
    if (availableWidth < 10) return;

    const originalText = toString(link);
    const words = originalText.split(/\s+/).filter(Boolean);
    if (words.length < 2) return;

    let reflowedText = "";
    let currentLine = "";
    for (const word of words) {
      const potentialLine = currentLine ? `${currentLine} ${word}` : word;
      if (potentialLine.length <= availableWidth || !currentLine) {
        currentLine = potentialLine;
        continue;
      }
      reflowedText += (reflowedText ? "\n" : "") + currentLine;
      currentLine = word;
    }
    reflowedText += (reflowedText ? "\n" : "") + currentLine;

    if (reflowedText.includes("\n")) {
      link.children = [{ type: "text", value: reflowedText }];
    }
  }

  private transformLinks(
    allLinkItems: LinkItem[],
    conflictingLinkIds: Set<number>,
    stats: TransformStats,
  ) {
    for (const linkItem of allLinkItems) {
      if (!linkItem.parent) {
        continue;
      }

      const parent = linkItem.parent;
      const index = (parent.children as Node[]).indexOf(linkItem.elem);
      if (index === -1) {
        continue;
      }

      const isConflicting = conflictingLinkIds.has(linkItem.id);

      switch (linkItem.elem.type) {
        case "link": {
          if (isConflicting) {
            break;
          }
          const identifier = normalizeIdentifier(
            extractLinkTextLiteral(linkItem.elem),
          );
          const newRef: LinkReference = {
            type: "linkReference",
            identifier: identifier,
            label: identifier,
            referenceType: "shortcut",
            children: linkItem.elem.children,
          };
          parent.children[index] = newRef;
          linkItem.elem = newRef;
          stats.linksConverted++;
          break;
        }
        case "linkReference": {
          if (isConflicting) {
            const defId = normalizeIdentifier(linkItem.elem.identifier);
            const defItem = this.info.definitionsByIdentifier.get(defId);
            if (defItem?.elem.url) {
              const newLink: Link = {
                type: "link",
                url: defItem.elem.url,
                children: linkItem.elem.children,
              };
              parent.children[index] = newLink;
              linkItem.elem = newLink;
            }
            break;
          }
          const linkRef = linkItem.elem;
          const linkName = normalizeLinkName(linkRef);
          if (linkRef.identifier !== linkName) {
            linkRef.identifier = linkName;
            linkRef.label = linkName;
          }
          linkRef.referenceType = "shortcut";
          break;
        }
      }
    }
  }

  private manageDefinitions(
    tree: Root,
    conflictingLinkIds: Set<number>,
    linkIdToUrls: Map<number, Set<string>>,
    stats: TransformStats,
  ) {
    // 1. Remove original definitions from the tree.
    const originalDefinitions = [...this.info.definitionsByIdentifier.values()];
    for (const defItem of originalDefinitions) {
      if (!defItem.parent) {
        continue;
      }
      const index = (defItem.parent.children as Node[]).indexOf(defItem.elem);
      if (index === -1) {
        continue;
      }
      defItem.parent.children.splice(index, 1);
    }

    // 2. Group link items by their heading section.
    const linksByHeading = new Map<number | undefined, LinkItem[]>();
    for (const linkItem of [...this.info.linksById.values()].flat()) {
      const headingId = linkItem.headingId;
      if (!linksByHeading.has(headingId)) {
        linksByHeading.set(headingId, []);
      }
      linksByHeading.get(headingId)!.push(linkItem);
    }

    const newTreeChildren: RootContent[] = [];
    const definitionCreatedFor = new Set<LinkIdentifier>();

    // 3. Create sections based on headings and insert definitions.
    const sections: RootContent[][] = [];
    let currentSection: RootContent[] = [];
    const childrenToProcess = tree.children.filter(
      (node) => node.type !== "definition",
    );

    for (const node of childrenToProcess) {
      if (node.type !== "heading") {
        currentSection.push(node);
        continue;
      }
      if (currentSection.length > 0) {
        sections.push(currentSection);
      }
      currentSection = [node];
    }
    if (currentSection.length > 0) {
      sections.push(currentSection);
    }

    // 4. Iterate through sections, generate, and add definitions.
    for (const section of sections) {
      newTreeChildren.push(...section);

      const headingNode = section.find((n) => n.type === "heading") as
        | Heading
        | undefined;
      const headingId = headingNode
        ? this.info.headingNodeToId.get(headingNode)
        : undefined;

      const links = linksByHeading.get(headingId) || [];
      const defsForThisSection = new Map<LinkIdentifier, Definition>();

      for (const linkItem of links) {
        if (linkItem.elem.type !== "linkReference") {
          continue;
        }

        const identifier = normalizeIdentifier(linkItem.elem.identifier);
        if (
          definitionCreatedFor.has(identifier) ||
          defsForThisSection.has(identifier)
        ) {
          continue;
        }

        const urlSet = linkIdToUrls.get(linkItem.id);
        if (!urlSet || urlSet.size !== 1) {
          continue;
        }

        const [url] = urlSet;
        defsForThisSection.set(identifier, {
          type: "definition",
          identifier: identifier,
          label: identifier,
          url: url,
        });
      }

      if (defsForThisSection.size > 0) {
        const sortedIdentifiers = Array.from(defsForThisSection.keys()).sort();
        for (const id of sortedIdentifiers) {
          newTreeChildren.push(defsForThisSection.get(id)!);
          definitionCreatedFor.add(id);
          stats.definitionsAdded++;
        }
      }
    }

    tree.children = newTreeChildren;
  }
}
