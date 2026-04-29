import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { TimeClock } from '@mui/x-date-pickers/TimeClock';
import dayjs, { Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';

type PomodoroPreset = {
  id: string;
  name: string;
  minutes: number;
};

const PRESETS_KEY = 'pomodoro-presets';
const DEFAULT_MINUTES = 60;

function readPresets(): PomodoroPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as PomodoroPreset[];
    return parsed.filter((preset) => preset.name && preset.minutes > 0);
  } catch {
    return [];
  }
}

function formatRemaining(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((value) => value.toString().padStart(2, '0')).join(':');
}

function minutesToClockValue(minutes: number): Dayjs {
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return dayjs().hour(hours).minute(restMinutes).second(0);
}

function clockValueToMinutes(value: Dayjs | null): number {
  if (!value) {
    return DEFAULT_MINUTES;
  }

  const nextMinutes = value.hour() * 60 + value.minute();
  return Math.max(1, nextMinutes);
}

export default function PomodoroWindow(): JSX.Element {
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_MINUTES);
  const [remainingSeconds, setRemainingSeconds] = useState(DEFAULT_MINUTES * 60);
  const [running, setRunning] = useState(false);
  const [presets, setPresets] = useState<PomodoroPreset[]>(() => readPresets());
  const [presetName, setPresetName] = useState('');
  const [activePresetName, setActivePresetName] = useState<string | undefined>();

  const clockValue = useMemo(() => minutesToClockValue(durationMinutes), [durationMinutes]);
  const progress = 1 - remainingSeconds / Math.max(1, durationMinutes * 60);

  useEffect(() => {
    if (running) {
      return;
    }

    setRemainingSeconds(durationMinutes * 60);
  }, [durationMinutes, running]);

  useEffect(() => {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  }, [presets]);

  useEffect(() => {
    if (!running) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setRunning(false);
          void window.api.notifyPomodoroDone({
            durationMinutes,
            presetName: activePresetName
          });
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [activePresetName, durationMinutes, running]);

  const handleClockChange = (value: Dayjs | null): void => {
    if (running) {
      return;
    }

    setActivePresetName(undefined);
    setDurationMinutes(clockValueToMinutes(value));
  };

  const handlePresetSave = (): void => {
    const trimmedName = presetName.trim();
    if (!trimmedName) {
      return;
    }

    setPresets((current) => [
      ...current,
      {
        id: `${Date.now()}`,
        name: trimmedName,
        minutes: durationMinutes
      }
    ]);
    setPresetName('');
  };

  const handlePresetSelect = (preset: PomodoroPreset): void => {
    if (running) {
      return;
    }

    setDurationMinutes(preset.minutes);
    setRemainingSeconds(preset.minutes * 60);
    setActivePresetName(preset.name);
  };

  const handlePresetDelete = (id: string): void => {
    setPresets((current) => current.filter((preset) => preset.id !== id));
  };

  const handleReset = (): void => {
    setRunning(false);
    setRemainingSeconds(durationMinutes * 60);
  };

  return (
    <div className="pomodoro-root">
      <main className="pomodoro-shell">
        <header className="pomodoro-header">
          <div>
            <p className="small">Pomodoro Timer</p>
            <h1>番茄钟</h1>
          </div>
          <button type="button" className="danger pomodoro-close" onClick={() => window.close()}>
            关闭
          </button>
        </header>

        <section className="pomodoro-clock-card">
          <div className="pomodoro-time">{formatRemaining(remainingSeconds)}</div>
          <div className="pomodoro-progress" aria-hidden="true">
            <span style={{ transform: `scaleX(${Math.min(1, Math.max(0, progress))})` }} />
          </div>

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <TimeClock value={clockValue} onChange={handleClockChange} disabled={running} />
          </LocalizationProvider>
        </section>

        <section className="pomodoro-controls">
          <button type="button" onClick={() => setRunning((current) => !current)}>
            {running ? '暂停' : '开始'}
          </button>
          <button type="button" className="secondary" onClick={handleReset}>
            重置
          </button>
        </section>

        <section className="pomodoro-presets">
          <div className="preset-save-row">
            <input
              type="text"
              value={presetName}
              onChange={(event) => setPresetName(event.target.value)}
              placeholder="预设名称"
              maxLength={24}
            />
            <button type="button" onClick={handlePresetSave}>
              保存预设
            </button>
          </div>

          <div className="preset-list">
            {presets.map((preset) => (
              <div className="preset-item" key={preset.id}>
                <button type="button" onClick={() => handlePresetSelect(preset)}>
                  {preset.name} · {preset.minutes} 分钟
                </button>
                <button type="button" className="danger preset-delete" onClick={() => handlePresetDelete(preset.id)}>
                  删除
                </button>
              </div>
            ))}
            {presets.length === 0 ? <p className="empty-tip">暂无预设，可先保存当前倒计时。</p> : null}
          </div>
        </section>
      </main>
    </div>
  );
}
