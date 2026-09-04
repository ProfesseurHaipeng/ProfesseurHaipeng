import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react"
import { IconMore, IconSearch } from "./icons"
import {
  CASE_CATEGORIES,
  CASE_CATEGORY_LABEL,
  CASE_COLORS,
  PROGRESS_LABEL,
  PROGRESS_TRACK,
  customerArchives,
  customerKey,
  factoryArchives,
  filterHermesCases,
  normalizeCase,
  ticketNo,
  ticketsForCustomer,
  type CaseCategory,
  type CaseColor,
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

function caseTitle(item: HermesCase) {
  const note = item.note?.split(/[\n。]/)[0]?.trim()
  if (note && note.length > 0 && note.length <= 40) return note
  return item.org || item.name
}

export function TicketsPanel({
  cases,
  loading,
  query,
  onQueryChange,
  onSearch,
  initialView = "tickets",
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
  initialView?: TicketView
  focusId?: string
  onOpenTicket: (id: string) => void
  onOpenCustomer: (key: string) => void
  onOpenFactory: (name: string) => void
  onUpdate: (id: string, patch: StaffCasePatch) => Promise<void>
  onDelete: (ids: string[]) => Promise<void>
  onBatchUpdate: (ids: string[], patch: StaffCasePatch) => Promise<void>
}) {
  const [view, setView] = useState<TicketView>(initialView)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editId, setEditId] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [batchProgress, setBatchProgress] = useState<HermesProgress>("talking")
  const [batchColor, setBatchColor] = useState<CaseColor>("none")
  const [batchCategory, setBatchCategory] = useState<CaseCategory>("unset")
  const [color, setColor] = useState<"all" | CaseColor>("all")
  const [progress, setProgress] = useState<"all" | HermesProgress>("all")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setView(initialView)
  }, [initialView])

  const live = useMemo(() => filterHermesCases(cases, { origin: "live" }).map(normalizeCase), [cases])
  const visible = useMemo(() => {
    const rows = filterHermesCases(cases, { origin: "live", query, color }).map(normalizeCase)
    return progress === "all" ? rows : rows.filter((item) => item.progress === progress)
  }, [cases, query, color, progress])
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
    if (!ids.length || busy) return
    if (!window.confirm(`删除 ${ids.length} 张工单？删除后无法恢复。`)) return
    setBusy(true)
    try {
      await onDelete(ids)
      setSelected((current) => new Set([...current].filter((id) => !ids.includes(id))))
      if (editId && ids.includes(editId)) setEditId(null)
    } finally {
      setBusy(false)
    }
  }

  const applyBatchProgress = async () => {
    const ids = [...selected]
    if (!ids.length || busy) return
    setBusy(true)
    try {
      await onBatchUpdate(ids, { progress: batchProgress })
      clearSelection()
    } finally {
      setBusy(false)
    }
  }

  const applyBatchTag = async () => {
    const ids = [...selected]
    if (!ids.length || busy) return
    setBusy(true)
    try {
      await onBatchUpdate(ids, { color: batchColor, category: batchCategory })
      clearSelection()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="desk-tickets">
      <header className="desk-tickets__head">
        <h2>
          工单档案
          <em>{visible.length}</em>
        </h2>
      </header>

      <form className="desk-tickets__search" onSubmit={onSearch}>
        <IconSearch />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索工单、客户、邮箱"
        />
      </form>

      <nav className="desk-tickets__views" aria-label="档案视图">
        <button type="button" className={view === "tickets" ? "is-on" : ""} onClick={() => setView("tickets")}>
          工单 {visible.length}
        </button>
        <button type="button" className={view === "customers" ? "is-on" : ""} onClick={() => setView("customers")}>
          客户 {customers.length}
        </button>
        <button type="button" className={view === "factories" ? "is-on" : ""} onClick={() => setView("factories")}>
          工厂 {factories.length}
        </button>
      </nav>

      <div className="desk-tickets__filters" aria-label="归类筛选">
        <label className="desk-tickets__select">
          <span className="sr-only">全部状态</span>
          <select value={progress} onChange={(event) => setProgress(event.target.value as "all" | HermesProgress)}>
            <option value="all">全部状态</option>
            {[...PROGRESS_TRACK, "hold" as const].map((step) => (
              <option key={step} value={step}>
                {PROGRESS_LABEL[step]}
              </option>
            ))}
          </select>
        </label>
        <div className="desk-tickets__colors">
          <span>颜色标签</span>
          {CASE_COLORS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`desk-color${color === item.key ? " is-on" : ""}`}
              style={{ "--swatch": item.swatch } as CSSProperties}
              onClick={() => setColor(color === item.key ? "all" : item.key)}
              aria-label={item.label}
            />
          ))}
        </div>
      </div>

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
              <select value={batchColor} onChange={(event) => setBatchColor(event.target.value as CaseColor)}>
                {CASE_COLORS.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select value={batchCategory} onChange={(event) => setBatchCategory(event.target.value as CaseCategory)}>
                {CASE_CATEGORIES.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => void applyBatchTag()}>
                批量打标
              </button>
              <button type="button" className="is-danger" disabled={busy} onClick={() => void confirmDelete([...selected])}>
                {busy ? "正在删除…" : "删除选中"}
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
            <li
              key={item.id}
              className={`desk-row desk-row--${item.color || "none"}${focusId === item.id ? " is-focus" : ""}`}
            >
              <label className="desk-tickets__check">
                <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} />
              </label>
              <button type="button" className="desk-ticket" onClick={() => onOpenTicket(item.id)}>
                <i
                  className="desk-ticket__dot"
                  style={{
                    background: CASE_COLORS.find((row) => row.key === (item.color || "none"))?.swatch || "#34c759",
                  }}
                  aria-hidden="true"
                />
                <div className="desk-ticket__body">
                  <em>{ticketNo(item)}</em>
                  <strong>{caseTitle(item)}</strong>
                  <span>
                    {item.name} · {PROGRESS_LABEL[item.progress]}
                    {item.category && item.category !== "unset" ? ` · ${CASE_CATEGORY_LABEL[item.category]}` : ""}
                  </span>
                </div>
                <time dateTime={item.updatedAt}>{formatTime(item.updatedAt)}</time>
              </button>
              <div className="desk-ticket__ops">
                <button type="button" className="karm-icon-btn" aria-label="工单菜单" onClick={() => setMenuId(menuId === item.id ? null : item.id)}>
                  <IconMore />
                </button>
                {menuId === item.id ? (
                  <div className="karm-menu">
                    <button type="button" onClick={() => { setMenuId(null); setEditId(item.id) }}>
                      编辑
                    </button>
                    <button type="button" className="is-danger" onClick={() => { setMenuId(null); void confirmDelete([item.id]) }}>
                      删除
                    </button>
                  </div>
                ) : null}
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
                    <em>客户档案</em>
                    <strong>{item.name}</strong>
                    <span>
                      {item.org || "公司尚无"} · {owned.length} 张工单 · {PROGRESS_LABEL[item.progress]}
                    </span>
                  </div>
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
                  <em>工厂档案</em>
                  <strong>{row.name}</strong>
                  <span>
                    {row.count} 张工单 · {PROGRESS_LABEL[row.latest.progress]}
                  </span>
                </div>
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

export function TicketEditDialog({
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
  const [tagColor, setTagColor] = useState<CaseColor>(item.color || "none")
  const [tagCategory, setTagCategory] = useState<CaseCategory>(item.category || "unset")
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
        color: tagColor,
        category: tagCategory,
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
          颜色标签
          <select value={tagColor} onChange={(event) => setTagColor(event.target.value as CaseColor)}>
            {CASE_COLORS.map((row) => (
              <option key={row.key} value={row.key}>
                {row.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          分类
          <select value={tagCategory} onChange={(event) => setTagCategory(event.target.value as CaseCategory)}>
            {CASE_CATEGORIES.map((row) => (
              <option key={row.key} value={row.key}>
                {row.label}
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
