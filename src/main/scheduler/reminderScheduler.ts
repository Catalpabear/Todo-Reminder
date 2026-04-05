import { BrowserWindow, Notification } from 'electron';

import type { Todo } from '../../shared/todo';
import { TodoRepository } from '../database/todoRepository';

const REMINDER_ADVANCE_MS = 5 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 1000;

export class ReminderScheduler {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly repository: TodoRepository,
    private readonly onNotificationClick?: () => void
  ) {}

  start(): void {
    if (this.timer) {
      return;
    }

    this.runTick();
    this.timer = setInterval(() => this.runTick(), CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }

  private runTick(): void {
    // Notify when a task enters the [deadline - 5h, +inf) window.
    const triggerBeforeTimestamp = Date.now() + REMINDER_ADVANCE_MS;
    const dueTodos = this.repository.getTodosDueForReminder(triggerBeforeTimestamp);

    for (const todo of dueTodos) {
      this.sendNotification(todo);
      this.repository.markNotified(todo.id);
    }
  }

  private sendNotification(todo: Todo): void {
    if (!Notification.isSupported()) {
      return;
    }

    const body = `${todo.title}\n截止时间: ${new Date(todo.deadline).toLocaleString()}`;
    const notification = new Notification({
      title: 'TODO 提醒（提前 5 小时）',
      body,
      silent: false
    });

    notification.on('click', () => {
      this.onNotificationClick?.();
      const focusedWindow = BrowserWindow.getAllWindows()[0];
      if (focusedWindow) {
        focusedWindow.show();
        focusedWindow.focus();
      }
    });

    notification.show();
  }
}
