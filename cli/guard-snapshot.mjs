#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const [sourceRootArg, destinationRootArg, entriesArg, depthArg, bytesArg] = process.argv.slice(2);
const sourceRoot = fs.realpathSync(sourceRootArg);
const destinationRoot = fs.realpathSync(destinationRootArg);
const limits = {
  entries: Number(entriesArg),
  depth: Number(depthArg),
  bytes: Number(bytesArg),
};
const state = { entries: 0, bytes: 0 };

function fail(message) {
  throw new Error(`Guard snapshot refused the workspace: ${message}`);
}

function destinationPath(relativePath) {
  const target = path.resolve(destinationRoot, relativePath);
  const relative = path.relative(destinationRoot, target);
  if (relative === ".." || relative.startsWith(`..${path.sep}`)) fail("path escaped destination");
  return target;
}

function copyRegular(source, destination, before) {
  state.bytes += before.size;
  if (state.bytes > limits.bytes) fail(`apparent bytes exceed ${limits.bytes}`);
  const sourceDescriptor = fs.openSync(
    source,
    fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0),
  );
  let destinationDescriptor;
  try {
    const opened = fs.fstatSync(sourceDescriptor);
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino) {
      fail(`regular file changed before copy: ${source}`);
    }
    destinationDescriptor = fs.openSync(
      destination,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL
        | (fs.constants.O_NOFOLLOW ?? 0),
      before.mode & 0o777,
    );
    const chunk = Buffer.allocUnsafe(64 * 1024);
    let copied = 0;
    while (copied < opened.size) {
      const count = fs.readSync(
        sourceDescriptor,
        chunk,
        0,
        Math.min(chunk.byteLength, opened.size - copied),
        null,
      );
      if (count === 0) break;
      fs.writeSync(destinationDescriptor, chunk, 0, count);
      copied += count;
    }
    const after = fs.fstatSync(sourceDescriptor);
    if (copied !== opened.size || opened.size !== after.size || opened.mtimeMs !== after.mtimeMs
      || opened.dev !== after.dev || opened.ino !== after.ino) {
      fail(`regular file changed during copy: ${source}`);
    }
  } finally {
    if (destinationDescriptor !== undefined) fs.closeSync(destinationDescriptor);
    fs.closeSync(sourceDescriptor);
  }
}

function copyDirectory(sourceDirectory, relativeDirectory = "", depth = 0) {
  if (depth > limits.depth) fail(`directory depth exceeds ${limits.depth}`);
  for (const name of fs.readdirSync(sourceDirectory)) {
    state.entries += 1;
    if (state.entries > limits.entries) fail(`entry count exceeds ${limits.entries}`);
    const relativePath = relativeDirectory ? path.join(relativeDirectory, name) : name;
    const source = path.join(sourceDirectory, name);
    const destination = destinationPath(relativePath);
    const stat = fs.lstatSync(source);
    if (stat.isDirectory()) {
      fs.mkdirSync(destination, { mode: stat.mode & 0o777 });
      copyDirectory(source, relativePath, depth + 1);
    } else if (stat.isSymbolicLink()) {
      fs.symlinkSync(fs.readlinkSync(source), destination);
    } else if (stat.isFile()) {
      copyRegular(source, destination, stat);
    } else {
      const args = process.platform === "darwin"
        ? ["-pPR", source, destination]
        : ["-a", "--no-dereference", source, destination];
      execFileSync("/bin/cp", args, { stdio: "ignore" });
    }
  }
}

copyDirectory(sourceRoot);
