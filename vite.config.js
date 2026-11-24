import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import express from "express";
import { dispatch } from "./server/dispatch.mjs";
function service(server) {
  const app = express();
  const api = dispatch({ demo: true });
  app.use("/dispatch", api);
  if (server.httpServer) api.attachWebSocket(server.httpServer);
  server.middlewares.use(app);
}
export default defineConfig({
  build: {target: "chrome80"},
  plugins: [
    react(),
    {
      name: "victoria-service",
      configureServer: service,
      configurePreviewServer: service,
    },
  ],
});
