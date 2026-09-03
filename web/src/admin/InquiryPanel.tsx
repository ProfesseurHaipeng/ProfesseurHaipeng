import { useState, type FormEvent } from "react"
import {
  INQUIRY_RUN,
  JOB_LABEL,
  OUTREACH_LABEL,
  buildInquiryAssignMessage,
  inquiryPromptPreview,
  inquiryRunHint,
  inquiryStepFill,
  type InquiryFinding,
  type InquiryState,
} from "../cms/inquiryDesk"

const SUGGEST = ["土壤板结", "化肥成本高", "有机肥短缺", "水稻加工厂", "茶叶基地"]

export function InquiryPanel({
  inquiry,
  busy,
  hermesReady,
  onAdd,
  onRemove,
  onAssign,
  onFile,
  onOpenTicket,
}: {
  inquiry: InquiryState
  busy?: boolean
  hermesReady?: boolean
  onAdd: (label: string) => Promise<void>
  onRemove: (id: string) => Promise<void>
  onAssign: (message: string) => Promise<void>
  onFile: (findingId: string) => Promise<void>
  onOpenTicket: (caseId: string) => void
}) {
  const [label, setLabel] = useState("")
  const [showPrompt, setShowPrompt] = useState(false)
  const [open, setOpen] = useState<{ id: string; kind: "source" | "draft" } | null>(null)
  const preview = inquiryPromptPreview(inquiry)
  const add = async (event?: FormEvent, next = label) => {
    event?.preventDefault()
    const text = next.trim()
    if (!text || busy) return
    await onAdd(text)
    setLabel("")
  }
  const assign = () => {
    if (busy) return
    void onAssign(buildInquiryAssignMessage(inquiry.targets))
  }
  const unusedSuggest = SUGGEST.filter((item) => !inquiry.targets.some((row) => row.label === item))
  const hint = inquiryRunHint(inquiry.job.status, inquiry.targets.length)
  const note =
    inquiry.job.status === "searching" && !hermesReady
      ? "任务已记下。网关接通后 Karmenai 才会找来源，没有来源不建档。"
      : inquiry.job.brief
        ? `${hint} · ${inquiry.job.brief}`
        : hint

  return (
    <section className="inq-board">
      <header className="inq-board__top">
        <div>
          <h2>询单设定</h2>
          <p className="inq-board__hint">条件会写入 Karmenai 的系统提示；点「开始寻找」后还会发一条明确指令到对话。</p>
        </div>
        <span className="inq-board__status">{preview.jobLabel}</span>
      </header>

      <article className="inq-card">
        <p className="inq-card__mark">A · 要找什么</p>
        <h3>厂商弊端 / 对口类型</h3>
        {inquiry.targets.length || unusedSuggest.length ? (
          <ul className="inq-tags">
            {inquiry.targets.map((item) => (
              <li key={item.id} className="is-on">
                <span>{item.label}</span>
                <button type="button" disabled={busy} onClick={() => void onRemove(item.id)} aria-label={`去掉 ${item.label}`}>
                  ×
                </button>
              </li>
            ))}
            {unusedSuggest.map((item) => (
              <li key={item}>
                <button type="button" disabled={busy} onClick={() => void add(undefined, item)}>
                  {item}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="inq-empty">还没有条件。加入后 Karmenai 每次对话都会读到。</p>
        )}
        <form className="inq-add" onSubmit={(event) => void add(event)}>
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="输入弊端或对口类型"
            maxLength={80}
          />
          <button type="submit" disabled={!label.trim() || busy}>
            加入
          </button>
        </form>

        {preview.targetCount > 0 ? (
          <div className="inq-prompt">
            <button type="button" className="inq-prompt__toggle" onClick={() => setShowPrompt((v) => !v)}>
              {showPrompt ? "收起" : "查看"}发给 Karmenai 的内容
            </button>
            {showPrompt ? (
              <>
                <p className="inq-prompt__label">点击「开始寻找」时发送的指令</p>
                <pre className="inq-prompt__box">{preview.userMessage}</pre>
                <p className="inq-prompt__label">每次对话附带的系统上下文（节选）</p>
                <pre className="inq-prompt__box inq-prompt__box--sys">{preview.systemExcerpt}</pre>
              </>
            ) : (
              <p className="inq-prompt__summary">
                已设定 {preview.targetCount} 条条件
                {preview.findingCount ? ` · 找到 ${preview.findingCount} 家` : ""}
              </p>
            )}
          </div>
        ) : null}

        <button type="button" className="inq-go" disabled={busy || !preview.targetCount} onClick={assign}>
          开始寻找
        </button>
        {!preview.targetCount ? <p className="inq-foot">先加入至少一条条件，再开始寻找。</p> : null}
      </article>

      <article className="inq-card inq-card--run">
        <div className="inq-run-head">
          <div>
            <p className="inq-card__mark">B · 进度</p>
            <p className="inq-step-note">{busy ? "正在写入工作台…" : note}</p>
          </div>
          <ol className="inq-steps inq-steps--compact">
            {INQUIRY_RUN.map((step, index) => {
              const fill = inquiryStepFill(inquiry.job.status, inquiry.targets.length, index)
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
            <p className="inq-card__mark">C · 结果</p>
            <span>{inquiry.findings.length ? `${inquiry.findings.length} 家` : JOB_LABEL[inquiry.job.status]}</span>
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

      <p className="inq-foot">建档会写入工单档案。站点没有发信接口，询单只起草、不群发。</p>
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
      <FindingOps item={item} shown={shown} busy={busy} onOpen={onOpen} onFile={onFile} onOpenTicket={onOpenTicket} />
      {shown ? <p className="inq-result__detail">{shown === "source" ? item.source || "来源尚无" : item.draft || "草稿尚无"}</p> : null}
    </article>
  )
}

function FindingOps({
  item,
  shown,
  busy,
  onOpen,
  onFile,
  onOpenTicket,
}: {
  item: InquiryFinding
  shown: "source" | "draft" | null
  busy?: boolean
  onOpen: (next: { id: string; kind: "source" | "draft" } | null) => void
  onFile: () => void
  onOpenTicket: (caseId: string) => void
}) {
  return (
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
  )
}
