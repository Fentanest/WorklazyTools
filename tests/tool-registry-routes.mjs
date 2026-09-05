import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const registryPath = path.resolve(testDirectory, "../src/app/toolRegistry.ts");
const registrySource = fs.readFileSync(registryPath, "utf8");
const sourceFile = ts.createSourceFile(registryPath, registrySource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

const toolsDeclaration = sourceFile.statements
  .filter(ts.isVariableStatement)
  .flatMap((statement) => statement.declarationList.declarations)
  .find((declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === "tools");

if (!toolsDeclaration || !toolsDeclaration.initializer || !ts.isArrayLiteralExpression(toolsDeclaration.initializer)) {
  throw new Error("Could not derive visual routes from src/app/toolRegistry.ts.");
}

const propertyText = (entry, name) => {
  const property = entry.properties.find((candidate) => (
    ts.isPropertyAssignment(candidate)
    && ((ts.isIdentifier(candidate.name) && candidate.name.text === name)
      || (ts.isStringLiteral(candidate.name) && candidate.name.text === name))
  ));
  return property && ts.isPropertyAssignment(property) && ts.isStringLiteral(property.initializer)
    ? property.initializer.text
    : undefined;
};

export const availableToolRoutes = Object.freeze(toolsDeclaration.initializer.elements
  .filter(ts.isObjectLiteralExpression)
  .map((entry) => ({
    id: propertyText(entry, "id"),
    path: propertyText(entry, "path"),
    status: propertyText(entry, "status"),
  }))
  .filter((entry) => entry.id && entry.path && entry.status === "available")
  .map(({ id, path: routePath }) => Object.freeze({
    id: `${id}-empty`,
    toolId: id,
    path: routePath,
    kind: "tool",
    readySelector: ".page:not(.tool-route-loading)",
  })));

if (availableToolRoutes.length !== 20) {
  throw new Error(`Expected 20 available tool routes, derived ${availableToolRoutes.length}.`);
}
