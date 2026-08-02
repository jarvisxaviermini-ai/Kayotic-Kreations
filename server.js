const fs = require("fs");
const http = require("http");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const contentPath = path.join(root, "content.json");
const passwordPath = path.join(root, ".admin-password");
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";
const sessions = new Set();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function send(res, status, body, type = "text/plain; charset=utf-8", extraHeaders = {}) {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  res.end(body);
}

function redirect(res, location) {
  res.writeHead(302, {
    Location: location,
    "Cache-Control": "no-store",
  });
  res.end();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function safeFilePath(urlPath) {
  const requested = decodeURIComponent(urlPath.split("?")[0]);
  const cleanPath = requested === "/" ? "/index.html" : requested;
  const filePath = path.join(root, cleanPath);
  if (!filePath.startsWith(root)) return null;
  return filePath;
}

async function getAdminPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;

  try {
    return (await fs.promises.readFile(passwordPath, "utf8")).trim();
  } catch {
    const generated = crypto.randomBytes(12).toString("base64url");
    await fs.promises.writeFile(passwordPath, `${generated}\n`, { mode: 0o600 });
    return generated;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim().split("="))
      .filter((pair) => pair.length === 2)
  );
}

function isAuthed(req) {
  const token = parseCookies(req).kk_session;
  return Boolean(token && sessions.has(token));
}

function isProtectedStatic(filePath) {
  const name = path.basename(filePath);
  return name === "admin.html" || name === "admin.js";
}

function isBlockedStatic(filePath) {
  const name = path.basename(filePath);
  return name.startsWith(".") || ["content.json", "server.js", "package.json", "server.log"].includes(name);
}

async function handleApi(req, res) {
  if (req.url === "/api/login" && req.method === "POST") {
    const body = await readBody(req);
    const parsed = JSON.parse(body);
    const password = await getAdminPassword();

    if (parsed.password !== password) {
      send(res, 401, JSON.stringify({ ok: false }), "application/json; charset=utf-8");
      return true;
    }

    const token = crypto.randomBytes(24).toString("base64url");
    sessions.add(token);
    send(res, 200, JSON.stringify({ ok: true }), "application/json; charset=utf-8", {
      "Set-Cookie": `kk_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`,
    });
    return true;
  }

  if (req.url === "/api/logout" && req.method === "POST") {
    const token = parseCookies(req).kk_session;
    if (token) sessions.delete(token);
    send(res, 200, JSON.stringify({ ok: true }), "application/json; charset=utf-8", {
      "Set-Cookie": "kk_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
    });
    return true;
  }

  if (req.url === "/api/content" && req.method === "GET") {
    const content = await fs.promises.readFile(contentPath, "utf8");
    send(res, 200, content, "application/json; charset=utf-8");
    return true;
  }

  if (req.url === "/api/content" && req.method === "POST") {
    if (!isAuthed(req)) {
      send(res, 401, JSON.stringify({ ok: false }), "application/json; charset=utf-8");
      return true;
    }

    const body = await readBody(req);
    const parsed = JSON.parse(body);
    const formatted = `${JSON.stringify(parsed, null, 2)}\n`;
    await fs.promises.writeFile(contentPath, formatted, "utf8");
    send(res, 200, JSON.stringify({ ok: true }), "application/json; charset=utf-8");
    return true;
  }

  return false;
}

async function handleStatic(req, res) {
  const filePath = safeFilePath(req.url);
  if (!filePath) {
    send(res, 403, "Forbidden");
    return;
  }

  if (isBlockedStatic(filePath)) {
    send(res, 404, "Not found");
    return;
  }

  if (isProtectedStatic(filePath) && !isAuthed(req)) {
    redirect(res, "/login.html");
    return;
  }

  try {
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) {
      send(res, 404, "Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const content = await fs.promises.readFile(filePath);
    send(res, 200, content, mimeTypes[ext] || "application/octet-stream");
  } catch {
    send(res, 404, "Not found");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (await handleApi(req, res)) return;
    await handleStatic(req, res);
  } catch (error) {
    send(res, 500, error.message || "Server error");
  }
});

server.listen(port, host, () => {
  console.log(`Kayotic Kreations running at http://${host}:${port}/`);
  getAdminPassword().catch((error) => {
    console.error(`Could not prepare admin password: ${error.message}`);
  });
});
