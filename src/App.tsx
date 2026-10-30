import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  addDays,
  applyTasks,
  COLORS,
  COLOR_NAMES,
  createData,
  dateRange,
  emptyDay,
  exportBackup,
  futureDates,
  getPeriod,
  money,
  newTask,
  parseMoney,
  parseTasks,
  periodDates,
  periodIndex,
  progress,
  spending,
  todayKey,
  updateDay,
  validDate,
  validateBackup,
  type AppData,
  type Day,
  type Period,
  type Task,
} from "./data";
import { changeData, loadData } from "./storage";
import CalendarView from "./CalendarView";
import { validMonth } from "./calendar";

type IconName =
  | "left"
  | "right"
  | "edit"
  | "plus"
  | "check"
  | "close"
  | "copy"
  | "paste"
  | "settings"
  | "download"
  | "upload"
  | "calendar"
  | "trash";
function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    left: <path d="m14 6-6 6 6 6" />,
    right: <path d="m10 6 6 6-6 6" />,
    edit: (
      <>
        <path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    copy: (
      <>
        <rect x="8" y="8" width="12" height="13" rx="2" />
        <path d="M15 8V3H3v13h5" />
      </>
    ),
    paste: (
      <>
        <path d="M8 5H5v16h14V5h-3" />
        <rect x="8" y="3" width="8" height="4" rx="1" />
        <path d="M8 12h8M8 16h5" />
      </>
    ),
    settings: (
      <>
        <path d="M4 7h16M4 17h16" />
        <circle cx="9" cy="7" r="2" />
        <circle cx="15" cy="17" r="2" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4m10-4v4M3 11h18" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />
      </>
    ),
  };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
const shortDate = (date: string) =>
  `${Number(date.slice(5, 7))}月${Number(date.slice(8))}日`;
const fullDate = (date: string) => `${date.slice(0, 4)}年${shortDate(date)}`;
const weekday = (date: string) =>
  `周${"日一二三四五六"[new Date(`${date}T12:00:00`).getDay()]}`;
