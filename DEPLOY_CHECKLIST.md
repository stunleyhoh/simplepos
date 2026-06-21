# 上线前检查清单

## Firebase Console

- 已开启 Billing，并设置预算提醒。
- 已启用 Authentication 的 Google 登录。
- 已创建 Firestore Database。
- 已发布 `firestore.rules`。
- 已在 Google Cloud 限制 Firebase Web API Key 的 HTTP referrers。

## 本地文件

- `firebase-config.local.js` 存在，并且内容是当前 Firebase 项目的真实配置。
- `firebase-config.local.js` 不提交到 GitHub。
- `firebase-config.example.js` 可以提交，用作模板。
- `firestore.rules` 已经是最新规则。
- `firebase.json` 和 `.firebaserc` 存在。

## 功能测试

- Google 管理员登录成功。
- 点击 `初始化云端数据` 后，Firestore 出现：
  - `branches`
  - `users`
  - `products`
  - `settings`
- 完成一笔收款后，Firestore 出现 `sales`。
- 管理员新增商品或调整库存后，Firestore 出现 `stockAdjustments`。
- 管理员执行新增分行、授权用户或保存设置后，Firestore 出现 `auditLogs`。
- 断网收款后，顶部显示待同步数量。
- 恢复网络后，待同步订单自动补传。
- `刷新云端资料` 可以读取云端资料。
- CSV 导出能打开，并包含分行、收银员、同步状态和服务周期。
- 完整 JSON 备份能下载。
- 从 JSON 备份恢复能成功载入本机资料。

## 部署

部署命令：

```powershell
firebase deploy
```

部署后访问：

```text
https://simplepos-2900e.web.app
```

如果线上页面显示云端未连接，优先检查：

- `firebase-config.local.js` 是否被部署。
- API Key 的 HTTP referrers 是否包含线上域名。
- Firestore Rules 是否已发布。
- Google 登录的 Authorized domains 是否包含线上域名。
