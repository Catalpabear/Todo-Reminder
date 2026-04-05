import Database from 'better-sqlite3';

import type { Todo, TodoInput, TodoUpdateInput } from '../../shared/todo';

type TodoRow = {
  id: number;
  title: string;
  description: string;
  deadline: number;
  notified: number;
};

export class TodoRepository {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        deadline INTEGER NOT NULL,
        notified INTEGER NOT NULL DEFAULT 0
      )
    `);
  }

  private rowToTodo(row: TodoRow): Todo {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      deadline: row.deadline,
      notified: row.notified === 1
    };
  }

  private getTodoById(id: number): Todo | null {
    const stmt = this.db.prepare('SELECT id, title, description, deadline, notified FROM todos WHERE id = ?');
    const row = stmt.get(id) as TodoRow | undefined;
    return row ? this.rowToTodo(row) : null;
  }

  getTodos(): Todo[] {
    const stmt = this.db.prepare('SELECT id, title, description, deadline, notified FROM todos ORDER BY deadline ASC');
    const rows = stmt.all() as TodoRow[];
    return rows.map((row) => this.rowToTodo(row));
  }

  createTodo(input: TodoInput): Todo {
    const stmt = this.db.prepare(
      'INSERT INTO todos (title, description, deadline, notified) VALUES (@title, @description, @deadline, 0)'
    );
    const info = stmt.run({
      title: input.title,
      description: input.description,
      deadline: input.deadline
    });

    const created = this.getTodoById(Number(info.lastInsertRowid));
    if (!created) {
      throw new Error('Failed to load created todo');
    }
    return created;
  }

  updateTodo(input: TodoUpdateInput): Todo | null {
    const existing = this.getTodoById(input.id);
    if (!existing) {
      return null;
    }

    const resetNotified = existing.deadline !== input.deadline;
    const notifiedValue = resetNotified ? 0 : existing.notified ? 1 : 0;

    const stmt = this.db.prepare(
      'UPDATE todos SET title = @title, description = @description, deadline = @deadline, notified = @notified WHERE id = @id'
    );

    stmt.run({
      id: input.id,
      title: input.title,
      description: input.description,
      deadline: input.deadline,
      notified: notifiedValue
    });

    return this.getTodoById(input.id);
  }

  deleteTodo(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM todos WHERE id = ?');
    const info = stmt.run(id);
    return info.changes > 0;
  }

  markNotified(id: number): boolean {
    const stmt = this.db.prepare('UPDATE todos SET notified = 1 WHERE id = ?');
    const info = stmt.run(id);
    return info.changes > 0;
  }

  getTodosDueForReminder(triggerBeforeTimestamp: number): Todo[] {
    const stmt = this.db.prepare(
      'SELECT id, title, description, deadline, notified FROM todos WHERE notified = 0 AND deadline <= ? ORDER BY deadline ASC'
    );
    const rows = stmt.all(triggerBeforeTimestamp) as TodoRow[];
    return rows.map((row) => this.rowToTodo(row));
  }

  close(): void {
    this.db.close();
  }
}
