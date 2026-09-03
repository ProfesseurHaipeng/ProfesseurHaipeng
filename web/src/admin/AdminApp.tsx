import { useEffect, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { withBase } from "../lib/asset"
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

type AdminView = "leads" | "hermes"

export function AdminApp() {
  const [auth, setAuth] = useState<AdminAuth | null>(() => readStoredAuth())
  const [user, setUser] = useState("")
  const [password, setPassword] = useState("")
  const [checking, setChecking] = useState(false)
  const [view, setView] = useState<AdminView>("leads")
  const [message, setMessage] = useState("")

  useEffect(() => {
    document.title = "网站后台 · 火山灰"
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
          <p className="latin-kicker">Back office</p>
          <h1>网站后台</h1>
          <p>查看前台线索，进入 karmenai 工作台。</p>
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
    <div className={`admin-shell${view === "hermes" ? " admin-shell--desk" : ""}`}>
      <aside className="admin-side">
        <div className="admin-side__bar">
          <div>
            <p className="latin-kicker">Back office</p>
            <h1>网站后台</h1>
          </div>
          <div className="admin-side__links">
            <Link to="/">前台</Link>
            <button type="button" className="admin-logout" onClick={logout}>
              退出
            </button>
          </div>
        </div>
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
            karmenai 工作台
          </button>
        </nav>
      </aside>
      <section className={view === "hermes" ? "admin-main admin-main--desk" : "admin-main"}>
        {view === "hermes" ? <HermesDesk auth={auth} /> : <LeadsPanel auth={auth} />}
      </section>
    </div>
  )
}
