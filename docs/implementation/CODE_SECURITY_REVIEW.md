# 代码与安全边界复核

## 结论

当前实现适合作为本地体验 demo。复核没有发现会破坏当前核心合同的已知高风险实现缺口，但这不是 production security certification，也不构成正式研究、production readiness 或商业适用性判断。许可证允许的用途与这些证据结论分开。

证据结论仍是 **Validate first（先验证）**。

## 公开可验证的约束

### 数据与模型

- `PredictionRecord.probability` 在类型、计算、存储、界面和导出中保持 `null`。
- Ranker 只读取训练选择和预先登记的可见属性，不读取未见照片 response、语言选择、备注或身份信息。
- 未通过候选轴证据检查的权重不参与单轴 prediction。
- Language adapter 收到 deep-cloned、deep-frozen 的只读投影；预测先于 adapter 生成。
- 运行时默认 adapter 是确定性模板，不调用 AI 模型或外部 provider。

### 图片与渲染

- 照片在展示前完成 schema、rights、hash、尺寸和 decode 检查。
- UI 只接收完整 bundle 的 verified Blob URL，不回退到未验证路径或静默替图。
- 用户改名、备注和错误信息通过 React 转义；代码不使用 `dangerouslySetInnerHTML`、`innerHTML`、`eval` 或 `new Function`。

### 状态、恢复与导出

- Session schema 检查阶段完成度、schedule、冻结 lineage、候选计划和编辑历史。
- Corrupt 与 empty 是不同状态；corrupt 会阻断自动保存并要求明确重置。
- Bundle mismatch 提供旧记录导出和确认重置；跨标签修改会暂停当前写入。
- Reset 只删除 Taste Language 自己的 localStorage key。
- JSON 将 Choice、Language 和 Delivery 分开，不含图片 bytes、内部 ownership ID、数值概率或私人路径；概率字段保持 `null`。

## 重复验证

```bash
npm run validate:fixtures
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
```

自动化覆盖 0/1/2 轴、低差异拒答、adapter failure、图片失败、越界改名、bundle mismatch、corrupt storage、跨标签清除、JSON 导出、移动端 A/B、200% reflow 和无障碍扫描。

测试通过只证明代码符合当前 demo 合同，不证明研究有效、生产安全或商业可用。

## 仍然存在的风险

1. Prediction 与候选 ownership 仍在客户端 state 中，开发者工具可以破坏 UI concealment。
2. localStorage 和客户端 digest 不提供机密性、主动防篡改、多用户隔离、原子 CAS 或取证级删除。
3. 恢复不会重新执行全部计算来抵御蓄意伪造但结构合法的 session。
4. 图片 rights、near-duplicate group 和摄影风格控制没有独立法律或感知审计。
5. Meta CSP 包含 UI 框架需要的 inline style 与本地开发连接，不是 production HTTP-header policy。
6. 浏览器与无障碍验证以 Chromium 和自动化为主，没有完整多浏览器或真实读屏用户研究。
7. 供应链没有 SBOM、签名或持续漏洞监控。
8. 浏览器拒绝下载时，当前界面没有可靠的完成或失败回执。

完整非目标见 [已知限制](../../KNOWN_LIMITATIONS.md)，关键取舍见 [决策记录](../DECISION_RECORD.md)。
