const state = {
  articles: [],
  toc: [],
  updatesArticle: null,
  introArticle: null,
  imageMap: {},
  query: "",
  filter: "all",
  category: ""
};

const articleList = document.querySelector("#articleList");
const reader = document.querySelector("#reader");
const searchInput = document.querySelector("#searchInput");
const categoryList = document.querySelector("#categoryList");
const docCount = document.querySelector("#docCount");
const wordCount = document.querySelector("#wordCount");

const formatter = new Intl.NumberFormat("zh-CN");
const coverPalettes = [
  ["#111827", "#ff5a3d", "#ffd166"],
  ["#172554", "#38bdf8", "#a7f3d0"],
  ["#2b174f", "#e879f9", "#facc15"],
  ["#063b35", "#2dd4bf", "#f97316"],
  ["#3a1d15", "#fb7185", "#fde68a"],
  ["#0f172a", "#818cf8", "#f8fafc"]
];
const topicGroups = [
  {
    id: "vibe-coding",
    title: "VibeCoding工作流",
    keywords: ["vibe", "coding", "工作流搭建", "工作流", "claude code", "figma", "cursorrules"],
    parts: ["part1", "ai设计工作流", "vibe coding"]
  },
  {
    id: "skill-library",
    title: "Skill库",
    keywords: ["skill", "skills", "claude skill", "claude skills", "设计skill", "技能", "skills库"],
    parts: ["skill", "skills", "技能"]
  },
  {
    id: "ai-design-basics",
    title: "人工智能设计基础",
    keywords: ["大模型入门", "大模型应用", "人工智能", "基础", "访谈", "观点", "趋势", "未分类", "更新记录", "资源合集", "ai学习"],
    parts: ["part2", "人工智能设计基础"]
  },
  {
    id: "designer-ai-matrix",
    title: "产品设计师AI能力矩阵",
    keywords: ["产品设计师ai能力矩阵", "能力矩阵", "产品设计师"],
    parts: ["part3", "产品设计师ai能力矩阵"]
  },
  {
    id: "ai-experience-methods",
    title: "AI驱动的体验设计方法",
    keywords: ["体验设计", "ai-ux", "体验模式", "体验度量", "心智模型", "设计原则", "机器人", "hri"],
    parts: ["part4", "ai驱动的体验设计", "ai驱动的体验设计方法", "part8", "机器人交互hri"]
  },
  {
    id: "enterprise-design-systems",
    title: "大厂AI设计系统与案例",
    keywords: ["设计系统", "指南", "大厂"],
    parts: ["part5", "ai设计系统"]
  },
  {
    id: "ai-product-cases",
    title: "AI产品设计案例库",
    keywords: ["海外产品", "国内产品", "产品案例", "案例库"],
    parts: ["part6", "ai产品设计案例"]
  },
  {
    id: "end-to-end-efficiency",
    title: "设计全流程AI提效指南",
    keywords: ["part7", "设计全流程ai提效指南", "设计全流程 ai 提效指南", "设计提示词集合", "用ai做海报", "用 ai 做海报", "用ai做动效", "用 ai 做动效"],
    parts: ["part7", "设计全流程ai提效指南"]
  }
];
const topicMatchOrder = [
  "skill-library",
  "end-to-end-efficiency",
  "designer-ai-matrix",
  "ai-experience-methods",
  "enterprise-design-systems",
  "ai-product-cases",
  "vibe-coding",
  "ai-design-basics"
];

const ACCESS_PASSWORD = "0304";
const AUTH_STORAGE_KEY = "ryleeKnowledgeAccess";
let hasInitialized = false;

setupAccessGate();

function setupAccessGate() {
  const authScreen = document.querySelector("#authScreen");
  const authForm = document.querySelector("#authForm");
  const passwordInput = document.querySelector("#authPassword");
  const authError = document.querySelector("#authError");

  const unlock = () => {
    document.body.classList.remove("auth-locked");
    document.body.classList.add("auth-unlocked");
    if (hasInitialized) return;
    hasInitialized = true;
    init().catch((error) => {
      console.error("Failed to initialize knowledge platform", error);
      renderLoadError(error);
    });
  };

  if (!authScreen || !authForm || !passwordInput) {
    unlock();
    return;
  }

  if (sessionStorage.getItem(AUTH_STORAGE_KEY) === "granted") {
    unlock();
    return;
  }

  passwordInput.focus();
  authForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (passwordInput.value.trim() === ACCESS_PASSWORD) {
      sessionStorage.setItem(AUTH_STORAGE_KEY, "granted");
      passwordInput.value = "";
      if (authError) authError.textContent = "";
      unlock();
      return;
    }

    if (authError) authError.textContent = "密码不正确，请重新输入。";
    passwordInput.select();
  });
}

