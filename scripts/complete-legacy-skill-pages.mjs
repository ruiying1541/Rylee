import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const dataPath = "data/articles.json";
const outputDir = "assets/article-images";
const indexUrl = "https://ruiying1541.github.io/design-skills/skills-index.json";
const siteBase = "https://ruiying1541.github.io/design-skills";
const githubAvatars = new Map([
  ["nextlevelbuilder", "https://avatars.githubusercontent.com/u/246974152?v=4"],
  ["Leonxlnx", "https://avatars.githubusercontent.com/u/219127460?v=4"],
  ["JimLiu", "https://avatars.githubusercontent.com/u/648674?v=4"],
  ["Owl-Listener", "https://avatars.githubusercontent.com/u/200631076?v=4"],
  ["bitjaru", "https://avatars.githubusercontent.com/u/23206862?v=4"],
  ["YuheshPandian", "https://avatars.githubusercontent.com/u/168426680?v=4"],
  ["SudeepAcharjee", "https://avatars.githubusercontent.com/u/112026180?v=4"],
  ["plugin87", "https://avatars.githubusercontent.com/u/5790381?v=4"]
]);

await mkdir(outputDir, { recursive: true });
const payload = JSON.parse(await readFile(dataPath, "utf8"));
const articles = payload.articles || [];
const index = await fetchJson(indexUrl);
let updatedInternal = 0;
let updatedGithub = 0;
let downloaded = 0;

for (const item of index) {
  const article = articles.find((entry) => entry.slug === findInternalSlug(item.name, articles));
  if (!article) continue;
  const pageUrl = `${siteBase}${item.url}`;
  const pageHtml = await fetchText(pageUrl);
  const rawMarkdown = pageHtml ? extractRawContent(pageHtml) : "";
  if (!rawMarkdown) continue;
  const html = markdownToHtml(rawMarkdown || item.description || "");
  article.html = html || renderInternalFallback(item);
  article.summary = item.description || article.summary;
  article.wordCount = countWords(`${article.title} ${article.summary} ${stripHtml(article.html)}`);
  article.sourceUrl = pageUrl;
  updatedInternal += 1;
}

for (const article of articles.filter((entry) => entry.slug?.startsWith("legacy-skill-") && !entry.slug.includes("legacy-skill-internal-"))) {
  const owner = getGithubOwner(article.sourceUrl || "");
  const avatar = githubAvatars.get(owner);
  if (!avatar) continue;
  const localAvatar = await downloadImage(avatar, `${slugify(owner)}-avatar`);
  if (localAvatar) downloaded += 1;
  article.html = renderGithubSkillHtml(article, owner, localAvatar);
  article.wordCount = countWords(`${article.title} ${article.summary} ${stripHtml(article.html)}`);
  updatedGithub += 1;
}

payload.articles = articles;
payload.totalWords = articles.reduce((sum, article) => sum + (Number(article.wordCount) || 0), 0);
await writeFile(dataPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ updatedInternal, updatedGithub, downloaded, total: articles.length }, null, 2));

function findInternalSlug(name, articles) {
  const prefix = `legacy-skill-internal-${slugify(name)}-`;
  return articles.find((entry) => entry.slug?.startsWith(prefix))?.slug;
}

