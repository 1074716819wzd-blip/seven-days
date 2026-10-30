# GitHub Pages 部署

当前状态：本地配置和验证已完成；尚未上传 GitHub，尚未上线。

## 仓库状态与下一步

本地项目及父目录没有 .git，PATH 中没有 Git/gh 命令。GitHub 连接账号为 1074716819wzd-blip，可访问仓库列表为空，查询 seven-days 返回 404（可能未创建或未授权）。没有覆盖任何远程仓库。

1. 登录 https://github.com/new 。若已有本项目仓库，先提供其地址并授权连接器，不要重复创建。
2. 新建时 Owner 选 1074716819wzd-blip，名称填 seven-days，选择 Public，勾选 Add a README file，点击 Create repository。GitHub Free 的 Pages 需要公开仓库；公开的是代码，不包含浏览器中的任务数据。
3. 仓库应为 https://github.com/1074716819wzd-blip/seven-days 。把地址发给助手继续上传。若仍不可见，在 GitHub Settings → Applications → Installed GitHub Apps 中配置对应连接，允许访问此仓库。
4. 项目文件上传到 main 后，在该仓库点 Settings → Pages → Build and deployment → Source，选择 GitHub Actions。无需选择分支发布，也无需另建模板工作流。
5. 到 Actions → Deploy to GitHub Pages → Run workflow，选 main，再点绿色 Run workflow。若 push 已自动部署成功，就不必重复运行。
6. 等待绿色成功，到 Settings → Pages → Visit site。

计划网址：https://1074716819wzd-blip.github.io/seven-days/ 。目前尚未上线，不是已验证的正式网址。

## 配置

- vite.config.ts 的 base 为 /seven-days/。如果最终仓库名称不同，需要调整；只有用户站点仓库或根域名部署才改为 /。
- .github/workflows/deploy.yml：push main 或手动触发 → Node 24 → npm ci → npm run build → 上传 dist → Pages 部署。只赋予 contents: read、pages: write、id-token: write。
- manifest 位于 /seven-days/manifest.webmanifest，原有相对 start_url、scope 和图标正确解析到子路径。
- service worker 位于 /seven-days/sw.js，scope 为 /seven-days/，离线缓存与导航回退正常。
- 现有 hash 路由不需要 404 页面或服务端重写。
- 没有修改 src、IndexedDB 版本/结构或 JSON 格式。旧平台配置没有参与本工作流，不再尝试其他平台。

## 本地验证

执行 npm.cmd ci、npm.cmd run build、npm.cmd test、npm.cmd run test:e2e、node scripts/verify-pwa-deployment.mjs。

- 安装依赖及 production build 成功。
- 13 个单元测试、7 组浏览器测试通过。
- 子路径下 manifest、资源、图标、service worker 路径和 scope 通过。
- 浏览器安装条件检查没有错误；离线刷新、编辑、持久化通过。
- 使用真实 UI 导出 JSON 再恢复，数据完全一致。
- 使用原有更新按钮激活新版 service worker，更新前后 IndexedDB 全量数据和版本完全一致。
- 工作流按 GitHub Pages 官方流程核对；远程 Actions、正式 HTTPS 和实体手机安装仍待上线后验证。

机器可读结果：test-results/pwa-deployment-verification.json。

## 手机和数据

Android：Chrome 打开正式网址 → 菜单 → 安装并创建快捷方式 → 安装（部分版本显示安装应用）。
iPhone：Safari 打开正式网址 → 分享 → 添加到主屏幕；如有“作为 Web App 打开”，保持开启，再点添加。

首次联网等待离线资源就绪后可离线使用。部署后电脑不必一直开机。

数据保存在手机浏览器 IndexedDB：seven-days / app / data，版本 1，不上传 GitHub。同一正式地址正常更新不会清空数据。IndexedDB 按 origin 隔离，不按子路径隔离。

从本地地址迁移到 Pages：先在旧应用“数据与安装 → 导出备份”，再到新应用“导入备份 → 确认替换并恢复”。换设备/浏览器也采用此方式。清除网站数据会删除记录，请保留 JSON 备份。

参考：https://vite.dev/guide/static-deploy.html#github-pages
https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
