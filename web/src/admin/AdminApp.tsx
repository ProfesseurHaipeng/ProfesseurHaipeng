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
  SESSION_KEY,
  setPreviewDraft,
  writeDraft,
} from "../cms/store"
import type { ContentModuleId, SiteContent } from "../cms/types"
import { ModuleEditor, moduleMeta } from "./editors"
import "./admin.css"

const LOCAL_UNLOCK = "ash-draft"

export function AdminApp() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(SESSION_KEY) === "1")
  const [password, setPassword] = useState("")
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

  const unlock = (event: FormEvent) => {
    event.preventDefault()
    if (password !== LOCAL_UNLOCK) {
      setMessage("口令不对。")
      return
    }
    sessionStorage.setItem(SESSION_KEY, "1")
    setAuthed(true)
    setMessage("")
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
      await publishContent(content, password || LOCAL_UNLOCK)
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

  if (!authed) {
    return (
      <main className="admin-gate">
        <form onSubmit={unlock}>
          <p className="latin-kicker">Content desk</p>
          <h1>内容后台</h1>
          <p>改官网文案、数字、案例和导航。</p>
          <label>
            口令
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <button className="btn" type="submit">
            进入
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
        <p className="latin-kicker">CMS</p>
        <h1>内容后台</h1>
        <p className="admin-hint">还空着 {emptyGapCount(content)} 项对外信息</p>
        <nav>
          {moduleMeta.map((item) => (
            <button
              key={item.id}
              type="button"
              className={moduleId === item.id ? "is-active" : ""}
              onClick={() => setModuleId(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <Link to="/">看前台</Link>
      </aside>
      <section className="admin-main">
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
          <label className="admin-field admin-field--inline">
            <span>发布口令</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="ash-draft"
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
          当前模块：{moduleMeta.find((item) => item.id === moduleId)?.label}。改完先保存草稿，再预览。数字和效果可以逐条改。
        </p>
        <ModuleEditor moduleId={moduleId} content={content} onChange={setContent} />
      </section>
    </div>
  )
}
