import type { Todo } from '../../../shared/todo';

type TodoItemProps = {
  todo: Todo;
  onEdit: (todo: Todo) => void;
  onDelete: (id: number) => Promise<void>;
  onMarkNotified: (id: number) => Promise<void>;
};

export default function TodoItem({ todo, onEdit, onDelete, onMarkNotified }: TodoItemProps): JSX.Element {
  return (
    <article className="todo-card">
      <div className="todo-card-header">
        <h3>{todo.title}</h3>
        <span className={todo.notified ? 'badge badge-ok' : 'badge'}>{todo.notified ? '已提醒' : '未提醒'}</span>
      </div>

      <p className="todo-deadline">截止：{new Date(todo.deadline).toLocaleString()}</p>
      {todo.description ? <p className="todo-description">{todo.description}</p> : null}

      <div className="todo-actions">
        <button type="button" className="secondary" onClick={() => onEdit(todo)}>
          编辑
        </button>
        <button type="button" className="danger" onClick={() => onDelete(todo.id)}>
          删除
        </button>
        {!todo.notified ? (
          <button type="button" className="ghost" onClick={() => onMarkNotified(todo.id)}>
            标记已提醒
          </button>
        ) : null}
      </div>
    </article>
  );
}
