import { useEffect, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { withBase } from "../lib/asset"
import { HermesDesk, type DeskArea } from "./HermesDesk"
import {
  IconChevron,
  IconDesk,
  IconExternal,
  IconFolder,
  IconHome,
  IconInquiry,
  IconLeads,
  IconSettings,
} from "./icons"
import { LeadsPanel, type AdminAuth } from "./LeadsPanel"
import "./admin.css"

const LOCAL_UNLOCK = "ash-draft"
const AUTH_KEY = "ash-admin-auth"
const SIDE_KEY = "ash-admin-side"

type AdminView = DeskArea | "leads" | "settings"
type ArchiveView = "customers" | "factories"

function readSideOpen() {
  try {
    const stored = sessionStorage.getItem(SIDE_KEY)
    if (stored === "0") return false
    if (stored === "1") return true
  } catch {
    /* ignore */
  }
  return typeof window === "undefined" || window.matchMedia("(min-width: 861px)").matches
}

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

const VIEW_LABEL: Record<AdminView, string> = {
  overview: "总览",
  leads: "前台线索",
  desk: "工作台",
  inquiry: "询单任务",
  archives: "客户与工厂",
  settings: "设置",
}

export function AdminApp() {
  const [auth, setAuth] = useState<AdminAuth | null>(() => readStoredAuth())
  const [user, setUser] = useState("")
  const [password, setPassword] = useState("")
  const [checking, setChecking] = useState(false)
  const [view, setView] = useState<AdminView>("overview")
  const [archiveView, setArchiveView] = useState<ArchiveView>("customers")
  const [archivesOpen, setArchivesOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [sideOpen, setSideOpen] = useState(readSideOpen)

  const toggleSide = () => {
    setSideOpen((open) => {
      const next = !open
      try {
        sessionStorage.setItem(SIDE_KEY, next ? "1" : "0")
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const go = (next: AdminView, archive?: ArchiveView) => {
    setView(next)
    if (archive) {
      setArchiveView(archive)
      setArchivesOpen(true)
    }
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 860px)").matches) {
      setSideOpen(false)
      try {
        sessionStorage.setItem(SIDE_KEY, "0")
      } catch {
        /* ignore */
      }
    }
  }

  useEffect(() => {
    document.title = "Karmenai 项目工作台"
  }, [])

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

  if (!auth) {
    return (
      <main className="admin-gate">
        <form onSubmit={(event) => void unlock(event)}>
          <div className="admin-gate__brand">
            <span className="admin-mark" aria-hidden="true">
              K
            </span>
            <div>
              <p className="admin-gate__kicker">Karmenai</p>
              <h1>项目工作台</h1>
            </div>
          </div>
          <p>登录后查看工单、询单和档案，并指挥询单工位。前台高级顾问是另一席。</p>
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

  const deskMounted = true
  const deskVisible = view === "overview" || view === "desk" || view === "inquiry" || view === "archives"
  const deskArea: DeskArea = deskVisible ? view : "desk"

  return (
    <div
      className={`admin-shell admin-shell--desk admin-shell--karmenai${sideOpen ? "" : " is-side-collapsed"}`}
    >
      <aside className="admin-side">
        <div className="admin-side__brand">
          <span className="admin-mark" aria-hidden="true">
            K
          </span>
          {sideOpen ? (
            <div>
              <strong>Karmenai</strong>
              <span>项目工作台</span>
            </div>
          ) : null}
        </div>

        <nav className="admin-nav" aria-label="后台分区">
          <button type="button" className={view === "overview" ? "is-active" : ""} onClick={() => go("overview")}>
            <IconHome />
            <span>总览</span>
          </button>
          <button type="button" className={view === "leads" ? "is-active" : ""} onClick={() => go("leads")}>
            <IconLeads />
            <span>前台线索</span>
          </button>
          <button type="button" className={view === "desk" ? "is-active" : ""} onClick={() => go("desk")}>
            <IconDesk />
            <span>工作台</span>
          </button>
          <button type="button" className={view === "inquiry" ? "is-active" : ""} onClick={() => go("inquiry")}>
            <IconInquiry />
            <span>询单任务</span>
          </button>
          <div className={`admin-nav__group${archivesOpen || view === "archives" ? " is-open" : ""}`}>
            <button
              type="button"
              className={view === "archives" ? "is-active" : ""}
              aria-expanded={archivesOpen}
              onClick={() => {
                setArchivesOpen((open) => !open)
                if (view !== "archives") go("archives", archiveView)
              }}
            >
              <IconFolder />
              <span>客户与工厂</span>
              <IconChevron className="admin-nav__chev" />
            </button>
            {sideOpen && archivesOpen ? (
              <div className="admin-nav__sub">
                <button
                  type="button"
                  className={view === "archives" && archiveView === "customers" ? "is-active" : ""}
                  onClick={() => go("archives", "customers")}
                >
                  客户档案
                </button>
                <button
                  type="button"
                  className={view === "archives" && archiveView === "factories" ? "is-active" : ""}
                  onClick={() => go("archives", "factories")}
                >
                  工厂档案
                </button>
              </div>
            ) : null}
          </div>
        </nav>

        <div className="admin-side__foot">
          <Link className="admin-side__link" to="/">
            <IconExternal />
            <span>查看前台</span>
          </Link>
          <button type="button" className={view === "settings" ? "is-active" : ""} onClick={() => go("settings")}>
            <IconSettings />
            <span>设置</span>
          </button>
          <button type="button" className="admin-side__fold" onClick={toggleSide} aria-expanded={sideOpen}>
            {sideOpen ? "收起" : "展开"}
          </button>
          <div className="admin-who">
            <span className="admin-who__avatar" aria-hidden="true">
              L
            </span>
            {sideOpen ? (
              <div>
                <strong>Linda</strong>
                <span>项目负责人</span>
              </div>
            ) : null}
          </div>
        </div>
      </aside>

      <div className="admin-frame">
        <header className="admin-top">
          <div className="admin-top__brand">
            <span className="admin-mark admin-mark--sm" aria-hidden="true">
              K
            </span>
            <strong>Karmenai</strong>
          </div>
          <p className="admin-top__crumb">{VIEW_LABEL[view]}</p>
          <button type="button" className="admin-who admin-who--top" onClick={() => go("settings")} aria-label="设置">
            <span className="admin-who__avatar" aria-hidden="true">
              L
            </span>
          </button>
        </header>

        <section className="admin-main" hidden={deskVisible} aria-hidden={deskVisible}>
          {view === "leads" ? <LeadsPanel auth={auth} onAttached={() => go("desk")} /> : null}
          {view === "settings" ? <SettingsPanel auth={auth} onLogout={logout} /> : null}
        </section>

        <section className="admin-main admin-main--desk" hidden={!deskVisible} aria-hidden={!deskVisible}>
          {deskMounted ? (
            <HermesDesk
              auth={auth}
              area={deskArea}
              archiveView={archiveView}
              visible={deskVisible}
              onNeedDesk={() => go("desk")}
              onExpandSide={sideOpen ? undefined : toggleSide}
            />
          ) : null}
        </section>
      </div>

      <nav className="admin-dock" aria-label="移动导航">
        <button type="button" className={view === "overview" ? "is-active" : ""} onClick={() => go("overview")}>
          <IconHome />
          <span>总览</span>
        </button>
        <button type="button" className={view === "leads" ? "is-active" : ""} onClick={() => go("leads")}>
          <IconLeads />
          <span>线索</span>
        </button>
        <button type="button" className={view === "desk" ? "is-active" : ""} onClick={() => go("desk")}>
          <IconDesk />
          <span>工作台</span>
        </button>
        <button type="button" className={view === "inquiry" ? "is-active" : ""} onClick={() => go("inquiry")}>
          <IconInquiry />
          <span>询单</span>
        </button>
      </nav>
    </div>
  )
}

function SettingsPanel({ auth, onLogout }: { auth: AdminAuth; onLogout: () => void }) {
  return (
    <section className="admin-settings">
      <header>
        <h2>设置</h2>
        <p>账号与进出。工单、询单和档案里的对话都是同一个询单工位。</p>
      </header>
      <article className="admin-settings__card">
        <div className="admin-who">
          <span className="admin-who__avatar" aria-hidden="true">
            L
          </span>
          <div>
            <strong>Linda</strong>
            <span>项目负责人 · {auth.user}</span>
          </div>
        </div>
        <p>当前登录账号只用于打开本站后台，不会出现在客户对话里。</p>
        <div className="admin-settings__ops">
          <Link className="btn btn--ghost" to="/">
            查看前台
          </Link>
          <button type="button" className="btn" onClick={onLogout}>
            退出登录
          </button>
        </div>
      </article>
    </section>
  )
}
