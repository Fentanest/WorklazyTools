export const pricePairs = [
  { name: "long decimal Number collision", original: "USD 1.1234567890123456789010", sale: "USD 1.1234567890123456789000", same: false },
  { name: "large amount Number collision", original: "USD 100000000000000.02", sale: "USD 100000000000000.01", same: false },
  { name: "trailing fractional zeros", original: "USD 16.990", sale: "USD 16.99", same: true },
  { name: "commas and leading zeros", original: "USD 001,150.1600", sale: "USD 0001150.16", same: true },
  { name: "integer and decimal", original: "USD 00016", sale: "USD 16.000", same: true },
  { name: "zero", original: "USD 000.000", sale: "USD 0", same: true },
  { name: "different currencies", original: "EUR 16.99", sale: "USD 16.99", same: false },
  { name: "same long decimal with trailing zeros", original: "USD 1.1234567890123456789010", sale: "USD 1.123456789012345678901", same: true },
] as const;
