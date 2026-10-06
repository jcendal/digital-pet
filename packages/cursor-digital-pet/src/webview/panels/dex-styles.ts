export const DEX_STYLES = /* css */ `
  * { box-sizing: border-box; }
  :root { color-scheme: light; --case: #594130; --case-edge: #9a7750; --case-ink: #d6c5a3;
    --lcd: #bac79c; --lcd-edge: #89966f; --ink: #26351e; --muted: #435334; --line: #8fa276;
    --type-small: 14px; --type-label: 16px; --type-body: 18px; --type-name: 20px; --type-title: 28px; }
  html { height: 100%; overflow: hidden; }
  body { height: 100%; height: 100dvh; overflow: hidden; margin: 0; background: #10120e; color: var(--ink); font-family: 'Dex Pixel', monospace;
    font-size: var(--type-body); line-height: 1.4; padding: 12px; }
  button, input, select { font: inherit; color: inherit; border-radius: 0; text-transform: uppercase; }
  button { cursor: pointer; }
  button:disabled { cursor: default; opacity: .4; }
  :focus-visible { outline: 2px solid var(--ink); outline-offset: -4px; }
  .device { width: 100%; height: 100%; min-height: 0; display: flex; flex-direction: column; max-width: 1120px; margin: auto; padding: 12px; background: var(--case); border: 4px solid var(--case-edge);
    box-shadow: 4px 0 #342b21, -4px 0 #342b21, 0 4px #342b21, 0 -4px #342b21, inset 0 0 0 3px #342b21;
    position: relative; }
  .device::before { content: ''; position: absolute; inset: 4px; pointer-events: none; border: 2px solid #342b21;
    background: repeating-linear-gradient(90deg, transparent 0 66px, #342b21 66px 68px, transparent 68px 70px) top / 100% 8px no-repeat,
    repeating-linear-gradient(90deg, transparent 0 66px, #342b21 66px 68px, transparent 68px 70px) bottom / 100% 8px no-repeat; }
  .masthead { display: flex; justify-content: space-between; align-items: center; gap: 20px; color: var(--case-ink); padding: 0 6px 10px; }
  .brand, h1 { margin: 0; font-size: 24px; line-height: 1.5; font-weight: 400; }
  .screen { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; background: var(--lcd); border: 4px solid #303725; padding: 12px;
    box-shadow: 0 0 0 3px #3f3225, inset 0 0 0 4px var(--lcd-edge); }
  .micro { font-size: var(--type-label); color: var(--muted); }
  h2, h3, p { margin: 0; }
  h2 { font-size: var(--type-title); font-weight: 400; overflow-wrap: anywhere; text-transform: uppercase; }
  h3 { font-size: var(--type-body); font-weight: 400; }
  .completion { flex-shrink: 0; display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
  .completion > div:first-child { display: flex; align-items: center; gap: 12px; flex: 1; }
  .completion .micro { font-size: var(--type-body); color: var(--ink); }
  .completion > div:first-child > p { margin-right: auto; }
  .completion strong { font-size: 24px; font-weight: 400; }
  .meter { width: 100%; height: 4px; order: 3; }
  .meter-fill { height: 100%; background: repeating-linear-gradient(90deg, var(--ink) 0 5px, transparent 5px 7px); }
  .meter { background: repeating-linear-gradient(90deg, var(--line) 0 5px, transparent 5px 7px); }
  #percent { font-size: var(--type-label); color: var(--muted); }
  .toolbar { flex-shrink: 0; display: grid; grid-template-columns: minmax(200px,1fr) minmax(220px,1fr) auto auto; gap: 12px; align-items: end; margin-bottom: 20px; }
  .field { display: grid; gap: 6px; min-width: 0; }
  .search-field { grid-column: 1 / -1; }
  .search-field > .micro { display: none; }
  input, select { min-height: 48px; background: transparent; border: 2px solid var(--muted); padding: 7px 10px; }
  input { width: 100%; }
  input::placeholder { color: var(--muted); opacity: 1; }
  select { width: 100%; font-size: var(--type-body); }
  select option { background: var(--lcd); }
  .switch { display: flex; border: 2px solid var(--muted); }
  .switch button, .utility { min-height: 48px; padding: 7px 10px; background: transparent; border: 0; font-size: var(--type-label); }
  .switch button + button { border-left: 2px solid var(--muted); }
  .switch button[aria-pressed=true] { background: var(--ink); color: var(--lcd); }
  .utility { border: 2px solid var(--muted); }
  .utility:hover { background: var(--ink); color: var(--lcd); }
  .workspace { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(280px, 1.3fr) minmax(250px, 1fr); gap: 16px; align-items: stretch; }
  .catalog { min-width: 0; min-height: 0; display: flex; flex-direction: column; }
  .catalog-header { padding: 0 4px 9px; display: flex; justify-content: space-between; gap: 12px; border-bottom: 2px solid var(--muted); }
  .entries { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 2px;
    flex: 1; min-height: 0; align-content: start; grid-auto-rows: max-content; overflow-y: auto; padding: 4px 6px 4px 0;
    scrollbar-color: var(--muted) var(--line); scrollbar-width: thin; }
  .entry { border: 0; border-bottom: 2px dotted var(--line); color: var(--ink); background: transparent; text-align: center;
    min-width: 0; padding: 10px 6px; position: relative; display: flex; flex-direction: column; align-items: center; gap: 5px; }
  .entry:hover { background: #a4b488; }
  .entry[aria-pressed=true] { background: var(--ink); color: var(--lcd); }
  .entry:focus-visible { outline: 2px dotted var(--lcd); outline-offset: -4px; z-index: 1; }
  .entry-id { color: var(--muted); font-size: var(--type-label); }
  .entry-name { font-size: var(--type-body); overflow-wrap: anywhere; width: 100%; text-transform: uppercase; }
  .entry-status { font-size: var(--type-small); }
  .entry.locked { color: var(--muted); }
  .entry[aria-pressed=true] .entry-id, .entry[aria-pressed=true] .entry-stage { color: var(--lcd); }
  .entry-sprite { width: 48px; height: 48px; margin: 4px; }
  svg { shape-rendering: crispEdges; }
  .locked .entry-sprite { opacity: .5; }
  .entries.list { grid-template-columns: 1fr; }
  .list .entry { display: grid; grid-template-columns: 76px minmax(0,1fr) 24px;
    gap: 8px; padding: 10px 8px; text-align: left; align-items: center; min-height: 52px; }
  .list .entry-sprite, .list .entry-stage { display: none; }
  .list .entry-name { font-size: var(--type-name); }
  .list .entry-status { text-align: right; }
  .status-mark { display: none; width: 16px; height: 16px; }
  .list .status-mark { display: block; }
  .list .status-text { display: none; }
  .entry-stage { color: var(--muted); font-size: var(--type-small); }
  .entries:not(.list) .entry-stage { display: none; }
  .no-results { padding: 36px 16px; color: var(--muted); text-align: center; line-height: 2; }
  .detail { border-left: 4px solid var(--line); padding-left: 16px; display: flex; flex-direction: column; min-height: 0; min-width: 0; }
  .detail-heading { flex-shrink: 0; display: flex; justify-content: space-between; gap: 12px; padding: 0 0 10px; border-bottom: 2px solid var(--muted); }
  .detail-id { font-size: var(--type-body); }
  .detail-body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding-top: 12px; scrollbar-width: thin; scrollbar-color: var(--muted) var(--line); }
  .lcd-frame { padding: 0; }
  .lcd { height: 200px; color: var(--ink); display: grid; place-items: center; position: relative; }
  .lcd svg { width: 128px; height: 128px; }
  .lcd-label { display: none; }
  .lcd-number { position: absolute; top: 0; right: 0; font-size: var(--type-small); color: var(--muted); }
  .detail-name { padding: 14px 0; border-bottom: 2px dotted var(--line); }
  .detail-name .micro { margin-top: 4px; }
  .badge { font-size: var(--type-small); color: var(--muted); }
  .facts { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 12px 0; border-bottom: 2px dotted var(--line); }
  .fact { display: grid; gap: 4px; font-size: var(--type-body); }
  .routes { padding-top: 12px; }
  .route-label { margin-bottom: 6px; }
  .route-items { display: flex; flex-wrap: wrap; gap: 6px; }
  .route { background: transparent; border: 2px solid var(--line); padding: 5px 7px; text-align: left; font-size: var(--type-small); }
  .route:hover { background: var(--ink); color: var(--lcd); }
  .route span { display: block; font-size: var(--type-small); }
  .hint { color: var(--muted); font-size: var(--type-small); line-height: 1.8; }
  .record-extra { margin-top: 12px; }
  .record-extra summary { cursor: pointer; font-size: var(--type-label); padding: 6px 0; }
  .record-extra > .hint { margin-top: 12px; }
  .detail-body > .hint { margin: 12px 0; }
  .reference { width: 100%; text-align: left; margin-top: 12px; }
  .detail-nav { flex-shrink: 0; display: flex; justify-content: space-between; gap: 8px; border-top: 2px solid var(--muted); padding-top: 10px; margin-top: 14px; }
  .detail-nav button { background: transparent; border: 0; padding: 4px 0; font-size: var(--type-label); }
  .keyboard-hint { flex-shrink: 0; margin-top: 12px; color: var(--muted); font-size: var(--type-small); }
  .footer { padding: 14px 6px 0; display: flex; align-items: center; justify-content: space-between; gap: 16px;
    font-size: var(--type-body); color: var(--case-ink); }
  .archive-status { font-size: var(--type-small); margin-left: auto; }
  .case-dots { font-family: monospace; font-size: 28px; line-height: 16px; letter-spacing: 2px; }
  .notice { flex-shrink: 0; max-height: 20%; overflow-y: auto; padding: 10px; margin: 0 0 12px; border: 2px dashed var(--muted); font-size: var(--type-body); }
  [hidden] { display: none !important; }
  @media (min-width: 1000px) { .lcd svg { width: 160px; height: 160px; } }
  @media (max-width: 820px) { .toolbar { grid-template-columns: minmax(0,1fr) minmax(0,1fr); }
    .switch button { flex: 1; } }
  @media (max-width: 820px) { body { padding: 10px; } .workspace { grid-template-columns: 1fr; grid-template-rows: minmax(0,1fr) minmax(0,1.6fr); }
    .detail { position: static; border-left: 0; border-top: 4px solid var(--line); padding: 16px 0 0; }
    .entries { max-height: none; } .lcd { height: 200px; } .lcd svg { width: 160px; height: 160px; } }
  @media (max-width: 600px) { body { padding: 10px; } .device { padding: 10px; } .screen { padding: 10px; }
    .brand, h1 { font-size: var(--type-body); } .masthead { gap: 12px; flex-wrap: wrap; }
    .completion > div:first-child { flex-wrap: wrap; gap: 6px; } .completion > div:first-child > p { width: 100%; }
    #percent, .archive-status, .keyboard-hint { display: none; } .footer { font-size: var(--type-small); }
    .toolbar { gap: 10px; max-height: 35dvh; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--muted) var(--line); } .switch button, .utility { padding: 7px 8px; }
    .list .entry { grid-template-columns: minmax(0,1fr) 24px; } .list .entry-id { display: none; }
    .detail-heading { flex-wrap: wrap; }
    .catalog-header { flex-wrap: wrap; } .detail-nav { flex-wrap: wrap; } }
  @media (max-height: 750px) {
    body { padding: 8px; } .device { padding: 10px; } .screen { padding: 10px; }
    .brand, h1 { font-size: 20px; line-height: 1.2; } .masthead { padding-bottom: 8px; }
    .completion { gap: 6px; margin-bottom: 8px; } .completion strong { font-size: 20px; }
    .toolbar { gap: 8px; margin-bottom: 10px; } .field { gap: 3px; }
    input, select, .switch button, .utility { min-height: 40px; }
    .footer { padding-top: 8px; font-size: var(--type-label); } .keyboard-hint { display: none; }
    .detail-body { padding-top: 8px; } .lcd-frame { float: left; width: 96px; margin-right: 12px; }
    .lcd { height: 112px; } .lcd svg { width: 96px; height: 96px; } .lcd-number { display: none; }
    .detail-name { min-height: 112px; padding: 8px 0; } .detail-name h2 { font-size: 24px; }
    .facts { clear: both; padding: 8px 0; } .record-extra { margin-top: 6px; }
    .detail-nav { padding-top: 6px; margin-top: 8px; } .catalog-header, .detail-heading { padding-bottom: 6px; }
  }
  @media (max-width: 820px) and (max-height: 750px) {
    .toolbar { max-height: 35dvh; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--muted) var(--line); } .detail { padding-top: 8px; }
  }
  @media (forced-colors: active) { .entry[aria-pressed=true] { outline: 2px solid Highlight; } }
`
