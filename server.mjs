import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const preferredPort = Number(process.env.PORT || 5173);
const maxPortAttempts = 20;

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml"
};

const server = createServer((request, response) => {
  const host = request.headers.host || `localhost:${server.address()?.port || preferredPort}`;
  const url = new URL(request.url || "/", `http://${host}`);
  const pathname = decodeURIComponent(url.pathname);
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = normalize(join(root, requested));

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const stats = statSync(filePath);
    const target = stats.isDirectory() ? join(filePath, "index.html") : filePath;
    response.writeHead(200, { "Content-Type": types[extname(target)] || "application/octet-stream" });
    createReadStream(target).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.on("listening", () => {
  const actualPort = server.address().port;
  console.log(`Design knowledge platform: http://localhost:${actualPort}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE" && currentAttempt < maxPortAttempts) {
    currentPort += 1;
    currentAttempt += 1;
    console.warn(`Port ${currentPort - 1} is already in use, trying ${currentPort}...`);
    server.listen(currentPort);
    return;
  }

  console.error(error);
  process.exitCode = 1;
});

let currentPort = preferredPort;
let currentAttempt = 0;
server.listen(currentPort);
