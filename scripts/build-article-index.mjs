import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataDir = path.join(root, "data");
const detailDir = path.join(dataDir, "articles");
const sourcePath = path.join(dataDir, "articles.json");
const indexPath = path.join(dataDir, "articles-index.json");

const payload = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
fs.mkdirSync(detailDir, { recursive: true });

const articles = (payload.articles || []).map((article) => {
  const { html = "", ...meta } = article;
  const detail = { ...article, html };
  const detailPath = path.join(detailDir, `${article.slug}.json`);
  fs.writeFileSync(detailPath, `${JSON.stringify(detail)}\n`);

  return {
    ...meta,
    searchText: stripHtml(html).slice(0, 300)
  };
});

const indexPayload = {
  ...payload,
  articles
};

fs.writeFileSync(indexPath, `${JSON.stringify(indexPayload)}\n`);

const fullBytes = fs.statSync(sourcePath).size;
const indexBytes = fs.statSync(indexPath).size;
console.log(`Built ${path.relative(root, indexPath)} from ${articles.length} articles`);
console.log(`Initial article payload: ${formatBytes(fullBytes)} -> ${formatBytes(indexBytes)}`);

function stripHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function formatBytes(value) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
