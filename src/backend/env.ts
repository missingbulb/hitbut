// The platform surface this Worker actually uses, declared here rather than pulled in as
// a dependency: the published Workers types collide with the DOM lib the site needs, and
// what we touch is a handful of methods. Anything added here should be added because a
// call site needs it.

export type D1Result<Row> = { results: Row[]; success: boolean };

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<Row = Record<string, unknown>>(): Promise<Row | null>;
  all<Row = Record<string, unknown>>(): Promise<D1Result<Row>>;
  run(): Promise<{ success: boolean }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<Row = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<Row>[]>;
  exec(query: string): Promise<unknown>;
}

export interface R2Object {
  text(): Promise<string>;
}

export interface R2Bucket {
  put(key: string, value: string | ArrayBuffer): Promise<unknown>;
  get(key: string): Promise<R2Object | null>;
  head(key: string): Promise<unknown | null>;
}

export type Env = {
  CORPUS: D1Database;
  RAW: R2Bucket;
  SURFACING_THRESHOLD: string;
  /**
   * The operator dashboard's credential, set as a Worker secret. Optional on the type
   * because a Worker deployed without it is a real state: the operations route answers
   * "unconfigured" then, rather than answering openly.
   */
  DASHBOARD_TOKEN?: string;
};
