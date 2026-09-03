import { useMemo, useState, type FormEvent } from "react"
import {
  PROGRESS_LABEL,
  PROGRESS_TRACK,
  customerArchives,
  customerKey,
  factoryArchives,
  factoryName,
  filterHermesCases,
  normalizeCase,
  ticketNo,
  ticketsForCustomer,
  type HermesCase,
  type HermesProgress,
  type StaffCasePatch,
} from "../cms/hermesDesk"

type TicketView = "tickets" | "customers" | "factories"

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("zh-CN", { hour12: false })
  } catch {
    return iso
  }
}

export function TicketsPanel({
  cases,
  loading,
  query,
  onQueryChange,
  onSearch,
  focusId,
  onOpenTicket,
  onOpenCustomer,
  onOpenFactory,
  onUpdate,
  onDelete,
  onBatchUpdate,
}: {
  cases: HermesCase[]
  loading?: boolean
  query: string
  onQueryChange: (value: string) => void
  onSearch: (event?: FormEvent) => void
  focusId?: string
  onOpenTicket: (id: string) => void
  onOpenCustomer: (key: string) => void
  onOpenFactory: (name: string) => void
  onUpdate: (id: string, patch: StaffCasePatch) => Promise<void>
  onDelete: (ids: string[]) => Promise<void>
  onBatchUpdate: (ids: string[], patch: StaffCasePatch) => Promise<void>
}) {
  const [view, setView] = useState<TicketView>("tickets")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editId, setEditId] = useState<string | null>(null)
  const [batchProgress, setBatchProgress] = useState<HermesProgress>("talking")

  const live = useMemo(() => filterHermesCases(cases, { origin: "live" }).map(normalizeCase), [cases])
  const visible = useMemo(() => filterHermesCases(cases, { origin: "live", query }).map(normalizeCase), [cases, query])
  const customers = useMemo(() => customerArchives(visible), [visible])
  const factories = useMemo(() => factoryArchives(visible), [visible])
  const editing = editId ? live.find((item) => item.id === editId) || null : null
  const selectedCount = selected.size

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const selectAllVisible = () => {
    if (view !== "tickets") return
    const ids = visible.map((item) => item.id)
    const allOn = ids.length > 0 && ids.every((id) => selected.has(id))
    setSelected(allOn ? new Set() : new Set(ids))
  }

  const clearSelection = () => setSelected(new Set())

  const confirmDelete = async (ids: string[]) => {
    if (!ids.length) return
    if (!window.confirm(`删除 ${ids.length} 张工单？删除后无法恢复。`)) return
    await onDelete(ids)
    setSelected(new Set())
    if (editId && ids.includes(editId)) setEditId(null)
  }

  const applyBatchProgress = async () => {
    const ids = [...selected]
    if (!ids.length) return
    await onBatchUpdate(ids, { progress: batchProgress })
    clearSelection()
  }

  return (
    <div className="desk-tickets">
      <header className="desk-tickets__head">
        <div>
          <h2>工单档案</h2>
          <p className="desk-tickets__hint">
            {visible.length ? `当前 ${visible.length} 张工单` : "还没有工单"} · 可搜索、编辑、批量删除
          </p>
        </div>
      </header>

      <form className="desk-tickets__search" onSubmit={onSearch}>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="工单号、手机、邮箱或公司"
        />
        <button type="submit">搜索</button>
      </form>

      <nav className="desk-tickets__views" aria-label="档案视图">
        <button type="button" className={view === "tickets" ? "is-on" : ""} onClick={() => setView("tickets")}>
          工单 {visible.length ? `(${visible.length})` : ""}
        </button>
        <button type="button" className={view === "customers" ? "is-on" : ""} onClick={() => setView("customers")}>
          客户 {customers.length ? `(${customers.length})` : ""}
        </button>
        <button type="button" className={view === "factories" ? "is-on" : ""} onClick={() => setView("factories")}>
          工厂 {factories.length ? `(${factories.length})` : ""}
        </button>
      </nav>

      {view === "tickets" && visible.length > 0 ? (
        <div className="desk-tickets__batch">
          <label className="desk-tickets__check-all">
            <input type="checkbox" checked={visible.length > 0 && visible.every((item) => selected.has(item.id))} onChange={selectAllVisible} />
            全选
          </label>
          {selectedCount > 0 ? (
            <>
              <span>{selectedCount} 张选中</span>
              <select value={batchProgress} onChange={(event) => setBatchProgress(event.target.value as HermesProgress)}>
                {PROGRESS_TRACK.map((step) => (
                  <option key={step} value={step}>
                    {PROGRESS_LABEL[step]}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => void applyBatchProgress()}>
                批量改进度
              </button>
              <button type="button" className="is-danger" onClick={() => void confirmDelete([...selected])}>
                删除选中
              </button>
              <button type="button" className="is-ghost" onClick={clearSelection}>
                取消
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {view === "tickets" ? (
        <ul className="desk-tickets__list">
          {visible.map((item) => (
            <li key={item.id} className={focusId === item.id ? "is-focus" : undefined}>
              <label className="desk-tickets__check">
                <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} />
              </label>
              <button type="button" className="desk-ticket" onClick={() => onOpenTicket(item.id)}>
                <div className="desk-ticket__body">
                  <em>{ticketNo(item)}</em>
                  <strong>{item.name}</strong>
                  <span>{item.org || "公司尚无"}</span>
                  <span>
                    {PROGRESS_LABEL[item.progress]}
                    {factoryName(item) ? ` · ${factoryName(item)}` : ""}
                  </span>
                  <time dateTime={item.updatedAt}>{formatTime(item.updatedAt)}</time>
                </div>
                <b aria-hidden="true">›</b>
              </button>
              <div className="desk-ticket__ops">
                <button type="button" onClick={() => setEditId(item.id)}>
                  编辑
                </button>
                <button type="button" className="is-danger" onClick={() => void confirmDelete([item.id])}>
                  删除
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {view === "customers" ? (
        <ul className="desk-tickets__list desk-tickets__list--simple">
          {customers.map((item) => {
            const owned = ticketsForCustomer(live, customerKey(item))
            return (
              <li key={customerKey(item)}>
                <button type="button" className="desk-ticket" onClick={() => onOpenCustomer(customerKey(item))}>
                  <div className="desk-ticket__body">
                    <em>客户</em>
                    <strong>{item.name}</strong>
                    <span>{item.org || "公司尚无"}</span>
                    <span>{owned.length} 张工单 · {PROGRESS_LABEL[item.progress]}</span>
                  </div>
                  <b aria-hidden="true">›</b>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}

      {view === "factories" ? (
        <ul className="desk-tickets__list desk-tickets__list--simple">
          {factories.map((row) => (
            <li key={row.name}>
              <button type="button" className="desk-ticket" onClick={() => onOpenFactory(row.name)}>
                <div className="desk-ticket__body">
                  <em>工厂</em>
                  <strong>{row.name}</strong>
                  <span>{row.count} 张工单</span>
                  <span>{PROGRESS_LABEL[row.latest.progress]}</span>
                </div>
                <b aria-hidden="true">›</b>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {!loading && view === "tickets" && visible.length === 0 ? (
        <p className="desk-tickets__empty">{query.trim() ? "没有匹配的工单。" : "还没有工单。前台对话或线索接入后会出现。"}</p>
      ) : null}
      {!loading && view === "customers" && customers.length === 0 ? (
        <p className="desk-tickets__empty">还没有客户档案。</p>
      ) : null}
      {!loading && view === "factories" && factories.length === 0 ? (
        <p className="desk-tickets__empty">还没有工厂档案。</p>
      ) : null}

      {editing ? (
        <TicketEditDialog
          item={editing}
          onClose={() => setEditId(null)}
          onSave={async (patch) => {
            await onUpdate(editing.id, patch)
            setEditId(null)
          }}
        />
      ) : null}
    </div>
  )
}

function TicketEditDialog({
  item,
  onClose,
  onSave,
}: {
  item: HermesCase
  onClose: () => void
  onSave: (patch: StaffCasePatch) => Promise<void>
}) {
  const [name, setName] = useState(item.name)
  const [org, setOrg] = useState(item.org)
  const [factory, setFactory] = useState(item.factory || "")
  const [contact, setContact] = useState(item.contact)
  const [place, setPlace] = useState(item.place || "")
  const [note, setNote] = useState(item.note)
  const [progress, setProgress] = useState(item.progress)
  const [nextAction, setNextAction] = useState(item.nextAction || "")
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        org: org.trim(),
        factory: factory.trim() || undefined,
        contact: contact.trim(),
        place: place.trim() || undefined,
        note: note.trim(),
        progress,
        nextAction: nextAction.trim() || undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="desk-edit" role="dialog" aria-modal="true" aria-labelledby="desk-edit-title">
      <form className="desk-edit__card" onSubmit={(event) => void submit(event)}>
        <header>
          <h3 id="desk-edit-title">编辑工单 {ticketNo(item)}</h3>
          <button type="button" className="desk-edit__close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>
        <label>
          称呼
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} />
        </label>
        <label>
          公司
          <input value={org} onChange={(event) => setOrg(event.target.value)} maxLength={200} />
        </label>
        <label>
          工厂
          <input value={factory} onChange={(event) => setFactory(event.target.value)} maxLength={200} />
        </label>
        <label>
          联系方式
          <input value={contact} onChange={(event) => setContact(event.target.value)} maxLength={200} />
        </label>
        <label>
          地区
          <input value={place} onChange={(event) => setPlace(event.target.value)} maxLength={80} />
        </label>
        <label>
          进度
          <select value={progress} onChange={(event) => setProgress(event.target.value as HermesProgress)}>
            {[...PROGRESS_TRACK, "hold" as const].map((step) => (
              <option key={step} value={step}>
                {PROGRESS_LABEL[step]}
              </option>
            ))}
          </select>
        </label>
        <label>
          线索 / 备注
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={2000} />
        </label>
        <label>
          下一步
          <input value={nextAction} onChange={(event) => setNextAction(event.target.value)} maxLength={200} />
        </label>
        <footer>
          <button type="button" className="is-ghost" onClick={onClose}>
            取消
          </button>
          <button type="submit" disabled={saving || !name.trim()}>
            {saving ? "保存中…" : "保存"}
          </button>
        </footer>
      </form>
    </div>
  )
}
