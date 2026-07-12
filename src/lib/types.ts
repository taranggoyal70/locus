// A repository loaded into Locus: a flat map of source path -> file contents,
// plus metadata. This is the shape both bundled demo repos and GitHub-fetched
// repos share, so the localizer never cares where the code came from.
export type RepoData = {
  name: string;
  slug: string;
  description: string;
  root: string; // e.g. "src" — the source root prefix on every path
  recentlyChanged: string[]; // full paths recently touched (cross-cutting signal)
  files: Record<string, string>;
};

export type GraphNode = {
  path: string; // full path
  rel: string; // path relative to root, for display
  dir: string; // top-level dir under root (app | components | hooks | lib | ...)
  tokens: number;
  isSurface: boolean; // a user-facing route/page entry
  route?: string;
};

export type GraphEdge = { from: string; to: string };

export type Graph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  byPath: Record<string, GraphNode>;
  deps: Record<string, string[]>;
  rdeps: Record<string, string[]>;
  surfaces: { route: string; path: string }[];
  totalTokens: number;
};

export type SliceFile = {
  path: string;
  rel: string;
  dist: number; // dependency distance from the anchor
  tokens: number;
  recent: boolean;
};

export type LocateResult = {
  task: string;
  widened: boolean;
  reason: string;
  anchors: string[]; // rel paths of the entry points
  slice: SliceFile[]; // ranked, most-relevant first
  excluded: string[]; // rel paths not loaded
  sliceTokens: number;
  totalTokens: number;
  savedPct: number;
};
