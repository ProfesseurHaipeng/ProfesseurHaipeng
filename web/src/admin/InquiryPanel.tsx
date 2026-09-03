import { useState, type FormEvent } from "react"
import {
  INQUIRY_RUN,
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
  const [open, setOpen] = useState<{ id: string; kind: "source" | "draft" } | null>(null)
  const add = async (event?: FormEvent, next = label) => {
    event?.preventDefault()
    const text = next.trim()
    if (!text || busy) return
    await onAdd(text)
    setLabel("")
  }
  const assign = () => {
    if (busy) return
    const list = inquiry.targets.map((item) => item.label).join("、")
    void onAssign(
      list
        ? `按这些厂商弊端 / 对口类型去找真实厂商：${list}。流程按 取条件 → 找来源 → 核实 → 起草稿。没有来源不要编。找到后只起草询单，不要群发。`
        : "先记下：同事还没设定弊端。请提醒他们先设定要找的厂商类型，不要编造厂商。",
    )
  }
  const unusedSuggest = SUGGEST.filter((item) => !inquiry.targets.some((row) => row.label === item))
  const hint = inquiryRunHint(inquiry.job.status, inquiry.targets.length)
  const note =
    inquiry.job.status === "searching" && !hermesReady
      ? "任务已记下。网关接通后才会找来源，没有来源不建档。"
      : inquiry.job.brief
        ? `${hint} ${inquiry.job.brief}`
        : hint

  return (
    <section className="inq-board">
      <header className="inq-board__top">
        <h2>Karmenai · 询单系统</h2>
      </header>

      <article className="inq-card">
        <p className="inq-card__mark">A) 条件设定</p>
        <h3>设定要找的厂商弊端</h3>
        <p>写清楚弊端或对口类型。Karmenai 按这个去找，没有真实来源不会建档。</p>
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
        ) : null}
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
        <button type="button" className="inq-go" disabled={busy} onClick={assign}>
          让 Karmenai 按这些条件去找
        </button>
      </article>

      <article className="inq-card">
        <p className="inq-card__mark">B) 运行中</p>
        <ol className="inq-steps">
          {INQUIRY_RUN.map((step, index) => {
            const fill = inquiryStepFill(inquiry.job.status, inquiry.targets.length, index)
            return (
              <li key={step.key} className={`is-${fill}`}>
                <i />
                <span>{step.label}</span>
              </li>
            )
          })}
        </ol>
        <p className="inq-step-note">{busy ? "正在把任务写入工作台。" : note}</p>
      </article>

      <article className="inq-card">
        <p className="inq-card__mark">C) 结果行</p>
        {inquiry.findings.length === 0 ? (
          <p className="inq-empty">尚无。有真实来源后，每家厂会出现在这里，并带询单草稿。</p>
        ) : (
          <>
            <div className="inq-table-wrap">
              <table className="inq-table">
                <thead>
                  <tr>
                    <th>厂商</th>
                    <th>对口类型</th>
                    <th>来源</th>
                    <th>询单草稿</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {inquiry.findings.map((item) => (
                    <FindingRow
                      key={item.id}
                      item={item}
                      open={open}
                      busy={busy}
                      onOpen={setOpen}
                      onFile={() => void onFile(item.id)}
                      onOpenTicket={onOpenTicket}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="inq-cards">
              {inquiry.findings.map((item) => (
                <li key={item.id}>
                  <FindingMini
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
          </>
        )}
      </article>

      <p className="inq-foot">建档会写入工单档案。站点没有发信接口，所以没有群发。</p>
    </section>
  )
}

function shortText(value: string | undefined, empty = "尚无") {
  const text = (value || "").replace(/\s+/g, " ").trim()
  if (!text) return empty
  return text.length > 24 ? `${text.slice(0, 24)}…` : text
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

function FindingRow({
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
    <>
      <tr>
        <td>{item.org}</td>
        <td>{item.pain || "尚无"}</td>
        <td>{shortText(item.source)}</td>
        <td>{shortText(item.draft)}</td>
        <td>
          <FindingOps item={item} shown={shown} busy={busy} onOpen={onOpen} onFile={onFile} onOpenTicket={onOpenTicket} />
        </td>
      </tr>
      {shown ? (
        <tr className="inq-table__detail">
          <td colSpan={5}>{shown === "source" ? item.source || "来源尚无" : item.draft || "草稿尚无"}</td>
        </tr>
      ) : null}
    </>
  )
}

function FindingMini({
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
    <article className="inq-mini">
      <strong>{item.org}</strong>
      <span>{item.pain || "对口类型尚无"}</span>
      <FindingOps item={item} shown={shown} busy={busy} onOpen={onOpen} onFile={onFile} onOpenTicket={onOpenTicket} />
      {shown ? <p>{shown === "source" ? item.source || "来源尚无" : item.draft || "草稿尚无"}</p> : null}
    </article>
  )
}
