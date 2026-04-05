import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';

import type { Todo } from '../../../shared/todo';

type TodoFormProps = {
  submitLabel: string;
  initialTitle: string;
  initialDescription: string;
  initialDeadline: string;
  onSubmit: (payload: { title: string; description: string; deadline: number }) => Promise<void>;
  onCancelEdit?: () => void;
  loading?: boolean;
};

function parseDeadline(input: string): number {
  return new Date(input).getTime();
}

export default function TodoForm({
  submitLabel,
  initialTitle,
  initialDescription,
  initialDeadline,
  onSubmit,
  onCancelEdit,
  loading
}: TodoFormProps): JSX.Element {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [deadline, setDeadline] = useState(initialDeadline);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(initialTitle);
    setDescription(initialDescription);
    setDeadline(initialDeadline);
    setError(null);
  }, [initialTitle, initialDescription, initialDeadline]);

  const isDisabled = useMemo(() => loading || !title.trim() || !deadline, [loading, title, deadline]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const timestamp = parseDeadline(deadline);

    if (Number.isNaN(timestamp)) {
      setError('请输入有效的截止时间');
      return;
    }

    setError(null);
    await onSubmit({
      title: title.trim(),
      description: description.trim(),
      deadline: timestamp
    });

    if (!onCancelEdit) {
      setTitle('');
      setDescription('');
      setDeadline('');
    }
  };

  return (
    <form className="todo-form" onSubmit={handleSubmit}>
      <label>
        标题
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="例如：提交周报"
          maxLength={120}
          required
        />
      </label>

      <label>
        描述
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="可选：补充细节"
          rows={3}
        />
      </label>

      <label>
        截止时间
        <input
          type="datetime-local"
          value={deadline}
          onChange={(event) => setDeadline(event.target.value)}
          required
        />
      </label>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="form-actions">
        <button type="submit" disabled={isDisabled}>
          {submitLabel}
        </button>

        {onCancelEdit ? (
          <button type="button" className="secondary" onClick={onCancelEdit}>
            取消编辑
          </button>
        ) : null}
      </div>
    </form>
  );
}

export function mapTodoToInitialForm(todo: Todo): {
  title: string;
  description: string;
  deadline: string;
} {
  const targetDate = new Date(todo.deadline);
  const shifted = new Date(todo.deadline - targetDate.getTimezoneOffset() * 60 * 1000);

  return {
    title: todo.title,
    description: todo.description,
    deadline: shifted.toISOString().slice(0, 16)
  };
}
