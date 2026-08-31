import {
  AgentSlice,
  truncateToolOutput,
  validateAgentCommand,
  validateRepoPath,
  type AgentSliceLedger,
} from "@/lib/agent/workspace-tools";

export type AgentWorkspaceCommand = {
  command: string;
  workingDirectory?: string;
  env?: Record<string, string>;
  abortSignal?: AbortSignal;
  timeoutMs?: number;
};

export type AgentWorkspaceFile = {
  path: string;
  content: string | Uint8Array;
  abortSignal?: AbortSignal;
};

export type AgentWorkspaceResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export interface AgentWorkspace {
  readonly id: string;
  readonly description: string;
  run(command: AgentWorkspaceCommand): Promise<AgentWorkspaceResult>;
  writeFile(file: AgentWorkspaceFile): Promise<void>;
  // R2: revoke every outbound network route for the remainder of the
  // sandbox's life. This must be enforced by the platform rather than by shell
  // convention, because the code it constrains can rewrite any shell it is
  // given. Called once, after dependency bootstrap and before the first
  // repository-controlled program runs.
  lockNetwork(abortSignal?: AbortSignal): Promise<void>;
  stop(): Promise<void>;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function evidence(result: AgentWorkspaceResult): string {
  const streams = [
    `exit ${result.exitCode}`,
    result.stdout.trim() && `stdout:\n${result.stdout.trim()}`,
    result.stderr.trim() && `stderr:\n${result.stderr.trim()}`,
  ].filter(Boolean);
  return truncateToolOutput(streams.join("\n\n"));
}

// Canonical containment, executed inside the sandbox.
//
// validateRepoPath is a lexical check that runs on the host and can only see the
// string. This is the check that actually holds, because it runs where the
// filesystem is and resolves what the path really points at. A repository is
// hostile input: it can ship a symlink at an admitted path so that a
// syntactically-inside path writes outside the workspace.
//
// For every path component this rejects:
//   - resolution outside the workspace root (realpath of cwd)
//   - symlinks, the documented way a repository redirects an admitted path
//   - sockets/FIFOs/devices, which make reads and writes non-deterministic
//
// lstat is used rather than stat precisely because stat follows links. Walking
// component-by-component (not just the final target) is required: a symlinked
// parent directory redirects every child beneath it.
// Exported so the containment boundary can be executed against a real
// filesystem in tests. Asserting that this string exists would prove nothing —
// the guarantee is that running it rejects a symlinked escape.
export const CONTAINMENT_PRELUDE = [
  'const fs=require("node:fs");',
  'const path=require("node:path");',
  "const root=fs.realpathSync(process.cwd());",
  "function contain(value){",
  'if(typeof value!=="string"||!value)throw new Error("missing path");',
  "const absolute=path.resolve(root,value);",
  "const relative=path.relative(root,absolute);",
  'if(!relative||relative.startsWith("..")||path.isAbsolute(relative))throw new Error("path escapes the workspace");',
  "let cursor=root;",
  "for(const segment of relative.split(path.sep)){",
  "cursor=path.join(cursor,segment);",
  "let entry;",
  // A missing component is fine — writeFile legitimately creates new files and
  // parent directories. Nothing below a missing component can exist either, so
  // there is nothing further to validate.
  "try{entry=fs.lstatSync(cursor);}catch{break;}",
  'if(entry.isSymbolicLink())throw new Error("symlink rejected: "+segment);',
  'if(!entry.isDirectory()&&!entry.isFile())throw new Error("special file rejected: "+segment);',
  "}",
  "return absolute;",
  "}",
].join("");

const READ_SLICE_CHARACTERS = 10_000;

const WRITE_SCRIPT = CONTAINMENT_PRELUDE + [
  "const target=contain(process.env.LOCUS_PATH);",
  "const content=process.env.LOCUS_CONTENT;",
  'if(content===undefined)throw new Error("missing write input");',
  "fs.mkdirSync(path.dirname(target),{recursive:true});",
  "fs.writeFileSync(target,content);",
  'process.stdout.write(`wrote ${process.env.LOCUS_PATH}\\n`);',
].join("");

const REPLACE_SCRIPT = CONTAINMENT_PRELUDE + [
  "const target=contain(process.env.LOCUS_PATH);",
  "const before=process.env.LOCUS_BEFORE;",
  "const after=process.env.LOCUS_AFTER;",
  'if(before===undefined||after===undefined)throw new Error("missing replace input");',
  'const source=fs.readFileSync(target,"utf8");',
  "const count=source.split(before).length-1;",
  'if(count!==1){console.error(`expected exactly one match, found ${count}`);process.exit(2);}',
  "fs.writeFileSync(target,source.replace(before,after));",
  'process.stdout.write(`updated ${process.env.LOCUS_PATH}\\n`);',
].join("");

const READ_BASE64_SCRIPT = CONTAINMENT_PRELUDE + [
  "const target=contain(process.env.LOCUS_PATH);",
  'process.stdout.write(fs.readFileSync(target).toString("base64"));',
].join("");

// Replaces `sed -n '1,320p'`, which follows symlinks and would happily print a
// file outside the workspace that an admitted path pointed at.
export const READ_SLICE_SCRIPT = CONTAINMENT_PRELUDE + [
  "const target=contain(process.env.LOCUS_PATH);",
  "const limit=Number(process.env.LOCUS_MAX_CHARACTERS)||10000;",
  "const source=fs.readFileSync(target,'utf8');",
  "const characters=Array.from(source);",
  "const start=Math.min(characters.length,Math.max(0,Number(process.env.LOCUS_OFFSET)||0));",
  "const end=Math.min(characters.length,start+limit);",
  'process.stdout.write(`characters ${start}-${end} of ${characters.length}\\n`+characters.slice(start,end).join(""));',
].join("");

// R3: `rg` does not follow symlinks while walking a directory, but it does read a
// symlinked path handed to it as an explicit argument — and search passes Slice
// paths explicitly. Verified against ripgrep 14.1.1: a symlink at an admitted
// path printed the contents of a file outside the workspace, while the same
// search as a directory walk found nothing. So search runs through `contain()`
// like every other read rather than shelling out to a tool whose containment
// behaviour depends on how it was invoked.
//
// A refused path is reported on stderr rather than skipped silently: a Slice
// entry that turns out to be a symlink is a fact about the repository the
// reviewer should see.
export const SEARCH_MATCH_LIMIT = 200;
const SEARCH_LINE_WIDTH = 300;
const SEARCH_PATHS_ENV = "LOCUS_PATHS";
const SEARCH_PATH_ENV_ENTRY_BUDGET = 60_000;

export const SEARCH_SCRIPT = CONTAINMENT_PRELUDE + [
  "const term=process.env.LOCUS_QUERY;",
  'if(!term)throw new Error("missing search term");',
  "let paths;",
  'try{paths=JSON.parse(process.env.LOCUS_PATHS||"[]");}catch{throw new Error("malformed search path list");}',
  'if(!Array.isArray(paths))throw new Error("malformed search path list");',
  "const limit=Number(process.env.LOCUS_MATCH_LIMIT)||200;",
  "const width=Number(process.env.LOCUS_LINE_WIDTH)||300;",
  "const out=[];const refused=[];let capped=false;",
  "for(const candidate of paths){",
  "if(capped)break;",
  "let target;",
  "try{target=contain(candidate);}catch(error){refused.push(candidate+\": \"+error.message);continue;}",
  "let raw;",
  // A Slice path can legitimately name a file the Agent has not created yet.
  "try{raw=fs.readFileSync(target);}catch{continue;}",
  // rg skips binary files, and decoding one as utf8 would spray replacement
  // characters through the evidence a human reads.
  "if(raw.includes(0))continue;",
  'const lines=raw.toString("utf8").split("\\n");',
  "for(let i=0;i<lines.length;i++){",
  "if(!lines[i].includes(term))continue;",
  "if(out.length>=limit){capped=true;break;}",
  'out.push(candidate+":"+(i+1)+":"+lines[i].slice(0,width));',
  "}",
  "}",
  'if(out.length)process.stdout.write(out.join("\\n")+"\\n");',
  'if(!out.length&&!refused.length)process.stdout.write("no matches\\n");',
  'if(capped)process.stdout.write("stopped at the "+limit+" match limit\\n");',
  'if(refused.length)process.stderr.write("refused "+refused.length+" path(s) that failed containment:\\n"+refused.join("\\n")+"\\n");',
].join("");

const PREPARE_DEPENDENCIES = [
  "if [ -f pnpm-lock.yaml ]; then",
  "corepack enable >/dev/null 2>&1 && pnpm install --frozen-lockfile --ignore-scripts;",
  "elif [ -f package-lock.json ]; then",
  "npm ci --ignore-scripts;",
  "elif [ -f yarn.lock ]; then",
  "corepack enable >/dev/null 2>&1 && yarn install --immutable --mode=skip-builds;",
  "elif [ -f bun.lock ] || [ -f bun.lockb ]; then",
  "bun install --frozen-lockfile --ignore-scripts;",
  "else echo 'No supported lockfile; dependency install skipped'; fi",
].join(" ");

export const MAX_REVIEW_DIFF_CHARACTERS = 500_000;

export type AgentChange = {
  path: string;
  content: string | null;
};

export type AgentVerification = {
  command: string;
  exitCode: number;
  evidence: string;
};

export class WorkspaceController {
  private readonly checks: AgentVerification[] = [];
  private networkLocked = false;

  constructor(
    private readonly workspace: AgentWorkspace,
    private readonly slice: AgentSlice,
  ) {}

  networkIsLocked(): boolean {
    return this.networkLocked;
  }

  // R2: the boundary between "Locus-controlled setup" and "repository- and
  // model-influenced execution". Dependency bootstrap needs the registry;
  // nothing after this point does, because the model itself runs server-side
  // and only the resulting commands execute in the sandbox.
  //
  // The flag is set only after the platform confirms the change, so a failed
  // lock leaves verification blocked rather than silently permitted.
  async lockNetwork(abortSignal?: AbortSignal): Promise<void> {
    if (this.networkLocked) return;
    await this.workspace.lockNetwork(abortSignal);
    this.networkLocked = true;
  }

  ledger(): AgentSliceLedger {
    return this.slice.ledger();
  }

  listFiles(): AgentSliceLedger {
    return this.slice.ledger();
  }

  verification(): AgentVerification[] {
    return [...this.checks];
  }

  async prepareDependencies(abortSignal?: AbortSignal): Promise<string> {
    const result = await this.workspace.run({
      command: PREPARE_DEPENDENCIES,
      abortSignal,
      timeoutMs: 300_000,
    });
    if (result.exitCode !== 0) throw new Error("Sandbox dependency preparation failed");
    return evidence(result);
  }

  async readFile(input: string, options: {
    offset?: number;
    maxCharacters?: number;
    abortSignal?: AbortSignal;
  } = {}): Promise<string> {
    const path = validateRepoPath(input);
    if (!this.slice.canRead(path)) {
      throw new Error(`${path} is outside the active Slice`);
    }
    const offset = Math.max(0, Math.round(options.offset ?? 0));
    const maxCharacters = Math.min(
      READ_SLICE_CHARACTERS,
      Math.max(1, Math.round(options.maxCharacters ?? READ_SLICE_CHARACTERS)),
    );
    const result = await this.workspace.run({
      command: `node -e ${shellQuote(READ_SLICE_SCRIPT)}`,
      env: {
        LOCUS_PATH: path,
        LOCUS_OFFSET: String(offset),
        LOCUS_MAX_CHARACTERS: String(maxCharacters),
      },
      abortSignal: options.abortSignal,
      timeoutMs: 30_000,
    });
    return evidence(result);
  }

  // R6: the reason travels with the grant rather than being collected and
  // dropped, so it reaches the approval evidence a human actually reads.
  async widenFile(input: string, reason: string, abortSignal?: AbortSignal): Promise<string> {
    const path = this.slice.widen(input, reason);
    return this.readFile(path, { abortSignal });
  }

  async search(query: string, abortSignal?: AbortSignal): Promise<string> {
    const term = query.trim().slice(0, 300);
    if (!term) throw new Error("Search query is required");
    const readable = this.slice.readablePaths();
    if (readable.length === 0) return "No readable files in the active Slice.";

    // One environment entry is bounded by the kernel (MAX_ARG_STRLEN, 128KB on
    // Linux), and a wide Slice can carry more path text than that. Truncating
    // here would quietly shrink what "searched the Slice" means, so the paths
    // that did not fit are counted and reported with the result.
    let pathEnvEntryBytes = Buffer.byteLength(`${SEARCH_PATHS_ENV}=[]`, "utf8") + 1;
    const searched: string[] = [];
    for (const path of readable) {
      const pathBytes = Buffer.byteLength(JSON.stringify(path), "utf8");
      const nextPathEnvEntryBytes = pathEnvEntryBytes + pathBytes + (searched.length === 0 ? 0 : 1);
      if (nextPathEnvEntryBytes > SEARCH_PATH_ENV_ENTRY_BUDGET) break;
      pathEnvEntryBytes = nextPathEnvEntryBytes;
      searched.push(path);
    }

    const result = await this.workspace.run({
      command: `node -e ${shellQuote(SEARCH_SCRIPT)}`,
      env: {
        LOCUS_QUERY: term,
        [SEARCH_PATHS_ENV]: JSON.stringify(searched),
        LOCUS_MATCH_LIMIT: String(SEARCH_MATCH_LIMIT),
        LOCUS_LINE_WIDTH: String(SEARCH_LINE_WIDTH),
      },
      abortSignal,
      timeoutMs: 30_000,
    });

    const dropped = readable.length - searched.length;
    if (dropped === 0) return evidence(result);
    return `${evidence(result)}\n\n${dropped} readable path(s) exceeded the search path budget and were not searched.`;
  }

  async replaceText(
    input: string,
    before: string,
    after: string,
    abortSignal?: AbortSignal,
  ): Promise<string> {
    const path = validateRepoPath(input);
    if (!this.slice.canWrite(path)) {
      throw new Error(`${path} is outside the active Slice`);
    }
    if (!before || before.length > 30_000 || after.length > 30_000) {
      throw new Error("Replacement text must be between 1 and 30,000 characters");
    }
    const result = await this.workspace.run({
      command: `node -e ${shellQuote(REPLACE_SCRIPT)}`,
      env: {
        LOCUS_PATH: path,
        LOCUS_BEFORE: before,
        LOCUS_AFTER: after,
      },
      abortSignal,
      timeoutMs: 30_000,
    });
    return evidence(result);
  }

  async writeFile(input: string, content: string, abortSignal?: AbortSignal): Promise<string> {
    const path = validateRepoPath(input);
    if (!this.slice.canWrite(path)) {
      if (this.slice.ledger().excluded.includes(path)) {
        throw new Error(`${path} already exists outside the Slice; widen it before editing`);
      }
      const absent = await this.workspace.run({
        command: `test ! -e ${shellQuote(path)}`,
        abortSignal,
        timeoutMs: 30_000,
      });
      if (absent.exitCode !== 0) {
        throw new Error(`${path} already exists outside the Slice; widen it before editing`);
      }
      this.slice.create(path);
    }
    if (content.length > 50_000) throw new Error("File content exceeds the 50,000 character limit");
    const result = await this.workspace.run({
      command: `node -e ${shellQuote(WRITE_SCRIPT)}`,
      env: { LOCUS_PATH: path, LOCUS_CONTENT: content },
      abortSignal,
      timeoutMs: 30_000,
    });
    return evidence(result);
  }

  async runCheck(input: string, abortSignal?: AbortSignal): Promise<string> {
    const command = validateAgentCommand(input);
    // R2: `pnpm test` and `pnpm build` are repository-controlled programs.
    // validateAgentCommand above constrains which command runs, never what the
    // command does — the repository supplies the script body. Once a check
    // starts, the sandbox must be assumed fully attacker-controlled, so it
    // must not be able to reach the network to exfiltrate the workspace or
    // fetch a further payload. Fail closed: refuse rather than run with egress.
    if (!this.networkLocked) {
      throw new Error("Verification cannot run before the sandbox network is locked");
    }
    const result = await this.workspace.run({
      command,
      abortSignal,
      timeoutMs: 300_000,
    });
    const output = evidence(result);
    this.checks.push({ command, exitCode: result.exitCode, evidence: output });
    return output;
  }

  private async createDiff(abortSignal?: AbortSignal): Promise<AgentWorkspaceResult> {
    const intent = await this.workspace.run({
      command: "git add --intent-to-add -- .",
      abortSignal,
      timeoutMs: 30_000,
    });
    if (intent.exitCode !== 0) throw new Error("Could not prepare a complete review diff");
    const result = await this.workspace.run({
      command: "git diff --no-ext-diff -- .",
      abortSignal,
      timeoutMs: 30_000,
    });
    if (result.exitCode !== 0) throw new Error("Could not create the review diff");
    return result;
  }

  // Agent-facing only: `show_diff` lets the model see its own work in
  // progress. R1 removed the reviewDiff() counterpart that fed the human
  // approval artifact, because it derived that artifact from the sandbox's
  // mutable Git index — the exact state repository-controlled verification can
  // rewrite. The reviewed diff is now built on the server from the trusted
  // base and the frozen candidate (see lib/agent/candidate.ts). Nothing that
  // reaches a reviewer or a delivery should be derived from this method.
  async diff(abortSignal?: AbortSignal): Promise<string> {
    return evidence(await this.createDiff(abortSignal));
  }

  async changeSet(abortSignal?: AbortSignal): Promise<AgentChange[]> {
    const names = await this.workspace.run({
      command: "git diff --name-status --diff-filter=AMD -- .",
      abortSignal,
      timeoutMs: 30_000,
    });
    if (names.exitCode !== 0) throw new Error("Could not enumerate changed files");

    const changes = names.stdout
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [status, ...pathParts] = line.split("\t");
        return { status, path: validateRepoPath(pathParts.join("\t")) };
      });
    const untracked = await this.workspace.run({
      command: "git ls-files --others --exclude-standard -- .",
      abortSignal,
      timeoutMs: 30_000,
    });
    if (untracked.exitCode !== 0) throw new Error("Could not enumerate new files");
    for (const path of untracked.stdout.split("\n").filter(Boolean)) {
      changes.push({ status: "A", path: validateRepoPath(path) });
    }
    if (changes.length > 30) throw new Error("Agent change set exceeds the 30 file limit");

    let totalCharacters = 0;
    const output: AgentChange[] = [];
    for (const change of changes) {
      if (!this.slice.canWrite(change.path)) {
        throw new Error(`${change.path} changed outside the active Slice`);
      }
      if (change.status === "D") {
        output.push({ path: change.path, content: null });
        continue;
      }

      const result = await this.workspace.run({
        command: `node -e ${shellQuote(READ_BASE64_SCRIPT)}`,
        env: { LOCUS_PATH: change.path },
        abortSignal,
        timeoutMs: 30_000,
      });
      if (result.exitCode !== 0) throw new Error(`Could not capture ${change.path}`);
      const content = Buffer.from(result.stdout.trim(), "base64").toString("utf8");
      totalCharacters += content.length;
      if (content.length > 200_000 || totalCharacters > 1_500_000) {
        throw new Error("Agent change set exceeds the delivery size limit");
      }
      output.push({ path: change.path, content });
    }
    return output;
  }
}
