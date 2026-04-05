import { BrowserWindow, screen } from 'electron';

import type { WindowMode } from '../../shared/todo';

const FOREVER_BLUR_OPACITY = 0.3;
const DESKTOP_BLUR_OPACITY = 0.2;
const FOCUS_OPACITY = 1;
const WINDOW_MARGIN = 24;
const DEFAULT_WINDOW_WIDTH = 380;
const DEFAULT_WINDOW_HEIGHT = 620;
const MIN_WINDOW_WIDTH_FLOOR = 120;
const MIN_WINDOW_HEIGHT_FLOOR = 100;

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private mode: WindowMode = 'forever';
  private clickThroughEnabled = false;
  private opacityTimer: NodeJS.Timeout | null = null;

  constructor(private readonly preloadPath: string, private readonly iconPath: string) {}

  createWindow(): BrowserWindow {
    const { width, height, minWidth, minHeight } = this.resolveWindowSize();
    const { x, y } = this.getDefaultPosition(width);

    this.mainWindow = new BrowserWindow({
      width,
      height,
      minWidth,
      minHeight,
      x,
      y,
      show: false,
      frame: false,
      transparent: true,
      hasShadow: true,
      autoHideMenuBar: true,
      resizable: true,
      alwaysOnTop: true,
      ...(process.platform === 'linux' ? { icon: this.iconPath } : {}),
      webPreferences: {
        preload: this.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    });

    this.mainWindow.on('ready-to-show', () => {
      this.mainWindow?.show();
      this.animateOpacity(this.mainWindow?.isFocused() ? FOCUS_OPACITY : FOREVER_BLUR_OPACITY);
    });

    this.mainWindow.on('focus', () => {
      this.animateOpacity(FOCUS_OPACITY);
    });

    this.mainWindow.on('blur', () => {
      if (!this.mainWindow) {
        return;
      }

      if (this.mode === 'forever') {
        this.animateOpacity(FOREVER_BLUR_OPACITY);
        return;
      }

      this.animateOpacity(DESKTOP_BLUR_OPACITY);
      // Desktop mode simulation: hide from normal workflow when user switches apps.
      setTimeout(() => {
        if (!this.mainWindow || this.mainWindow.isDestroyed()) {
          return;
        }

        if (this.mode === 'desktop' && !this.mainWindow.isFocused()) {
          this.mainWindow.minimize();
        }
      }, 180);
    });

    return this.mainWindow;
  }

  getWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  showAndFocus(): void {
    if (!this.mainWindow) {
      return;
    }

    if (this.mainWindow.isMinimized()) {
      this.mainWindow.restore();
    }

    this.mainWindow.show();
    this.mainWindow.focus();
  }

  minimize(): void {
    this.mainWindow?.minimize();
  }

  close(): void {
    this.mainWindow?.close();
  }

  setMode(mode: WindowMode): WindowMode {
    this.mode = mode;

    if (!this.mainWindow) {
      return this.mode;
    }

    if (mode === 'forever') {
      this.mainWindow.setAlwaysOnTop(true, 'screen-saver');
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore();
      }
      this.mainWindow.show();
      this.animateOpacity(this.mainWindow.isFocused() ? FOCUS_OPACITY : FOREVER_BLUR_OPACITY);
    } else {
      this.mainWindow.setAlwaysOnTop(false);
      this.mainWindow.show();
      this.animateOpacity(this.mainWindow.isFocused() ? FOCUS_OPACITY : DESKTOP_BLUR_OPACITY);
    }

    this.mainWindow.webContents.send('windowModeChanged', this.mode);
    return this.mode;
  }

  getMode(): WindowMode {
    return this.mode;
  }

  setClickThrough(enabled: boolean): boolean {
    this.clickThroughEnabled = enabled;
    this.mainWindow?.setIgnoreMouseEvents(enabled, { forward: enabled });
    this.mainWindow?.webContents.send('clickThroughChanged', this.clickThroughEnabled);
    return this.clickThroughEnabled;
  }

  getClickThrough(): boolean {
    return this.clickThroughEnabled;
  }

  private resolveWindowSize(): { width: number; height: number; minWidth: number; minHeight: number } {
    const bounds = screen.getPrimaryDisplay().workArea;
    const minWidth = Math.max(MIN_WINDOW_WIDTH_FLOOR, Math.floor(bounds.width / 5));
    const minHeight = Math.max(MIN_WINDOW_HEIGHT_FLOOR, Math.floor(bounds.height / 5));
    const maxWidth = Math.max(minWidth, bounds.width - WINDOW_MARGIN * 2);
    const maxHeight = Math.max(minHeight, bounds.height - WINDOW_MARGIN * 2);

    return {
      width: Math.min(DEFAULT_WINDOW_WIDTH, maxWidth),
      height: Math.min(DEFAULT_WINDOW_HEIGHT, maxHeight),
      minWidth,
      minHeight
    };
  }

  private getDefaultPosition(width: number): { x: number; y: number } {
    const bounds = screen.getPrimaryDisplay().workArea;
    const x = bounds.x + bounds.width - width - WINDOW_MARGIN;
    const y = bounds.y + WINDOW_MARGIN;

    return { x, y };
  }

  private animateOpacity(target: number): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return;
    }

    const start = this.mainWindow.getOpacity();
    const totalSteps = 10;
    const durationMs = 180;

    if (Math.abs(start - target) < 0.01) {
      this.mainWindow.setOpacity(target);
      return;
    }

    if (this.opacityTimer) {
      clearInterval(this.opacityTimer);
      this.opacityTimer = null;
    }

    let step = 0;
    // Small stepped animation keeps transitions smooth for frameless transparent windows.
    this.opacityTimer = setInterval(() => {
      if (!this.mainWindow || this.mainWindow.isDestroyed()) {
        if (this.opacityTimer) {
          clearInterval(this.opacityTimer);
          this.opacityTimer = null;
        }
        return;
      }

      step += 1;
      const progress = step / totalSteps;
      const nextOpacity = start + (target - start) * progress;
      this.mainWindow.setOpacity(nextOpacity);

      if (step >= totalSteps) {
        this.mainWindow.setOpacity(target);
        if (this.opacityTimer) {
          clearInterval(this.opacityTimer);
          this.opacityTimer = null;
        }
      }
    }, Math.floor(durationMs / totalSteps));
  }
}
