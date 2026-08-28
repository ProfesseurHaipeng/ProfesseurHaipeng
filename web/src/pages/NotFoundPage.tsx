import { Link } from "react-router-dom"

export function NotFoundPage() {
  return (
    <article className="page">
      <header className="page-intro">
        <p className="latin-kicker">Missing layer</p>
        <h1>这一页还没有</h1>
        <p className="lead">回到已有栏目继续看，或进后台把这一栏加进导航。</p>
      </header>
      <p>
        <Link className="btn" to="/">
          回首页
        </Link>
      </p>
    </article>
  )
}