function extractRawContent(html) {
  const match = String(html || "").match(/<pre[^>]*id=["']raw-content["'][^>]*>([\s\S]*?)<\/pre>/i);
  return match ? decodeHtml(match[1]).trim() : "";
}

function markdownToHtml(markdown) {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let paragraph = [];
  let list = [];
  let code = [];
  let inCode = false;
  let table = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p>${inlineMarkdown(paragraph.join(" ").trim())}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list.length) return;
    blocks.push(`<ul>${list.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
    list = [];
  };
  const flushCode = () => {
    if (!code.length) return;
    blocks.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
    code = [];
  };
  const flushTable = () => {
    if (!table.length) return;
    const rows = table.filter((row) => !/^\s*\|?\s*-+/.test(row));
    if (!rows.length) { table = []; return; }
    const htmlRows = rows.map((row, index) => {
      const cells = row.split("|").map((cell) => cell.trim()).filter(Boolean);
      const tag = index === 0 ? "th" : "td";
      return `<tr>${cells.map((cell) => `<${tag}>${inlineMarkdown(cell)}</${tag}>`).join("")}</tr>`;
    }).join("");
    blocks.push(`<table>${htmlRows}</table>`);
    table = [];
  };
  const flushAll = () => { flushParagraph(); flushList(); flushTable(); };

  for (const line of lines) {
    if (/^```/.test(line)) {
      if (inCode) { inCode = false; flushCode(); } else { flushAll(); inCode = true; }
      continue;
    }
    if (inCode) { code.push(line); continue; }
    if (!line.trim()) { flushAll(); continue; }
    if (/^---+$/.test(line.trim())) { flushAll(); blocks.push("<hr>"); continue; }
    const heading = line.match(/^(#{2,4})\s+(.+)$/);
    if (heading) {
      flushAll();
      const level = Math.min(heading[1].length, 4);
      blocks.push(`<h${level}>${inlineMarkdown(heading[2].trim())}</h${level}>`);
      continue;
    }
    const listItem = line.match(/^[-*]\s+(.+)$/);
    if (listItem) { flushParagraph(); flushTable(); list.push(listItem[1].trim()); continue; }
    if (line.includes("|") && /^\s*\|?.+\|.+/.test(line)) { flushParagraph(); flushList(); table.push(line); continue; }
    flushList(); flushTable(); paragraph.push(line.trim());
  }
  flushAll();
  if (inCode) flushCode();
  return blocks.join("\n");
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function renderInternalFallback(item) {
  return `<p>${escapeHtml(item.description || "")}</p>`;
}

function renderGithubSkillHtml(article, owner, localAvatar) {
  const avatar = localAvatar ? `<figure class="lake-image-card"><img src="${escapeAttribute(localAvatar)}" alt="${escapeAttribute(owner)}" loading="lazy"><figcaption>${escapeHtml(owner)}</figcaption></figure>` : "";
  const tags = (article.tags || []).map((tag) => `<span>#${escapeHtml(tag)}</span>`).join(" ");
  return `
    ${avatar}
    <p>${escapeHtml(article.summary || "")}</p>
    <h3>资源信息</h3>
    <p><strong>作者：</strong>${escapeHtml(owner)}</p>
    <p><strong>仓库：</strong>${escapeHtml(article.title)}</p>
    <p><strong>标签：</strong>${tags}</p>
    <p><strong>来源：</strong><a href="${escapeAttribute(article.sourceUrl || "")}" target="_blank" rel="noreferrer">${escapeHtml(article.sourceUrl || "")}</a></p>
  `;
}

async function downloadImage(url, name) {
  try {
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "image/*,*/*;q=0.8" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) return "";
    const type = response.headers.get("content-type") || "";
    const ext = type.includes("png") ? ".png" : type.includes("jpeg") || type.includes("jpg") ? ".jpg" : type.includes("webp") ? ".webp" : ".png";
    const fileName = `legacy-${name}-${createHash("sha1").update(url).digest("hex").slice(0, 8)}${ext}`;
    await writeFile(path.join(outputDir, fileName), buffer);
    return `./assets/article-images/${fileName}`;
  } catch {
    return "";
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} ${response.status}`);
  return response.json();
}
async function fetchText(url) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!response.ok) throw new Error(`${url} ${response.status}`);
      return response.text();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
    }
  }
  console.warn(`Failed to fetch detail page: ${lastError?.message || url}`);
  return "";
}
function getGithubOwner(url) {
  try { return new URL(url).pathname.split("/").filter(Boolean)[0] || ""; } catch { return ""; }
}
function stripHtml(html) { return String(html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(); }
function countWords(value) {
  const text = String(value || "").trim();
  const chinese = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const words = (text.replace(/[\u4e00-\u9fa5]/g, " ").match(/[A-Za-z0-9_-]+/g) || []).length;
  return chinese + words;
}
function slugify(value) { return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item"; }
function decodeHtml(value) {
  return String(value || "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&#039;/g, "'").replace(/&amp;/g, "&");
}
function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function escapeAttribute(value) { return escapeHtml(value).replaceAll("`", "&#096;"); }
