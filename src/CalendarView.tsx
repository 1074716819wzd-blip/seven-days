import type { CSSProperties } from "react";
import {
  emptyDay,
  getPeriod,
  money,
  periodIndex,
  progress,
  type AppData,
} from "./data";
import {
  calendarMoney,
  monthCells,
  monthSummary,
  shiftMonth,
} from "./calendar";

export default function CalendarView({
  data,
  month,
  today,
  onMonthChange,
  openDay,
}: {
  data: AppData;
  month: string;
  today: string;
  onMonthChange: (month: string) => void;
  openDay: (date: string) => void;
}) {
  const summary = monthSummary(data, month);
  return (
    <section className="calendar-view" aria-label="月历总览">
      <div className="calendar-heading">
        <h1 aria-live="polite">
          <span>{month.slice(0, 4)}年</span> {Number(month.slice(5))}月
        </h1>
        <div className="month-controls">
          <button
            aria-label="上一个月"
            disabled={month === "0000-01"}
            onClick={() => onMonthChange(shiftMonth(month, -1))}
          >
            ‹
          </button>
          <button
            className="month-today"
            onClick={() => onMonthChange(today.slice(0, 7))}
          >
            今天
          </button>
          <button
            aria-label="下一个月"
            disabled={month === "9999-12"}
            onClick={() => onMonthChange(shiftMonth(month, 1))}
          >
            ›
          </button>
        </div>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">
        {"日一二三四五六".split("").map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div
        className="calendar-grid"
        aria-label={`${month.slice(0, 4)}年${Number(month.slice(5))}月日期`}
      >
        {monthCells(month).map((date, index) => {
          if (!date)
            return (
              <div
                className="calendar-blank"
                key={`blank-${index}`}
                aria-hidden="true"
              />
            );
          const day = data.days[date] ?? emptyDay();
          const p = progress(day.tasks);
          const complete = p.total > 0 && p.done === p.total;
          const stage = getPeriod(data, periodIndex(data.anchor, date));
          const label = p.total
            ? `${complete ? "✓ " : ""}${p.percent}%`
            : "暂无任务";
          return (
            <button
              key={date}
              data-date={date}
              className={`calendar-day ${date === today ? "calendar-today" : ""} ${complete ? "calendar-complete" : ""} ${p.done > 0 ? "has-progress" : ""}`}
              style={{ "--stage-color": stage.color } as CSSProperties}
              aria-current={date === today ? "date" : undefined}
              aria-label={`${date}，${date === today ? "今天，" : ""}${p.total ? `完成 ${p.done}/${p.total}，${p.percent}%` : "暂无任务"}，消费 ${money(day.expenseCents)} 元，${stage.name}`}
              onClick={() => openDay(date)}
            >
              <span className="calendar-number">{Number(date.slice(8))}</span>
              <span
                className={`calendar-completion ${!p.total ? "no-tasks" : ""}`}
              >
                {label}
              </span>
              <span className="calendar-progress" aria-hidden="true">
                <span style={{ width: `${p.percent}%` }} />
              </span>
              <span
                className="calendar-expense"
                title={`¥${money(day.expenseCents)}`}
              >
                ¥{calendarMoney(day.expenseCents)}
              </span>
              <span
                className="calendar-stage"
                title={stage.name}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
      <p className="calendar-key">
        <span />
        底部色条表示 7 天阶段 · 点日期查看和编辑
      </p>
      <section
        className={`spending-summary month-summary ${money(summary.totalCents).length > 12 ? "long-total" : ""}`}
        aria-label="月度汇总"
      >
        <div>
          <span>本月平均完成率</span>
          <strong data-testid="month-average">
            {summary.averagePercent === null
              ? "—"
              : `${summary.averagePercent}%`}
          </strong>
        </div>
        <div>
          <span>本月累计消费</span>
          <strong data-testid="month-spending">
            <small>¥</small> {money(summary.totalCents)}
          </strong>
        </div>
      </section>
      <p className="month-note">
        {summary.taskDays
          ? `完成率按 ${summary.taskDays} 个有任务日期平均，空白日期不计入。`
          : "本月还没有任务记录，空白日期不计入平均。"}
        <br />
        大额消费简写，点击日期查看完整金额。
      </p>
    </section>
  );
}
