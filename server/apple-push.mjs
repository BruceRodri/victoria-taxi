import { connect } from "node:http2";
import { readFileSync } from "node:fs";
import { sign } from "node:crypto";
export function apnsConfigured() {
  return Boolean(
    process.env.VT_APNS_KEY &&
    process.env.VT_APNS_KEY_ID &&
    process.env.VT_APNS_TEAM,
  );
}
export async function sendApple(token, body,data={}) {
  const encode = (obj) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  const unsigned =
    encode({ alg: "ES256", kid: process.env.VT_APNS_KEY_ID }) +
    "." +
    encode({
      iss: process.env.VT_APNS_TEAM,
      iat: Math.floor(Date.now() / 1000),
    });
  const sig = sign("sha256", Buffer.from(unsigned), {
    key: readFileSync(process.env.VT_APNS_KEY),
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");
  const client = connect(
    process.env.VT_APNS_SANDBOX === "1"
      ? "https://api.sandbox.push.apple.com"
      : "https://api.push.apple.com",
  );
  try {
    await new Promise((resolve, reject) => {
      client.once("error", reject);
      const req = client.request({
        ":method": "POST",
        ":path": "/3/device/" + token,
        authorization: "bearer " + unsigned + "." + sig,
        "apns-topic": "com.victoriataxi.mobile",
        "apns-push-type": "alert",
      });
      req.on("error", reject);
      req.on("response", (headers) =>
        headers[":status"] === 200
          ? resolve()
          : reject(Error("APNs " + headers[":status"])),
      );
      req.setTimeout(10000, () => {
        req.close();
        reject(Error("Timeout"));
      });
      req.end(
        JSON.stringify({
          ...data,aps: { ...(data.callId?{category:"VT_CALL"}:data.kind==="arrival"?{category:"VT_ARRIVAL"}:{}),alert: { title: "Victoria-Taxi", body }, sound: "default" },
        }),
      );
    });
  } finally {
    client.close();
  }
}
