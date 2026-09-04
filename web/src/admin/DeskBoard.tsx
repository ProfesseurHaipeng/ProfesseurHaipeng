import {
  PROGRESS_LABEL,
  PROGRESS_TRACK,
  boardMetrics,
  customerArchives,
  factoryArchives,
  pipelineStats,
  type HermesCase,
  type HermesEvent,
  type HermesProgress,
} from "../cms/hermesDesk"
import type { InquiryState } from "../cms/inquiryDesk"

const PIPE_COLOR: Record<HermesProgress, string> = {
  new: "#c5d5ce",
  contacted: "#7d9b8f",
  talking: "#1b4332",
  sample: "#3d6b5c",
  negotiate: "#c9a227",
  hold: "#b8bbb6",
  closed: "#d5d8d4",
}

export function DeskBoard({
  cases,
  events,
  inquiry,
  coachTurns,
}: {
  cases: HermesCase[]
  events: HermesEvent[]
  inquiry: InquiryState
  coachTurns: number
}) {
  const board = boardMetrics(cases)
  const pipeline = pipelineStats(cases)
  const customers = customerArchives(cases)
  const factories = factoryArchives(cases)
  const bars = PROGRESS_TRACK.map((key) => ({ key, label: PROGRESS_LABEL[key], value: pipeline[key] || 0 }))
  if (pipeline.hold) bars.push({ key: "hold", label: PROGRESS_LABEL.hold, value: pipeline.hold })
  const series = eventSeries(events)
  const recent = [...events].reverse().slice(0, 8)
  const cards = [
    { label: "在跟工单", value: board.live },
    { label: "询单任务", value: inquiry.tasks.length },
    { label: "找到厂商", value: inquiry.findings.length },
    { label: "工作台对话", value: coachTurns },
    { label: "客户档案", value: customers.length },
    { label: "工厂档案", value: factories.length },
  ]

  return (
    <section className="desk-board">
      <header className="desk-board__head">
        <h2>工作总览</h2>
        <p>数字都来自本站工单、询单和事件。没有的就显示 0。</p>
      </header>
      <ul className="desk-board__cards">
        {cards.map((item) => (
          <li key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </li>
        ))}
      </ul>
      <div className="desk-board__charts">
        <article className="desk-board__chart">
          <header>
            <h3>工单进度</h3>
            <span>{board.live} 张</span>
          </header>
          <PipelineBar rows={bars} />
          <BarChart rows={bars} />
        </article>
        <article className="desk-board__chart">
          <header>
            <h3>近两周事件</h3>
            <span>{events.length ? `${events.length} 条` : "尚无"}</span>
          </header>
          <GroupChart points={series} />
        </article>
        <article className="desk-board__chart desk-board__chart--feed">
          <header>
            <h3>最近动态</h3>
            <span>{recent.length ? `${recent.length} 条` : "尚无"}</span>
          </header>
          {recent.length === 0 ? (
            <p className="desk-board__empty">还没有事件。</p>
          ) : (
            <ol className="desk-board__feed">
              {recent.map((item) => (
                <li key={item.id}>
                  <strong>{item.text}</strong>
                  <time dateTime={item.at}>{formatTime(item.at)}</time>
                </li>
              ))}
            </ol>
          )}
        </article>
        <article className="desk-board__chart desk-board__chart--tree">
          <header>
            <h3>档案关系</h3>
            <span>工单 / 客户 / 工厂</span>
          </header>
          <TreeChart tickets={board.live} customers={customers.length} factories={factories.length} />
        </article>
      </div>
    </section>
  )
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("zh-CN", { hour12: false })
  } catch {
    return iso
  }
}

function PipelineBar({ rows }: { rows: { key: string; label: string; value: number }[] }) {
  const total = rows.reduce((sum, item) => sum + item.value, 0)
  if (!total) return <p className="desk-board__empty">尚无进度分布。</p>
  return (
    <div className="desk-pipe">
      <div className="desk-pipe__bar" aria-hidden="true">
        {rows
          .filter((item) => item.value)
          .map((item) => (
            <i
              key={item.key}
              style={{
                width: `${(item.value / total) * 100}%`,
                background: PIPE_COLOR[item.key as HermesProgress] || "#1b4332",
              }}
              title={`${item.label} ${item.value}`}
            />
          ))}
      </div>
      <ul className="desk-pipe__legend">
        {rows.map((item) => (
          <li key={item.key}>
            <i style={{ background: PIPE_COLOR[item.key as HermesProgress] || "#1b4332" }} />
            {item.label} {item.value}
          </li>
        ))}
      </ul>
    </div>
  )
}

function chartTicks(max: number) {
  const top = Math.max(1, max)
  return [0, top / 2, top]
}

