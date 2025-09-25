/**
 * Configuration for the Markdown transformation.
 */
export class Config {
  /**
   * The maximum column width for a line of text. If a transformed link would
   * cause a line to exceed this width, the link text will be reflowed.
   */
  public columnWidth?: number;
}
