import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const dataPath = "data/articles.json";
const indexUrl = "https://ruiying1541.github.io/design-skills/skills-index.json";
const siteBase = "https://ruiying1541.github.io/design-skills";
const today = new Date().toISOString().slice(0, 10);

const payload = JSON.parse(await readFile(dataPath, "utf8"));
const articles = payload.articles || [];
const index = await fetch(indexUrl).then((response) => response.json());

let fixed = 0;
let imported = 0;

for (const article of articles) {
  if (!article.slug?.startsWith("legacy-skill-")) continue;
  const cleanTitle = article.title.replace(/｜设计\s*Skill\s*资源$/i, "").trim();
  if (cleanTitle !== article.title) {
    article.title = cleanTitle;
    fixed += 1;
  }
  article.html = cleanLegacyHtml(article.html || "", article);
  article.summary = String(article.summary || "").replace(/^这是从旧版 Skill 网站迁移过来的设计 Skill 资源[，,。\s]*/g, "").trim() || article.summary;
  article.category = "Skill库";
  article.tags = normalizeTags(article.tags || []);
  article.wordCount = countWords(`${article.title} ${article.summary} ${stripHtml(article.html)}`);
}

const existingKeys = new Set(articles.map((article) => normalizeKey(article.title)));
const existingSources = new Set(articles.map((article) => article.sourceUrl).filter(Boolean));
const maxOrder = Math.max(...articles.map((article) => Number(article.order) || 0), 0);

for (const item of index) {
  const url = `${siteBase}${item.url}`;
  if (existingSources.has(url) || existingKeys.has(normalizeKey(item.title))) continue;

  const html = renderInternalSkillHtml(item);
  const article = {
    title: item.title,
    slug: `legacy-skill-internal-${slugify(item.name)}-${createHash("sha1").update(url).digest("hex").slice(0, 6)}`,
    summary: item.description,
    category: "Skill库",
    tags: normalizeTags(["Skill", item.category, ...(item.tags || []), ...(item.tools || [])]),
    featured: false,
    order: maxOrder + imported + 1,
    level: 2,
    updatedAt: item.updated || today,
    wordCount: countWords(`${item.title} ${item.description} ${stripHtml(html)}`),
    sourceUrl: url,
    html
  };
  articles.push(article);
  imported += 1;
}

payload.articles = articles;
payload.totalWords = articles.reduce((sum, article) => sum + (Number(article.wordCount) || 0), 0);
await writeFile(dataPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ fixed, imported, total: articles.length }, null, 2));

function cleanLegacyHtml(html, article) {
  const text = String(html || "")
    .replace(/<p>\s*这是从旧版 Skill 网站迁移过来的设计 Skill 资源，已统一归入当前知识库的 Skill库栏目。\s*<\/p>\s*/g, "")
    .replace(/<h3>资源简介<\/h3>/g, "<h3>简介</h3>")
    .replace(/作为 Skill库 中的参考资源，便于后续筛选、搜索和扩展。/g, "作为设计工作流中的参考资源，便于筛选、搜索和复用。");
  if (text.trim()) return text;
  return `<p>${escapeHtml(article.summary || article.title)}</p>`;
}

function renderInternalSkillHtml(item) {
  const triggers = (item.ai_trigger || []).map((trigger) => `<li>${escapeHtml(trigger)}</li>`).join("");
  const tools = (item.tools || []).map((tool) => `<li>${escapeHtml(tool)}</li>`).join("");
  const tags = (item.tags || []).map((tag) => `<span>#${escapeHtml(tag)}</span>`).join(" ");
  const related = (item.related || []).map((name) => `<span>${escapeHtml(name)}</span>`).join(" ");
  return `
    <p>${escapeHtml(item.description || "")}</p>
    <h3>适用场景</h3>
    <ul>${triggers || `<li>用于 ${escapeHtml(item.title)} 相关的设计工作流。</li>`}</ul>
    <h3>输出内容</h3>
    <p>${escapeHtml(item.ai_output || "可复用的设计分析、检查清单和执行建议。")}</p>
    ${tools ? `<h3>常用工具</h3><ul>${tools}</ul>` : ""}
    <h3>资源信息</h3>
    <p><strong>分类：</strong>${escapeHtml(item.category || "Skill")}</p>
    <p><strong>难度：</strong>${escapeHtml(item.difficulty || "未标注")}</p>
    <p><strong>标签：</strong>${tags}</p>
    ${related ? `<p><strong>关联 Skill：</strong>${related}</p>` : ""}
  `;
}

function normalizeTags(tags) {
  const result = [];
  for (const tag of tags) {
    const value = String(tag || "").replace(/^#/, "").trim();
    if (!value) continue;
    if (!result.some((item) => normalizeKey(item) === normalizeKey(value))) result.push(value);
  }
  return result.slice(0, 8);
}

function stripHtml(html) {
  return String(html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function countWords(value) {
  const text = String(value || "").trim();
  const chinese = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const words = (text.replace(/[\u4e00-\u9fa5]/g, " ").match(/[A-Za-z0-9_-]+/g) || []).length;
  return chinese + words;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "item";
}

function normalizeKey(value) {
  return String(value || "").toLowerCase().replace(/[\s\u3000｜|:：,，、。·\-_/\\]+/g, "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
