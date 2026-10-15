/** Same as the `wide:` variant in globals.css: a computer, or a phone or tablet turned sideways. */
export const WIDE_QUERY = "(min-width: 1024px), (min-width: 560px) and (orientation: landscape)";

/**
 * On wide screens, flow a page's cards into two newspaper-style columns: read top to bottom, then
 * the next column; a card is never split. Phones keep one column. Use on the content wrapper.
 */
export const TWO_COLUMNS = "wide:columns-2 wide:gap-8 wide:space-y-0 *:break-inside-avoid wide:*:mb-5";
