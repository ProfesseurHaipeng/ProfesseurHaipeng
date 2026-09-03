import { useCallback, useEffect, useState } from "react"
import type { Lead } from "../cms/leads"
import { withBase } from "../lib/asset"

export type AdminAuth = { user: string; pass: string }

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("zh-CN", { hour12: false })
  } catch {
    return iso
  }
}

export function LeadsPanel({ auth }: { auth: AdminAuth }) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch(withBase("api/leads"), {
        headers: { "X-Admin-User": auth.user, "X-Admin-Pass": auth.pass },
      })
      if (!response.ok) throw new Error(`接口返回 ${response.status}`)
      const payload = (await response.json()) as { leads?: Lead[] }
      setLeads(Array.isArray(payload.leads) ? payload.leads : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取失败")
    } finally {
      setLoading(false)
    }
  }, [auth.user, auth.pass])

  useEffect(() => {
    void load()
  }, [load])

  const attach = async (lead: Lead) => {
    try {
      const response = await fetch(withBase("api/hermes-desk"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-User": auth.user,
          "X-Admin-Pass": auth.pass,
        },
        body: JSON.stringify({ action: "attach", leadId: lead.id }),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(payload.error || `接口返回 ${response.status}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "接入失败")
    }
  }

  const remove = async (lead: Lead) => {
    if (!window.confirm(`删除 ${lead.name} 的这条线索？删除后无法恢复。`)) return
    try {
      const response = await fetch(`${withBase("api/leads")}?id=${encodeURIComponent(lead.id)}`, {
        method: "DELETE",
        headers: { "X-Admin-User": auth.user, "X-Admin-Pass": auth.pass },
      })
      if (!response.ok) throw new Error(`接口返回 ${response.status}`)
      setLeads((current) => current.filter((item) => item.id !== lead.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败")
    }
  }

  return (
    <div className="admin-leads">
      <header className="admin-leads__head">
        <div>
          <h2>前台线索</h2>
          <p className="admin-hint">
            访客在「联络 · 留一条线索」提交后会记录在这里{leads.length ? `，当前 ${leads.length} 条` : ""}。接入工作台后会出现在工单档案。
          </p>
        </div>
        <button type="button" className="btn btn--ghost" onClick={() => void load()} disabled={loading}>
          {loading ? "正在刷新…" : "刷新"}
        </button>
      </header>
      {error ? <p className="notice notice--warn">{error}</p> : null}
      {!loading && !error && leads.length === 0 ? (
        <p className="admin-leads__empty">还没有线索。前台提交后这里会出现记录。</p>
      ) : null}
      <ul className="admin-leads__list">
        {leads.map((lead) => (
          <li key={lead.id} className="admin-lead">
            <header>
              <strong>{lead.name}</strong>
              {lead.source === "ai" ? <span className="admin-lead__ai">AI 工单</span> : null}
              {lead.org ? <span className="admin-lead__org">{lead.org}</span> : null}
              <time dateTime={lead.at}>{formatTime(lead.at)}</time>
              {lead.place ? <span className="admin-lead__place">{lead.place}</span> : null}
            </header>
            <p className="admin-lead__note">{lead.note}</p>
            <footer>
              {lead.email ? (
                <a className="text-link" href={`mailto:${lead.email}`}>
                  {lead.email}
                </a>
              ) : (
                <span className="admin-lead__contact">{lead.contact || "未留联系方式"}</span>
              )}
              <button type="button" className="admin-lead__attach" onClick={() => void attach(lead)}>
                接入工作台
              </button>
              <button type="button" className="admin-lead__delete" onClick={() => void remove(lead)}>
                删除
              </button>
            </footer>
          </li>
        ))}
      </ul>
    </div>
  )
}
