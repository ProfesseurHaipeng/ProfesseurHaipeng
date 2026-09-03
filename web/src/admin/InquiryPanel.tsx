import { useEffect, useRef, useState, type FormEvent } from "react"
import {
  FIND_QUOTAS,
  INQUIRY_RUN,
  LIMIT_HOURS,
  NEED_PRESETS,
  OUTREACH_LABEL,
  SCHEDULE_KIND,
  TASK_LABEL,
  inquiryRunHint,
  inquiryStepFill,
  taskIsDue,
  taskJobStatus,
  type InquiryFinding,
  type InquirySchedule,
  type InquiryScheduleKind,
  type InquiryState,
  type InquiryTarget,
  type InquiryTask,
} from "../cms/inquiryDesk"

type TaskPayload = {
  inquiry?: InquiryState
  assignMessage?: string
  caseId?: string
}

export function InquiryPanel({
  inquiry,
  locked,
  hermesReady,
  ticketNoOf,
  onTask,
  onStart,
  onFile,
  onOpenTicket,
}: {
  inquiry: InquiryState
  locked?: boolean
  hermesReady?: boolean
  ticketNoOf: (caseId: string) => string
  onTask: (op: string, body?: Record<string, unknown>) => Promise<TaskPayload>
  onStart: (id: string) => Promise<void>
  onFile: (findingId: string) => Promise<void>
  onOpenTicket: (caseId: string) => void
}) {
  const [openId, setOpenId] = useState<string | null>(inquiry.currentId || null)
  const [flash, setFlash] = useState("")
  const task = inquiry.tasks.find((item) => item.id === openId) || null

  useEffect(() => {
    if (openId && !inquiry.tasks.some((item) => item.id === openId)) setOpenId(null)
  }, [inquiry.tasks, openId])

  const createTask = async () => {
    if (locked) return
    setFlash("正在创建…")
    try {
      const payload = await onTask("create", {
        name: "询单任务",
        instruction: "按选定的需求和家数去网上找真实厂商。没有来源不要编。找到联系方式后只起草询单。",
        schedule: { kind: "once" },
        quota: 8,
        limitHours: 24,
        enabled: true,
      })
      const id = payload.inquiry?.currentId || payload.inquiry?.tasks?.[0]?.id
      if (id) setOpenId(id)
      setFlash("已创建。本页工单已留下。")
    } catch {
      setFlash("没创建成功，再点一次")
    }
  }

  const openTask = (id: string) => {
    setOpenId(id)
    setFlash("已打开")
    void onTask("select", { id }).catch(() => undefined)
  }

  if (task) {
    return (
      <TaskEditor
        inquiry={inquiry}
        task={task}
        locked={locked}
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
          <p className="inq-board__hint">选定需求、家数和限时后，Karmenai 按这些真实参数去找厂商。</p>
        </div>
        {inquiry.tasks.length ? (
          <button type="button" className="inq-mini-go" disabled={locked} onClick={() => void createTask()}>
            创建询单任务
          </button>
        ) : null}
      </header>
      <Flash text={flash} />

      {inquiry.tasks.length === 0 ? (
        <article className="inq-hero">
          <p>先选定要找的厂家类型和家数。创建后立刻有一张本页工单，开始寻找后 Karmenai 按这些参数去找。</p>
          <button type="button" className="inq-go" disabled={locked} onClick={() => void createTask()}>
            {locked ? "正在创建…" : "创建询单任务"}
          </button>
        </article>
      ) : (
        <ul className="inq-task-list">
          {inquiry.tasks.map((item) => (
            <li key={item.id}>
              <button type="button" className="inq-task" onClick={() => openTask(item.id)}>
                <strong>{item.name}</strong>
                <span>
                  {TASK_LABEL[item.status]}
                  {item.enabled ? "" : " · 已停用"}
                  {taskIsDue(item) ? " · 已到点" : ""}
                </span>
                <span>
                  {item.targets.map((row) => row.label).join("、") || "尚未选定需求"}
                  {` · 找 ${item.quota || 8} 家`}
                  {item.limitHours ? ` · ${item.limitHours} 小时` : ""}
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
  locked,
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
  locked?: boolean
  hermesReady?: boolean
  ticketNo: string
  onBack: () => void
  onTask: (op: string, body?: Record<string, unknown>) => Promise<TaskPayload>
  onStart: () => Promise<void>
  onFile: (findingId: string) => Promise<void>
  onOpenTicket: (caseId: string) => void
  onDeleted: () => void
}) {
  const inflight = useRef(0)
  const [name, setName] = useState(task.name)
  const [instruction, setInstruction] = useState(task.instruction)
  const [chip, setChip] = useState("")
  const [targets, setTargets] = useState(task.targets)
  const [quota, setQuota] = useState(task.quota || 8)
  const [schedule, setSchedule] = useState(task.schedule)
  const [limitHours, setLimitHours] = useState(task.limitHours)
  const [enabled, setEnabled] = useState(task.enabled)
  const [flash, setFlash] = useState("")
  const [starting, setStarting] = useState(false)
  const [open, setOpen] = useState<{ id: string; kind: "source" | "draft" } | null>(null)
  const jobStatus = taskJobStatus(task.status)
  const canStart = Boolean(targets.length || instruction.trim()) && task.status !== "cancelled"
  const canCancel = task.status === "searching" || task.status === "review" || task.status === "drafting"
  const hint = inquiryRunHint(jobStatus, targets.length)
  const note =
    task.status === "timeout"
      ? "已到限时，本轮停止。"
      : task.status === "cancelled"
        ? "这轮已取消。工单还在，需要的话可以再开始。"
        : task.status === "searching" && !hermesReady
          ? "任务和工单已记下。网关接通后 Karmenai 才会按这些参数找来源。"
          : task.brief
            ? `${hint} · ${task.brief}`
            : hint

  useEffect(() => {
    if (inflight.current) return
    setName(task.name)
    setInstruction(task.instruction)
    setTargets(task.targets)
    setQuota(task.quota || 8)
    setSchedule(task.schedule)
    setLimitHours(task.limitHours)
    setEnabled(task.enabled)
  }, [task.id, task.updatedAt])

  const persist = async (patch: Record<string, unknown>, ok = "已记下") => {
    inflight.current += 1
    try {
      await onTask("update", { id: task.id, ...patch })
      setFlash(ok)
    } catch {
      setFlash("没写上，再点一次")
    } finally {
      inflight.current = Math.max(0, inflight.current - 1)
    }
  }

  const toggleNeed = (label: string) => {
    const exists = targets.some((item) => item.label === label)
    const next = exists
      ? targets.filter((item) => item.label !== label)
      : [...targets, { id: `tg-${label}`, label, at: new Date().toISOString() }]
    setTargets(next)
    setFlash(exists ? `已去掉「${label}」` : `已加入「${label}」`)
    void persist({ targets: next.map((item) => item.label) }, exists ? `已去掉「${label}」` : `已加入「${label}」`)
  }

  const addChip = (event?: FormEvent, next = chip) => {
    event?.preventDefault()
    const text = next.trim()
    if (!text) {
      setFlash("先输入一条需求")
      return
    }
    if (targets.some((item) => item.label === text)) {
      setChip("")
      setFlash("这条已经在里面")
      return
    }
    const row: InquiryTarget = { id: `tg-${text}`, label: text, at: new Date().toISOString() }
    const list = [...targets, row]
    setTargets(list)
    setChip("")
    setFlash(`已加入「${text}」`)
    void persist({ targets: list.map((item) => item.label) }, "已加入")
  }

  const removeChip = (label: string) => toggleNeed(label)
  const unusedCustom = targets.filter((item) => !NEED_PRESETS.some((row) => row.label === item.label))

  return (
    <section className="inq-board">
      <header className="inq-edit-top">
        <button type="button" className="inq-back" onClick={onBack}>
          返回
        </button>
        <h2>询单任务</h2>
      </header>
      <Flash text={flash} />

      <div className="inq-toolbar">
        <label className={`inq-switch${enabled ? " is-on" : ""}`}>
          <input
            type="checkbox"
            checked={enabled}
            disabled={task.status === "cancelled"}
            onChange={(event) => {
              setEnabled(event.target.checked)
              setFlash(event.target.checked ? "已启用" : "已停用")
              void persist({ enabled: event.target.checked }, event.target.checked ? "已启用" : "已停用")
            }}
          />
          <i />
          <span>{enabled ? "已启用" : "已停用"}</span>
        </label>
        <button
          type="button"
          disabled={!canCancel}
          onClick={() => {
            if (confirm("取消这一轮寻找？任务和本页工单会留着。")) {
              setFlash("正在取消…")
              void onTask("cancel", { id: task.id })
                .then(() => setFlash("已取消这一轮"))
                .catch(() => setFlash("没取消成，再点一次"))
            }
          }}
        >
          取消
        </button>
        <button
          type="button"
          className="is-danger"
          disabled={locked}
          onClick={() => {
            if (confirm("删除这个询单任务和本页工单？")) {
              setFlash("正在删除…")
              void onTask("delete", { id: task.id })
                .then(onDeleted)
                .catch(() => setFlash("没删掉，再点一次"))
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
              if (name.trim() && name.trim() !== task.name) void persist({ name: name.trim() }, "名称已记下")
            }}
          />
        </label>
        <label className="inq-field">
          <span>指令</span>
          <textarea
            rows={3}
            value={instruction}
            maxLength={2000}
            placeholder="这轮除了下面的需求和家数，还要特别注意什么？"
            onChange={(event) => setInstruction(event.target.value)}
            onBlur={() => {
              if (instruction !== task.instruction) void persist({ instruction }, "指令已记下")
            }}
          />
        </label>
      </article>

      <article className="inq-card">
        <p className="inq-card__mark">1 · 设定需求</p>
        <h3>要找哪类厂家</h3>
        <p className="inq-empty">点选立刻生效，会写进这轮任务和发给 Karmenai 的参数。</p>
        <ul className="inq-tags">
          {NEED_PRESETS.filter((item) => item.group === "type").map((item) => {
            const on = targets.some((row) => row.label === item.label)
            return (
              <li key={item.label}>
                <button type="button" aria-pressed={on} onClick={() => toggleNeed(item.label)}>
                  {item.label}
                </button>
              </li>
            )
          })}
        </ul>
        <h3>对口弊端</h3>
        <ul className="inq-tags">
          {NEED_PRESETS.filter((item) => item.group === "pain").map((item) => {
            const on = targets.some((row) => row.label === item.label)
            return (
              <li key={item.label}>
                <button type="button" aria-pressed={on} onClick={() => toggleNeed(item.label)}>
                  {item.label}
                </button>
              </li>
            )
          })}
          {unusedCustom.map((item) => (
            <li key={item.id} className="is-on">
              <button type="button" aria-pressed="true" onClick={() => removeChip(item.label)}>
                {item.label} ×
              </button>
            </li>
          ))}
        </ul>
        <form className="inq-add" onSubmit={(event) => addChip(event)}>
          <input
            value={chip}
            onChange={(event) => setChip(event.target.value)}
            placeholder="补充一条需求或弊端"
            maxLength={80}
          />
          <button type="submit" disabled={!chip.trim()}>
            加入
          </button>
        </form>
      </article>

      <article className="inq-card">
        <p className="inq-card__mark">2 · 设定参数</p>
        <h3>找多少家</h3>
        <div className="inq-choice">
          {FIND_QUOTAS.map((item) => (
            <button
              key={item}
              type="button"
              className={quota === item ? "is-on" : ""}
              aria-pressed={quota === item}
              onClick={() => {
                setQuota(item)
                setFlash(`本轮找 ${item} 家`)
                void persist({ quota: item }, `已记下：找 ${item} 家`)
              }}
            >
              {item} 家
            </button>
          ))}
        </div>
        <h3>花多少时间</h3>
        <div className="inq-choice">
          <button
            type="button"
            className={!limitHours ? "is-on" : ""}
            aria-pressed={!limitHours}
            onClick={() => {
              setLimitHours(undefined)
              setFlash("不限时")
              void persist({ limitHours: 0 }, "已记下：不限时")
            }}
          >
            不限
          </button>
          {LIMIT_HOURS.map((hours) => (
            <button
              key={hours}
              type="button"
              className={limitHours === hours ? "is-on" : ""}
              aria-pressed={limitHours === hours}
              onClick={() => {
                setLimitHours(hours)
                setFlash(`限时 ${hours} 小时`)
                void persist({ limitHours: hours }, `已记下：${hours} 小时`)
              }}
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
        <p className="inq-card__mark">何时再跑</p>
        <div className="inq-choice">
          {SCHEDULE_KIND.map((item) => (
            <button
              key={item.key}
              type="button"
              className={schedule.kind === item.key ? "is-on" : ""}
              aria-pressed={schedule.kind === item.key}
              onClick={() => {
                const next: InquirySchedule = { ...schedule, kind: item.key }
                setSchedule(next)
                setFlash(`已选 ${item.label}`)
                void persist({ schedule: next }, `已记下：${item.label}`)
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        {needsHour(schedule.kind) ? (
          <label className="inq-field">
            <span>几点</span>
            <select
              value={schedule.hour ?? 9}
              onChange={(event) => {
                const next = { ...schedule, hour: Number(event.target.value) }
                setSchedule(next)
                void persist({ schedule: next }, "时间已记下")
              }}
            >
              {Array.from({ length: 24 }, (_, hour) => (
                <option key={hour} value={hour}>
                  {String(hour).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {schedule.kind === "interval" ? (
          <label className="inq-field">
            <span>间隔小时</span>
            <input
              type="number"
              min={1}
              max={168}
              value={schedule.intervalHours ?? 6}
              onChange={(event) => {
                const next = {
                  ...schedule,
                  kind: "interval" as const,
                  intervalHours: Math.max(1, Math.min(168, Number(event.target.value) || 6)),
                }
                setSchedule(next)
                void persist({ schedule: next }, "间隔已记下")
              }}
            />
          </label>
        ) : null}
        {task.nextRunAt ? <p className="inq-empty">下次：{clock(task.nextRunAt)}</p> : null}
        {taskIsDue(task) ? <p className="inq-due">已到点。点「开始寻找」再跑一轮。</p> : null}
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
        <p className="inq-empty">找到官网和邮箱后只起草询单。站点还没有发信口，不会假装已经发出。</p>
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

      <button
        type="button"
        className="inq-go"
        disabled={starting || locked || !canStart}
        onClick={() => {
          setStarting(true)
          setFlash("正在交给 Karmenai…")
          void onStart()
            .then(() => setFlash("已交给 Karmenai，按你设的需求和家数去找"))
            .catch(() => setFlash("没交出去，再点一次"))
            .finally(() => setStarting(false))
        }}
      >
        {starting ? "正在交给 Karmenai…" : "开始寻找"}
      </button>
      {!canStart && task.status === "cancelled" ? <p className="inq-foot">已取消的任务不能再开始，请另建一轮。</p> : null}
      {!canStart && task.status !== "cancelled" ? <p className="inq-foot">先选定至少一种需求，或写一条指令。</p> : null}

      <article className="inq-card inq-card--run">
        <div className="inq-run-head">
          <div>
            <p className="inq-card__mark">进度</p>
            <p className="inq-step-note">{starting ? "正在交给 Karmenai…" : note}</p>
          </div>
          <ol className="inq-steps inq-steps--compact">
            {INQUIRY_RUN.map((step, index) => {
              const fill = inquiryStepFill(jobStatus, targets.length, index)
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
            <span>
              {inquiry.findings.length ? `${inquiry.findings.length} / ${quota} 家` : `目标 ${quota} 家`}
            </span>
          </div>
          {inquiry.findings.length === 0 ? (
            <p className="inq-empty">尚无。Karmenai 找到带真实来源的厂商后会写在这里。</p>
          ) : (
            <ul className="inq-results">
              {inquiry.findings.map((item) => (
                <li key={item.id}>
                  <FindingCard item={item} open={open} onOpen={setOpen} onFile={() => void onFile(item.id)} onOpenTicket={onOpenTicket} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </article>
      <p className="inq-foot">厂商建档是另一张工单。询单只起草，不群发。</p>
    </section>
  )
}

function Flash({ text }: { text: string }) {
  const [shown, setShown] = useState(text)
  useEffect(() => {
    if (!text) return
    setShown(text)
    const timer = window.setTimeout(() => setShown(""), 1800)
    return () => window.clearTimeout(timer)
  }, [text])
  return (
    <p className={`inq-flash${shown ? "" : " is-idle"}${shown.includes("没") ? " is-bad" : ""}`} aria-live="polite">
      {shown || " "}
    </p>
  )
}

function FindingCard({
  item,
  open,
  onOpen,
  onFile,
  onOpenTicket,
}: {
  item: InquiryFinding
  open: { id: string; kind: "source" | "draft" } | null
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
        来源：{item.source || "尚无"} · 联系：{item.contact || "尚无"} · 草稿：{item.draft ? "有" : "尚无"}
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
          <button type="button" onClick={onFile}>
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
