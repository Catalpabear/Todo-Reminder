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
  return dayjs()
    .hour(Math.floor(minutes / 60))
    .minute(minutes % 60)
    .second(0);
}

function clockValueToMinutes(value: Dayjs | null): number {
  if (!value) {
    return DEFAULT_MINUTES;
  }

  return Math.max(1, value.hour() * 60 + value.minute());
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
    if (!running) {
      setRemainingSeconds(durationMinutes * 60);
    }
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

  const handleReset = (): void => {
    setRunning(false);
    setRemainingSeconds(durationMinutes * 60);
  };

  return (
    <div className="pomodoro-root drag-region">
      <main className="pomodoro-shell">

        <section className="pomodoro-clock-card no-drag">
          <div className="pomodoro-time">{formatRemaining(remainingSeconds)}</div>
          <div className="pomodoro-progress" aria-hidden="true">
            <span style={{ transform: `scaleX(${Math.min(1, Math.max(0, progress))})` }} />
          </div>

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <TimeClock value={clockValue} onChange={handleClockChange} disabled={running} />
          </LocalizationProvider>
        </section>

        <section className="pomodoro-controls no-drag">
          <button type="button" onClick={() => setRunning((current) => !current)}>
            {running ? '暂停' : '开始'}
          </button>
          <button type="button" className="secondary" onClick={handleReset}>
            重置
          </button>
          <button type="button" onClick={() => window.close()}>
            退出
          </button>
        </section>

        <details className="pomodoro-presets no-drag">
          <summary>预设</summary>
          <div className="preset-save-row">
            <input
              type="text"
              value={presetName}
              onChange={(event) => setPresetName(event.target.value)}
              placeholder="名称"
              maxLength={24}
            />
            <button type="button" onClick={handlePresetSave}>
              保存
            </button>
          </div>

          <div className="preset-list">
            {presets.map((preset) => (
              <div className="preset-item" key={preset.id}>
                <button type="button" onClick={() => handlePresetSelect(preset)}>
                  {preset.name} · {preset.minutes} 分钟
                </button>
                <button
                  type="button"
                  className="danger preset-delete"
                  onClick={() => setPresets((current) => current.filter((item) => item.id !== preset.id))}
                >
                  删除
                </button>
              </div>
            ))}
            {presets.length === 0 ? <p className="empty-tip">暂无预设。</p> : null}
          </div>
        </details>
      </main>
    </div>
  );
}
