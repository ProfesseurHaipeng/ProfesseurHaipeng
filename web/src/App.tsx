import { BrowserRouter, Route, Routes } from "react-router-dom"
import { AdminApp } from "./admin/AdminApp"
import { ContentProvider } from "./cms/ContentContext"
import { SiteLayout } from "./components/SiteLayout"
import { CasesPage } from "./pages/CasesPage"
import { ContactPage } from "./pages/ContactPage"
import { HomePage } from "./pages/HomePage"
import { MarketPage } from "./pages/MarketPage"
import { NextPage } from "./pages/NextPage"
import { NotFoundPage } from "./pages/NotFoundPage"
import { ProductsPage } from "./pages/ProductsPage"
import { ProjectPage } from "./pages/ProjectPage"
import { ResourcePage } from "./pages/ResourcePage"
import { SolutionsPage } from "./pages/SolutionsPage"
import { SupplyPage } from "./pages/SupplyPage"
import { TestingPage } from "./pages/TestingPage"
import { VideosPage } from "./pages/VideosPage"
import "./App.css"

export default function App() {
  return (
    <ContentProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/admin/*" element={<AdminApp />} />
          <Route element={<SiteLayout />}>
            <Route index element={<HomePage />} />
            <Route path="project" element={<ProjectPage />} />
            <Route path="resource" element={<ResourcePage />} />
            <Route path="supply" element={<SupplyPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="testing" element={<TestingPage />} />
            <Route path="market" element={<MarketPage />} />
            <Route path="solutions" element={<SolutionsPage />} />
            <Route path="cases" element={<CasesPage />} />
            <Route path="videos" element={<VideosPage />} />
            <Route path="next" element={<NextPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ContentProvider>
  )
}
