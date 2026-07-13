import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const dataPath = "data/articles.json";
const source = "https://ruiying1541.github.io/design-skills/";

const legacyItems = [
  {
    owner: "nextlevelbuilder",
    repo: "ui-ux-pro-max-skill",
    title: "ui-ux-pro-max-skill",
    url: "https://github.com/nextlevelbuilder/ui-ux-pro-max-skill",
    summary: "An AI SKILL that provide design intelligence for building professional UI/UX multiple platforms",
    category: "AI辅助",
    language: "Python",
    topics: ["ai-skills", "antigravity"]
  },
  {
    owner: "Leonxlnx",
    repo: "taste-skill",
    title: "Taste-Skill",
    url: "https://github.com/Leonxlnx/taste-skill",
    summary: "Taste-Skill gives your AI good taste and stops the AI from generating boring, generic slop.",
    category: "AI辅助",
    language: "Markdown",
    topics: ["taste", "skill"]
  },
  {
    owner: "JimLiu",
    repo: "baoyu-design",
    title: "baoyu-design",
    url: "https://github.com/JimLiu/baoyu-design",
    summary: "Run Claude Design locally as an Agent Skill for Cursor, Claude Code and more. Produce polished UI mockups, prototypes, decks and wireframes as self-contained HTML.",
    category: "AI辅助",
    language: "JavaScript",
    topics: ["agent-skills", "claude"]
  },
  {
    owner: "Owl-Listener",
    repo: "designer-skills",
    title: "designer-skills",
    url: "https://github.com/Owl-Listener/designer-skills",
    summary: "Designer Skills Collection: agentic skills, commands, and plugins for design — from research to systems, UI, interaction, and delivery.",
    category: "组件设计",
    language: "Markdown",
    topics: ["agentic", "agentic-ai"]
  },
  {
    owner: "bitjaru",
    repo: "styleseed",
    title: "styleseed",
    url: "https://github.com/bitjaru/styleseed",
    summary: "Design engine for Claude Code, Codex and Cursor. It teaches design judgment with 74 rules, 48 components, 7 brand skins, a motion system and 15 skills.",
    category: "组件设计",
    language: "TypeScript",
    topics: ["ai-coding", "ai-design"]
  },
  {
    owner: "YuheshPandian",
    repo: "ICONIC",
    title: "ICONIC",
    url: "https://github.com/YuheshPandian/ICONIC",
    summary: "A developer-oriented library of sleek, bubble-shaped skill icons designed for GitHub READMEs, portfolios, and resumes.",
    category: "平台规范",
    language: "HTML",
    topics: ["badges-markdown", "frontend"]
  },
  {
    owner: "SudeepAcharjee",
    repo: "The-50-Front-end-Project",
    title: "The-50-Front-end-Project",
    url: "https://github.com/SudeepAcharjee/The-50-Front-end-Project",
    summary: "A collection of 50 carefully curated frontend projects that showcase skills and creativity as a frontend developer across technologies and design principles.",
    category: "前端练习",
    language: "JavaScript",
    topics: ["frontend", "projects"]
  },
  {
    owner: "plugin87",
    repo: "ux-ui-agent-skills",
    title: "ux-ui-agent-skills",
    url: "https://github.com/plugin87/ux-ui-agent-skills",
    summary: "Turn Claude into a Senior Design Architect with design tokens, 42 components, WCAG 2.2 accessibility, any-framework code, 138 design systems, and runnable skills.",
    category: "可访问性",
    language: "JavaScript",
    topics: ["accessibility", "ai-agents"]
  }
];

const payload = JSON.parse(await readFile(dataPath, "utf8"));
const articles = payload.articles || [];
const existingTitles = new Set(articles.map((article) => normalize(article.title)));
const existingSources = new Set(articles.map((article) => article.sourceUrl).filter(Boolean));
const maxOrder = Math.max(...articles.map((article) => Number(article.order) || 0), 0);
const today = new Date().toISOString().slice(0, 10);

const imported = [];
legacyItems.forEach((item, index) => {
  if (existingSources.has(item.url) || existingTitles.has(normalize(item.title))) return;

  const title = `${item.title}｜设计 Skill 资源`;
  if (existingTitles.has(normalize(title))) return;

  const tags = ["Skill", item.category, item.language, ...item.topics]
    .filter(Boolean)
    .map((tag) => String(tag).trim());
  const html = renderLegacySkillHtml(item);
  const article = {
    title,
    slug: `legacy-skill-${slugify(item.owner)}-${slugify(item.repo)}-${createHash("sha1").update(item.url).digest("hex").slice(0, 6)}`,
    summary: item.summary,
    category: "Skill库",
    tags,
    featured: false,
    order: maxOrder + index + 1,
    level: 2,
    updatedAt: today,
    wordCount: countWords(`${title} ${item.summary} ${item.category} ${item.language} ${item.topics.join(" ")}`),
    sourceUrl: item.url,
    html
  };
  articles.push(article);
  imported.push(article.title);
});

payload.articles = articles;
payload.totalWords = articles.reduce((sum, article) => sum + (Number(article.wordCount) || 0), 0);
await writeFile(dataPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ imported: imported.length, titles: imported }, null, 2));

function renderLegacySkillHtml(item) {
  const topics = item.topics.map((topic) => `<span>#${escapeHtml(topic)}</span>`).join(" ");
  return `
    <p>这是从旧版 Skill 网站迁移过来的设计 Skill 资源，已统一归入当前知识库的 Skill库栏目。</p>
    <h3>资源简介</h3>
    <p>${escapeHtml(item.summary)}</p>
    <h3>适用场景</h3>
    <ul>
      <li>设计师使用 AI Agent / Claude / Cursor / Codex 辅助设计工作流。</li>
      <li>沉淀 UI、UX、设计系统、可访问性、原型和交互评审等高频能力。</li>
      <li>作为 Skill库 中的参考资源，便于后续筛选、搜索和扩展。</li>
    </ul>
    <h3>资源信息</h3>
    <p><strong>作者：</strong>${escapeHtml(item.owner)}</p>
    <p><strong>仓库：</strong>${escapeHtml(item.repo)}</p>
    <p><strong>分类：</strong>${escapeHtml(item.category)} · ${escapeHtml(item.language)}</p>
    <p><strong>标签：</strong>${topics}</p>
    <p><strong>来源：</strong><a href="${escapeAttribute(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.url)}</a></p>
  `;
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

function normalize(value) {
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

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
