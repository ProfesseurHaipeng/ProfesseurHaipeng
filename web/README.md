# 皮纳图博火山灰官网（内容草案）

品牌尚未落实。前台按招商手册铺开，所有栏目都可以在后台改。

## 后台怎么改

打开 `/admin`，口令先用 `ash-draft`。

1. 先看 **待补缺口**：品牌、邮箱、电话、微信、地址、手册下载会自动标空。
2. 左侧改对应模块。图、导航、数字、作物方案、区域、案例、视频都能增删和上下移动。
3. **保存草稿** 存在当前浏览器。未保存离开页会提示。
4. **前台预览草稿** 打开 `/?preview=1`，顶栏会标明这是草稿。
5. **导出 / 导入 JSON** 带走整站内容。旧 JSON 导入时会自动补上新栏位。
6. 部署到 Netlify 后点 **发布**。把环境变量 `ADMIN_PASSWORD` 换成自己的口令。

默认稿在 `src/cms/defaultContent.ts`。内容结构在 `src/cms/types.ts`。合并规则在 `src/cms/merge.ts`。

## 本地

```bash
npm install
npm run dev
npm test
npm run build
```

## 内容架构

```
手册栏目     前台路由      后台模块
待补清单     /next        gaps
图库                     media
战略概览     /project     overview
火山资源     /resource    resource
矿区供应     /supply      supply
产品体系     /products    products
检测报告     /testing     testing
市场布局     /market      market
应用方案     /solutions   solutions
案例展示     /cases       cases
视频入口     /videos      videos
联络         /contact     contact + settings.channels
```

发布接口：`GET/PUT /api/content` → Netlify Function + Blobs `ash-cms/site`。

GitHub 个人简介 README 没有改动。
