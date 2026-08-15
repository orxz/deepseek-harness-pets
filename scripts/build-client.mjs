/**
 * build-client.mjs — 把浏览器半边（src/index.js）打包成 dsh client 契约要求的
 * CJS 工厂产物 lib/client.js：
 *
 *   window.__ModuleLoader__.load({ id, factory })
 *   factory(require) → module.exports（require 的外部依赖来自浏览器模块表）
 *
 * 格式对照 @dshthemes/ui 的 lib/client.js（预构建产物）与 dsh 源码
 * packages/client/modules（node 半边按 exports["./client"] 解析并哈希入 boot graph）。
 * 外部化规则：react 等平台种子模块经模块表 require，不打入包。
 */
import { build } from "esbuild";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const id = "deepseek-harness-pets";

await build({
  entryPoints: [resolve(root, "src/index.js")],
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: "es2022",
  outfile: resolve(root, "lib/client.js"),
  external: ["react", "react/jsx-runtime", "react-dom"],
  banner: {
    js: [
      `window.__ModuleLoader__.load({`,
      `\tid: ${JSON.stringify(id)},`,
      `\tfactory: (require) => {`,
      `\t\tvar module = { exports: {} };`,
      `\t\tvar exports = module.exports;`,
      `\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });`,
    ].join("\n"),
  },
  footer: {
    js: ["\t\treturn module.exports;", "\t},", "});"].join("\n"),
  },
  logLevel: "info",
});

mkdirSync(resolve(root, "lib"), { recursive: true });
console.log(`built lib/client.js for ${id}`);
