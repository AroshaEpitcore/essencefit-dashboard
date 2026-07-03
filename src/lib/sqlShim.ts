/*
 * PostgreSQL compatibility shim.
 *
 * Preserves the `mssql` API surface the data layer was written against —
 * `sql.<Type>` markers, `.request().input(name, type, value).query(text)`
 * returning `{ recordset }`, and `new sql.Transaction(pool)` /
 * `new sql.Request(tx)` — so the existing queries run on PostgreSQL (Supabase)
 * with only their SQL *bodies* translated (done in later phases), not their
 * call-site plumbing. Backed by `pg`.
 */
import { Pool, types, type PoolClient, type QueryResultRow } from "pg";
import { COLUMN_CASE } from "@/lib/columnCase";

// node-postgres returns NUMERIC/DECIMAL (OID 1700) and BIGINT (OID 20) as
// STRINGS to avoid precision loss. This app treats prices and quantities as JS
// numbers everywhere (its types declare `number`), and string values silently
// break numeric comparisons — e.g. "1299" > "990" is false (compared as text),
// which hid every sale/deal (no Sale tag, no PDP cut price, empty "Deals only").
// Parse them to numbers at the source so every comparison behaves numerically.
types.setTypeParser(1700, (v) => (v == null ? null : parseFloat(v))); // numeric / decimal / money
types.setTypeParser(20, (v) => (v == null ? null : parseInt(v, 10))); // bigint (SUM/COUNT results)

// PostgreSQL folds unquoted identifiers to lowercase, so pg returns lowercase
// row keys. The app reads PascalCase (row.PaymentStatus); remap each row's keys
// back via the generated lowercase->Pascal dictionary (unknown keys pass through).
function remapKeys(row: QueryResultRow): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k in row) out[COLUMN_CASE[k] ?? k] = row[k];
  return out;
}

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Supabase requires TLS; its pooler cert isn't in the local trust store.
      ssl: { rejectUnauthorized: false },
      max: Number(process.env.DB_POOL_MAX ?? 5),
    });
  }
  return pool;
}

type Exec = (
  text: string,
  values: unknown[]
) => Promise<{ rows: QueryResultRow[]; rowCount: number | null }>;

/*
 * Builds an mssql-style request: collects @named params via .input(), then on
 * .query() rewrites @name -> $n (only for params actually referenced, so unused
 * .input()s are ignored like mssql does) and runs the SQL through `exec`.
 */
export function makeRequest(exec: Exec) {
  const params: Record<string, unknown> = {};
  const types: Record<string, string | undefined> = {};
  const api = {
    // Supports both mssql overloads: .input(name, type, value) and .input(name, value).
    // When a type marker is given, we remember its PostgreSQL type so each @param
    // can be cast ($n::type) — pg can't infer types for params used in contexts
    // like `@x IS NULL` once the mssql type hints are dropped.
    input(name: string, ...rest: unknown[]) {
      if (rest.length >= 2) {
        params[name] = rest[1];
        types[name] = (rest[0] as { __pg?: string } | undefined)?.__pg;
      } else {
        params[name] = rest[0];
      }
      return api;
    },
    async _exec(text: string) {
      const values: unknown[] = [];
      const pos: Record<string, number> = {};
      const sqlText = text.replace(/@(\w+)/g, (_m, n: string) => {
        if (!(n in pos)) {
          if (!(n in params)) throw new Error(`sql-shim: missing parameter @${n}`);
          values.push(params[n]);
          pos[n] = values.length;
        }
        const t = types[n];
        return `$${pos[n]}` + (t ? `::${t}` : "");
      });
      return exec(sqlText, values);
    },
    async query(text: string) {
      const res = await api._exec(text);
      // Remap lowercase pg keys -> PascalCase; keep recordset loosely typed
      // (any[]) as mssql's was, so existing call-sites type-check unchanged.
      return { recordset: res.rows.map(remapKeys) as any[], rowsAffected: [res.rowCount ?? res.rows.length] };
    },
    // Like .query() but skips the PascalCase remap. For ad-hoc SELECT ... AS
    // aliases (e.g. chart-shaped rows like `AS sales`, `AS date`, `AS name`)
    // that intentionally use lowercase keys matching frontend expectations —
    // remapKeys() would otherwise rewrite them to a same-named real DB column's
    // PascalCase form (e.g. "sales"->"Sales", "date"->"DATE", "name"->"Name"),
    // silently breaking any consumer expecting the lowercase alias.
    async queryRaw(text: string) {
      const res = await api._exec(text);
      return { recordset: res.rows as any[], rowsAffected: [res.rowCount ?? res.rows.length] };
    },
    batch(text: string) {
      return api.query(text);
    },
  };
  return api;
}

/*
 * `new sql.Transaction(pool)` + `tx.begin()/commit()/rollback()`. Backed by a
 * dedicated pg client so BEGIN/COMMIT run on one connection. The constructor
 * arg (the pool-like object) is accepted for API compatibility but unused — the
 * shim owns the pool.
 */
export class Transaction {
  client: PoolClient | null = null;
  constructor(_pool?: unknown) {}
  async begin() {
    this.client = await getPool().connect();
    await this.client.query("BEGIN");
  }
  async commit() {
    if (!this.client) return;
    try {
      await this.client.query("COMMIT");
    } finally {
      this.client.release();
      this.client = null;
    }
  }
  async rollback() {
    if (!this.client) return;
    try {
      await this.client.query("ROLLBACK");
    } finally {
      this.client.release();
      this.client = null;
    }
  }
}

/*
 * `new sql.Request(txOrPool)` — an mssql-style request bound to the
 * transaction's client when given a Transaction, otherwise to the pool. The
 * constructor returns the request builder object directly.
 */
export class Request {
  constructor(src?: unknown) {
    if (src instanceof Transaction && src.client) {
      const client = src.client;
      return makeRequest((t, v) => client.query(t, v)) as unknown as Request;
    }
    return makeRequest((t, v) => getPool().query(t, v)) as unknown as Request;
  }
}

// Type markers. Each is callable (e.g. sql.NVarChar(100)) and usable directly
// (e.g. sql.UniqueIdentifier); calling returns the same marker. `__pg` carries
// the PostgreSQL type so the request builder can cast params ($n::type).
function mk(pg?: string): any {
  const f: any = (..._args: unknown[]) => f;
  f.__pg = pg;
  return f;
}
export const NVarChar = mk("text");
export const NChar = mk("text");
export const VarChar = mk("text");
export const Char = mk("text");
export const Text = mk("text");
export const NText = mk("text");
export const Int = mk("int");
export const BigInt = mk("bigint");
export const SmallInt = mk("int");
export const TinyInt = mk("int");
export const Bit = mk("boolean");
export const Decimal = mk("numeric");
export const Numeric = mk("numeric");
export const Float = mk("double precision");
export const Real = mk("double precision");
export const Money = mk("numeric");
export const DateTime = mk("timestamp");
export const DateTime2 = mk("timestamp");
export const Date = mk("date");
export const Time = mk("time");
export const UniqueIdentifier = mk("uuid");
export const MAX = mk(); // used only as an argument to NVarChar(sql.MAX)

const sql: any = {
  NVarChar, NChar, VarChar, Char, Text, NText, Int, BigInt, SmallInt, TinyInt,
  Bit, Decimal, Numeric, Float, Real, Money, DateTime, DateTime2, Date, Time,
  UniqueIdentifier, MAX, Transaction, Request,
};

export default sql;
