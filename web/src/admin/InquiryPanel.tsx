import { useEffect, useState, type FormEvent } from "react"
import {
  INQUIRY_RUN,
  LIMIT_HOURS,
  OUTREACH_LABEL,
  SCHEDULE_KIND,
  TASK_LABEL,
  inquiryRunHint,
  inquiryStepFill,
  scheduleLabel,
  taskIsDue,
  taskJobStatus,
  type InquiryFinding,
  type InquiryScheduleKind,
  type InquiryState,
  type InquiryTask,
} from "../cms/inquiryDesk"

const SUGGEST = ["土壤板结", "化肥成本高", "有机肥短缺", "水稻加工厂", "茶叶基地"]
const HOURS = Array.from({ length: 24 }, (_, index) => index)

type TaskPayload = {
  inquiry?: InquiryState
  assignMessage?: string
  caseId?: string
}

export function InquiryPanel({
  inquiry,
  busy,
  hermesReady,
  ticketNoOf,
  onTask,
  onStart,
  onFile,
  onOpenTicket,
}: {
  inquiry: InquiryState
  busy?: boolean
  hermesReady?: boolean
  ticketNoOf: (caseId: string) => string
  onTask: (op: string, body?: Record<string, unknown>) => Promise<TaskPayload>
  onStart: (id: string) => Promise<void>
  onFile: (findingId: string) => Promise<void>
  onOpenTicket: (caseId: string) => void
}) {
  const [openId, setOpenId] = useState<string | null>(inquiry.currentId || null)
  const task = inquiry.tasks.find((item) => item.id === openId) || null

  useEffect(() => {
    if (openId && !inquiry.tasks.some((item) => item.id === openId)) setOpenId(null)
  }, [inquiry.tasks, openId])

  const createTask = async () => {
    if (busy) return
    try {
      const payload = await onTask("create", {
        name: "询单任务",
        instruction: "按条件找真实厂商。没有来源不要编。",
        schedule: { kind: "once" },
        enabled: true,
      })
      const id = payload.inquiry?.currentId || payload.inquiry?.tasks?.[0]?.id
      if (id) setOpenId(id)
    } catch {
      return
    }
  }

  const openTask = async (id: string) => {
    if (busy) return
    try {
      await onTask("select", { id })
      setOpenId(id)
    } catch {
      return
    }
  }

  if (task) {
    return (
      <TaskEditor
        inquiry={inquiry}
        task={task}
        busy={busy}
        hermesReady={hermesReady}
        ticketNo={task.caseId ? ticketNoOf(task.caseId) : ""}
        onBack={() => setOpenId(null)}
        onTask={onTask}
        onStart={() => onStart(task.id)}
        onFile={onFile}
        onOpenTicket={onOpenTicket}
        onDeleted={() => setOpenId(null)}
      />
    )
  }

  return (
    <section className="inq-board">
      <header className="inq-board__top">
        <div>
          <h2>询单任务</h2>
          <p className="inq-board__hint">按条件和时间去找真实厂商。创建后立刻有一张属于本页的工单。</p>
        </div>
        {inquiry.tasks.length ? (
          <button type="button" className="inq-mini-go" disabled={busy} onClick={() => void createTask()}>
            创建询单任务
          </button>
        ) : null}
      </header>

      {inquiry.tasks.length === 0 ? (
        <article className="inq-hero">
          <p>询单任务是这个工作台按你设的条件和时间表去找厂商的任务。</p>
          <button type="button" className="inq-go" disabled={busy} onClick={() => void createTask()}>
            创建询单任务
          </button>
        </article>
      ) : (
        <ul className="inq-task-list">
          {inquiry.tasks.map((item) => (
            <li key={item.id}>
              <button type="button" className="inq-task" disabled={busy} onClick={() => void openTask(item.id)}>
                <strong>{item.name}</strong>
                <span>
                  {TASK_LABEL[item.status]}
                  {item.enabled ? "" : " · 已停用"}
                  {taskIsDue(item) ? " · 已到点" : ""}
                </span>
                <span>
                  {scheduleLabel(item.schedule)}
                  {item.limitHours ? ` · 限时 ${item.limitHours} 小时` : " · 不限时"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function TaskEditor({
  inquiry,
  task,
  busy,
  hermesReady,
  ticketNo,
  onBack,
  onTask,
  onStart,
  onFile,
  onOpenTicket,
  onDeleted,
}: {
  inquiry: InquiryState
  task: InquiryTask
  busy?: boolean
  hermesReady?: boolean
  ticketNo: string
  onBack: () => void
  onTask: (op: string, body?: Record<string, unknown>) => Promise<TaskPayload>
  onStart: () => Promise<void>
  onFile: (findingId: string) => Promise<void>
  onOpenTicket: (caseId: string) => void
  onDeleted: () => void
}) {
  const [name, setName] = useState(task.name)
  const [instruction, setInstruction] = useState(task.instruction)
  const [chip, setChip] = useState("")
  const [open, setOpen] = useState<{ id: string; kind: "source" | "draft" } | null>(null)
  const jobStatus = taskJobStatus(task.status)
  const canStart = Boolean(task.targets.length || task.instruction.trim()) && task.status !== "cancelled"
  const canCancel = task.status === "searching" || task.status === "review" || task.status === "drafting"
  const hint = inquiryRunHint(jobStatus, task.targets.length)
  const note =
    task.status === "timeout"
      ? "已到限时，本轮停止。"
      : task.status === "cancelled"
        ? "这轮已取消。工单还在，需要的话可以再开始。"
        : task.status === "searching" && !hermesReady
          ? "任务和工单已记下。网关接通后 Karmenai 才会找来源，没有来源不写厂商。"
          : task.brief
            ? `${hint} · ${task.brief}`
            : hint

  useEffect(() => {
    setName(task.name)
    setInstruction(task.instruction)
  }, [task.id])

  const save = (patch: Record<string, unknown>) => {
    if (busy) return
    void onTask("update", { id: task.id, ...patch }).catch(() => undefined)
  }

  const addChip = async (event?: FormEvent, next = chip) => {
    event?.preventDefault()
    const text = next.trim()
    if (!text || busy) return
    if (task.targets.some((item) => item.label === text)) {
      setChip("")
      return
    }
    await onTask("update", { id: task.id, targets: [...task.targets.map((item) => item.label), text] })
    setChip("")
  }

  const removeChip = (label: string) => {
    if (busy) return
    void onTask("update", {
      id: task.id,
      targets: task.targets.filter((item) => item.label !== label).map((item) => item.label),
    })
  }

  const unusedSuggest = SUGGEST.filter((item) => !task.targets.some((row) => row.label === item))

  return (
    <section className="inq-board">
      <header className="inq-edit-top">
        <button type="button" className="inq-back" onClick={onBack}>
          返回
        </button>
        <h2>询单任务</h2>
      </header>

      <div className="inq-toolbar">
        <label className={`inq-switch${task.enabled ? " is-on" : ""}`}>
          <input
            type="checkbox"
            checked={task.enabled}
            disabled={busy || task.status === "cancelled"}
            onChange={(event) => save({ enabled: event.target.checked })}
          />
          <i />
          <span>{task.enabled ? "已启用" : "已停用"}</span>
        </label>
        <button
          type="button"
          disabled={busy || !canCancel}
          onClick={() => {
            if (confirm("取消这一轮寻找？任务和本页工单会留着。")) void onTask("cancel", { id: task.id })
          }}
        >
          取消
        </button>
        <button
          type="button"
          className="is-danger"
          disabled={busy}
          onClick={() => {
            if (confirm("删除这个询单任务和本页工单？")) {
              void onTask("delete", { id: task.id }).then(onDeleted)
            }
          }}
        >
          删除
        </button>
      </div>

      <article className="inq-card">
        <label className="inq-field">
          <span>名称</span>
          <input
            value={name}
            maxLength={80}
            placeholder="为这轮询单命名"
            onChange={(event) => setName(event.target.value)}
            onBlur={() => {
              if (name.trim() && name.trim() !== task.name) save({ name: name.trim() })
            }}
          />
        </label>
        <label className="inq-field">
          <span>指令</span>
          <textarea
            rows={3}
            value={instruction}
            maxLength={2000}
            placeholder="这轮询单每次运行时应该做什么？"
            onChange={(event) => setInstruction(event.target.value)}
            onBlur={() => {
              if (instruction !== task.instruction) save({ instruction })
            }}
          />
        </label>
      </article>

      <article className="inq-card">
        <p className="inq-card__mark">要找什么</p>
        <h3>厂商弊端 / 对口类型</h3>
        {task.targets.length || unusedSuggest.length ? (
          <ul className="inq-tags">
            {task.targets.map((item) => (
              <li key={item.id} className="is-on">
                <span>{item.label}</span>
                <button type="button" disabled={busy} onClick={() => removeChip(item.label)} aria-label={`去掉 ${item.label}`}>
                  ×
                </button>
              </li>
            ))}
            {unusedSuggest.map((item) => (
              <li key={item}>
                <button type="button" disabled={busy} onClick={() => void addChip(undefined, item)}>
                  {item}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="inq-empty">还没有条件。加入后会写进这轮任务。</p>
        )}
        <form className="inq-add" onSubmit={(event) => void addChip(event)}>
          <input
            value={chip}
            onChange={(event) => setChip(event.target.value)}
            placeholder="输入弊端或对口类型"
            maxLength={80}
          />
          <button type="submit" disabled={!chip.trim() || busy}>
            加入
          </button>
        </form>
      </article>

      <article className="inq-card">
        <p className="inq-card__mark">何时运行</p>
        <div className="inq-choice">
          {SCHEDULE_KIND.map((item) => (
            <button
              key={item.key}
              type="button"
              className={task.schedule.kind === item.key ? "is-on" : ""}
              disabled={busy}
              onClick={() => save({ schedule: { ...task.schedule, kind: item.key } })}
            >
              {item.label}
            </button>
          ))}
        </div>
        {needsHour(task.schedule.kind) ? (
          <label className="inq-field">
            <span>几点</span>
            <select
              value={task.schedule.hour ?? 9}
              disabled={busy}
              onChange={(event) =>
                save({ schedule: { ...task.schedule, kind: task.schedule.kind, hour: Number(event.target.value) } })
              }
            >
              {HOURS.map((hour) => (
                <option key={hour} value={hour}>
                  {String(hour).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {task.schedule.kind === "interval" ? (
          <label className="inq-field">
            <span>间隔小时</span>
            <input
              type="number"
              min={1}
              max={168}
              value={task.schedule.intervalHours ?? 6}
              disabled={busy}
              onChange={(event) =>
                save({
                  schedule: {
                    ...task.schedule,
                    kind: "interval",
                    intervalHours: Math.max(1, Math.min(168, Number(event.target.value) || 6)),
                  },
                })
              }
            />
          </label>
        ) : null}
        {task.nextRunAt ? <p className="inq-empty">下次：{clock(task.nextRunAt)}</p> : null}
        {taskIsDue(task) ? <p className="inq-due">已到点。点「开始寻找」再跑一轮。</p> : null}
      </article>

      <article className="inq-card">
        <p className="inq-card__mark">限时</p>
        <div className="inq-choice">
          <button type="button" className={!task.limitHours ? "is-on" : ""} disabled={busy} onClick={() => save({ limitHours: 0 })}>
            不限
          </button>
          {LIMIT_HOURS.map((hours) => (
            <button
              key={hours}
              type="button"
              className={task.limitHours === hours ? "is-on" : ""}
              disabled={busy}
              onClick={() => save({ limitHours: hours })}
            >
              {hours} 小时
            </button>
          ))}
        </div>
        {task.dueAt && (task.status === "searching" || task.status === "review" || task.status === "drafting") ? (
          <p className="inq-empty">本轮截止 {clock(task.dueAt)}</p>
        ) : null}
      </article>

      <article className="inq-card">
        <p className="inq-card__mark">本页工单</p>
        {task.caseId ? (
          <div className="inq-ticket">
            <strong>{ticketNo || "询单工单"}</strong>
            <span>{TASK_LABEL[task.status]}</span>
            <button type="button" onClick={() => onOpenTicket(task.caseId!)}>
              看工单
            </button>
          </div>
        ) : (
          <p className="inq-empty">创建后会立刻留下一张属于本页的工单。</p>
        )}
      </article>

      <article className="inq-card">
        <p className="inq-card__mark">运行历史</p>
        {task.runs.length === 0 ? (
          <p className="inq-empty">尚无运行记录</p>
        ) : (
          <ul className="inq-hist">
            {task.runs
              .slice()
              .reverse()
              .map((item) => (
                <li key={item.id}>
                  <strong>{runLabel(item.status)}</strong>
                  <span>{clock(item.at)}</span>
                  {item.note ? <p>{item.note}</p> : null}
                </li>
              ))}
          </ul>
        )}
      </article>

      <button type="button" className="inq-go" disabled={busy || !canStart} onClick={() => void onStart()}>
        开始寻找
      </button>
      {!canStart && task.status === "cancelled" ? <p className="inq-foot">已取消的任务不能再开始，请另建一轮。</p> : null}
      {!canStart && task.status !== "cancelled" ? <p className="inq-foot">先写指令或加入至少一条条件，再开始寻找。</p> : null}

      <article className="inq-card inq-card--run">
        <div className="inq-run-head">
          <div>
            <p className="inq-card__mark">进度</p>
            <p className="inq-step-note">{busy ? "正在写入工作台…" : note}</p>
          </div>
          <ol className="inq-steps inq-steps--compact">
            {INQUIRY_RUN.map((step, index) => {
              const fill = inquiryStepFill(jobStatus, task.targets.length, index)
              return (
                <li key={step.key} className={`is-${fill}`} title={step.label}>
                  <i />
                  <span>{step.label}</span>
                </li>
              )
            })}
          </ol>
        </div>
        <div className="inq-run-results">
          <div className="inq-run-results__head">
            <p className="inq-card__mark">结果</p>
            <span>{inquiry.findings.length ? `${inquiry.findings.length} 家` : TASK_LABEL[task.status]}</span>
          </div>
          {inquiry.findings.length === 0 ? (
            <p className="inq-empty">尚无。Karmenai 找到带真实来源的厂商后会写在这里。</p>
          ) : (
            <ul className="inq-results">
              {inquiry.findings.map((item) => (
                <li key={item.id}>
                  <FindingCard
                    item={item}
                    open={open}
                    busy={busy}
                    onOpen={setOpen}
                    onFile={() => void onFile(item.id)}
                    onOpenTicket={onOpenTicket}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </article>
      <p className="inq-foot">建档会另写厂商工单。站点没有发信接口，询单只起草、不群发。</p>
    </section>
  )
}

function FindingCard({
  item,
  open,
  busy,
  onOpen,
  onFile,
  onOpenTicket,
}: {
  item: InquiryFinding
  open: { id: string; kind: "source" | "draft" } | null
  busy?: boolean
  onOpen: (next: { id: string; kind: "source" | "draft" } | null) => void
  onFile: () => void
  onOpenTicket: (caseId: string) => void
}) {
  const shown = open?.id === item.id ? open.kind : null
  return (
    <article className="inq-result">
      <header>
        <strong>{item.org}</strong>
        <span className="inq-result__outreach">{OUTREACH_LABEL[item.outreach]}</span>
      </header>
      <p>{item.pain || "对口类型尚无"}</p>
      <p className="inq-result__meta">
        来源：{item.source || "尚无"} · 草稿：{item.draft ? "有" : "尚无"}
      </p>
      <span className="inq-ops">
        <button type="button" onClick={() => onOpen(shown === "source" ? null : { id: item.id, kind: "source" })}>
          看来源
        </button>
        <button type="button" onClick={() => onOpen(shown === "draft" ? null : { id: item.id, kind: "draft" })}>
          看草稿
        </button>
        {item.caseId ? (
          <button type="button" onClick={() => onOpenTicket(item.caseId!)}>
            看工单
          </button>
        ) : (
          <button type="button" disabled={busy} onClick={onFile}>
            建档
          </button>
        )}
      </span>
      {shown ? <p className="inq-result__detail">{shown === "source" ? item.source || "来源尚无" : item.draft || "草稿尚无"}</p> : null}
    </article>
  )
}

function needsHour(kind: InquiryScheduleKind) {
  return kind === "daily" || kind === "weekdays" || kind === "weekly" || kind === "monthly"
}

function clock(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "尚无"
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = String(date.getHours()).padStart(2, "0")
  const minute = String(date.getMinutes()).padStart(2, "0")
  return `${month}/${day} ${hour}:${minute}`
}

function runLabel(status: "started" | "done" | "cancelled" | "timeout" | "noted") {
  if (status === "started") return "已开始"
  if (status === "done") return "已结束"
  if (status === "cancelled") return "已取消"
  if (status === "timeout") return "已到时"
  return "记下"
}
