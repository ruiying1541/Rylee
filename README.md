# Rylee歪理知识库

这是一个用于承载语雀设计文章的静态知识库网站。

## 运行网站

```bash
npm start
```

打开终端输出的地址。默认是 `http://localhost:5173`；如果 `5173` 已被其他项目占用，服务会自动尝试 `5174`、`5175` 等后续端口，请以终端输出为准。

注意：不要直接双击打开 `index.html`。页面需要通过本地服务加载 `data/articles.json` 和 `data/yuque-toc.json`，直接用 `file://` 打开可能会出现 `TypeError: fetch failed` 或数据加载失败。

## 导入语雀内容

### 在线导入

如果知识库有访问密码，可以直接导入：

```bash
npm run import:yuque-online -- https://www.yuque.com/abyssalsailor/yg90qa 密码
```

脚本会生成 `data/articles.json` 和 `data/yuque-toc.json`。

### 导入导出文件

也可以在语雀里导出知识库内容，然后：

1. 把导出的 Markdown 或 HTML 文件夹放到项目根目录。
2. 将文件夹命名为 `yuque-export`。
3. 运行：

```bash
npm run import:yuque
```

如果你的导出文件夹不是 `yuque-export`，可以指定路径：

```bash
node scripts/import-yuque-export.mjs ./你的导出文件夹
```

导入后会生成 `data/articles.json`，刷新网页即可看到完整文章列表和正文。
