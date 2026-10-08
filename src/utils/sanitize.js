/**
 * Client-side guards for branch meta that ends up in markup.
 *
 * The server already sanitizes these fields on write and on read
 * (VOS_Meta_Fields), so these checks only matter if a bad value gets past
 * PHP some other way. They're cheap insurance at the two places where a
 * value turns into HTML: the Print Map window and the Branch Finder link.
 */

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const HTTP_URL  = /^https?:\/\//i;

/**
 * Returns the color if it's #rgb or #rrggbb, otherwise the fallback.
 */
export const safeColor = ( color, fallback = '#888888' ) =>
    typeof color === 'string' && HEX_COLOR.test( color ) ? color : fallback;

/**
 * Returns the URL if it's absolute http(s), otherwise null. React 18
 * renders javascript: hrefs as-is, so the scheme has to be checked here.
 */
export const safeUrl = ( url ) =>
    typeof url === 'string' && HTTP_URL.test( url ) ? url : null;