const rangeLabel = (dates: string[]) =>
  `${fullDate(dates[0])} — ${fullDate(dates[dates.length - 1])}`;
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "操作失败，请重试。";
type Commit = (change: (data: AppData | null) => AppData) => Promise<boolean>;

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-label={title}
    >
      <div className="sheet">
        <div className="sheet-head">
          <h2>{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="关闭"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
function ProgressBar({ tasks }: { tasks: Task[] }) {
  const p = progress(tasks);
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label="任务完成进度"
      aria-valuenow={p.percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${p.percent}%` }} />
    </div>
  );
}
function PeriodForm({
  initial,
  anchor,
  onSave,
  busy,
}: {
  initial: Period;
  anchor?: string;
  onSave: (name: string, color: string, start: string) => void;
  busy: boolean;
}) {
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState(initial.color);
  const [start, setStart] = useState(anchor ?? todayKey());
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(name, color, start);
      }}
      className="stack"
    >
      <label>
        阶段名称
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          required
        />
      </label>
      {anchor !== undefined && (
        <label>
          第一个周期的起始日期
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            required
            min="1900-01-01"
            max="9998-12-31"
          />
          <span className="hint">
            之后每 7 天自动衔接，过去和未来都可以编辑。
          </span>
        </label>
      )}
      <fieldset>
        <legend>阶段颜色</legend>
        <div className="color-options">
          {COLORS.map((value, i) => (
            <button
              key={value}
              type="button"
              className={`color-option ${value === color ? "chosen" : ""}`}
              style={{ "--swatch": value } as CSSProperties}
              aria-label={COLOR_NAMES[i]}
              aria-pressed={value === color}
              onClick={() => setColor(value)}
            >
              {value === color && <Icon name="check" />}
            </button>
          ))}
        </div>
      </fieldset>
      <button className="primary wide" disabled={busy}>
        {anchor !== undefined ? "开始我的第一个 7 天" : "保存阶段"}
      </button>
    </form>
  );
}

function BatchModal({
  kind,
  source,
  data,
  commit,
  close,
  notify,
}: {
  kind: "copy" | "paste";
  source: string;
  data: AppData;
  commit: Commit;
  close: () => void;
  notify: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [target, setTarget] = useState(kind === "copy" ? "future" : "day");
  const [count, setCount] = useState("3");
  const [start, setStart] = useState(addDays(source, 1));
  const [end, setEnd] = useState(addDays(source, 7));
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<{ dates: string[]; texts: string[] } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const texts =
    kind === "paste"
      ? parseTasks(text)
      : (data.days[source]?.tasks ?? []).map((task) => task.text);
  function preview(e: FormEvent) {
    e.preventDefault();
    try {
      if (!texts.length) throw new Error("请先添加至少一条任务。");
      const dates =
        target === "day"
          ? [source]
          : target === "today"
            ? [todayKey()]
            : target === "future"
              ? futureDates(source, Number(count))
              : dateRange(start, end);
      setPlan({ dates, texts });
      setError("");
    } catch (error) {
      setError(errorText(error));
    }
  }
  async function execute() {
    if (!plan) return;
    setBusy(true);
    const ok = await commit((current) =>
      applyTasks(current!, plan.dates, plan.texts, mode),
    );
    setBusy(false);
    if (ok) {
      notify(
        `已将 ${plan.texts.length} 条任务${mode === "replace" ? "覆盖" : "追加"}到 ${plan.dates.length} 天`,
      );
      close();
    }
  }
  return (
    <Modal
      title={
        plan ? "确认应用任务" : kind === "paste" ? "粘贴任务" : "复制到其他日期"
      }
      onClose={close}
    >
      {plan ? (
        <div className="stack">
          <div className="confirm-box">
            <span className="eyebrow">
              {mode === "replace" ? "覆盖原有任务" : "保留原有任务并追加"}
            </span>
            <h3>
              {plan.texts.length} 条任务 → {plan.dates.length} 天
            </h3>
            <p>{rangeLabel(plan.dates)}</p>
          </div>
          <p className="muted">
            {mode === "replace"
              ? "所选日期原有任务及完成状态将被替换。"
              : "所选日期原有任务及完成状态会保留。"}
            新增任务均为未完成，消费金额保持不变。
          </p>
          {kind === "copy" && plan.dates.includes(source) && (
            <p className="notice">
              范围包含来源日期，该日任务也会按所选模式更新。
            </p>
          )}
          <div className="button-row">
            <button onClick={() => setPlan(null)} disabled={busy}>
              返回修改
            </button>
            <button className="primary" onClick={execute} disabled={busy}>
              {busy
                ? "正在保存…"
                : `确认${mode === "replace" ? "覆盖" : "追加"}`}
            </button>
          </div>
        </div>
      ) : (
        <form className="stack" onSubmit={preview}>
          {kind === "paste" && (
            <label>
              把豆包或其他地方的任务粘贴在这里
              <textarea
                autoFocus
                rows={5}
                placeholder={"一行一条任务\n空行会自动忽略"}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </label>
          )}
          <div className="preview-tasks">
            <span className="hint">
              {kind === "paste" ? "已解析" : `${shortDate(source)}的任务`} ·{" "}
              {texts.length} 条
            </span>
            {texts.length > 0 && (
              <ol>
                {texts.map((value, index) => (
                  <li key={index}>{value}</li>
                ))}
              </ol>
            )}
          </div>
          <label>
            应用到
            <select
              aria-label="应用到"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              {kind === "paste" && (
                <option value="day">
                  {source === todayKey()
                    ? "今天"
                    : `当前日期 · ${shortDate(source)}`}
                </option>
              )}
              {kind === "paste" && source !== todayKey() && (
                <option value="today">今天</option>
              )}
              <option value="future">{shortDate(source)}之后的 N 天</option>
              <option value="range">指定日期范围</option>
            </select>
          </label>
          {target === "future" && (
            <label>
              未来多少天
              <div className="number-row">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  required
                  aria-label="未来天数"
                />
                <span>天</span>
              </div>
              <div className="quick-options">
                {[3, 5, 7].map((n) => (
                  <button
                    type="button"
                    key={n}
                    aria-pressed={count === String(n)}
                    onClick={() => setCount(String(n))}
                  >
                    {n} 天
                  </button>
                ))}
              </div>
              <span className="hint">
                从 {shortDate(addDays(source, 1))} 开始，不包含{" "}
                {shortDate(source)}。
              </span>
            </label>
          )}
          {target === "range" && (
            <div className="date-fields">
              <label>
                开始日期
                <input
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  required
                />
              </label>
              <label>
                结束日期
                <input
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  required
                />
              </label>
            </div>
          )}
          <fieldset>
            <legend>应用方式</legend>
            <div className="mode-options">
              <label className={mode === "append" ? "selected" : ""}>
                <input
                  type="radio"
                  name="mode"
                  value="append"
                  checked={mode === "append"}
                  onChange={() => setMode("append")}
                />
                <span>
                  追加<small>保留原有任务</small>
                </span>
              </label>
              <label className={mode === "replace" ? "selected" : ""}>
                <input
                  type="radio"
                  name="mode"
                  value="replace"
                  checked={mode === "replace"}
                  onChange={() => setMode("replace")}
                />
                <span>
                  覆盖<small>替换原有任务</small>
                </span>
              </label>
            </div>
          </fieldset>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary wide" disabled={!texts.length}>
            下一步 · 确认应用
          </button>
        </form>
      )}
    </Modal>
  );
}

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
function Settings({
  data,
  commit,
  close,
  notify,
  install,
  requestInstall,
  offline,
  updated,
  updateApp,
}: {
  data: AppData;
  commit: Commit;
  close: () => void;
  notify: (message: string) => void;
  install: InstallPrompt | null;
  requestInstall: () => Promise<void>;
  offline: boolean;
  updated: boolean;
  updateApp: () => void;
}) {
  const [backup, setBackup] = useState<AppData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  function download() {
    const url = URL.createObjectURL(
      new Blob([exportBackup(data)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `七日备份-${todayKey()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    notify("备份已导出，请保管好 JSON 文件");
  }
  async function readFile(file?: File) {
    if (!file) return;
    setError("");
    try {
      if (file.size > 25 * 1024 * 1024)
        throw new Error("文件过大，请选择小于 25 MB 的 JSON 备份。");
      setBackup(validateBackup(JSON.parse(await file.text())));
    } catch (error) {
      setError(errorText(error));
    }
    if (input.current) input.current.value = "";
  }
  async function restore() {
    setBusy(true);
    const ok = await commit(() => backup!);
    setBusy(false);
    if (ok) {
      notify("备份已恢复");
      close();
    }
  }
  return (
    <Modal title={backup ? "确认恢复备份" : "数据与安装"} onClose={close}>
      {backup ? (
        <div className="stack">
          <div className="confirm-box">
            <h3>{Object.keys(backup.days).length} 天的记录</h3>
            <p>
              {Object.values(backup.days).reduce(
                (sum, day) => sum + day.tasks.length,
                0,
              )}{" "}
              条任务 · {Object.keys(backup.periods).length} 个已记录阶段
            </p>
            <p>周期起点：{fullDate(backup.anchor)}</p>
          </div>
          <p>恢复会替换当前设备上的全部记录。建议先导出当前备份。</p>
          <button onClick={download}>
            <Icon name="download" />
            导出当前备份
          </button>
          <div className="button-row">
            <button onClick={() => setBackup(null)}>取消</button>
            <button className="primary" disabled={busy} onClick={restore}>
              {busy ? "正在恢复…" : "确认替换并恢复"}
            </button>
          </div>
        </div>
      ) : (
        <div className="stack">
          <div>
            <h3>记录留在你的设备上</h3>
            <p className="muted">
              任务、消费和阶段信息自动保存在当前浏览器。换手机或清除网站数据前，请导出备份。
            </p>
          </div>
          <div className="button-row">
            <button onClick={download}>
              <Icon name="download" />
              导出备份
            </button>
            <button onClick={() => input.current?.click()}>
              <Icon name="upload" />
              导入备份
            </button>
          </div>
          <input
            className="hidden"
            ref={input}
            type="file"
            accept=".json,application/json"
            aria-label="选择 JSON 备份"
            onChange={(e) => void readFile(e.target.files?.[0])}
          />
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <hr />
          <div>
            <h3>放到手机主屏幕</h3>
            <p className="muted">
              iPhone：用 Safari 打开，点“分享” → “添加到主屏幕”。
              <br />
              Android：在浏览器菜单中选择“安装应用”或“添加到主屏幕”。
            </p>
            {install && (
              <button
                className="primary wide"
                onClick={() =>
                  void requestInstall().catch((error) =>
                    setError(errorText(error)),
                  )
                }
              >
                安装七日
              </button>
            )}
            <p className="hint">
              手机安装与离线使用需要 HTTPS
              地址。首次联网打开并缓存完成后，可以离线使用。
            </p>
            <p className="storage-note">
              {offline || navigator.serviceWorker?.controller
                ? "✓ 离线资源已就绪"
                : "离线资源尚未就绪，请在正式预览地址联网打开"}
            </p>
          </div>
          {updated && (
            <button onClick={updateApp}>更新应用（记录会保留）</button>
          )}
        </div>
      )}
    </Modal>
  );
}

function DayView({
  date,
  day,
  onChange,
  onCopy,
  onPaste,
  back,
  backLabel,
}: {
  date: string;
  day: Day;
  onChange: (fn: (day: Day) => Day) => Promise<boolean>;
  onCopy: () => void;
  onPaste: () => void;
  back: () => void;
  backLabel: string;
}) {
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [expense, setExpense] = useState((day.expenseCents / 100).toFixed(2));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(
    () => setExpense((day.expenseCents / 100).toFixed(2)),
    [day.expenseCents],
  );
  const p = progress(day.tasks);
  async function add(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    const ok = await onChange((old) => ({
      ...old,
      tasks: [...old.tasks, newTask(text)],
    }));
    if (ok) setText("");
    setBusy(false);
  }
  async function saveExpense(e: FormEvent) {
    e.preventDefault();
    try {
      const cents = parseMoney(expense);
      if (await onChange((old) => ({ ...old, expenseCents: cents }))) {
        setError("");
        setExpense((cents / 100).toFixed(2));
      }
    } catch (error) {
      setError(errorText(error));
    }
  }
  return (
    <>
      <button className="back-button" onClick={back}>
        <Icon name="left" />
        {backLabel}
      </button>
      <section className="day-heading">
        <div>
          <p className="eyebrow">
            {date.slice(0, 4)} · {weekday(date)}
            {date === todayKey() ? " · 今天" : ""}
          </p>
          <h1>{shortDate(date)}</h1>
        </div>
        <span
          className={`big-percent ${p.percent === 100 ? "complete-text" : ""}`}
        >
          {p.percent === 100 && "✓ "}
          {p.percent}
          <small>%</small>
        </span>
      </section>
      <div className="day-progress">
        <div className="section-caption">
          <span>
            已完成 {p.done} / {p.total} 项
          </span>
          <span>
            {p.percent === 100 ? "今天的任务，全部完成" : "按自己的节奏来"}
          </span>
        </div>
        <ProgressBar tasks={day.tasks} />
      </div>
      <section className="task-section">
        <div className="section-title">
          <h2>
            当天任务 <span>{p.total}</span>
          </h2>
          <button className="text-button" onClick={onPaste}>
            <Icon name="paste" />
            粘贴任务
          </button>
        </div>
        {day.tasks.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">
              <Icon name="check" />
            </span>
            <h3>留一点空间，给今天</h3>
            <p>从一件小事开始，或粘贴你的任务清单。</p>
          </div>
        ) : (
          <ul className="task-list">
            {day.tasks.map((task) => (
              <li key={task.id} className={task.done ? "task done" : "task"}>
                <button
                  className="check-button"
                  role="checkbox"
                  aria-checked={task.done}
                  aria-label={`${task.done ? "取消完成" : "完成"}：${task.text}`}
                  onClick={() =>
                    void onChange((old) => ({
                      ...old,
                      tasks: old.tasks.map((item) =>
                        item.id === task.id
                          ? { ...item, done: !item.done }
                          : item,
                      ),
                    }))
                  }
                >
                  {task.done && <Icon name="check" />}
                </button>
                <button
                  className="task-text"
                  onClick={() => setEditing(task)}
                  aria-label={`修改：${task.text}`}
                >
                  {task.text}
                </button>
                <button
                  className="icon-button delete-button"
                  aria-label={`删除：${task.text}`}
                  onClick={() => setDeleting(task)}
                >
                  <Icon name="trash" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form className="add-task" onSubmit={add}>
          <input
            aria-label="新任务"
            placeholder="添加一件要做的事…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            className="primary"
            disabled={!text.trim() || busy}
            aria-label="添加任务"
          >
            <Icon name="plus" />
          </button>
        </form>
        <button
          className="copy-button"
          disabled={!day.tasks.length}
          onClick={onCopy}
        >
          <Icon name="copy" />
          应用到其他日期
          <Icon name="right" />
        </button>
      </section>
      <section className="expense-section">
        <div>
          <h2>{date === todayKey() ? "今日消费" : "当日消费"}</h2>
          <p className="hint">记下当天的总金额就好</p>
        </div>
        <form onSubmit={saveExpense}>
          <label className="amount-input">
            <span>¥</span>
            <input
              aria-label="消费金额"
              inputMode="decimal"
              value={expense}
              onChange={(e) => setExpense(e.target.value)}
            />
          </label>
          <button type="submit">保存金额</button>
        </form>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>
      <p className="footnote">每一天的记录，都可以随时修改。</p>
      {editing && (
        <Modal title="修改任务" onClose={() => setEditing(null)}>
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!editing.text.trim()) return;
              if (
                await onChange((old) => ({
                  ...old,
                  tasks: old.tasks.map((task) =>
                    task.id === editing.id
                      ? { ...task, text: editing.text.trim() }
                      : task,
                  ),
                }))
              )
                setEditing(null);
            }}
          >
            <label>
              任务内容
              <textarea
                autoFocus
                value={editing.text}
                onChange={(e) =>
                  setEditing({ ...editing, text: e.target.value })
                }
                required
                rows={3}
              />
            </label>
            <button className="primary" disabled={!editing.text.trim()}>
              保存修改
            </button>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal title="删除这条任务？" onClose={() => setDeleting(null)}>
          <div className="stack">
            <p className="task-preview">{deleting.text}</p>
            <div className="button-row">
              <button onClick={() => setDeleting(null)}>取消</button>
              <button
                className="danger"
                onClick={async () => {
                  if (
                    await onChange((old) => ({
                      ...old,
                      tasks: old.tasks.filter(
                        (task) => task.id !== deleting.id,
                      ),
                    }))
                  )
                    setDeleting(null);
                }}
              >
                确认删除
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function readSelectedDate() {
  const match = window.location.hash.match(
    /^(?:#month\/\d{4}-\d{2}\/|#)day\/(.+)$/,
  );
  return match && validDate(match[1]) ? match[1] : null;
}
function readView(): "month" | "week" {
  return /^#(?:week|day\/)/.test(window.location.hash) ? "week" : "month";
}
function readMonth() {
  const month = window.location.hash.match(
    /^#month\/(\d{4}-\d{2})(?:\/|$)/,
  )?.[1];
  return month && validMonth(month) ? month : null;
}
export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(0);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(readSelectedDate);
  const [view, setView] = useState(readView);
  const [month, setMonth] = useState(
    () => readMonth() ?? todayKey().slice(0, 7),
  );
  const [today, setToday] = useState(todayKey());
  const [modal, setModal] = useState<
    "period" | "settings" | "paste" | "copy" | "jump" | null
  >(null);
  const [jump, setJump] = useState(todayKey());
  const [toast, setToast] = useState("");
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  const {
    offlineReady: [offline],
    needRefresh: [updated],
    updateServiceWorker,
  } = useRegisterSW();
  useEffect(() => {
    let active = true;
    void loadData()
      .then((value) => {
        if (active) {
          setData(value);
          setIndex(
            value ? periodIndex(value.anchor, selected ?? todayKey()) : 0,
          );
          setLoading(false);
        }
      })
      .catch((error) => {
        if (active) {
          setFatal(`无法读取本地记录：${errorText(error)}`);
          setLoading(false);
        }
      });
    const hash = () => {
      setSelected(readSelectedDate());
      setView(readView());
      const nextMonth = readMonth();
      if (nextMonth) setMonth(nextMonth);
      else if (readView() === "month") setMonth(todayKey().slice(0, 7));
    };
    const clock = setInterval(() => setToday(todayKey()), 30000);
    const prompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallPrompt);
    };
    const installed = () => setInstall(null);
    window.addEventListener("hashchange", hash);
    window.addEventListener("beforeinstallprompt", prompt);
    window.addEventListener("appinstalled", installed);
    if ("BroadcastChannel" in window) {
      channel.current = new BroadcastChannel("seven-days-changes");
      channel.current.onmessage = () => {
        void loadData()
          .then(setData)
          .catch((error) => setError(errorText(error)));
      };
    }
    return () => {
      active = false;
      clearInterval(clock);
      channel.current?.close();
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("beforeinstallprompt", prompt);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (data) setIndex(periodIndex(data.anchor, today));
  }, [today, data?.anchor]);
  const commit: Commit = async (change) => {
    setPending((value) => value + 1);
    setError("");
    try {
      const value = await changeData(change);
      setData(value);
      channel.current?.postMessage("changed");
      return true;
    } catch (error) {
      setError(`未能保存：${errorText(error)}`);
      return false;
    } finally {
      setPending((value) => value - 1);
    }
  };
  const openDay = (date: string) => {
    window.location.hash =
      view === "month" ? `month/${month}/day/${date}` : `day/${date}`;
    window.scrollTo(0, 0);
  };
  const goHome = () => {
    if (selected && data) setIndex(periodIndex(data.anchor, selected));
    window.location.hash = view === "month" ? `month/${month}` : "week";
    window.scrollTo(0, 0);
  };
  const activeIndex =
    data && selected ? periodIndex(data.anchor, selected) : index;
  const period = data
    ? getPeriod(data, activeIndex)
    : { name: "第 1 阶段", color: COLORS[0] };
  const dates = data ? periodDates(data.anchor, index) : [];
  const totals = data ? spending(data, dates) : { total: 0, average: 0 };
  const source = selected ?? today;
  return (
    <div className="app" style={{ "--accent": period.color } as CSSProperties}>
      <header className="app-header">
        <a
          className="brand"
          href={view === "month" ? `#month/${today.slice(0, 7)}` : "#week"}
          onClick={() => {
            if (data) setIndex(periodIndex(data.anchor, today));
          }}
        >
          <span className="brand-mark">
            7<span />
          </span>
          <span>
            七日<small>把日子，一天一天过好</small>
          </span>
        </a>
        {data && (
          <button
            className="icon-button"
            aria-label="数据与安装"
            onClick={() => setModal("settings")}
          >
            <Icon name="settings" />
          </button>
        )}
      </header>
      <main>
        {data && !loading && !selected && (
          <nav className="view-switch" aria-label="主要视图">
            <button
              aria-pressed={view === "month"}
              onClick={() => {
                window.location.hash = `month/${month}`;
              }}
            >
              月历
            </button>
            <button
              aria-pressed={view === "week"}
              onClick={() => {
                window.location.hash = "week";
              }}
            >
              7天
            </button>
          </nav>
        )}
        {loading ? (
          <p className="loading">正在打开你的七日…</p>
        ) : fatal ? (
          <div className="error" role="alert">
            <h2>暂时无法打开记录</h2>
            <p>{fatal}</p>
            <p>请确认浏览器允许网站存储，再重新打开。不要清除原有网站数据。</p>
            <button onClick={() => window.location.reload()}>重新读取</button>
          </div>
        ) : !data ? (
          <section className="onboarding">
            <span className="eyebrow">从今天开始 · 每次 7 天</span>
            <h1>
              简单记录，
              <br />
              慢慢完成。
            </h1>
            <p className="intro">
              你的任务，你的节奏。
              <br />
              用七天，装下每天的小事和消费。
            </p>
            <PeriodForm
              initial={period}
              anchor={today}
              busy={pending > 0}
              onSave={async (name, color, anchor) => {
                if (await commit(() => createData(anchor, name, color))) {
                  setIndex(0);
                  setToast("第一个 7 天，准备好了");
                }
              }}
            />
            <p className="footnote">无需登录 · 自动保存在本机</p>
          </section>
        ) : selected ? (
          <DayView
            key={selected}
            date={selected}
            day={data.days[selected] ?? emptyDay()}
            onChange={(fn) =>
              commit((current) => updateDay(current!, selected, fn))
            }
            onCopy={() => setModal("copy")}
            onPaste={() => setModal("paste")}
            back={goHome}
            backLabel={view === "month" ? "返回月历" : "返回 7 天"}
          />
        ) : view === "month" ? (
          <>
            <CalendarView
              data={data}
              month={month}
              today={today}
              openDay={openDay}
              onMonthChange={(value) => {
                window.location.hash = `month/${value}`;
              }}
            />
            <div className="bottom-actions">
              <button onClick={() => setModal("paste")}>
                <Icon name="paste" />
                粘贴任务
              </button>
              <button
                className="primary"
                onClick={() => {
                  window.location.hash = `month/${today.slice(0, 7)}/day/${today}`;
                  window.scrollTo(0, 0);
                }}
              >
                打开今天
                <Icon name="right" />
              </button>
            </div>
          </>
        ) : (
          <>
            <section className="period-heading">
              <div className="eyebrow">
                <span className="color-dot" /> 7 天，一个小阶段
              </div>
              <div className="heading-row">
                <h1>{period.name}</h1>
                <button
                  className="icon-button"
                  aria-label="编辑阶段"
                  onClick={() => setModal("period")}
                >
                  <Icon name="edit" />
                </button>
              </div>
              <p className="date-range">{rangeLabel(dates)}</p>
            </section>
            <section className="spending-summary" aria-label="本周期消费">
              <div>
                <span>7 天累计消费</span>
                <strong>
                  <small>¥</small> {money(totals.total)}
                </strong>
              </div>
              <div>
                <span>
                  日均消费 <small>/ 7 天</small>
                </span>
                <strong>
                  <small>¥</small> {money(totals.average)}
                </strong>
              </div>
            </section>
            <nav className="period-nav" aria-label="切换阶段">
              <button aria-label="上一阶段" onClick={() => setIndex(index - 1)}>
                <Icon name="left" />
              </button>
              <div>
                <button
                  className="text-button"
                  onClick={() => setIndex(periodIndex(data.anchor, today))}
                >
                  回到本期
                </button>
                <span>·</span>
                <button
                  className="text-button"
                  onClick={() => setModal("jump")}
                >
                  <Icon name="calendar" />
                  选日期
                </button>
              </div>
              <button aria-label="下一阶段" onClick={() => setIndex(index + 1)}>
                <Icon name="right" />
              </button>
            </nav>
            <section className="day-cards" aria-label="七天日期卡片">
              {dates.map((date) => {
                const day = data.days[date] ?? emptyDay();
                const p = progress(day.tasks);
                const isToday = date === today;
                return (
                  <button
                    key={date}
                    className={`day-card ${isToday ? "is-today" : ""} ${p.percent === 100 ? "is-complete" : ""}`}
                    onClick={() => openDay(date)}
                    aria-label={`${fullDate(date)} ${weekday(date)}${isToday ? " 今天" : ""}，已完成 ${p.done}/${p.total}，${p.percent}%，消费 ${money(day.expenseCents)} 元`}
                  >
                    <div className="card-date">
                      <span>{Number(date.slice(5, 7))}月</span>
                      <strong>{date.slice(8)}</strong>
                      <small>{weekday(date)}</small>
                    </div>
                    <div className="card-main">
                      <div className="card-top">
                        <span>
                          {isToday ? (
                            <b className="today-badge">今天</b>
                          ) : (
                            <span className="card-date-label">
                              {shortDate(date)}
                            </span>
                          )}
                        </span>
                        <strong
                          className={p.percent === 100 ? "complete-text" : ""}
                        >
                          {p.percent === 100 ? "✓ " : ""}
                          {p.percent}
                          <small>%</small>
                        </strong>
                      </div>
                      <ProgressBar tasks={day.tasks} />
                      <div className="card-bottom">
                        <span>
                          {p.done} / {p.total}{" "}
                          <span className="task-unit">项完成</span>
                        </span>
                        <span>消费 ¥{money(day.expenseCents)}</span>
                      </div>
                    </div>
                    <span className="card-arrow">
                      <Icon name="right" />
                    </span>
                  </button>
                );
              })}
            </section>
            <p className="footnote">过去、现在、未来，都由你安排。</p>
            <div className="bottom-actions">
              <button onClick={() => setModal("paste")}>
                <Icon name="paste" />
                粘贴任务
              </button>
              <button className="primary" onClick={() => openDay(today)}>
                打开今天
                <Icon name="right" />
              </button>
            </div>
          </>
        )}
        {error && (
          <div className="error save-error" role="alert">
            {error}
            <button className="text-button" onClick={() => setError("")}>
              关闭提示
            </button>
          </div>
        )}
      </main>
      {data && (
        <div className="save-status" role="status">
          <span />
          {pending ? "正在保存…" : error ? "保存失败，请重试" : "已保存在本机"}
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Icon name="check" />
          {toast}
        </div>
      )}
      {data && modal === "period" && (
        <Modal title="编辑阶段" onClose={() => setModal(null)}>
          <PeriodForm
            initial={period}
            busy={pending > 0}
            onSave={async (name, color) => {
              if (
                await commit((current) => ({
                  ...current!,
                  periods: {
                    ...current!.periods,
                    [index]: {
                      name: name.trim() || getPeriod(current!, index).name,
                      color,
                    },
                  },
                }))
              )
                setModal(null);
            }}
          />
        </Modal>
      )}
      {data && (modal === "paste" || modal === "copy") && (
        <BatchModal
          kind={modal}
          source={source}
          data={data}
          commit={commit}
          close={() => setModal(null)}
          notify={setToast}
        />
      )}
      {data && modal === "settings" && (
        <Settings
          data={data}
          commit={commit}
          close={() => setModal(null)}
          notify={setToast}
          install={install}
          requestInstall={async () => {
            const prompt = install;
            setInstall(null);
            if (prompt) {
              await prompt.prompt();
              await prompt.userChoice;
            }
          }}
          offline={offline}
          updated={updated}
          updateApp={() => void updateServiceWorker(true)}
        />
      )}
      {data && modal === "jump" && (
        <Modal title="前往某一天" onClose={() => setModal(null)}>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (validDate(jump)) {
                setIndex(periodIndex(data.anchor, jump));
                setModal(null);
                openDay(jump);
              }
            }}
          >
            <label>
              选择日期
              <input
                autoFocus
                type="date"
                value={jump}
                onChange={(e) => setJump(e.target.value)}
                required
                min="1900-01-01"
                max="9998-12-31"
              />
            </label>
            <button className="primary">打开这一天</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
