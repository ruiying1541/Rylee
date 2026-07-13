import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const inputDir = process.argv[2] || "yuque-export";
const outputFile = "data/articles.json";
const supported = new Set([".md", ".markdown", ".html", ".htm"]);

const files = await collectFiles(inputDir);
const articles = [];

for (const file of files) {
  const ext = extname(file).toLowerCase();
  if (!supported.has(ext)) continue;

  const raw = await readFile(file, "utf8");
  const rel = relative(inputDir, file);
  const title = getTitle(raw, rel, ext);
  const html = ext === ".md" || ext === ".markdown" ? markdownToHtml(raw) : extractBody(raw);
  const plainText = stripHtml(html);
  const category = rel.includes("/") ? rel.split("/")[0] : "未分类";

  articles.push({
    title,
    slug: slugify(rel.replace(extname(rel), "")),
    summary: plainText.slice(0, 120),
    category,
    tags: [],
    featured: articles.length < 6,
    order: articles.length + 1,
    updatedAt: new Date().toISOString().slice(0, 10),
    wordCount: countWords(plainText),
    html
  });
}

await mkdir("data", { recursive: true });
await writeFile(outputFile, JSON.stringify({
  source: inputDir,
  title: "任天真设计室 | AI全栈设计知识库",
  totalWords: articles.reduce((sum, article) => sum + article.wordCount, 0),
  articles
}, null, 2), "utf8");

console.log(`Imported ${articles.length} articles into ${outputFile}`);

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...await collectFiles(path));
    } else {
      result.push(path);
    }
  }
  return result;
}

function getTitle(raw, rel, ext) {
  if (ext === ".md" || ext === ".markdown") {
    const heading = raw.match(/^#\s+(.+)$/m);
    if (heading) return cleanText(heading[1]);
  }

  const htmlTitle = raw.match(/<title[^>]*>(.*?)<\/title>/is) || raw.match(/<h1[^>]*>(.*?)<\/h1>/is);
  if (htmlTitle) return cleanText(stripHtml(htmlTitle[1]));

  return cleanText(rel.split("/").pop().replace(extname(rel), ""));
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let inCode = false;
  let code = [];
  let paragraph = [];
  let listType = "";
  let tableBuffer = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };

  const flushList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = "";
    }
  };

  const flushTable = () => {
    if (!tableBuffer.length) return;
    const rows = tableBuffer.filter((line) => !/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line));
    const body = rows.map((line, index) => {
      const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
      const tag = index === 0 ? "th" : "td";
      return `<tr>${cells.map((cell) => `<${tag}>${inlineMarkdown(cell)}</${tag}>`).join("")}</tr>`;
    }).join("");
    html.push(`<table>${body}</table>`);
    tableBuffer = [];
  };

  for (const line of lines) {
    if (/^```/.test(line)) {
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        code = [];
        inCode = false;
      } else {
        flushParagraph();
        flushList();
        flushTable();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      code.push(line);
      continue;
    }

    if (/^\s*$/.test(line)) {
      flushParagraph();
      flushList();
      flushTable();
      continue;
    }

    if (/^\|.+\|$/.test(line)) {
      flushParagraph();
      flushList();
      tableBuffer.push(line);
      continue;
    }

    flushTable();

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const quote = line.match(/^>\s?(.+)$/);
    if (quote) {
      flushParagraph();
      flushList();
      html.push(`<blockquote>${inlineMarkdown(quote[1])}</blockquote>`);
      continue;
    }

    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    if (unordered) {
      flushParagraph();
      if (listType !== "ul") {
        flushList();
        listType = "ul";
        html.push("<ul>");
      }
      html.push(`<li>${inlineMarkdown(unordered[1])}</li>`);
      continue;
    }

    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      if (listType !== "ol") {
        flushList();
        listType = "ol";
        html.push("<ol>");
      }
      html.push(`<li>${inlineMarkdown(ordered[1])}</li>`);
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  flushTable();

  return html.join("\n");
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function extractBody(html) {
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return body ? body[1].trim() : html.trim();
}

function stripHtml(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(text) {
  const chinese = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const western = (text.replace(/[\u4e00-\u9fa5]/g, " ").match(/[A-Za-z0-9]+/g) || []).length;
  return chinese + western;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || `article-${Date.now()}`;
}

function cleanText(value) {
  return value.replace(/[#*_`]/g, "").trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
