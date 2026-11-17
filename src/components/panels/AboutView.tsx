export function AboutView({ onReplayIntro }: { onReplayIntro: () => void }) {
  return (
    <div className="about">
      <div className="about__seal">
        <span>半</span>
      </div>
      <h2 className="about__title">半刻</h2>
      <p className="about__pinyin">BANKE</p>
      <p className="about__manifesto">
        把一颗番茄切成四瓣，把一天切成几段。
        <br />
        不追着你跑，只在水边替你数着。
      </p>

      <div className="about__steps">
        <div className="about-step">
          <span className="about-step__mark">切</span>
          <div>
            <h3>四瓣</h3>
            <p>学习、工作、阅读、静心。点开一瓣，就只做这一件事。</p>
          </div>
        </div>
        <div className="about-step">
          <span className="about-step__mark">数</span>
          <div>
            <h3>一刻</h3>
            <p>限时或只往上数。轻点数字，就在倒计时与正计时之间换一种看法。</p>
          </div>
        </div>
        <div className="about-step">
          <span className="about-step__mark">柄</span>
          <div>
            <h3>收刀</h3>
            <p>番茄的柄挂在记录与设置。切下来的每一瓣，都会留在本子里。</p>
          </div>
        </div>
      </div>

      <div className="about__meta">
        <div>
          <span>版本</span>
          <strong>1.0.0</strong>
        </div>
        <div>
          <span>记录</span>
          <strong>只在本机</strong>
        </div>
        <div>
          <span>画面</span>
          <strong>实时生成</strong>
        </div>
      </div>

      <div className="about__actions">
        <button className="btn btn--ghost btn--small" onClick={onReplayIntro}>
          重看一次开场
        </button>
      </div>

      <p className="about__credits">
        字体取自系统 · 番茄与水面由 Three.js 程序生成 · 声音由 WebAudio 合成
        <br />
        为长时间坐着的人做的一颗番茄。
      </p>
    </div>
  )
}