async function init() {
  const [articlesResponse, tocResponse, imageMapResponse] = await Promise.all([
    fetchJson("./data/articles.json"),
    fetchJson("./data/yuque-toc.json").catch(() => null),
    fetchJson("./data/image-map.json").catch(() => ({}))
  ]);
  const payload = articlesResponse;
  const tocPayload = tocResponse || {};
  const allArticles = payload.articles || [];
  state.imageMap = imageMapResponse || {};
  state.updatesArticle = allArticles.find((article) => isUpdatesArticle(article)) || null;
  state.introArticle = allArticles.find((article) => isIntroArticle(article)) || null;
  state.articles = allArticles.filter(shouldShowArticle);
  state.toc = (tocPayload.toc || []).filter((item) => item.type !== "DOC" || shouldShowArticle({ title: item.title, slug: item.url }));
  renderMetrics({
    ...payload,
    totalWords: state.articles.reduce((sum, article) => sum + (article.wordCount || 0), 0)
  });
  renderCategories();
  bindEvents();
  render();
}

function isUpdatesArticle(article) {
  return formatDisplayTitle(article?.title || "") === "📅更新记录" || article?.slug === "wl7ne2twbnz5iu70";
}

function isIntroArticle(article) {
  return formatDisplayTitle(article?.title || "") === "知识库简介" || article?.slug === "oxa01toz9uugpwir";
}

