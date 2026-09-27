import { createSign, createVerify, createHash } from "node:crypto";

/**
 * Minimal HTTP Signatures (draft-cavage) for ActivityPub server-to-server.
 * Signs (request-target), host, date, and digest when a body is present.
 */
export function signRequest(opts: {
  method: string;
  url: string;
  body?: string;
  privateKeyPem: string;
  keyId: string;
}): { headers: Record<string, string>; body?: string } {
  const parsed = new URL(opts.url);
  const date = new Date().toUTCString();
  const headers: Record<string, string> = {
    Host: parsed.host,
    Date: date,
    Accept: "application/activity+json, application/ld+json",
    "Content-Type": "application/activity+json",
  };

  const signingHeaders = ["(request-target)", "host", "date"];
  let digestLine = "";
  if (opts.body != null) {
    const digest = createHash("sha256").update(opts.body).digest("base64");
    headers.Digest = `SHA-256=${digest}`;
    signingHeaders.push("digest");
    digestLine = `\ndigest: ${headers.Digest}`;
  }

  const target =
    `${opts.method.toLowerCase()} ${parsed.pathname}${parsed.search}`;
  const signingString =
    `(request-target): ${target}\nhost: ${parsed.host}\ndate: ${date}${digestLine}`;

  const signer = createSign("sha256");
  signer.update(signingString);
  signer.end();
  const signature = signer.sign(opts.privateKeyPem, "base64");

  headers.Signature = [
    `keyId="${opts.keyId}"`,
    `algorithm="rsa-sha256"`,
    `headers="${signingHeaders.join(" ")}"`,
    `signature="${signature}"`,
  ].join(",");

  return { headers, body: opts.body };
}

export function parseSignatureHeader(header: string) {
  const out: Record<string, string> = {};
  for (const part of header.split(",")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    let val = part.slice(idx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    out[key] = val;
  }
  return out;
}

export function verifyRequestSignature(opts: {
  method: string;
  url: string;
  headers: Headers;
  body: string;
  publicKeyPem: string;
}): boolean {
  const sigHeader = opts.headers.get("signature");
  if (!sigHeader) return false;
  const parts = parseSignatureHeader(sigHeader);
  if (!parts.signature || !parts.headers) return false;

  const parsed = new URL(opts.url);
  const headerList = parts.headers.split(/\s+/);
  const lines: string[] = [];
  for (const h of headerList) {
    if (h === "(request-target)") {
      lines.push(
        `(request-target): ${opts.method.toLowerCase()} ${parsed.pathname}${parsed.search}`,
      );
    } else {
      const val = opts.headers.get(h);
      if (val == null) return false;
      lines.push(`${h}: ${val}`);
    }
  }

  if (headerList.includes("digest")) {
    const expected = createHash("sha256").update(opts.body).digest("base64");
    const got = opts.headers.get("digest") ?? "";
    if (!got.includes(expected)) return false;
  }

  const verifier = createVerify("sha256");
  verifier.update(lines.join("\n"));
  verifier.end();
  try {
    return verifier.verify(opts.publicKeyPem, parts.signature, "base64");
  } catch {
    return false;
  }
}
