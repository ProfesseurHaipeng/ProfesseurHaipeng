import { BrowserRouter, HashRouter, Navigate, Route, Routes } from "react-router-dom"
import { AdminApp } from "./admin/AdminApp"
import { ContentProvider } from "./cms/ContentContext"
import { SiteLayout } from "./components/SiteLayout"
import { isHashBuild, routerBasename } from "./lib/asset"
import { CasesPage } from "./pages/CasesPage"
import { ContactPage } from "./pages/ContactPage"
import { HomePage } from "./pages/HomePage"
import { NextPage } from "./pages/NextPage"
import { NotFoundPage } from "./pages/NotFoundPage"
import { ProductsPage } from "./pages/ProductsPage"
import { ProjectPage } from "./pages/ProjectPage"
import { UsePage } from "./pages/UsePage"
import "./App.css"

export default function App() {
  const Router = isHashBuild() ? HashRouter : BrowserRouter
  return (
    <ContentProvider>
      <Router basename={isHashBuild() ? undefined : routerBasename()}>
        <Routes>
          <Route path="/admin/*" element={<AdminApp />} />
          <Route element={<SiteLayout />}>
            <Route index element={<HomePage />} />
            <Route path="project" element={<ProjectPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="use" element={<UsePage />} />
            <Route path="cases" element={<CasesPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="next" element={<NextPage />} />
            <Route path="resource" element={<Navigate to="/project" replace />} />
            <Route path="supply" element={<Navigate to="/products" replace />} />
            <Route path="testing" element={<Navigate to="/products" replace />} />
            <Route path="market" element={<Navigate to="/use" replace />} />
            <Route path="solutions" element={<Navigate to="/use" replace />} />
            <Route path="videos" element={<Navigate to="/cases" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Router>
    </ContentProvider>
  )
}
