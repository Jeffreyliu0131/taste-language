import { Button, Callout } from "@radix-ui/themes";
import { Check, Eye, Lock, Warning } from "@phosphor-icons/react";
import type { Dispatch } from "react";
import type { SessionState } from "../domain/types";
import type { SessionAction } from "../session/reducer";
import { useStepFocus } from "../components/useStepFocus";

interface Props {
  session: SessionState;
  dispatch: Dispatch<SessionAction>;
  now: () => string;
  fixtureSetVersion: string;
  bundleDigest: string;
}

export function ContextScreen({ session, dispatch, now, fixtureSetVersion, bundleDigest }: Props) {
  const headingRef = useStepFocus("context");
  return (
    <section className="context-screen">
      <div className="context-intro">
        <p className="step-context">先确认这次在判断什么</p>
        <h1 ref={headingRef} tabIndex={-1}>只判断照片里看得见的偏好</h1>
        <p className="context-lead">
          想象你要独自学习很长时间。你只需判断更想看到哪种空间画面，不是在挑选真实地点。
        </p>
      </div>

      <div className="context-contract">
        <section className="contract-positive">
          <Eye size={24} aria-hidden="true" />
          <h2>本次会观察</h2>
          <ul>
            <li><Check aria-hidden="true" />开阔或包裹的视觉边界</li>
            <li><Check aria-hidden="true" />留白或丰富的物件层次</li>
            <li><Check aria-hidden="true" />未见照片上的方向选择</li>
          </ul>
        </section>
        <section className="contract-negative">
          <Warning size={24} aria-hidden="true" />
          <h2>照片不能证明</h2>
          <p>噪声、插座、座椅舒适度、拥挤、价格、时段、店规，以及真实地点是否适合久坐。</p>
        </section>
      </div>

      <div className="context-side">
        <section className="experience-outline" aria-labelledby="experience-outline-title">
          <h2 id="experience-outline-title">你会经历什么</h2>
          <ol>
            <li><strong>先选 6 组照片</strong><span>系统只从这些选择形成候选偏好。</span></li>
            <li><strong>确认一次冻结</strong><span>候选轴和 3 组预测从此不再改变。</span></li>
            <li><strong>再选 3 组新照片</strong><span>预测先隐藏，到结果页再逐项揭示。</span></li>
            <li><strong>辨认并编辑语言</strong><span>查看证据后，你可以接受、改名、否定或合并。</span></li>
          </ol>
        </section>

        <Callout.Root color="green" className="context-data-note">
          <Callout.Icon><Lock aria-hidden="true" /></Callout.Icon>
          <Callout.Text>
            12 张本地合成照片已经过来源、文件哈希和解码校验。选择与结果只保存在当前浏览器。
          </Callout.Text>
        </Callout.Root>
      </div>

      <div className="context-action">
        <div>
          <strong>显示模式将在开始时锁定</strong>
          <span>当前：{session.displayTheme === "dark" ? "深色" : "浅色"}</span>
        </div>
        <Button size="3" onClick={() => dispatch({
          type: "LOCK_CONTEXT",
          now: now(),
          fixtureSetVersion,
          bundleDigest
        })}>
          确认情境，开始 6 组选择
        </Button>
      </div>
    </section>
  );
}
