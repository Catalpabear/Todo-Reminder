declare module 'better-sqlite3' {
  namespace Database {
    interface RunResult {
      changes: number;
      lastInsertRowid: number | bigint;
    }

    interface Statement {
      all(...params: unknown[]): unknown[];
      get(...params: unknown[]): unknown;
      run(...params: unknown[]): RunResult;
    }

    interface Database {
      close(): void;
      exec(source: string): void;
      pragma(source: string): unknown;
      prepare(source: string): Statement;
    }
  }

  interface DatabaseConstructor {
    new (path: string): Database.Database;
    (path: string): Database.Database;
  }

  const Database: DatabaseConstructor;
  export = Database;
}

declare module '*?asset' {
  const path: string;
  export default path;
}
