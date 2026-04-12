import * as service from "./iclock.service.js";

export function pollDevice(req, res) {
  const command = service.getPollResponse({
    headers: req.headers,
    query: req.query,
  });

  return res.type("text/plain").send(command);
}

export async function receiveDevicePacket(req, res) {
  try {
    await service.handleIncomingPacket({
      headers: req.headers,
      body: req.body,
    });
  } catch (error) {
    // Device expects text/plain response even when payload is malformed.
    console.error("ICLOCK PARSE ERROR:", error.message || error);
  }

  return res.type("text/plain").send("OK");
}