function shouldShowArticle(article) {
  return !isUpdatesArticle(article) && !isIntroArticle(article);
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${url} 返回 ${response.status}`);
  }
  return response.json();
}

function renderLoadError(error) {
  docCount.textContent = "0";
  wordCount.textContent = "0";
  categoryList.innerHTML = "";
  reader.innerHTML = "";
  articleList.innerHTML = `
    <div class="card-grid">
      <div class="empty-card error-card">
        <h2>没有加载到知识库数据</h2>
        <p>错误信息：${escapeHtml(error?.message || "未知错误")}</p>
        <ol>
          <li>在项目目录运行 <code>npm start</code>。</li>
          <li>打开终端输出的地址，例如 <code>http://localhost:5173/</code> 或自动切换后的端口。</li>
          <li>不要直接双击 <code>index.html</code>，否则浏览器可能会拦截本地 JSON 请求。</li>
          <li>如果 5173 被其他项目占用，请以终端输出的新端口为准。</li>
        </ol>
      </div>
    </div>
  `;
}

function bindEvents() {
  searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    state.filter = "all";
    state.category = "";
    if (state.query && getRoute().name !== "home") {
      location.hash = "#/";
      return;
    }
    renderNavState();
    renderCategories();
    render();
  });

  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.view === "catalog") {
        location.hash = "#/catalog";
        return;
      }
      if (button.dataset.view === "intro") {
        location.hash = "#/intro";
        state.filter = "all";
        state.category = "";
        renderNavState();
        renderCategories();
        render();
        return;
      }
      if (button.dataset.view === "updates") {
        location.hash = "#/updates";
        state.filter = "all";
        state.category = "";
        renderNavState();
        renderCategories();
        render();
        return;
      }
      location.hash = "#/";
      state.filter = button.dataset.filter || "all";
      state.category = "";
      renderNavState();
      renderCategories();
      render();
    });
  });

  window.addEventListener("hashchange", render);
}

function renderMetrics(payload) {
  const totalWords = payload.totalWords ?? state.articles.reduce((sum, article) => sum + (article.wordCount || 0), 0);
  docCount.textContent = formatter.format(state.articles.length);
  wordCount.textContent = formatter.format(totalWords);
}

function renderCategories() {
  const route = getRoute();
  const topics = [
    {
      id: "",
      title: "全部文章",
      count: state.articles.length,
      isAll: true
    },
    ...topicGroups.map((topic) => ({
      ...topic,
      count: state.articles.filter((article) => getArticleTopic(article).id === topic.id).length
    }))
  ];
  categoryList.innerHTML = topics.length
    ? `<div class="category-title">栏目</div>${topics.map((topic, index) => `
        <button class="category-button ${topic.isAll ? (route.name === "home" && !state.category && !state.query ? "active" : "") : (route.name === "home" && state.category === topic.id ? "active" : "")}" data-category="${escapeAttribute(topic.id)}">
          <span><b>${String(index + 1).padStart(2, "0")}</b>${escapeHtml(topic.title)}</span>
          <em>${formatter.format(topic.count)}</em>
        </button>
      `).join("")}`
    : "";

  categoryList.querySelectorAll(".category-button").forEach((button) => {
    button.addEventListener("click", () => {
      location.hash = "#/";
      state.filter = "all";
      state.category = button.dataset.category || "";
      state.query = "";
      searchInput.value = "";
      renderNavState();
      renderCategories();
      render();
    });
  });
}

function render() {
  const route = getRoute();
  renderNavState();
  document.body.dataset.route = route.name;

  if (route.name === "intro") {
    renderArticle(state.introArticle);
    return;
  }

  if (route.name === "updates") {
    renderUpdates();
    return;
  }

  if (route.name === "catalog") {
    renderCatalog();
    return;
  }

  if (route.name === "article") {
    const article = state.articles.find((item) => item.slug === route.slug) || state.articles[0];
    renderArticle(article);
    return;
  }

  renderHome();
}

function renderHome() {
  const articles = getVisibleArticles();
  reader.innerHTML = "";
  articleList.innerHTML = `
    ${renderListHeader(articles)}
    <div class="card-grid">
      ${articles.length
        ? articles.map((article, index) => renderArticleCard(article, index)).join("")
        : `<div class="empty-card"><h2>没有匹配文章</h2><p>换一个关键词或栏目试试。</p></div>`}
    </div>
  `;
}

function renderCatalog() {
  reader.innerHTML = "";
  const rows = state.toc.length ? state.toc : state.articles.map((article) => ({
    type: "DOC",
    title: article.title,
    url: article.slug,
    level: article.level || 0
  }));

  articleList.innerHTML = `
    <div class="catalog-page">
      <div class="list-header">
        <strong>全部目录</strong>
        <span>${formatter.format(state.articles.length)} 篇文章</span>
      </div>
      <div class="catalog-tree">
        ${rows.map(renderCatalogRow).join("")}
      </div>
    </div>
  `;
}

function renderUpdates() {
  const recentArticles = getRecentArticles();
  reader.innerHTML = "";
  articleList.innerHTML = `
    <div class="updates-page">
      <div class="list-header">
        <strong>最近更新</strong>
        <span>${formatter.format(recentArticles.length)} / ${formatter.format(state.articles.length)} 篇</span>
      </div>
      ${recentArticles.length
        ? renderRecentTimeline(recentArticles)
        : `<div class="empty-card"><h2>暂无最近更新</h2><p>有更新后会显示在这里。</p></div>`}
    </div>
  `;
}

function renderRecentTimeline(articles) {
  const groups = groupArticlesByDate(articles);
  return `
    <section class="recent-timeline" aria-label="最近更新时间轴">
      ${groups.map(([date, items], index) => `
        <section class="recent-date-group" id="update-${escapeAttribute(date)}">
          <div class="recent-date-marker">
            <time>${escapeHtml(formatDateText(date))}</time>
            <span>${index === 0 ? "最新更新" : `${formatter.format(items.length)} 篇更新`}</span>
          </div>
          <div class="card-grid updates-card-grid">
            ${items.map((article) => renderArticleCard(article, articles.indexOf(article))).join("")}
          </div>
        </section>
      `).join("")}
    </section>
  `;
}

function groupArticlesByDate(articles) {
  const groups = new Map();
  articles.forEach((article) => {
    const date = article.updatedAt || "未知时间";
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(article);
  });
  return [...groups.entries()].sort((a, b) => String(b[0]).localeCompare(String(a[0])));
}

function formatDateText(value) {
  return String(value || "").replaceAll("-", ".");
}

function getRecentArticles() {
  return [...state.articles]
    .filter((article) => article.updatedAt)
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

function renderArticle(article) {
  if (!article) {
    articleList.innerHTML = "";
    reader.innerHTML = "";
    return;
  }

  const topic = getArticleTopic(article);
  articleList.innerHTML = "";
  reader.innerHTML = `
    <article class="reader-shell">
      <header class="reader-header">
        <a class="back-link" href="#/">返回首页</a>
        <h1>${escapeHtml(formatDisplayTitle(article.title))}</h1>
        <div class="reader-meta">
          <span>${escapeHtml(topic.title)}</span>
          ${getArticleDisplayTags(article, topic).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
          ${article.updatedAt ? `<span>更新于 ${escapeHtml(article.updatedAt)}</span>` : ""}
          ${article.wordCount ? `<span>${formatter.format(article.wordCount)} 字</span>` : ""}
        </div>
      </header>
      <div class="article-body">${renderLakeHtml(article.html || "")}</div>
    </article>
  `;
}

function renderNavState() {
  const route = getRoute();
  document.querySelectorAll(".nav-item").forEach((item) => {
    const shouldActivate =
      (item.dataset.view === "intro" && route.name === "intro") ||
      (item.dataset.view === "updates" && route.name === "updates") ||
      (route.name === "home" && item.dataset.filter === state.filter && !state.category && !state.query);
    item.classList.toggle("active", shouldActivate);
  });
}

function renderListHeader(articles) {
  const topic = topicGroups.find((item) => item.id === state.category);
  const scope = topic?.title || (state.query ? `搜索：${state.query}` : getFilterLabel());
  return `
    <div class="list-header">
      <strong>${escapeHtml(scope)}</strong>
      <span>${formatter.format(articles.length)} / ${formatter.format(state.articles.length)} 篇</span>
    </div>
  `;
}

function getArticleDisplayTags(article, topic) {
  const rawTags = [article.category, ...(article.tags || [])]
    .filter(Boolean)
    .map((tag) => formatDisplayTag(tag))
    .filter(Boolean)
    .filter((tag) => normalizeTopicText(tag) !== normalizeTopicText(topic.title));

  return [...new Set(rawTags.map(compactDisplayTag))]
    .filter(Boolean)
    .filter((tag) => !["未分类", "资源合集", "访谈合集"].includes(tag))
    .filter((tag) => normalizeTopicText(tag) !== normalizeTopicText(topic.title))
    .slice(0, 2);
}

function compactDisplayTag(value) {
  const tag = String(value || "")
    .replace(/AI设计系统/g, "设计系统")
    .replace(/AI设计/g, "AI")
    .replace(/人工智能/g, "AI")
    .replace(/合集/g, "")
    .replace(/工作流搭建/g, "工作流")
    .replace(/产品案例/g, "案例")
    .replace(/设计指南/g, "指南")
    .replace(/资源集合/g, "资源")
    .replace(/&Vibe Coding/g, "")
    .replace(/Vibe Coding必备/g, "Vibe")
    .replace(/Vibe Coding/g, "Vibe")
    .replace(/\s+/g, "")
    .trim();

  const aliases = [
    [/访谈|采访|播客/, "访谈"],
    [/工作流|Workflow/i, "工作流"],
    [/提示词|Prompt/i, "提示词"],
    [/Skill|技能/i, "Skill"],
    [/案例|Case/i, "案例"],
    [/资源|网站|工具箱/, "资源"],
    [/指南|原则|规范|白皮书/, "指南"],
    [/设计系统/, "设计系统"],
    [/动效|Motion/i, "动效"],
    [/Agent|智能体/i, "Agent"],
    [/UX|体验/i, "UX"]
  ];

  const alias = aliases.find(([pattern]) => pattern.test(tag));
  if (alias) return alias[1];
  return truncateTitle(tag, 6);
}

function formatDisplayTag(value) {
  return String(value || "")
    .replace(/PART\d+\S*\s*/gi, "")
    .replace(/[📂🎙⌛️]/g, "")
    .replace(/^\s*\d+(?:\.\d+)*[\.、\s]+/, "")
    .trim();
}

function renderArticleCard(article, displayIndex = 0) {
  const topic = getArticleTopic(article);
  const tags = getArticleDisplayTags(article, topic).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
  return `
    <a class="work-card" href="#/article/${encodeURIComponent(article.slug)}">
      ${renderCover(article, displayIndex)}
      <div class="work-card-body">
        <h2>${escapeHtml(formatDisplayTitle(article.title))}</h2>
        <p>${escapeHtml(article.summary || "暂无摘要")}</p>
        <div class="work-meta">
          <span>${article.wordCount ? formatter.format(article.wordCount) : 0} 字</span>
        </div>
        ${tags ? `<div class="tag-row">${tags}</div>` : ""}
      </div>
    </a>
  `;
}

function renderCover(article, displayIndex = 0) {
  const topic = getArticleTopic(article);
  const palette = coverPalettes[hashText(topic.id) % coverPalettes.length];
  const index = String(displayIndex + 1).padStart(2, "0");
  const title = article.title || "Untitled";
  return `
    <figure class="work-cover generated-cover" style="--c1:${palette[0]};--c2:${palette[1]};--c3:${palette[2]}">
      <span class="cover-kicker">${escapeHtml(topic.title)}</span>
      <strong>${escapeHtml(formatCoverTitle(title))}</strong>
      <em>AI DESIGN · ${escapeHtml(index)}</em>
    </figure>
  `;
}

function formatDisplayTitle(value) {
  return String(value || "")
    .replace(/^\s*\d+(?:\.\d+)*[\.、\s]+/, "")
    .replace(/^\s*专题\s*[一二三四五六七八九十百千万0-9]+\s*[：:、.．\-—]\s*/, "")
    .trim();
}

function formatCoverTitle(value) {
  const title = formatDisplayTitle(value)
    .replace(/([\u4e00-\u9fa5])([A-Za-z0-9])/g, "$1 $2")
    .replace(/([A-Za-z0-9])([\u4e00-\u9fa5])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

  return compactCoverTitle(title, 25);
}

function compactCoverTitle(title, maxLength) {
  const normalized = String(title || "").trim();
  if (countTitleLength(normalized) <= maxLength) return normalized;

  const candidates = [
    normalized.split(/[：:｜|]/)[0],
    normalized
      .replace(/最新\s*/g, "")
      .replace(/0\s*门槛/g, "")
      .replace(/高级/g, "")
      .replace(/制作/g, "做")
      .replace(/创建设计系统文档/g, "建设计系统文档")
      .replace(/如何/g, "")
      .replace(/一个/g, "")
      .replace(/\s+/g, " ")
      .trim(),
    normalized
      .replace(/[，,。].*$/, "")
      .replace(/[：:].*$/, "")
      .trim()
  ].filter(Boolean);

  const best = candidates.find((candidate) => countTitleLength(candidate) <= maxLength);
  if (best) return best;

  return truncateTitle(normalized, maxLength);
}

function countTitleLength(value) {
  return [...String(value || "").replace(/\s+/g, "")].length;
}

function truncateTitle(value, maxLength) {
  const chars = [...String(value || "")];
  let length = 0;
  let result = "";
  for (const char of chars) {
    if (/\s/.test(char)) {
      result += char;
      continue;
    }
    if (length >= maxLength) break;
    result += char;
    length += 1;
  }
  return result.trim();
}

function renderCatalogRow(item) {
  const level = Math.min(Number(item.level || 0), 4);
  const title = item.title || "未命名";
  if (item.type === "DOC" && item.url) {
    return `
      <a class="catalog-row catalog-doc" style="--level:${level}" href="#/article/${encodeURIComponent(item.url)}">
        <span>${escapeHtml(formatDisplayTitle(title))}</span>
      </a>
    `;
  }

  return `
    <div class="catalog-row catalog-title" style="--level:${level}">
      <span>${escapeHtml(title)}</span>
    </div>
  `;
}

function getFilterLabel() {
  if (state.filter === "recent") return "最近更新";
  if (state.filter === "featured") return "精选";
  return "全部文章";
}

function getVisibleArticles() {
  const query = state.query;
  if (query) {
    return state.articles
      .map((article) => ({ article, score: scoreArticle(article, query) }))
      .filter((item) => item.score > 0)
      .sort((a, b) =>
        b.score - a.score ||
        String(b.article.updatedAt || "").localeCompare(String(a.article.updatedAt || "")) ||
        (a.article.order || 0) - (b.article.order || 0)
      )
      .map((item) => item.article);
  }

  return state.articles
    .filter((article) => {
      if (state.filter === "featured" && !article.featured) return false;
      if (state.filter === "recent" && !article.updatedAt) return false;
      if (state.category && getArticleTopic(article).id !== state.category) return false;
      return true;
    })
    .sort((a, b) => {
      if (state.filter === "recent") return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
      return (a.order || 0) - (b.order || 0);
    });
}

function scoreArticle(article, query) {
  const normalizedQuery = normalizeSearchText(query);
  const compactQuery = normalizeTopicText(query);
  const tokens = getSearchTokens(query);
  if (!normalizedQuery && !compactQuery && !tokens.length) return 0;

  const topic = getArticleTopic(article);
  const displayTags = getArticleDisplayTags(article, topic);
  const title = normalizeSearchText(article.title);
  const titleCompact = normalizeTopicText(article.title);
  const summary = normalizeSearchText(article.summary);
  const topicAndTags = normalizeSearchText([article.category, topic.title, ...(article.tags || []), ...displayTags].join(" "));
  const topicAndTagsCompact = normalizeTopicText([article.category, topic.title, ...(article.tags || []), ...displayTags].join(" "));
  const body = normalizeSearchText(stripHtml(renderLakeHtml(article.html || "")));

  let score = 0;
  if (title === normalizedQuery || titleCompact === compactQuery) score += 220;
  if (title.includes(normalizedQuery) || titleCompact.includes(compactQuery)) score += 150;
  if (tokens.length && tokens.every((token) => title.includes(token) || titleCompact.includes(normalizeTopicText(token)))) score += 95;
  if (topicAndTags.includes(normalizedQuery) || topicAndTagsCompact.includes(compactQuery)) score += 80;
  if (tokens.length && tokens.every((token) => topicAndTags.includes(token) || topicAndTagsCompact.includes(normalizeTopicText(token)))) score += 52;
  if (summary.includes(normalizedQuery)) score += 36;
  if (tokens.length && tokens.every((token) => summary.includes(token))) score += 24;
  if (body.includes(normalizedQuery)) score += 12;
  if (tokens.length && tokens.every((token) => body.includes(token))) score += 8;
  if (isSkillQuery(query) && getArticleTopic(article).id === "skill-library") score += 70;

  return score;
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\u3000\s]+/g, " ")
    .trim();
}

function getSearchTokens(value) {
  return normalizeSearchText(value)
    .split(/[\s｜|/\\,，:：、。]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function isSkillQuery(value) {
  const compact = normalizeTopicText(value);
  return compact.includes("skill") || compact.includes("skills") || compact.includes("技能");
}

function getSearchHaystack(article) {
  const topic = getArticleTopic(article);
  return [
    article.title,
    article.summary,
    article.category,
    topic.title,
    ...(article.tags || []),
    ...getArticleDisplayTags(article, topic),
    stripHtml(renderLakeHtml(article.html || ""))
  ]
    .join(" ")
    .toLowerCase();
}

function getArticleTopic(article) {
  const structuredHaystack = normalizeTopicText([
    article.category,
    ...(article.tags || [])
  ].join(" "));
  const fullHaystack = normalizeTopicText([
    article.title,
    article.summary,
    article.category,
    ...(article.tags || [])
  ].join(" "));

  if (isSkillArticle(fullHaystack)) {
    return topicGroups.find((topic) => topic.id === "skill-library") || topicGroups[0];
  }

  if (fullHaystack.includes("提示词集合")) {
    return topicGroups.find((topic) => topic.id === "end-to-end-efficiency") || topicGroups[1];
  }

  const exactPartMatch = topicGroups.find((topic) =>
    (topic.parts || []).some((part) => structuredHaystack.includes(normalizeTopicText(part)))
  );
  if (exactPartMatch) return exactPartMatch;

  if (["未分类", "访谈", "资源合集", "更新记录", "知识库简介", "ai学习网站"].some((keyword) => fullHaystack.includes(normalizeTopicText(keyword)))) {
    return topicGroups.find((topic) => topic.id === "ai-design-basics") || topicGroups[1];
  }

  return getTopicMatchGroups().find((topic) =>
    topic.keywords.some((keyword) => fullHaystack.includes(normalizeTopicText(keyword)))
  ) || topicGroups[1];
}

function isSkillArticle(haystack) {
  return ["skill", "skills", "claudeskill", "claudeskills", "设计skill", "技能"].some((keyword) =>
    String(haystack || "").includes(normalizeTopicText(keyword))
  );
}

function normalizeTopicText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s\u3000+&｜|·:：,，/\\-]/g, "");
}

function getTopicMatchGroups() {
  return topicMatchOrder
    .map((id) => topicGroups.find((topic) => topic.id === id))
    .filter(Boolean);
}

function getRoute() {
  const hash = location.hash || "#/";
  if (hash.startsWith("#/intro")) return { name: "intro" };
  if (hash.startsWith("#/catalog")) return { name: "catalog" };
  if (hash.startsWith("#/updates")) return { name: "updates" };
  if (hash.startsWith("#/article/")) return { name: "article", slug: decodeURIComponent(hash.replace("#/article/", "")) };
  return { name: "home" };
}

function getArticleCover(article) {
  const cards = extractLakeCards(article.html || "");
  const imageCard = cards.find((card) => card.detail?.image || isImageUrl(card.src));
  return resolveImageUrl(imageCard?.detail?.image || (isImageUrl(imageCard?.src) ? imageCard.src : ""));
}

function renderLakeHtml(html) {
  return stripYuqueLinks(String(html || "")).replace(/<card\b([^>]*)><\/card>/g, (match, attrs) => {
    const attrMap = parseAttributes(attrs);
    const card = parseCardValue(attrMap.value);
    if (!card) return match;
    return renderLakeCard(card, attrMap);
  });
}

function renderLakeCard(card, attrs) {
  const title = card.detail?.title || card.name || attrs.name || "语雀卡片";
  const desc = card.detail?.desc || "";
  const url = card.detail?.url || card.url || card.src || "";
  const image = resolveImageUrl(card.detail?.image || (isImageUrl(card.src) ? card.src : ""));

  if (image) {
    const shouldLink = url && !isYuqueUrl(url);
    return `
      <figure class="lake-image-card">
        ${shouldLink ? `<a href="${escapeAttribute(url)}" target="_blank" rel="noreferrer">` : ""}
          <img src="${escapeAttribute(image)}" alt="${escapeAttribute(title)}" loading="lazy">
        ${shouldLink ? "</a>" : ""}
        ${title ? `<figcaption>${escapeHtml(title)}</figcaption>` : ""}
      </figure>
    `;
  }

  if (url && !isYuqueUrl(url)) {
    return `
      <a class="lake-link-card" href="${escapeAttribute(url)}" target="_blank" rel="noreferrer">
        <strong>${escapeHtml(title)}</strong>
        ${desc ? `<span>${escapeHtml(desc)}</span>` : ""}
      </a>
    `;
  }

  return `<div class="lake-link-card"><strong>${escapeHtml(title)}</strong>${desc ? `<span>${escapeHtml(desc)}</span>` : ""}</div>`;
}

function isYuqueUrl(value) {
  try {
    const { hostname } = new URL(String(value || ""), location.origin);
    return hostname === "yuque.com" || hostname.endsWith(".yuque.com");
  } catch {
    return /(^|\.)yuque\.com\b/i.test(String(value || ""));
  }
}

function stripYuqueLinks(html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  template.content.querySelectorAll("a[href]").forEach((link) => {
    if (!isYuqueUrl(link.getAttribute("href"))) return;
    link.replaceWith(...link.childNodes);
  });
  return template.innerHTML;
}

function extractLakeCards(html) {
  return [...String(html || "").matchAll(/<card\b([^>]*)><\/card>/g)]
    .map((match) => parseCardValue(parseAttributes(match[1]).value))
    .filter(Boolean);
}

function parseAttributes(attrs) {
  const result = {};
  for (const match of String(attrs || "").matchAll(/([:\w-]+)=["']([^"']*)["']/g)) {
    result[match[1]] = decodeHtml(match[2]);
  }
  return result;
}

function parseCardValue(value) {
  if (!value) return null;
  try {
    const raw = decodeHtml(value).replace(/^data:/, "");
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
}

function resolveImageUrl(value) {
  const url = String(value || "");
  return state.imageMap[url] || url;
}

function isImageUrl(value) {
  const text = String(value || "");
  if (/^https?:\/\/.+\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(text)) return true;
  if (/^https?:\/\/mmbiz\.qpic\.cn\//i.test(text)) return true;
  if (/^https?:\/\/cdn\.nlark\.com\/yuque\//i.test(text)) return true;
  return false;
}

function hashText(value) {
  return [...String(value || "")].reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) >>> 0, 0);
}

function stripHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content.textContent || "";
}

function decodeHtml(value) {
  return String(value ?? "")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#34;", "\"")
    .replaceAll("&#039;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
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
