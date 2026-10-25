/** Version binds output provenance to the literal normalization sets, not a locale. */
export const TEXT_NORMALIZATION_POLICY=Object.freeze({
 version:'worklazy-text-normalization-v2',
 // Tab, space, vertical tab, form feed and the Unicode space separators (no-break, ideographic, ...).
 whitespace:'\t \v\f\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000',singleQuotes:'‘’‚‛',doubleQuotes:'“”„‟',dashes:'‐‑‒–—―−',
});
