import * as React from 'react';
import {
  Box,
  Button,
  DatePicker,
  Field,
  Flex,
  SingleSelect,
  SingleSelectOption,
  Typography,
} from '@strapi/design-system';
import { useFetchClient, useNotification } from '@strapi/strapi/admin';
import { PLUGIN_ID } from '../pluginId';

type Action = 'publish' | 'unpublish';

type ScheduledAction = {
  id: number;
  action: Action;
  executeAt: string;
  status: 'pending' | 'processing' | 'done' | 'failed' | 'skipped';
  executedAt: string | null;
  error: string | null;
};

type Target = { contentType: string; documentId: string; locale?: string };

const LABELS: Record<Action, string> = { publish: 'Publish at', unpublish: 'Unpublish at' };
const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

const TIME_STEP_MINUTES = 15;
const TIME_FORMAT: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };

const formatDate = (value: string) =>
  new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short', hour12: true });

const pad = (n: number) => String(n).padStart(2, '0');
const toTimeValue = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
const formatTime = (hours: number, minutes: number) =>
  new Date(2000, 0, 1, hours, minutes).toLocaleTimeString([], TIME_FORMAT);

// The design system's TimePicker/DateTimePicker hard-code 24-hour labels, so the
// time is a plain select: values stay "HH:mm", labels read "1:30 PM".
const TIME_OPTIONS = Array.from({ length: (24 * 60) / TIME_STEP_MINUTES }, (_, i) => {
  const hours = Math.floor((i * TIME_STEP_MINUTES) / 60);
  const minutes = (i * TIME_STEP_MINUTES) % 60;
  return { value: `${pad(hours)}:${pad(minutes)}`, label: formatTime(hours, minutes) };
});

const timeOptionsFor = (date: Date | null) => {
  // Keep an off-step saved time (e.g. imported from the old plugin) selectable.
  if (!date || TIME_OPTIONS.some((o) => o.value === toTimeValue(date))) return TIME_OPTIONS;
  const extra = { value: toTimeValue(date), label: formatTime(date.getHours(), date.getMinutes()) };
  return [...TIME_OPTIONS, extra].sort((a, b) => a.value.localeCompare(b.value));
};

// DatePicker displays the UTC calendar day of its value and emits local midnight,
// so hand it the local day expressed in UTC.
const toPickerDay = (date: Date) => new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

const ScheduleInput = ({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
}) => {
  const setDay = (day: Date | undefined) => {
    if (!day) return onChange(null);
    onChange(
      new Date(day.getFullYear(), day.getMonth(), day.getDate(), value?.getHours() ?? 0, value?.getMinutes() ?? 0)
    );
  };

  const setTime = (time: string | number) => {
    const [hours, minutes] = String(time).split(':').map(Number);
    const base = value ?? new Date();
    onChange(new Date(base.getFullYear(), base.getMonth(), base.getDate(), hours, minutes));
  };

  return (
    <Field.Root name={name}>
      <Field.Label>{label}</Field.Label>
      <Flex gap={1} wrap="wrap">
        <Box flex="1">
          <DatePicker
            value={value ? toPickerDay(value) : undefined}
            minDate={toPickerDay(new Date())}
            onChange={setDay}
            onClear={() => onChange(null)}
            clearLabel="Clear date"
            aria-label="Choose date"
          />
        </Box>
        <Box flex="1">
          <SingleSelect
            value={value ? toTimeValue(value) : undefined}
            onChange={setTime}
            placeholder="Time"
            aria-label="Choose time"
          >
            {timeOptionsFor(value).map((o) => (
              <SingleSelectOption key={o.value} value={o.value}>
                {o.label}
              </SingleSelectOption>
            ))}
          </SingleSelect>
        </Box>
      </Flex>
    </Field.Root>
  );
};

const pendingDates = (actions: ScheduledAction[]) => {
  const dates: Record<Action, Date | null> = { publish: null, unpublish: null };
  for (const a of actions) {
    if (a.status === 'pending') dates[a.action] = new Date(a.executeAt);
  }
  return dates;
};

const ScheduleForm = ({ target }: { target: Target }) => {
  const { get, put } = useFetchClient();
  const { toggleNotification } = useNotification();
  const [actions, setActions] = React.useState<ScheduledAction[]>([]);
  const [dates, setDates] = React.useState<Record<Action, Date | null>>({ publish: null, unpublish: null });
  const [saving, setSaving] = React.useState(false);

  const applyActions = (data: ScheduledAction[]) => {
    setActions(data);
    setDates(pendingDates(data));
  };

  React.useEffect(() => {
    get<{ data: ScheduledAction[] }>(`/${PLUGIN_ID}/actions`, { params: target })
      .then(({ data }) => applyActions(data.data))
      .catch(() => applyActions([]));
  }, [target.contentType, target.documentId, target.locale]);

  const saved = pendingDates(actions);
  const dirty = (['publish', 'unpublish'] as Action[]).some(
    (a) => (dates[a]?.getTime() ?? null) !== (saved[a]?.getTime() ?? null)
  );

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await put<{ data: ScheduledAction[] }>(`/${PLUGIN_ID}/actions`, {
        ...target,
        publishAt: dates.publish?.toISOString() ?? null,
        unpublishAt: dates.unpublish?.toISOString() ?? null,
      });
      applyActions(data.data);
      toggleNotification({ type: 'success', message: 'Schedule saved' });
    } catch (error: any) {
      toggleNotification({
        type: 'danger',
        message: error?.response?.data?.error?.message ?? 'Could not save schedule',
      });
    } finally {
      setSaving(false);
    }
  };

  const lastProblem = actions.find((a) => a.status === 'failed');

  return (
    <Flex direction="column" alignItems="stretch" gap={3} width="100%">
      {(['publish', 'unpublish'] as Action[]).map((action) => (
        <ScheduleInput
          key={action}
          name={`scheduler-${action}`}
          label={LABELS[action]}
          value={dates[action]}
          onChange={(date) => setDates((prev) => ({ ...prev, [action]: date }))}
        />
      ))}
      <Typography variant="pi" textColor="neutral600">
        Times are in {TIMEZONE}. Checked about once a minute.
      </Typography>
      {lastProblem && (
        <Box background="danger100" padding={2} hasRadius>
          <Typography variant="pi" textColor="danger700">
            Scheduled {lastProblem.action} for {formatDate(lastProblem.executeAt)} failed: {lastProblem.error}
          </Typography>
        </Box>
      )}
      <Button fullWidth variant="secondary" onClick={save} loading={saving} disabled={!dirty}>
        Save schedule
      </Button>
    </Flex>
  );
};

export const SchedulePanel = ({ activeTab, model, documentId, document }: any) => {
  // activeTab is null when the content type has no draft & publish;
  // documentId is missing while creating a new entry.
  if (activeTab === null || !documentId) return null;

  return {
    title: 'Schedule',
    content: <ScheduleForm target={{ contentType: model, documentId, locale: document?.locale ?? undefined }} />,
  };
};