function BarChart({ rows }: { rows: { key: string; label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((item) => item.value))
  const plotLeft = 36
  const plotRight = 352
  const plotTop = 16
  const plotBottom = 118
  const plotH = plotBottom - plotTop
  return (
    <svg className="desk-chart" viewBox="0 0 360 160" role="img" aria-label="工单进度柱状图">
      {chartTicks(max).map((tick) => {
        const y = plotBottom - (tick / max) * plotH
        return (
          <g key={tick}>
            <line x1={plotLeft} y1={y} x2={plotRight} y2={y} stroke="#ececec" />
            <text x={plotLeft - 8} y={y + 3} textAnchor="end" fontSize="8" fill="#66736e">
              {tick}
            </text>
          </g>
        )
      })}
      {rows.map((item, index) => {
        const width = (plotRight - plotLeft) / rows.length
        const x = plotLeft + index * width + width * 0.18
        const barW = width * 0.64
        const h = (item.value / max) * plotH
        return (
          <g key={item.key}>
            <rect x={x} y={plotBottom - h} width={barW} height={h} rx="3" fill="#1b4332" />
            <text x={x + barW / 2} y="148" textAnchor="middle" fontSize="8" fill="#66736e">
              {item.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function GroupChart({ points }: { points: { label: string; tickets: number; other: number }[] }) {
  if (!points.some((item) => item.tickets || item.other)) {
    return <p className="desk-board__empty">尚无事件曲线。</p>
  }
  const max = Math.max(1, ...points.map((item) => item.tickets + item.other))
  const plotLeft = 36
  const plotRight = 352
  const plotTop = 16
  const plotBottom = 118
  const plotH = plotBottom - plotTop
  const width = (plotRight - plotLeft) / points.length
  return (
    <svg className="desk-chart" viewBox="0 0 360 160" role="img" aria-label="近两周事件柱状图">
      {chartTicks(max).map((tick) => {
        const y = plotBottom - (tick / max) * plotH
        return (
          <g key={tick}>
            <line x1={plotLeft} y1={y} x2={plotRight} y2={y} stroke="#ececec" />
            <text x={plotLeft - 8} y={y + 3} textAnchor="end" fontSize="8" fill="#66736e">
              {tick}
            </text>
          </g>
        )
      })}
      {points.map((item, index) => {
        const x = plotLeft + index * width + width * 0.2
        const barW = width * 0.28
        const ticketH = (item.tickets / max) * plotH
        const otherH = (item.other / max) * plotH
        return (
          <g key={item.label}>
            <rect x={x} y={plotBottom - ticketH} width={barW} height={ticketH} rx="2" fill="#1b4332" />
            <rect x={x + barW + 2} y={plotBottom - otherH} width={barW} height={otherH} rx="2" fill="#c5d5ce" />
          </g>
        )
      })}
      <text x={plotLeft} y="150" fontSize="8" fill="#66736e">
        {points[0]?.label}
      </text>
      <text x={plotRight} y="150" textAnchor="end" fontSize="8" fill="#66736e">
        {points.at(-1)?.label}
      </text>
    </svg>
  )
}

function TreeChart({ tickets, customers, factories }: { tickets: number; customers: number; factories: number }) {
  return (
    <svg className="desk-chart desk-chart--tree" viewBox="0 0 360 160" role="img" aria-label="档案关系图">
      <line x1="180" y1="48" x2="90" y2="98" stroke="#d5d8d4" />
      <line x1="180" y1="48" x2="270" y2="98" stroke="#d5d8d4" />
      <rect x="120" y="12" width="120" height="36" rx="8" fill="#1b4332" />
      <text x="180" y="34" textAnchor="middle" fontSize="12" fill="#fff">
        工单 {tickets}
      </text>
      <rect x="30" y="98" width="120" height="36" rx="8" fill="#fff" stroke="#d5d8d4" />
      <text x="90" y="120" textAnchor="middle" fontSize="12" fill="#14241f">
        客户 {customers}
      </text>
      <rect x="210" y="98" width="120" height="36" rx="8" fill="#fff" stroke="#d5d8d4" />
      <text x="270" y="120" textAnchor="middle" fontSize="12" fill="#14241f">
        工厂 {factories}
      </text>
    </svg>
  )
}

function eventSeries(events: HermesEvent[]) {
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - (13 - index))
    return date
  })
  return days.map((date) => {
    const key = date.toISOString().slice(0, 10)
    const day = events.filter((item) => item.at.slice(0, 10) === key)
    return {
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      tickets: day.filter((item) => item.kind === "ticket" || item.kind === "attach").length,
      other: day.filter((item) => item.kind !== "ticket" && item.kind !== "attach").length,
    }
  })
}
