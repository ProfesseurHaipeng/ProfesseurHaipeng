import { useEffect, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { cloneJson } from "../cms/clone"
import { defaultContent } from "../cms/defaultContent"
import { emptyGapCount } from "../cms/gaps"
import { mergeContent } from "../cms/merge"
import {
  clearDraft,
  downloadContent,
  publishContent,
  readDraft,
  readImportedFile,
  setPreviewDraft,
  writeDraft,
} from "../cms/store"
import type { ContentModuleId, SiteContent } from "../cms/types"
import { withBase } from "../lib/asset"
import { ModuleEditor, moduleMeta } from "./editors"
import { HermesDesk } from "./HermesDesk"
import { LeadsPanel, type AdminAuth } from "./LeadsPanel"
import "./admin.css"

const LOCAL_UNLOCK = "ash-draft"
const AUTH_KEY = "ash-admin-auth"

function readStoredAuth(): AdminAuth | null {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AdminAuth
    return parsed.user && parsed.pass ? parsed : null
  } catch {
    return null
  }
}

type AdminView = "leads" | "hermes" | "cms"

export function AdminApp() {
  const [auth, setAuth] = useState<AdminAuth | null>(() => readStoredAuth())
  const [user, setUser] = useState("")
  const [password, setPassword] = useState("")
  const [checking, setChecking] = useState(false)
  const [view, setView] = useState<AdminView>("leads")
  const [moduleId, setModuleId] = useState<ContentModuleId>("gaps")
  const [content, setContent] = useState<SiteContent>(() =>
    mergeContent(readDraft() ?? defaultContent),
  )
  const [saved, setSaved] = useState(() => JSON.stringify(mergeContent(readDraft() ?? defaultContent)))
  const [message, setMessage] = useState("")
  const dirty = JSON.stringify(content) !== saved

  useEffect(() => {
    document.title = "内容后台 · 火山灰"
  }, [])

  useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      if (!dirty) return
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", onLeave)
    return () => window.removeEventListener("beforeunload", onLeave)
  }, [dirty])

  const unlock = async (event: FormEvent) => {
    event.preventDefault()
    const account = user.trim()
    if (!account || !password) {
      setMessage("请输入账号和密码。")
      return
    }
    setChecking(true)
    setMessage("")
    let ok = false
    try {
      const response = await fetch(withBase("api/leads"), {
        headers: { "X-Admin-User": account, "X-Admin-Pass": password },
      })
      if (response.ok) {
        ok = true
      } else if (response.status === 401) {
        setMessage("账号或密码不对。")
      } else {
        setMessage(`后台接口异常（${response.status}），稍后再试。`)
      }
    } catch {
      // Static builds have no API; keep the local-only fallback for drafts.
      if (account === "admin" && password === LOCAL_UNLOCK) ok = true
      else setMessage("连不上后台接口，请检查网络。")
    }
    setChecking(false)
    if (!ok) return
    const next = { user: account, pass: password }
    sessionStorage.setItem(AUTH_KEY, JSON.stringify(next))
    setAuth(next)
  }

  const logout = () => {
    sessionStorage.removeItem(AUTH_KEY)
    setAuth(null)
    setPassword("")
  }

  const saveDraft = () => {
    const next = writeDraft(content)
    setContent(next)
    setSaved(JSON.stringify(next))
    setMessage("草稿已保存在这台浏览器里。前台要看到改动，请点「前台预览草稿」。")
  }

  const preview = () => {
    writeDraft(content)
    setPreviewDraft(true)
    window.open("/?preview=1", "_blank", "noopener")
    setMessage("已打开前台预览。关掉预览后，访客仍只看到已发布内容。")
  }

  const stopPreview = () => {
    setPreviewDraft(false)
    setMessage("已停止前台预览草稿。")
  }

  const resetPublished = () => {
    const next = cloneJson(defaultContent)
    setContent(next)
    setSaved(JSON.stringify(next))
    clearDraft()
    setPreviewDraft(false)
    setMessage("已回到仓库里的已发布稿。")
  }

  const onImport = async (file: File | undefined) => {
    if (!file) return
    try {
      const next = await readImportedFile(file)
      setContent(next)
      setSaved("")
      setMessage("已读入 JSON，记得再保存草稿或发布。")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "导入失败")
    }
  }

  const onPublish = async () => {
    try {
      await publishContent(content, auth?.pass || LOCAL_UNLOCK)
      const next = writeDraft(content)
      setSaved(JSON.stringify(next))
      setMessage("已发布到站点存储。若在本地 Vite 里，这个接口还不存在，请改用导出 JSON。")
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `发布未完成：${error.message}。本地可先导出 JSON。`
          : "发布未完成。",
      )
    }
  }

  if (!auth) {
    return (
      <main className="admin-gate">
        <form onSubmit={(event) => void unlock(event)}>
          <p className="latin-kicker">Back office</p>
          <h1>网站后台</h1>
          <p>查看前台线索、Hermes 工作台，管理官网文案。</p>
          <label>
            账号
            <input
              value={user}
              onChange={(e) => setUser(e.target.value)}
              autoComplete="username"
              placeholder="admin"
            />
          </label>
          <label>
            密码
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <button className="btn" type="submit" disabled={checking}>
            {checking ? "正在验证…" : "登录"}
          </button>
          {message ? <p className="notice notice--warn">{message}</p> : null}
          <p>
            <Link to="/">返回前台</Link>
          </p>
        </form>
      </main>
    )
  }

  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <p className="latin-kicker">Back office</p>
        <h1>网站后台</h1>
        <p className="admin-hint">还空着 {emptyGapCount(content)} 项对外信息</p>
        <nav>
          <button
            type="button"
            className={view === "leads" ? "is-active" : ""}
            onClick={() => setView("leads")}
          >
            前台线索
          </button>
          <button
            type="button"
            className={view === "hermes" ? "is-active" : ""}
            onClick={() => setView("hermes")}
          >
            Hermes 工作台
          </button>
          {moduleMeta.map((item) => (
            <button
              key={item.id}
              type="button"
              className={view === "cms" && moduleId === item.id ? "is-active" : ""}
              onClick={() => {
                setView("cms")
                setModuleId(item.id)
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <Link to="/">看前台</Link>
        <button type="button" className="admin-logout" onClick={logout}>
          退出登录
        </button>
      </aside>
      <section className="admin-main">
        {view === "leads" ? (
          <LeadsPanel auth={auth} />
        ) : view === "hermes" ? (
          <HermesDesk auth={auth} />
        ) : (
          <>
            <header className="admin-toolbar">
              <button type="button" className="btn" onClick={saveDraft}>
                {dirty ? "保存草稿（未存）" : "保存草稿"}
              </button>
              <button type="button" className="btn btn--ghost" onClick={preview}>
                前台预览草稿
              </button>
              <button type="button" className="btn btn--ghost" onClick={stopPreview}>
                停止预览
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => downloadContent(content)}>
                导出 JSON
              </button>
              <label className="btn btn--ghost">
                导入 JSON
                <input
                  className="sr-only"
                  type="file"
                  accept="application/json"
                  onChange={(e) => onImport(e.target.files?.[0])}
                />
              </label>
              <button type="button" className="btn btn--ghost" onClick={onPublish}>
                发布
              </button>
              <button type="button" className="btn btn--ghost" onClick={resetPublished}>
                恢复默认文案
              </button>
            </header>
            {message ? <p className="notice">{message}</p> : null}
            <p className="admin-hint">
              当前模块：{moduleMeta.find((item) => item.id === moduleId)?.label}
              。改完先保存草稿，再预览。数字和效果可以逐条改。
            </p>
            <ModuleEditor moduleId={moduleId} content={content} onChange={setContent} />
          </>
        )}
      </section>
    </div>
  )
}
