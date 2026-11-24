import express from "express";
import { dispatch } from "./dispatch.mjs";
import { fileURLToPath } from "node:url";
const app = express();
const service = dispatch({lanTest: process.env.VT_LAN_TEST === "1"});
app.use("/dispatch", service);
if (process.env.VT_LAN_TEST === "1") {
  app.get("/Victoria-Taxi.apk", (_req, res) =>
    res.download(fileURLToPath(new URL("../android/app/build/outputs/apk/debug/app-debug.apk", import.meta.url)), "Victoria-Taxi.apk"));
}
app.use(express.static(fileURLToPath(new URL("../dist", import.meta.url))));
const server = app.listen(Number(process.env.PORT || 5192), process.env.HOST || "127.0.0.1");
service.attachWebSocket(server);
