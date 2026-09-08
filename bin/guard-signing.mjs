import crypto from "node:crypto";
import fs from "node:fs";
import { canonicalJson, sha256, writeFileSafely } from "./guard.mjs";

export const SIGNED_ENVELOPE_SCHEMA = "locus.guard.signed-envelope.v1";

function requireEd25519PrivateKey(privateKeyPath) {
  let key;
  try {
    key = crypto.createPrivateKey(fs.readFileSync(privateKeyPath));
  } catch {
    throw new Error(`Guard signing private key is unreadable: ${privateKeyPath}`);
  }
  if (key.asymmetricKeyType !== "ed25519") {
    throw new Error("Guard signing requires an Ed25519 private key.");
  }
  return key;
}

function requireEd25519PublicKey(publicKeyPath) {
  let key;
  try {
    key = crypto.createPublicKey(fs.readFileSync(publicKeyPath));
  } catch {
    throw new Error(`Guard signing public key is unreadable: ${publicKeyPath}`);
  }
  if (key.asymmetricKeyType !== "ed25519") {
    throw new Error("Guard verification requires an Ed25519 public key.");
  }
  return key;
}

function publicKeyId(publicKey) {
  return sha256(publicKey.export({ type: "spki", format: "der" }));
}

export function readPublicKeyId(publicKeyPath) {
  return publicKeyId(requireEd25519PublicKey(publicKeyPath));
}

export function generateSigningKeyPair({ privateKeyPath, publicKeyPath }) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" });
  const publicPem = publicKey.export({ type: "spki", format: "pem" });
  writeFileSafely(privateKeyPath, privatePem, { mode: 0o600, exclusive: true });
  try {
    writeFileSafely(publicKeyPath, publicPem, { mode: 0o644, exclusive: true });
  } catch (cause) {
    try {
      fs.unlinkSync(privateKeyPath);
    } catch {
      // The original error is more useful; a leftover key remains mode 0600.
    }
    throw cause;
  }
  return { keyId: publicKeyId(publicKey), privateKeyPath, publicKeyPath };
}

export function createSignedEnvelope({ payload, privateKeyPath }) {
  const privateKey = requireEd25519PrivateKey(privateKeyPath);
  const publicKey = crypto.createPublicKey(privateKey);
  const signature = crypto.sign(null, Buffer.from(canonicalJson(payload)), privateKey);
  return {
    schemaVersion: SIGNED_ENVELOPE_SCHEMA,
    payload,
    signature: {
      algorithm: "ed25519",
      keyId: publicKeyId(publicKey),
      value: signature.toString("base64"),
    },
  };
}

export function verifySignedEnvelope({ envelope, publicKeyPath, expectedKeyId = null }) {
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
    throw new Error("Guard signed receipt must be a JSON object.");
  }
  if (envelope.schemaVersion !== SIGNED_ENVELOPE_SCHEMA) {
    throw new Error(`Unsupported Guard signed envelope schema: ${envelope.schemaVersion ?? "missing"}`);
  }
  if (envelope.signature?.algorithm !== "ed25519") {
    throw new Error("Guard signed receipt must use Ed25519.");
  }
  const publicKey = requireEd25519PublicKey(publicKeyPath);
  const trustedKeyId = publicKeyId(publicKey);
  if (envelope.signature?.keyId !== trustedKeyId) {
    throw new Error("Guard signed receipt key ID does not match the supplied public key.");
  }
  if (expectedKeyId && trustedKeyId !== expectedKeyId) {
    throw new Error(
      `Guard signed receipt does not match the trusted key ID: expected ${expectedKeyId}, got ${trustedKeyId}.`,
    );
  }
  let signature;
  try {
    signature = Buffer.from(envelope.signature.value, "base64");
  } catch {
    throw new Error("Guard signed receipt signature is not valid base64.");
  }
  const valid = crypto.verify(
    null,
    Buffer.from(canonicalJson(envelope.payload)),
    publicKey,
    signature,
  );
  if (!valid) throw new Error("Guard signed receipt signature does not match its payload.");
  return envelope.payload;
}
