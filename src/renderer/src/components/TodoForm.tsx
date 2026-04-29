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
  close: () => void;
};

function parseDeadline(input: string): number {
  return new Date(input).getTime();
}

function toLocalDateTimeInputValue(timestamp: number): string {
  const target = new Date(timestamp);
  const shifted = new Date(target.getTime() - target.getTimezoneOffset() * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
}

export default function TodoForm({
  submitLabel,
  initialTitle,
  initialDescription,
  initialDeadline,
  onSubmit,
  onCancelEdit,
  loading,
  close
}: TodoFormProps): JSX.Element {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [deadline, setDeadline] = useState(initialDeadline);
  const [error, setError] = useState<string | null>(null);
  const minDeadline = useMemo(() => toLocalDateTimeInputValue(Date.now() + 1 * 60 * 60 * 1000), []);
  const parsedDeadline = useMemo(() => parseDeadline(deadline), [deadline]);

  useEffect(() => {
    setTitle(initialTitle);
    setDescription(initialDescription);
    setDeadline(minDeadline);
    setError(null);
  }, [initialTitle, initialDescription, initialDeadline]);

  useEffect(() => {
    if (!deadline) {
      setError(null);
      return;
    }

    if (Number.isNaN(parsedDeadline)) {
      setError('请输入有效的截止时间');
      return;
    }

    if (parsedDeadline < Date.now()) {
      setError('计划日期不能早于当前时间');
      return;
    }

    setError(null);
  }, [deadline, parsedDeadline]);

  const isDisabled = useMemo(() => {
    if (loading || !title.trim() || !deadline) {
      return true;
    }

    if (Number.isNaN(parsedDeadline)) {
      return true;
    }

    return parsedDeadline < Date.now();
  }, [loading, title, deadline, parsedDeadline]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const timestamp = parseDeadline(deadline);

    if (Number.isNaN(timestamp)) {
      setError('请输入有效的截止时间');
      return;
    }

    if (timestamp < Date.now()) {
      setError('计划日期不能早于当前时间');
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
    close();
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
          min={minDeadline}
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
