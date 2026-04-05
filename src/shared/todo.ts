export interface Todo {
  id: number;
  title: string;
  description: string;
  deadline: number;
  notified: boolean;
}

export interface TodoInput {
  title: string;
  description: string;
  deadline: number;
}

export interface TodoUpdateInput extends TodoInput {
  id: number;
}

export type WindowMode = 'forever' | 'desktop';
