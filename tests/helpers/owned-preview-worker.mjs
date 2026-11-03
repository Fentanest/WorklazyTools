import { preview } from "vite";

const { repositoryRoot, port, outDir, token } = JSON.parse(process.argv[2]);
const host = "127.0.0.1";
let server;
let stopping = false;
async function stop() {
  stopping = true;
  if (server) await new Promise((resolve) => {
    server.httpServer.close(resolve);
    server.httpServer.closeAllConnections();
  });
  process.exit(0);
}
process.once("SIGTERM", stop);
process.once("disconnect", stop);

try {
  server = await preview({
    root: repositoryRoot,
    envFile: false,
    build: { outDir },
    preview: { host, port, strictPort: true, open: false },
    plugins: [{
      name: "harness-preview-identity",
      configurePreviewServer(previewServer) {
        previewServer.middlewares.use((request, response, next) => {
          if (request.url !== `/__harness_preview_identity/${token}`) return next();
          response.setHeader("Content-Type", "application/json");
          response.setHeader("Cache-Control", "no-store");
          response.end(JSON.stringify({ token, pid: process.pid, port }));
        });
      },
    }],
  });
  if (stopping) await stop();
  const address = server.httpServer.address();
  if (!address || typeof address === "string" || address.port !== port || address.address !== host) {
    throw new Error("Vite preview listened on an unexpected address");
  }
  process.send({ type: "listening", token, pid: process.pid, host: address.address, port: address.port });
} catch (error) {
  console.error(error);
  process.exit(1);
}
