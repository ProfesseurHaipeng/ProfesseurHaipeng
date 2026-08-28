# 皮纳图博火山灰官网（内容草案）

品牌尚未落实。前台按招商手册先铺开，所有栏目都可以在后台改。

## 怎么改内容

打开 `/admin`，口令先用 `ash-draft`。

1. 左侧选模块（品牌、导航、项目、资源、供应、产品、检测、市场、方案、案例、视频、联络）。
2. 改完点 **保存草稿**。草稿存在当前浏览器。
3. 点 **前台预览草稿** 查看真实页面。
4. **导出 JSON** 可以把整站内容带走或交给仓库。
5. 部署到 Netlify 后，**发布** 会写入 Blobs；把环境变量 `ADMIN_PASSWORD` 换成自己的口令。

前台只读内容，不写死文案。默认稿在 `src/cms/defaultContent.ts`。

## 本地

```bash
npm install
npm run dev
```

## 内容架构

```
手册栏目     前台路由      后台模块
战略概览     /project     overview
火山资源     /resource    resource
矿区供应     /supply      supply
产品体系     /products    products
检测报告     /testing     testing
市场布局     /market      market
应用方案     /solutions   solutions
案例展示     /cases       cases
视频入口     /videos      videos
```

GitHub 个人简介 README 没有改动。
