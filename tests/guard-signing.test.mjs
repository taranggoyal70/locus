import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createSignedEnvelope,
  generateSigningKeyPair,
  readPublicKeyId,
  verifySignedEnvelope,
} from "../bin/guard-signing.mjs";

const temporaryDirectories = [];

function temporaryDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "locus-signing-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("Guard signed receipts", () => {
  it("verifies a canonical receipt with an independently held Ed25519 public key", () => {
    const directory = temporaryDirectory();
    const privateKeyPath = path.join(directory, "guard-private.pem");
    const publicKeyPath = path.join(directory, "guard-public.pem");
    const generated = generateSigningKeyPair({ privateKeyPath, publicKeyPath });
    const payload = {
      schemaVersion: "locus.guard.run-receipt.v1",
      candidate: { hash: "candidate-123" },
      review: { status: "pending" },
    };

    const envelope = createSignedEnvelope({ payload, privateKeyPath });
    const verified = verifySignedEnvelope({
      envelope,
      publicKeyPath,
      expectedKeyId: generated.keyId,
    });

    expect(verified).toEqual(payload);
    expect(envelope.signature.algorithm).toBe("ed25519");
    expect(envelope.signature.keyId).toBe(readPublicKeyId(publicKeyPath));
    expect(envelope.signature.value).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  });

  it("rejects a receipt changed after it was signed", () => {
    const directory = temporaryDirectory();
    const privateKeyPath = path.join(directory, "guard-private.pem");
    const publicKeyPath = path.join(directory, "guard-public.pem");
    generateSigningKeyPair({ privateKeyPath, publicKeyPath });
    const envelope = createSignedEnvelope({
      payload: { schemaVersion: "locus.guard.run-receipt.v1", result: "pass" },
      privateKeyPath,
    });
    envelope.payload.result = "fail";

    expect(() => verifySignedEnvelope({ envelope, publicKeyPath })).toThrow(
      /signature does not match/,
    );
  });

  it("rejects a valid signature from an unexpected signer", () => {
    const first = temporaryDirectory();
    const second = temporaryDirectory();
    const firstPrivate = path.join(first, "private.pem");
    const firstPublic = path.join(first, "public.pem");
    const secondPrivate = path.join(second, "private.pem");
    const secondPublic = path.join(second, "public.pem");
    generateSigningKeyPair({ privateKeyPath: firstPrivate, publicKeyPath: firstPublic });
    const expected = generateSigningKeyPair({
      privateKeyPath: secondPrivate,
      publicKeyPath: secondPublic,
    });
    const envelope = createSignedEnvelope({
      payload: { result: "pass" },
      privateKeyPath: firstPrivate,
    });

    expect(() => verifySignedEnvelope({
      envelope,
      publicKeyPath: firstPublic,
      expectedKeyId: expected.keyId,
    })).toThrow(/does not match the trusted key ID/);
  });
});
