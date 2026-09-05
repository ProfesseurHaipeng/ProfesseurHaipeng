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
  outreach?: { searched?: number; drafted?: number; sent?: number; report?: string }
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
  onStart: (id: string) => Promise<{ flash?: string } | void>
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
        instruction: "按选定的厂家类型和痛点，到网上找对方已公布的邮箱，用本站皮纳图博火山灰和官网写推广信。发信走 WEHO 已配置的发出信箱；没有邮局回执只入队为草稿。没有公开邮箱不要编。",
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
    <section className="inq-page">
      <header className="inq-page__head">
        <div className="inq-page__title">
          <h2>询单任务</h2>
          {flash ? <p className="inq-flash">{flash}</p> : <p>选定需求、家数和限时后，工位会上网找公开邮箱并起草推广信。</p>}
        </div>
        {inquiry.tasks.length ? (
          <button type="button" className="inq-mini-go" disabled={locked} onClick={() => void createTask()}>
            创建
          </button>
        ) : null}
      </header>

      {inquiry.tasks.length === 0 ? (
        <article className="inq-hero">
          <p>创建后立刻有一张本页工单。选好厂家类型和家数，再开始询单。</p>
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
                  {` · ${item.quota || 8} 家`}
                  {item.limitHours ? ` · ${item.limitHours}h` : ""}
                </span>
                <em>{item.targets.map((row) => row.label).join("、") || "尚未选定需求"}</em>
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
  onStart: () => Promise<{ flash?: string } | void>
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
          ? "正在网上找公开邮箱。顾问网关没接通也不影响本轮寻找和起草。"
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

  const startRound = () => {
    if (starting || locked || !canStart) return
    setStarting(true)
    setEnabled(true)
    setFlash("正在网上找公开邮箱并起草推广信…")
    void onTask("update", {
      id: task.id,
      name: name.trim() || task.name,
      instruction,
      targets: targets.map((item) => item.label),
      quota,
      schedule,
      limitHours: limitHours || 0,
      enabled: true,
    })
      .then(() => onStart())
      .then((result) => setFlash(result?.flash || "本轮询单已跑完"))
      .catch(() => setFlash("没跑起来，再点一次"))
      .finally(() => setStarting(false))
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

  const unusedCustom = targets.filter((item) => !NEED_PRESETS.some((row) => row.label === item.label))

  return (
    <section className="inq-page">
      <header className="inq-page__head">
        <button type="button" className="inq-page__back" onClick={onBack}>
          返回
        </button>
        <div className="inq-page__title">
          <h2>{name || "询单任务"}</h2>
          <p>
            <span className="inq-badge">{TASK_LABEL[task.status]}</span>
            {ticketNo ? (
              <button type="button" className="inq-page__ticket" onClick={() => onOpenTicket(task.caseId!)}>
                {ticketNo}
              </button>
            ) : null}
          </p>
        </div>
        <div className="inq-page__ops">
          <button
            type="button"
            className="inq-save"
            disabled={locked || starting}
            onClick={() => {
              void persist(
                {
                  name: name.trim() || task.name,
                  instruction,
                  targets: targets.map((item) => item.label),
                  quota,
                  schedule,
                  limitHours: limitHours || 0,
                  enabled,
                },
                "草稿已保存",
              )
            }}
          >
            保存草稿
          </button>
          <button
            type="button"
            className="inq-go"
            disabled={starting || locked || !canStart}
            onClick={() => startRound()}
          >
            {starting ? "正在询单…" : "开始询单"}
          </button>
        </div>
      </header>
      {flash ? (
        <p className="inq-flash" role="status">
          {flash}
        </p>
      ) : null}

      <div className="inq-page__stack">
          <section className="inq-box">
            <h3 className="inq-box__title">任务设置</h3>

            <label className="inq-field">
              <span>任务名称</span>
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
              <span>补充指令</span>
              <textarea
                rows={2}
                value={instruction}
                maxLength={2000}
                placeholder="已知公开邮箱、对方网址，或这轮还要强调的产品卖点"
                onChange={(event) => setInstruction(event.target.value)}
                onBlur={() => {
                  if (instruction !== task.instruction) void persist({ instruction }, "指令已记下")
                }}
              />
            </label>

            <div className="inq-field">
              <span>厂家类型</span>
              <ul className="inq-tokens">
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
            </div>

            <div className="inq-field">
              <span>对方痛点</span>
              <ul className="inq-tokens">
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
                  <li key={item.id}>
                    <button type="button" aria-pressed="true" onClick={() => toggleNeed(item.label)}>
                      {item.label} ×
                    </button>
                  </li>
                ))}
              </ul>
              <form className="inq-add" onSubmit={(event) => addChip(event)}>
                <input value={chip} onChange={(event) => setChip(event.target.value)} placeholder="补充一条" maxLength={80} />
                <button type="submit" disabled={!chip.trim()}>
                  加入
                </button>
              </form>
            </div>

            <div className="inq-field">
              <span>目标数量</span>
              <div className="inq-seg" role="group" aria-label="目标数量">
                {FIND_QUOTAS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={quota === item ? "is-on" : ""}
                    aria-pressed={quota === item}
                    onClick={() => {
                      setQuota(item)
                      setFlash(`找 ${item} 家`)
                      void persist({ quota: item }, `已记下：找 ${item} 家`)
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="inq-field">
              <span>时限</span>
              <div className="inq-seg" role="group" aria-label="时限">
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
                    {hours}h
                  </button>
                ))}
              </div>
            </div>

            <div className="inq-field">
              <span>执行节奏</span>
              <div className="inq-inline">
                <select
                  value={schedule.kind}
                  onChange={(event) => {
                    const next: InquirySchedule = { ...schedule, kind: event.target.value as InquiryScheduleKind }
                    setSchedule(next)
                    const label = SCHEDULE_KIND.find((item) => item.key === next.kind)?.label || "节奏"
                    setFlash(label)
                    void persist({ schedule: next }, `已记下：${label}`)
                  }}
                >
                  {SCHEDULE_KIND.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
                {needsHour(schedule.kind) ? (
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
                ) : null}
                {schedule.kind === "interval" ? (
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
                ) : null}
              </div>
              {taskIsDue(task) ? <p className="inq-due">已到点，可再开始一轮。</p> : null}
            </div>

            <div className="inq-box__foot">
              {!canStart && task.status === "cancelled" ? <p className="inq-foot">已取消的任务请另建一轮。</p> : null}
              {!canStart && task.status !== "cancelled" ? <p className="inq-foot">先选定一种需求，或写一条指令。</p> : null}
            </div>
          </section>

          <section className="inq-box">
            <div className="inq-box__head">
              <h3 className="inq-box__title">执行进度</h3>
              <span>
                {inquiry.findings.length} / {quota}
              </span>
            </div>
            <p className="inq-step-note">{starting ? "正在网上找公开邮箱并起草推广信…" : note}</p>
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
            {inquiry.findings.length === 0 ? (
              <div className="inq-wait">
                <p className="inq-empty">等待开始</p>
                <p>找到带公开邮箱或可核验来源的对象后写在这里。</p>
              </div>
            ) : (
              <ul className="inq-results">
                {inquiry.findings.map((item) => (
                  <li key={item.id}>
                    <FindingCard item={item} open={open} onOpen={setOpen} onFile={() => void onFile(item.id)} onOpenTicket={onOpenTicket} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <details className="inq-more">
            <summary>运行历史{task.runs.length ? ` · ${task.runs.length}` : ""}</summary>
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
          </details>

          <section className="inq-box inq-box--manage">
            <h3 className="inq-box__title">任务</h3>
            <div className="inq-manage">
              <div>
                <strong>启用</strong>
                <p>关掉后不会按节奏再跑。</p>
              </div>
              <label className={`inq-switch${enabled ? " is-on" : ""}`}>
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={task.status === "cancelled"}
                  onChange={(event) => {
                    const on = event.target.checked
                    setEnabled(on)
                    if (on && canStart) {
                      setFlash("已启用，正在开始询单…")
                      startRound()
                      return
                    }
                    setFlash(on ? "已启用" : "已停用")
                    void persist({ enabled: on }, on ? "已启用" : "已停用")
                  }}
                />
                <i />
                <span>{enabled ? "开" : "关"}</span>
              </label>
            </div>
            <div className="inq-manage">
              <div>
                <strong>取消本轮</strong>
                <p>寻找停下，任务和本页工单会留着。</p>
              </div>
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
            </div>
            <div className="inq-manage inq-manage--danger">
              <div>
                <strong>删除任务</strong>
                <p>这个询单任务和本页工单一并去掉。</p>
              </div>
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
          </section>
      </div>
    </section>
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
