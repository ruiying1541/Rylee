import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dataPath = path.join(root, "data", "articles.json");
const outputDir = path.join(root, "assets", "article-images");
const mapPath = path.join(root, "data", "image-map.json");
const concurrency = Number(process.env.IMAGE_DOWNLOAD_CONCURRENCY || 8);

const imageExtensions = new Map([
  ["image/jpeg", ".jpg"],
  ["image/jpg", ".jpg"],
  ["image/png", ".png"],
  ["image/gif", ".gif"],
  ["image/webp", ".webp"],
  ["image/svg+xml", ".svg"]
]);

const articlesPayload = JSON.parse(await readFile(dataPath, "utf8"));
const imageUrls = extractImageUrls(articlesPayload.articles || []);
const existingMap = await readJson(mapPath).catch(() => ({}));
const imageMap = { ...existingMap };

await mkdir(outputDir, { recursive: true });

let completed = 0;
let failed = 0;
let skipped = 0;

await runPool(imageUrls, concurrency, async (url) => {
  if (imageMap[url]) {
    skipped += 1;
    completed += 1;
    logProgress();
    return;
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 KnowledgeBaseImageDownloader/1.0",
        Referer: "https://www.yuque.com/"
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = getImageExtension(url, response.headers.get("content-type"));
    const fileName = `${createHash("sha1").update(url).digest("hex").slice(0, 16)}${ext}`;
    const relativePath = `./assets/article-images/${fileName}`;

    await writeFile(path.join(outputDir, fileName), buffer);
    imageMap[url] = relativePath;
  } catch (error) {
    failed += 1;
    console.warn(`\nFailed: ${url}\n${error.message}`);
  } finally {
    completed += 1;
    logProgress();
  }
});

await writeFile(mapPath, `${JSON.stringify(imageMap, null, 2)}\n`, "utf8");
console.log(`\nDone. total=${imageUrls.length}, mapped=${Object.keys(imageMap).length}, skipped=${skipped}, failed=${failed}`);

function extractImageUrls(articles) {
  const urls = new Set();
  articles.forEach((article) => {
    const html = String(article.html || "");

    html.replace(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi, (_, src) => {
      if (isRemoteImage(src)) urls.add(decodeHtml(src));
      return "";
    });

    for (const match of html.matchAll(/<card\b([^>]*)><\/card>/g)) {
      const card = parseCardValue(parseAttributes(match[1]).value);
      const candidates = [card?.detail?.image, card?.image, card?.src, card?.url]
        .filter(Boolean)
        .map(String);
      candidates.forEach((candidate) => {
        if (isRemoteImage(candidate)) urls.add(candidate);
      });
    }
  });
  return [...urls];
}

function isRemoteImage(value) {
  const text = String(value || "");
  if (/^https?:\/\/.+\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(text)) return true;
  if (/^https?:\/\/mmbiz\.qpic\.cn\//i.test(text)) return true;
  if (/^https?:\/\/cdn\.nlark\.com\/yuque\//i.test(text)) return true;
  return false;
}

function getImageExtension(url, contentType) {
  const fromType = imageExtensions.get(String(contentType || "").split(";")[0].trim().toLowerCase());
  if (fromType) return fromType;
  const pathname = new URL(url).pathname;
  const ext = path.extname(pathname).toLowerCase();
  return ext && ext.length <= 6 ? ext : ".png";
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

function decodeHtml(value) {
  return String(value || "")
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function runPool(items, limit, worker) {
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  });
  await Promise.all(workers);
}

function logProgress() {
  process.stdout.write(`\rDownloading images ${completed}/${imageUrls.length} failed=${failed}`);
}
