import type { ToolAccent } from "../app/toolRegistry";

export const toolIconAccentClasses = {
  green: "bg-gradient-to-br from-green-50 to-green-100 text-green-700 dark:from-green-950/70 dark:to-green-900/40 dark:text-green-300",
  blue: "bg-gradient-to-br from-blue-50 to-blue-100 text-blue-700 dark:from-blue-950/70 dark:to-blue-900/40 dark:text-blue-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-950/70 dark:text-violet-300",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-950/70 dark:text-orange-300",
  pink: "bg-pink-100 text-pink-700 dark:bg-pink-950/70 dark:text-pink-300",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300",
} satisfies Record<ToolAccent, string>;
