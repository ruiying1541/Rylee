# 项目交接说明

这是“Rylee歪理知识库”的静态网站项目，可直接交给其他 AI 工具继续开发。

## 当前状态

- 首页：站酷风格卡片流，显示全部 120 篇文章。
- 左侧栏目：固定为 7 个 AI 设计主题栏目，并按主题筛选文章。
- 目录页：单独页面，保留语雀原目录层级，共 146 条目录节点。
- 文章页：保留语雀正文内容，语雀图片卡片会渲染为正文图片，链接卡片会渲染为链接卡片。
- 数据：`data/articles.json` 是文章数据，`data/yuque-toc.json` 是语雀目录数据。

## 运行方式

```bash
npm start
```

打开：

```text
http://localhost:5173/
```

这个项目没有前端框架依赖，使用原生 HTML、CSS、JavaScript。

## 文件结构

```text
index.html                         页面骨架
styles.css                         全站样式，包含站酷风格布局、卡片、目录、文章正文
app.js                             前端逻辑，包含路由、筛选、栏目、卡片、正文渲染
server.mjs                         本地静态服务器
package.json                       启动脚本
data/articles.json                 120 篇文章正文与元数据
data/yuque-toc.json                原语雀目录层级
scripts/import-yuque-online.mjs    从语雀在线导入内容
scripts/import-yuque-export.mjs    从语雀导出文件夹导入内容
```

## 关键实现

### 1. 路由

路由在 `app.js`：

- `#/` 首页卡片流
- `#/catalog` 目录页
- `#/article/:slug` 文章详情页

### 2. 左侧主题栏目

栏目配置在 `app.js` 顶部的 `topicGroups`：

```js
const topicGroups = [
  { id: "vibe-coding", title: "AI 编程与 Vibe Coding 工作流", keywords: [...] },
  ...
];
```

如果要改栏目标题、顺序、匹配关键词，优先改这里。

匹配优先级在 `topicMatchOrder`，用于避免一篇文章被宽泛关键词提前匹配。

### 3. 封面

封面逻辑在 `getArticleCover()` 和 `renderCover()`：

- 优先从语雀正文图片卡片里取真实图片。
- 没有图片时，用文章标题和栏目生成一张文字封面。
- 不会改动 `data/articles.json` 原始数据。

### 4. 文章正文图片

语雀正文里有 Lake 格式的 `<card>` 标签。渲染逻辑在：

- `renderLakeHtml()`
- `renderLakeCard()`
- `extractLakeCards()`

图片卡片会变成 `.lake-image-card`，链接卡片会变成 `.lake-link-card`。

## 当前 7 个栏目

1. AI 编程与 Vibe Coding 工作流
2. 人工智能设计基础
3. 产品设计师 AI 能力矩阵
4. AI 驱动的体验设计方法
5. 大厂 AI 设计系统与案例
6. AI 产品设计案例库
7. 设计全流程 AI 提效指南

## 常见修改入口

- 改整体布局、颜色、间距：修改 `styles.css`
- 改左侧栏目：修改 `app.js` 的 `topicGroups`
- 改首页卡片内容：修改 `renderArticleCard()`
- 改封面规则：修改 `getArticleCover()` / `renderCover()`
- 改文章详情页：修改 `renderArticle()` 和文章正文相关 CSS
- 重新导入语雀内容：运行 `npm run import:yuque-online -- 语雀链接 密码`

## 注意事项

- 不要直接手动改 `data/articles.json` 的正文内容，除非明确要改文章信息。
- 如果重新导入语雀内容，可能会覆盖 `data/articles.json` 和 `data/yuque-toc.json`。
- 如果要保持“不要更改任何信息”，只改渲染逻辑和样式，不改数据文件。
