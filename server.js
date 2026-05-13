const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = 8765;
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

http.createServer((request, response) => {
  const url = decodeURIComponent(request.url.split("?")[0]);
  const filePath = path.join(root, url === "/" ? "index.html" : url);

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": types[path.extname(filePath)] || "text/plain; charset=utf-8"
    });
    response.end(data);
  });
}).listen(port, "127.0.0.1", () => {
  console.log(`To-do app: http://127.0.0.1:${port}/`);
});
