# Fixture provenance and rights boundary

## 结论

本项目包含 12 张 synthetic fixture。它们于 2026-08-30 使用 OpenAI image generation 生成，由 Kairui Liu 提示、筛选并整理；生成时没有提供第三方参考图，也没有抓取商家图片。原始输出缩放为最长边 1280px、JPEG quality 82；最终仓库文件的 SHA-256 记录在 `public/fixtures/manifest.json`。

这些输出是 AI-generated，可能不是唯一的，也可能与其他生成内容或常见室内视觉材料相似。这里的 provenance 说明不能证明绝对原创、与所有既有作品都不相似，或不存在任何第三方权利问题。

## Rights statement

- `source_type`: `ai-generated`
- `license_id`: `CC0-1.0`
- License: [CC0 1.0 Universal](../../LICENSES/CC0-1.0.txt)
- Rights affirmer: Kairui Liu；effective date: 2026-08-30
- 许可范围包括 12 张 JPEG，以及项目编写的 `visible_features`、prompt summary、style tags、source/near-duplicate groups 和 manifest metadata；完整边界见 [ASSET_LICENSES.md](../../ASSET_LICENSES.md)。
- 在权利确认人持有相应版权及相关权利的范围内，材料通过 CC0 向公共领域贡献；CC0 不要求署名，也不限制复制、修改、再分发、商业使用或模型训练。
- No third-party attribution is claimed because no third-party reference image was supplied. 这不是“与第三方作品绝无相似”的保证。
- CC0 只处理权利确认人有权放弃或许可的版权及相关权利，不授予商标、专利、隐私、公开权等其他人的权利，也不提供 copyrightability、title、non-infringement、uniqueness、accuracy 或 suitability 保证。
- Source URIs 已改为稳定的 `urn:taste-language:fixture:f01` 至 `f12`，不公开内部 generation execution ID、私人路径或会话标识。
- 版权许可与项目授权分开：公开 CC0 不代表本项目已获准招募参与者、运行外部研究，也不改变 `Validate first`。

## Shared prompt contract

Built-in imagegen mode，use case 为 `photorealistic-natural`。

每张图共用约束：

```text
Asset type: local research fixture for a pairwise visual preference prototype
Scene: fictional, unbranded study interior, no identifiable real location
Style: photorealistic interior photography, natural material texture, minor imperfection
Composition: horizontal 16:10, eye-level, 35mm feel, whole desk area visible
Constraints: no people, no faces, no text, no signs, no logos, no watermark,
no visible outlets, no claim about noise or comfort, no dramatic grading,
no shallow depth of field
Avoid: luxury staging, cinematic bloom, purple lighting, perfect symmetry,
fisheye distortion
```

## Per-fixture primary prompts

| ID | Primary request | Split |
|---|---|---|
| f01 | Broad soft daylight, open sightline, low visual clutter, pale oak desk | Training |
| f02 | Amber task lighting, enclosed alcove, layered books and textiles | Training |
| f03 | Cool concrete, long sparse desk, exposed structural lines, open sightline | Training |
| f04 | Dense shelving, warm timber, moderate daylight, layered worktable | Training |
| f05 | Bright glass wall, open shared table, many empty chairs and architectural frames | Training |
| f06 | Small enclosed dark room, one sparse desk, almost no objects | Training |
| f07 | Soft curtained window, rounded timber furniture, woven rug, light layering | Holdout |
| f08 | Open pale metal framing, long clear desk, hard-edged cool light | Holdout |
| f09 | Low timber partitions, geometric shelving, compact modular work surfaces | Holdout |
| f10 | Enclosed eclectic room with books, ceramics, colored textiles and layered surfaces | Holdout |
| f11 | Narrow cool room, closely spaced shelves, compact desk, dense layering | Holdout |
| f12 | Open timber pavilion, broad uncluttered table, long warm sightline | Holdout |

## Annotation boundary

`visible_features.openness` 和 `visible_features.density` 是项目编写的显式属性，用于 deterministic mechanism demo，并与 manifest 其他项目原创 metadata 一并采用 CC0-1.0。它们不是用户生成标签、心理测量、事实真值或真实地点属性；公开许可不提高其准确性或外部效度。

Photography/style tags 只进入 provenance 与 limitation，不进入 ranker。Training 与 holdout 的 `source_group`、`near_duplicate_group` 和 fixture ID 在 build/freeze preflight 中必须不交叉。

## Hash verification

```bash
npm run validate:fixtures
```

这会重新计算仓库 JPEG 的 SHA-256，并核对 CC0 asset/metadata declaration、AI-generated/non-unique disclosure、sanitized URN、完整 public-use fields、ID/path/hash uniqueness、split/schedule closure 与 group isolation。Runtime 还会在用户看到情境页前重新验证 schema、SHA-256、自然尺寸和图像 decode，并只向 UI 交付 verified Blob URL。
