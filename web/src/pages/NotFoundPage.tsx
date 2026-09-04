import { Link } from "react-router-dom"
import { PageHero } from "../components/PageHero"

export function NotFoundPage() {
  return (
    <article className="page wrap">
      <PageHero kicker="这一页没有" title="走错路了" lead="回到已有栏目继续看。" />
      <p>
        <Link className="btn" to="/">
          回首页
        </Link>
      </p>
    </article>
  )
}
