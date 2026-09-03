import { useState, type FormEvent } from "react"
import {
  JOB_LABEL,
  OUTREACH_LABEL,
  type InquiryFinding,
  type InquiryState,
} from "../cms/inquiryDesk"

const SUGGEST = ["土壤板结", "化肥成本高", "有机肥短缺", "水稻加工厂", "茶叶基地"]

export function InquiryPanel({
  inquiry,
  busy,
  onAdd,
  onRemove,
  onAssign,
}: {
  inquiry: InquiryState
  busy?: boolean
  onAdd: (label: string) => Promise<void>
  onRemove: (id: string) => Promise<void>
  onAssign: (message: string) => Promise<void>
}) {
  const [label, setLabel] = useState("")
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
        ? `按这些厂商弊端 / 对口类型去找真实厂商：${list}。没有来源不要编。找到后只起草询单，不要群发。`
        : "先记下：同事还没设定弊端。请提醒他们先设定要找的厂商类型，不要编造厂商。",
    )
  }

  return (
    <section className="hermes-inquiry">
      <header className="hermes-panel__who">
        <em>询单系统</em>
        <strong>同一 Hermes · 同一配置</strong>
        <span>
          {JOB_LABEL[inquiry.job.status]}
          {inquiry.job.brief ? ` · ${inquiry.job.brief}` : ""}
        </span>
      </header>
      <section className="hermes-fold is-open">
        <div className="hermes-fold__head">设定要找的厂商弊端</div>
        <div className="hermes-fold__body">
          <p className="hermes-grok__empty">写清楚弊端或对口类型。Karmenai 按这个去找，没有真实来源不会建档。</p>
          <div className="hermes-suggest">
            {SUGGEST.map((item) => (
              <button key={item} type="button" disabled={busy} onClick={() => void add(undefined, item)}>
                {item}
              </button>
            ))}
          </div>
          <form className="hermes-target-form" onSubmit={(event) => void add(event)}>
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="例如：土壤板结的水稻加工厂"
              maxLength={80}
            />
            <button type="submit" disabled={!label.trim() || busy}>
              加入
            </button>
          </form>
          <ul className="hermes-chips">
            {inquiry.targets.map((item) => (
              <li key={item.id}>
                <span>{item.label}</span>
                <button type="button" disabled={busy} onClick={() => void onRemove(item.id)} aria-label={`去掉 ${item.label}`}>
                  ×
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="hermes-assign" disabled={busy} onClick={assign}>
            让 Karmenai 按这些条件去找
          </button>
        </div>
      </section>
      <section className="hermes-fold is-open">
        <div className="hermes-fold__head">找到的厂商</div>
        <div className="hermes-fold__body">
          {inquiry.findings.length === 0 ? (
            <p className="hermes-grok__empty">尚无。有真实来源后，每家厂会出现在这里，并带询单草稿。</p>
          ) : (
            <ul className="hermes-tickets__list">
              {inquiry.findings.map((item) => (
                <li key={item.id}>
                  <FindingCard item={item} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </section>
  )
}

function FindingCard({ item }: { item: InquiryFinding }) {
  return (
    <article className="hermes-ticket hermes-finding">
      <div className="hermes-ticket__body">
        <em>{OUTREACH_LABEL[item.outreach]}</em>
        <strong>{item.org}</strong>
        <span>
          {item.place || "地区尚无"}
          {item.pain ? ` · ${item.pain}` : ""}
        </span>
        <span>来源：{item.source || "尚无"}</span>
        {item.contact ? <span>{item.contact}</span> : null}
        {item.draft ? <p className="hermes-sum">{item.draft}</p> : null}
      </div>
    </article>
  )
}
