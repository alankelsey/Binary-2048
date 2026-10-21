import fs from "node:fs";
import path from "node:path";
import { OPENAPI_SPEC } from "@/lib/binary2048/openapi";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

function routeFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(fullPath);
    return entry.name === "route.ts" ? [fullPath] : [];
  });
}

function contractOperations() {
  return Object.entries(OPENAPI_SPEC.paths).flatMap(([routePath, pathItem]) =>
    METHODS.flatMap((method) => method.toLowerCase() in pathItem ? [`${method} ${routePath}`] : [])
  ).sort();
}

function implementedOperations() {
  const apiRoot = path.join(process.cwd(), "app", "api");
  return routeFiles(apiRoot).flatMap((file) => {
    const routePath = `/${path.relative(path.join(process.cwd(), "app"), path.dirname(file))}`
      .replace(/\\/g, "/")
      .replace(/\[\.\.\.(\w+)\]/g, "{$1}")
      .replace(/\[(\w+)\]/g, "{$1}");
    const source = fs.readFileSync(file, "utf8");
    return METHODS.flatMap((method) => {
      const declaration = new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\b|export\\s+const\\s+${method}\\s*=`);
      return declaration.test(source) ? [`${method} ${routePath}`] : [];
    });
  }).sort();
}

describe("OpenAPI route drift", () => {
  it("keeps every explicitly implemented HTTP operation in the published contract", () => {
    expect(contractOperations()).toEqual(implementedOperations());
  });
});
