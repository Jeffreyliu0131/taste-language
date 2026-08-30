# Taste Language 实现架构

Taste Language 是一个静态、local-first、deterministic 的浏览器 demo。运行时没有 AI 模型、外部 provider、账户、后端或数据库依赖。

架构优先保证：

- 只有通过完整性校验的照片可以进入比较；
- 未见照片预测和候选语言在展示前冻结；
- 证据不足时允许 0 个轴或拒答；
- 后续选择和编辑不能改写冻结结果。

## 数据流

```text
manifest + local image bytes
→ schema / rights / hash / dimensions / decode checks
→ verified Blob URLs
→ 6 training choices
→ deterministic feature-difference profile
→ freeze predictions + 0-2 axes + candidate positions
→ 3 unseen-photo choices
→ language identification + evidence-only edits
→ Choice / Language / Delivery export records
```

## Deterministic feature-difference baseline

Manifest 预先登记 `openness` 和 `density` 两个可见属性。对每个方向明确、非重复的训练 pair，ranker 使用被选一侧与另一侧的属性差：

```text
beta_k = sum(choice_direction × feature_difference_k)
         / (1 + sum(abs(feature_difference_k)))

margin(left, right) = active_beta · (left_features - right_features)
```

- `tie` 与 `can't tell` 不进入 fit；位置互换 pair 只做一致性检查。
- 每个轴独立检查权重、支持样本和冲突。只有通过检查的轴进入未见照片 margin。
- 合法 profile 包含 0、1 或 2 个轴。
- 未见照片只输出 `left`、`right` 或 `abstain`；`probability` 恒为 `null`。

这些阈值是 demo heuristic，不是校准概率或用户价值证据。

## 冻结与语言边界

第 6 组训练选择后，系统一次锁定训练摘要、算法版本、0-2 个轴、3 组未见照片预测、候选语言位置和方向交换顺序。

未见照片 response 只写入单独记录。接受、改名、否定、合并和撤销只改变表达视图与 edit trail，不重算 profile 或预测。

默认 `LanguageAdapter` 是本地确定性模板。预测先于 adapter 生成；adapter 只能为预先登记的轴提出标签，不能改权重、证据、ID、profile 或 prediction。Adapter failure 会单独进入 Delivery record，不会被伪装成 0 个轴。

## 图片、session 与导出

- `public/fixtures/manifest.json` 是照片来源、用途和运行时属性的 source of truth。
- Build 与 runtime 验证 ID、schedule、group isolation、rights、SHA-256、自然尺寸和 decode。
- UI 只接收完整 bundle 的 verified Blob URL；缺项、额外项或未验证路径都会 hard stop。
- Local session 区分 `empty`、`ready`、`corrupt` 与 `unavailable`。Corrupt 不会被 fresh session 静默覆盖。
- Bundle mismatch 可先导出旧记录，再明确重置；跨标签修改会暂停当前写入。
- JSON 将 Choice、Language 和 Delivery 分开，不含图片 bytes、内部 ownership ID、数值概率或私人路径；概率字段保持 `null`。

## UI concealment 与安全边界

预测和候选来源在相应步骤前不会显示在 UI 或 ARIA 中，但仍存在于客户端 state。因此该机制只能称为 `UI-concealed`，不能称为 participant-grade blind isolation。

用户输入通过 React 文本渲染；同源资源限制、CSP 和无 source map 构建适合本地 demo。但 localStorage、meta CSP 和客户端 digest 都不是 production security boundary，Reset 也不承诺取证级删除。

代码按 `src/data`、`src/domain`、`src/session`、`src/storage`、`src/screens` 分层；核心规则保留为纯函数和显式类型。

当前证据结论仍是 **Validate first（先验证）**。关键取舍见 [决策记录](../DECISION_RECORD.md)，风险与非目标见 [已知限制](../../KNOWN_LIMITATIONS.md)。
