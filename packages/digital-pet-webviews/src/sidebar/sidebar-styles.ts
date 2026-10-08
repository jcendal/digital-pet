export const SIDEBAR_STYLES = /* css */ `
  html { height: auto; overflow: auto; }
  body { height: auto; padding: 10px; background: transparent; overflow: auto; }
  .pet-module { padding: 10px; border: 2px solid var(--case-edge); background: var(--lcd); box-shadow: 0 0 0 2px var(--case); }
  .pet-header { display: flex; justify-content: space-between; gap: 8px; border-bottom: 2px solid var(--muted); padding-bottom: 6px; font-size: 14px; }
  .pet-header .micro { font-size: 14px; }
  #phase::before { content: ''; display: inline-block; width: 8px; height: 8px; background: var(--ink); margin-right: 6px; }
  #content { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-areas: "name" "art" "progress"; grid-template-rows: 26px 144px 64px; }
  .arena { position: relative; grid-area: art; min-width: 0; height: 144px; display: grid; place-items: center; overflow: hidden; }
  .arena svg { width: 100%; height: 100%; }
  .arena.with-battle-hud svg { height: calc(100% - 56px); margin-top: 24px; margin-bottom: 32px; }
  #battle-scores { position: absolute; top: 8px; left: 2px; right: 2px; display: flex; justify-content: space-between; }
  #player-score, #opponent-score { display: flex; gap: 6px; }
  .score-pip { width: 16px; height: 16px; border: 2px solid var(--ink); }
  .score-pip.filled { background: var(--ink); }
  #battle-caption { position: absolute; bottom: 6px; left: 0; right: 0; text-align: center; font-size: 18px; line-height: 1.2; }
  .identity { grid-area: name; min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  #name { min-width: 0; font-size: 14px; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #stage { min-width: 0; max-width: 50%; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .battling #name, .battling #stage { flex: 1; max-width: 50%; font-size: 14px; }
  .battling #stage { text-align: right; }
  .progress { grid-area: progress; height: 64px; padding: 4px 0; border-top: 2px solid var(--muted); }
  .progress-heading { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; }
  #meter { height: 12px; margin: 4px 0; border: 1px solid var(--muted); padding: 2px; }
  #meter-fill { display: block; height: 100%; background: repeating-linear-gradient(90deg, var(--ink) 0 8px, transparent 8px 10px); width: 0; }
  #gauge { font-size: 12px; }
  .pet-actions { display: flex; justify-content: flex-end; gap: 6px; }
  .pet-actions button { min-height: 22px; padding: 2px 6px; color: var(--ink); font: inherit; font-size: 12px; line-height: 1.2; border: 1px solid var(--muted); border-radius: 0; background: transparent; cursor: pointer; }
  .pet-actions button:hover { color: var(--lcd); background: var(--ink); }
  :focus-visible { outline: 2px solid var(--ink); outline-offset: -3px; }
  .animating #content { grid-template-rows: 26px 200px 64px; }
  .animating .arena { height: 200px; }
  .animating .pet-actions { border-top: 2px solid var(--muted); padding-top: 6px; }
  #empty { padding: 20px 0; font-size: 14px; }
  .no-partner #content { display: none; }
  @media (max-width: 260px) { body { padding: 6px; } .pet-module { padding: 8px; } }
`
