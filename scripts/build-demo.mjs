/**
 * build-demo.mjs — inlines the REAL engine TS (type-stripped) into the demo
 * HTML so the demo logic is identical to chat-engine.ts / ask-answer.ts.
 * Run: bun /home/z/my-project/scripts/build-demo.mjs
 */
import { Transpiler } from "bun";

const ENGINE = "/home/z/my-project/download/chat-fix/chat-engine.ts";
const ASK = "/home/z/my-project/download/chat-fix/ask-answer.ts";
const TEMPLATE = "/home/z/my-project/scripts/demo-template.html";
const OUT = "/home/z/my-project/download/chat-fix/chat-demo.html";

const t = new Transpiler({ loader: "ts" });

async function toPlainJs(path) {
  const src = await Bun.file(path).text();
  let js = t.transformSync(src);
  // strip type-only exports (transpiler erases `export type`; be safe anyway)
  js = js.replace(/^export type[^;]*;\s*$/gm, "");
  // make declarations plain so the inline script exposes them to the demo IIFE
  js = js.replace(/^export (?=(?:async\s+)?(?:class|function|const|let|var)\b)/gm, "");
  js = js.replace(/^export \{[^}]*\};?\s*$/gm, "");
  return js;
}

const engineJs = await toPlainJs(ENGINE);
const askJs = await toPlainJs(ASK);

let html = await Bun.file(TEMPLATE).text();
if (!html.includes("/*__ENGINE_JS__*/") || !html.includes("/*__ASK_JS__*/")) {
  throw new Error("template placeholders missing");
}
html = html.replace("/*__ENGINE_JS__*/", engineJs).replace("/*__ASK_JS__*/", askJs);

await Bun.write(OUT, html);
const size = (await Bun.file(OUT)).size;
console.log(`built ${OUT} (${size} bytes)`);
