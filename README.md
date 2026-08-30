# Taste Language

Taste Language 是一个本地运行的照片视觉偏好语言 demo。它把“独自长时间学习”这一固定情境下的成对照片选择，转成可检查、可编辑、可否定的候选表达，并用未见照片检查冻结前留下的方向。

当前证据结论是 **Validate first（先验证）**。这个仓库展示的是一种可运行、可审计的机制，不证明用户需要它，也不代表研究结果、真实地点推荐或可上线产品。

## 体验流程

```text
确认情境
→ 选择 6 组照片
→ 冻结偏好摘要、0-2 个候选轴和 3 组未见照片预测
→ 选择 3 组未见照片
→ 辨认两轮候选语言
→ 查看照片证据并编辑候选轴
→ 分别查看照片选择、语言辨认和运行状态
```

照片只能支持视觉层面的描述。应用不会据此判断噪声、插座、座椅舒适度、拥挤、价格、营业规则，或真实地点是否适合久坐。

## 核心机制

- **确定性 feature-difference baseline：** 只使用 manifest 中预先登记的 `openness` 和 `density` 两个可见属性，根据方向明确的训练选择计算差异分值。
- **0-2 个候选轴：** 每个轴必须分别通过权重、支持样本和冲突检查。证据不足时允许得到 0 个轴。
- **拒答优先：** 未见照片差异过小或没有有效轴时，输出 `abstain`；预测概率始终为 `null`。
- **先冻结，后揭示：** 未见照片预测、候选语言位置和方向交换在展示前一次冻结。之后的选择和编辑不会回写冻结结果。
- **运行时不使用 AI 或 provider：** 候选标签来自本地确定性模板。应用不需要模型、API 密钥、账户、后端或外部网络。
- **三份记录分离：** 照片选择、语言辨认和运行状态不会合成为一个成功分数。

`UI-concealed` 只表示界面暂不显示预测与候选来源。数据仍在客户端内存中，检查开发者工具可以看到，因此这不是 participant-grade blind isolation。

## 本地运行

需要 Node.js 22.12 或更高版本。

```bash
npm ci
npm run dev
```

开发服务器只绑定 `127.0.0.1`。生产构建的本地验收方式：

```bash
npm run build
npm run preview:acceptance
```

然后打开 `http://127.0.0.1:43135/`。

## 可复现演示路径

| 阶段 | 选择 |
|---|---|
| 前 6 组照片 | A、A、A、B、B、B |
| 3 组未见照片 | B、A、B |

这个序列只用于复现界面状态。即使三次方向相同，也不代表准确率、稳定性或产品价值。完整观察清单见 [体验验收说明](EXPERIENCE_ACCEPTANCE.md)。

## 截图

- [Desktop：情境边界](artifacts/screenshots/desktop-context.png)
- [Mobile dark：A/B 同屏比较](artifacts/screenshots/mobile-pair-dark.png)
- [Desktop：候选轴证据与编辑](artifacts/screenshots/desktop-axis-review.png)
- [Desktop：三份结果](artifacts/screenshots/desktop-results.png)

## 验证

```bash
npm run validate:fixtures
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
```

测试覆盖确定性冻结、0/1/2 轴、低差异拒答、受控改名、图片完整性、存储恢复、JSON 导出、键盘路径、移动端重排和无障碍检查。测试通过只说明实现符合当前合同，不会把 demo 升级为已验证产品。

## 文档

- [关键产品与技术决策](docs/DECISION_RECORD.md)
- [实现架构](docs/implementation/ARCHITECTURE.md)
- [代码与安全边界](docs/implementation/CODE_SECURITY_REVIEW.md)
- [已知限制与不可宣称事项](KNOWN_LIMITATIONS.md)
- [体验验收说明](EXPERIENCE_ACCEPTANCE.md)

## License

- 代码与文档采用 [MIT License](LICENSE)。
- Fixture 图片及其 metadata 采用 CC0；以 [资产许可说明](ASSET_LICENSES.md) 为准。
- README 中公开链接的 4 张产品截图采用 CC BY 4.0，署名要求见 [资产许可说明](ASSET_LICENSES.md)。

## 当前边界

- 只描述固定学习情境下的**照片视觉偏好**，不推荐真实地点。
- 不推断人格、身份、健康、收入、消费能力或其他敏感属性。
- localStorage 是便利性存储，不是机密性或防篡改边界。
- 许可证允许的用途与产品证据是两回事；本 demo 不是正式用户研究、隐私合规证明、商业适用性判断或 production-ready 系统。
