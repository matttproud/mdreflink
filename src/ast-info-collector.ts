import type {
  Root,
  Link,
  LinkReference,
  Definition,
  Node,
  Parents,
  Heading,
} from "mdast";
import { visit } from "unist-util-visit";
import { toMarkdown } from "mdast-util-to-markdown";

// Data Models
export type LinkName = string & { readonly __brand: "LinkName" };
export type LinkIdentifier = string & { readonly __brand: "LinkIdentifier" };

export class LinkItem {
  constructor(
    public id: number,
    public headingId: number | undefined,
    public elem: Link | LinkReference,
    public parent: Parents | undefined,
    public linkName: LinkName,
  ) {}
}

export class DefinitionItem {
  constructor(
    public id: LinkIdentifier,
    public elem: Definition,
    public parent: Parents | undefined,
  ) {}
}

export class HeadingItem {
  constructor(
    public id: number,
    public elem: Heading,
  ) {}
}

// Helper functions
/**
 *
 * @param s
 */
/**
 * Collapses text into a whitespace-concise form for purposes of creating
 * canonical Markdown identifiers.
 * @param s The string to be collapsed.
 * @returns The collapsed string.
 */
export function normalizeText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 *
 * @param node
 */
/**
 * Extracts the nested Markdown that formed the link's name.
 * @param node The link to extract the text from.
 * @returns The extracted link text.
 */
export function extractLinkTextLiteral(node: Link | LinkReference): string {
  const text = toMarkdown({ type: "paragraph", children: node.children });
  return normalizeText(text);
}

/**
 *
 * @param node
 */
/**
 * Normalizes link-related nodes into a canonical LinkName form.
 * @param node The node to be canonicalized.
 * @returns The normalized link name.
 */
export function normalizeLinkName(node: Link | LinkReference): LinkName {
  return normalizeText(extractLinkTextLiteral(node)) as LinkName;
}

/**
 *
 * @param raw
 */
/**
 * Normalizes raw strings into canonical LinkIdentifier form.
 * @param raw The string to be canonicalized.
 * @returns The normalized link identifier.
 */
export function normalizeIdentifier(raw: string): LinkIdentifier {
  return normalizeText(raw) as LinkIdentifier;
}

/**
 * Visits the nodes on the AST to collect information about them in a single
 * pass.
 */
export class AstInfoCollector {
  public idSeq = 0;
  public headingSeq = 0;
  public linksById = new Map<number, LinkItem[]>();
  public linkIdsByLinkName = new Map<LinkName, number>();
  public headingsById = new Map<number, HeadingItem>();
  public definitionsByIdentifier = new Map<LinkIdentifier, DefinitionItem>();
  public headingNodeToId = new Map<Heading, number>();

  public collect(tree: Root): void {
    visit(tree, (node, index, parent) => {
      this.ingest(node, parent ?? undefined);
    });
  }

  private ingest(n: Node, parent?: Parents): void {
    switch (n.type) {
      case "link":
        this.ingestLink(n as Link, parent);
        break;
      case "linkReference":
        this.ingestLinkReference(n as LinkReference, parent);
        break;
      case "definition":
        this.ingestDefinition(n as Definition, parent);
        break;
      case "heading":
        this.ingestHeading(n as Heading);
        break;
      default:
    }
  }

  private ingestLink(l: Link, parent?: Parents): void {
    this.ingestLinkNode(l, parent);
  }

  private ingestLinkReference(l: LinkReference, parent?: Parents): void {
    this.ingestLinkNode(l, parent);
  }

  private ingestDefinition(d: Definition, parent?: Parents): void {
    const id = normalizeIdentifier(d.identifier);
    if (this.definitionsByIdentifier.has(id)) {
      return;
    }
    const defItem = new DefinitionItem(id, d, parent);
    this.definitionsByIdentifier.set(id, defItem);
  }

  private ingestHeading(h: Heading): void {
    this.headingSeq++;
    this.headingsById.set(this.headingSeq, new HeadingItem(this.headingSeq, h));
    this.headingNodeToId.set(h, this.headingSeq);
  }

  private ingestLinkNode(l: Link | LinkReference, parent?: Parents): void {
    const linkName = normalizeLinkName(l);
    if (!linkName) {
      return;
    }

    let id = this.linkIdsByLinkName.get(linkName);
    if (id === undefined) {
      this.idSeq++;
      id = this.idSeq;
      this.linkIdsByLinkName.set(linkName, id);
    }

    const headingId = this.headingSeq > 0 ? this.headingSeq : undefined;
    const linkItem = new LinkItem(id, headingId, l, parent, linkName);

    if (!this.linksById.has(id)) {
      this.linksById.set(id, []);
    }
    this.linksById.get(id)!.push(linkItem);
  }
}
