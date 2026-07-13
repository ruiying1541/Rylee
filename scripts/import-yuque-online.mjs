import { publicEncrypt, constants } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

const sourceUrl = process.argv[2] || "https://www.yuque.com/abyssalsailor/yg90qa";
const password = process.argv[3] || process.env.YUQUE_PASSWORD;

if (!password) {
  console.error("Usage: npm run import:yuque-online -- <yuque-url> <password>");
  process.exit(1);
}

const cookieJar = new Map();

const firstHtml = await requestText(sourceUrl);
let appData = parseAppData(firstHtml);

if (appData.matchCondition?.page === "verify") {
  const id = appData.matchCondition.needVerifyTargetId;
  const targetType = appData.matchCondition.targetType;
  const endpoint = targetType === "Book" ? `/api/books/${id}/verify` : `/api/docs/${id}/verify`;

  await requestJson(new URL(endpoint, sourceUrl), {
    method: "PUT",
    body: JSON.stringify({ password: encryptPassword(password) })
  });
}

const bookHtml = await requestText(sourceUrl);
appData = parseAppData(bookHtml);

if (!appData.book?.toc) {
  throw new Error("Could not read Yuque book table of contents.");
}

const book = appData.book;
const toc = book.toc || [];
const docs = toc.filter((item) => item.type === "DOC" && item.url);
const ancestorsByUuid = buildAncestors(toc);
const articles = [];

for (let index = 0; index < docs.length; index += 1) {
  const item = docs[index];
  const response = await requestJson(new URL(`/api/docs/${item.url}?book_id=${book.id}`, sourceUrl));
  const data = response.data || response;
  const ancestors = ancestorsByUuid.get(item.uuid) || [];
  const html = normalizeLakeHtml(data.content || "");
  const plainText = stripHtml(html);

  articles.push({
    title: data.title || item.title,
    slug: item.url,
    summary: plainText.slice(0, 140),
    category: [...ancestors].reverse().find(Boolean) || "未分类",
    tags: ancestors,
    featured: index < 6,
    order: index + 1,
    level: item.level || 0,
    updatedAt: formatDate(data.content_updated_at || data.updated_at),
    wordCount: data.word_count || countWords(plainText),
    sourceUrl: new URL(`${book.namespace}/${item.url}`, "https://www.yuque.com/").toString(),
    html
  });

  console.log(`Imported ${index + 1}/${docs.length}: ${data.title || item.title}`);
  await wait(180);
}

await mkdir("data", { recursive: true });
await writeFile("data/yuque-toc.json", JSON.stringify({ sourceUrl, book, toc }, null, 2), "utf8");
await writeFile("data/articles.json", JSON.stringify({
  source: sourceUrl,
  title: book.name,
  totalWords: articles.reduce((sum, article) => sum + (article.wordCount || 0), 0),
  articles
}, null, 2), "utf8");

console.log(`Done. Imported ${articles.length} articles.`);

async function requestText(url, options = {}) {
  const response = await fetch(url, requestOptions(url, options));
  storeCookies(response);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.text();
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, requestOptions(url, options));
  storeCookies(response);
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON from ${url}, got: ${text.slice(0, 160)}`);
  }
  if (!response.ok) throw new Error(payload.message || `${response.status} ${response.statusText}`);
  return payload;
}

function requestOptions(url, options = {}) {
  const headers = {
    "Accept": "application/json,text/html;q=0.9,*/*;q=0.8",
    "Content-Type": "application/json",
    "Referer": sourceUrl,
    "Origin": new URL(sourceUrl).origin,
    "X-Requested-With": "XMLHttpRequest",
    ...options.headers
  };

  const csrf = cookieJar.get("yuque_ctoken");
  if (csrf) headers["x-csrf-token"] = csrf;

  const cookie = cookieHeader();
  if (cookie) headers.Cookie = cookie;

  return {
    credentials: "include",
    ...options,
    headers
  };
}

function storeCookies(response) {
  const setCookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
  const fallback = response.headers.get("set-cookie");
  const values = setCookies.length ? setCookies : fallback ? [fallback] : [];

  for (const value of values) {
    const first = value.split(";")[0];
    const index = first.indexOf("=");
    if (index > 0) cookieJar.set(first.slice(0, index), first.slice(index + 1));
  }
}

function cookieHeader() {
  return [...cookieJar.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
}

function parseAppData(html) {
  const encoded = html.match(/window\.appData = JSON\.parse\(decodeURIComponent\("([^"]+)"\)\)/)?.[1];
  if (!encoded) throw new Error("Could not find window.appData in Yuque page.");
  return JSON.parse(decodeURIComponent(encoded));
}

function encryptPassword(value) {
  const publicKey = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCfwyOyncSrUTmkaUPsXT6UUdXx
TQ6a0wgPShvebfwq8XeNj575bUlXxVa/ExIn4nOUwx6iR7vJ2fvz5Ls750D051S7
q70sevcmc8SsBNoaMQtyF/gETPBSsyWv3ccBJFrzZ5hxFdlVUfg6tXARtEI8rbIH
su6TBkVjk+n1Pw/ihQIDAQAB
-----END PUBLIC KEY-----`;

  return publicEncrypt({
    key: publicKey,
    padding: constants.RSA_PKCS1_PADDING
  }, Buffer.from(`${Date.now()}:${value}`)).toString("base64");
}

function buildAncestors(toc) {
  const byUuid = new Map(toc.map((item) => [item.uuid, item]));
  const result = new Map();

  for (const item of toc) {
    const ancestors = [];
    let parentUuid = item.parent_uuid;
    while (parentUuid && byUuid.has(parentUuid)) {
      const parent = byUuid.get(parentUuid);
      ancestors.unshift(parent.title);
      parentUuid = parent.parent_uuid;
    }
    result.set(item.uuid, ancestors);
  }

  return result;
}

function normalizeLakeHtml(content) {
  return String(content || "")
    .replace(/^<!doctype lake>/i, "")
    .replace(/<meta\b[^>]*>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .trim();
}

function stripHtml(html) {
  return String(html || "")
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

function formatDate(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
