import { AlertDialog, Button, Callout } from "@radix-ui/themes";
import {
  ArrowCounterClockwise,
  Check,
  DownloadSimple,
  Info,
  Warning,
  X
} from "@phosphor-icons/react";
import { useStepFocus } from "../components/useStepFocus";
import { HOLDOUT_SCHEDULE } from "../data/schedule";
import type {
  ChoiceRecord,
  Fixture,
  PredictionRecord,
  SessionState
} from "../domain/types";

interface Props {
  session: SessionState;
  fixturesById: Map<string, Fixture>;
  onExport: () => void;
  onRestart: () => void;
}

function selectedFixture(choice: ChoiceRecord | undefined): string | null {
  if (!choice) return null;
  if (choice.value === "left") return choice.leftId;
  if (choice.value === "right") return choice.rightId;
  return null;
}

function choiceLabel(choice: ChoiceRecord | undefined): string {
  if (!choice) return "未作答";
  if (choice.value === "left") return "选择 A";
  if (choice.value === "right") return "选择 B";
  if (choice.value === "tie") return "同样适合";
  return "看不出来";
}

function predictionLabel(prediction: PredictionRecord): string {
  if (prediction.ordinal === "left") return "冻结时倾向 A";
  if (prediction.ordinal === "right") return "冻结时倾向 B";
  return prediction.abstainReason === "ZERO_AXIS" ? "保留拒答：0 个轴" : "保留拒答：差异太小";
}

function outcomeLabel(choice: ChoiceRecord | undefined, prediction: PredictionRecord): string {
  if (prediction.ordinal === "abstain") return "系统拒答";
  if (!choice || choice.value === "tie" || choice.value === "cant_tell") return "你的选择没有方向";
  return prediction.ordinal === choice.value ? "本次示例方向相同" : "本次示例方向不同";
}

function letterFor(order: string[], value: string | null): string {
  if (value === "none") return "都不像";
  if (value === "unsupported") return "不支持";
  if (!value) return "未提交";
  const index = order.indexOf(value);
  return index >= 0 ? String.fromCharCode(65 + index) : "未知";
}

export function ResultsScreen({ session, fixturesById, onExport, onRestart }: Props) {
  const headingRef = useStepFocus("results");
  const lock = session.lock;
  if (!lock) return null;
  const trainingRepeatA = session.trainingChoices.find((choice) => choice.pairId === "t03");
  const trainingRepeatB = session.trainingChoices.find((choice) => choice.pairId === "t06");
  const repeatConsistent =
    selectedFixture(trainingRepeatA) !== null &&
    selectedFixture(trainingRepeatA) === selectedFixture(trainingRepeatB);
  const leftCount = session.trainingChoices.filter((choice) => choice.value === "left").length;
  const rightCount = session.trainingChoices.filter((choice) => choice.value === "right").length;

  return (
    <section className="results-screen">
      <div className="results-heading">
        <p className="step-context">本次体验完成</p>
        <h1 ref={headingRef} tabIndex={-1}>结果分为三份记录</h1>
        <p>未见照片、语言辨认和运行状态分别呈现，不合成一个“成功分数”。</p>
        <div className="results-actions">
          <Button size="3" onClick={onExport}><DownloadSimple aria-hidden="true" />导出本地记录</Button>
          <AlertDialog.Root>
            <AlertDialog.Trigger>
              <Button size="3" variant="soft" color="gray"><ArrowCounterClockwise aria-hidden="true" />重新体验</Button>
            </AlertDialog.Trigger>
            <AlertDialog.Content maxWidth="480px">
              <AlertDialog.Title>清除本次记录并重新开始？</AlertDialog.Title>
              <AlertDialog.Description>
                这会移除当前浏览器里的 Taste Language 进度。已经下载的导出文件不会被删除。
              </AlertDialog.Description>
              <div className="dialog-actions">
                <AlertDialog.Cancel><Button variant="soft" color="gray">保留结果</Button></AlertDialog.Cancel>
                <AlertDialog.Action><Button color="red" onClick={onRestart}>清除并重新开始</Button></AlertDialog.Action>
              </div>
            </AlertDialog.Content>
          </AlertDialog.Root>
        </div>
      </div>

      <nav className="result-jump-nav" aria-label="三份结果导航">
        <a href="#choice-ledger-title"><span>记录一</span><strong>未见照片</strong></a>
        <a href="#language-ledger-title"><span>记录二</span><strong>语言辨认</strong></a>
        <a href="#delivery-ledger-title"><span>记录三</span><strong>运行状态</strong></a>
      </nav>

      <section className="result-ledger choice-ledger" aria-labelledby="choice-ledger-title">
        <header>
          <div>
            <span>记录一</span>
            <h2 id="choice-ledger-title">3 组未见照片，逐项对照</h2>
          </div>
          <p>只看冻结前留下的方向、分值或拒答，不会根据你的后续选择重算。</p>
        </header>
        <Callout.Root color="gray" className="demo-sequence-note">
          <Callout.Icon><Info aria-hidden="true" /></Callout.Icon>
          <Callout.Text>当前复现序列是合成演示。三次方向相同不代表准确率、稳定性或产品价值。</Callout.Text>
        </Callout.Root>
        <div className="prediction-rows">
          {HOLDOUT_SCHEDULE.map((pair) => {
            const choice = session.holdoutChoices.find((item) => item.pairId === pair.id);
            const prediction = lock.holdoutPredictions.find((item) => item.pairId === pair.id);
            const left = fixturesById.get(pair.leftId);
            const right = fixturesById.get(pair.rightId);
            if (!prediction || !left || !right) return null;
            const outcome = outcomeLabel(choice, prediction);
            const isMismatch = outcome === "本次示例方向不同";
            return (
              <article className="prediction-row" key={pair.id}>
                <div className="mini-pair" aria-label={`${pair.id} 未见照片对`}>
                  <img src={left.path} alt={`Holdout ${pair.id} 样本 A`} />
                  <img src={right.path} alt={`Holdout ${pair.id} 样本 B`} />
                </div>
                <div className="prediction-facts">
                  <span>{pair.id}</span>
                  <strong>{choiceLabel(choice)}</strong>
                  <strong>{predictionLabel(prediction)}</strong>
                </div>
                <div className={`outcome-copy ${isMismatch ? "mismatch" : ""}`}>
                  {isMismatch ? <X aria-hidden="true" /> : prediction.ordinal === "abstain" ? <Info aria-hidden="true" /> : <Check aria-hidden="true" />}
                  <span>{outcome}</span>
                </div>
                <details>
                  <summary>查看冻结分值</summary>
                  <p>{prediction.margin.toFixed(3)} 分值单位。概率字段固定为 null。</p>
                </details>
              </article>
            );
          })}
        </div>
        <div className="training-audit">
          <div><span>位置互换检查</span><strong>{repeatConsistent ? "仍选择同一张照片" : "前后不同或没有方向"}</strong></div>
          <div><span>训练左右选择</span><strong>A {leftCount} 次，B {rightCount} 次</strong></div>
          <p>这只能描述本次位置影响和前后选择，不能证明偏好在不同日期或情境下稳定。</p>
        </div>
      </section>

      <section className="result-ledger language-ledger" aria-labelledby="language-ledger-title">
        <header>
          <div>
            <span>记录二</span>
            <h2 id="language-ledger-title">语言辨认与编辑</h2>
          </div>
          <p>觉得一段话像自己，不等于它能稳定预测新照片，也不等于用户需要这个产品。</p>
        </header>
        <div className="language-readout">
          <div>
            <span>四组说法</span>
            <strong>你选 {letterFor(lock.lineupPlan.order, session.lineupSelection)}</strong>
            <small>系统冻结候选是 {letterFor(lock.lineupPlan.order, lock.lineupPlan.ownOpaqueId)}</small>
          </div>
          <div>
            <span>方向交换</span>
            <strong>你选 {letterFor(lock.perturbationPlan.order, session.perturbationSelection)}</strong>
            <small>原方向是 {letterFor(lock.perturbationPlan.order, lock.perturbationPlan.ownOpaqueId)}</small>
          </div>
        </div>
        <div className="final-axes">
          <h3>你处置后的候选语言</h3>
          {session.editableAxes.length === 0 ? (
            <p>0 个轴。系统保留拒答，没有补写描述。</p>
          ) : (
            session.editableAxes.map((axis) => (
              <div key={axis.id}>
                <strong>{axis.label}</strong>
                <span>{axis.status === "accepted" ? "已接受" : axis.status === "rejected" ? "已否定" : axis.status === "merged" ? "已合并" : "未处置"}</span>
              </div>
            ))
          )}
          {session.secondaryNote ? <blockquote>你的补充备注：{session.secondaryNote}</blockquote> : null}
        </div>
        <Callout.Root color="amber">
          <Callout.Icon><Warning aria-hidden="true" /></Callout.Icon>
          <Callout.Text>这只是可操作的反通用描述示例，不符合正式验证所需的五候选协议，也不产生语言“通过或失败”的结论。</Callout.Text>
        </Callout.Root>
      </section>

      <section className="result-ledger delivery-ledger" aria-labelledby="delivery-ledger-title">
        <header>
          <div>
            <span>记录三</span>
            <h2 id="delivery-ledger-title">运行与交付状态</h2>
          </div>
          <p>图片或语言模块失败会单独记录，不会被算成 0 个轴，也不会改写照片选择结果。</p>
        </header>
        <div className="delivery-overview">
          {lock.delivery.status === "delivered" ? <Check aria-hidden="true" /> : <Warning aria-hidden="true" />}
          <div>
            <strong>{lock.delivery.status === "delivered" ? "本地流程已完成" : "核心选择已完成，语言模块失败"}</strong>
            <p>12 张照片通过完整性校验；核心计算不需要账号、API 密钥或外部网络。</p>
          </div>
        </div>
        <details className="delivery-details">
          <summary>查看技术交付明细</summary>
          <div className="delivery-facts">
            <div><span>语言模块</span><strong>{lock.delivery.status === "delivered" ? lock.delivery.adapter : "生成失败"}</strong></div>
            <div><span>照片完整性</span><strong>12 张文件哈希已验证</strong></div>
            <div><span>外部网络</span><strong>核心路径无请求</strong></div>
            <div><span>预测概率</span><strong>null</strong></div>
          </div>
          {lock.delivery.status === "failed" ? <p className="delivery-error">{lock.delivery.message}</p> : null}
        </details>
      </section>

      <details className="profile-receipt">
        <summary>查看冻结记录与版本</summary>
        <dl>
          <div><dt>Context</dt><dd>long-study-photo-visual</dd></div>
          <div><dt>Date</dt><dd>{lock.createdAt}</dd></div>
          <div><dt>Fixture version</dt><dd>{lock.fixtureSetVersion}</dd></div>
          <div><dt>Algorithm</dt><dd>{lock.algorithmVersion}</dd></div>
          <div><dt>Lock digest</dt><dd>{lock.lockDigest}</dd></div>
          <div><dt>Theme / viewport</dt><dd>{lock.displayTheme} / {lock.viewportClass}</dd></div>
        </dl>
      </details>

      <section className="cannot-claim">
        <h2>不可宣称事项</h2>
        <p>不能据此宣称需求已验证、真实咖啡店适合学习、预测已经校准、偏好跨情境稳定、能够推断人格，或已经达到可发布产品与外部研究标准。</p>
      </section>
    </section>
  );
}
