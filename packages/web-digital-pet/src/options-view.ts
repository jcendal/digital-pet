const deviceIcon = /* html */ `<svg class="option-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M2 2h8v2H2zm0 2h2v12H2zm6 0h2v12H8zm-6 12h8v2H2zm2-3h4v2H4zm10-7h8v2h-8zm0 2h2v12h-2zm6 0h2v12h-2zm-6 12h8v2h-8zm2-3h4v2h-4zM10 8h4v2h-4zm0 4h4v2h-4z"/></svg>`
const eggIcon = /* html */ `<svg class="option-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10 2h4v2h-4zM8 4h2v4H8zm6 0h2v4h-2zM6 8h2v4H6zm10 0h2v4h-2zM4 12h2v6H4zm14 0h2v6h-2zM6 18h2v2H6zm10 0h2v2h-2zM8 20h8v2H8zM8 10h4v4H8zm4 6h4v2h-4z"/></svg>`

export const optionsMarkup = /* html */ `
<dialog id="options-dialog" class="web-dialog" aria-labelledby="options-title">
  <header class="dialog-head"><div><p class="dialog-eyebrow">DIGITAL MONSTER</p><h2 id="options-title">OPTIONS</h2></div><form method="dialog"><button class="dialog-close" aria-label="Close options">✕</button></form></header>
  <div class="dialog-body">
    <section class="save-section"><h3>YOUR SAVE</h3>
      <div class="save-choices">
        <label class="save-choice"><input id="source-computer" type="radio" name="save-source" value="sqlite"><span class="save-card"><span class="save-card-head"><strong>COMPUTER SAVE</strong><small id="computer-availability" class="save-badge"></small></span><small class="save-description">Your companion from Cursor or OpenCode on this computer.</small></span></label>
        <label class="save-choice"><input id="source-browser" type="radio" name="save-source" value="browser"><span class="save-card"><span class="save-card-head"><strong>THIS BROWSER</strong><small class="save-badge">ON DEVICE</small></span><small class="save-description">A separate companion that grows over time. Take it to your other devices.</small></span></label>
      </div>
      <p class="save-note"><span class="note-mark" aria-hidden="true"></span>Switching keeps both saves. Choice saved on this device.</p>
      <aside id="browser-options-hint" class="source-notice" hidden><strong>COMPUTER COMPANION</strong><p>Manage growth and new eggs in Cursor or OpenCode. Choose THIS BROWSER to use the options below.</p></aside>
    </section>
    <section class="world-section"><h3>YOUR WORLD</h3><p class="section-description">Explore a new home with your companion.</p><button id="world-button" class="wide-action" type="button" aria-haspopup="dialog"><span>EXPLORE REGIONS<span id="world-current">Dragon Eye Lake</span></span><span aria-hidden="true">→</span></button><button id="landscape-motion" class="wide-action" type="button" aria-pressed="false"><span>MOVING LANDSCAPE</span><span id="landscape-motion-state" class="value-badge">OFF</span></button><p class="setting-caption">Scrolls gently in the direction your companion walks.</p></section>
    <fieldset id="browser-options"><legend class="sr-only">Browser companion options</legend>
      <section class="growth-section"><div class="section-heading"><h3>EXPERIENCE TO EVOLVE</h3><span id="experience-amount" class="value-badge">100%</span></div>
        <p class="section-description">Set the pace of your companion's journey.</p>
        <div id="experience-control" class="experience-control" data-level="high">
          <label class="sr-only" for="experience-level">Experience to evolve</label>
          <input id="experience-level" class="experience-slider" type="range" min="0" max="2" step="1" value="2" aria-valuetext="High">
          <div class="range-labels"><button type="button" data-experience-index="0" aria-pressed="false">LOW<span>10%</span></button><button type="button" data-experience-index="1" aria-pressed="false">NORMAL<span>50%</span></button><button type="button" data-experience-index="2" aria-pressed="true">HIGH<span>100%</span></button></div>
        </div>
        <p id="experience-description" class="setting-caption"></p>
      </section>
      <section class="devices-section"><div class="action-heading">${deviceIcon}<div><h3>CONNECT DEVICES</h3><p class="section-description">Your companion, on another screen.</p></div></div>
        <div id="paired-device" class="paired-card" hidden><span class="card-label">PAIRED DEVICE</span><p id="pair-linked"></p><button id="pair-sync" class="primary-action" type="button" disabled><span>SYNC COMPANION</span><span aria-hidden="true">↓</span></button><p class="setting-caption">Brings the other device's save here, with a backup of yours. Keep both apps open.</p></div>
        <button id="pair-button" class="wide-action" type="button"><span id="pair-button-label">PAIR DEVICES</span><span aria-hidden="true">→</span></button>
        <button id="pair-forget" class="text-action" type="button" hidden>FORGET PAIRED DEVICE</button>
        <p id="pair-summary" class="connection-status" role="status" aria-live="polite"></p>
      </section>
      <section class="backup-section"><h3>BACK UP YOUR SAVE</h3><p class="section-description">Keep a copy of your companion outside this browser.</p>
        <button id="backup-download" class="wide-action" type="button">DOWNLOAD BACKUP</button>
        <button id="backup-import" class="wide-action" type="button">IMPORT BACKUP</button>
        <input id="backup-file" class="sr-only" type="file" accept=".json,application/json" aria-label="Choose a Digital Pet backup">
        <div id="backup-confirm" class="confirm-box" hidden><strong>REPLACE THIS BROWSER SAVE?</strong><p id="backup-preview"></p><p>Your current save can be restored from Options after import.</p><div class="dialog-actions"><button id="backup-accept" class="primary-action" type="button">REPLACE SAVE</button><button id="backup-cancel" type="button">CANCEL</button></div></div>
        <button id="backup-restore" class="text-action" type="button" hidden>RESTORE PREVIOUS SAVE</button>
        <p class="setting-caption">Updates keep your browser save. A downloaded backup also protects it if browser data is cleared.</p>
      </section>
      <section class="new-partner-section"><div class="action-heading">${eggIcon}<div><h3>A NEW JOURNEY</h3><p class="section-description">Start fresh. Keep your past companions.</p></div></div>
        <button id="new-partner" class="wide-action" type="button"><span>START A NEW EGG</span><span aria-hidden="true">+</span></button>
        <p class="setting-caption">Your current companion moves to History.</p>
        <div id="new-partner-confirm" class="confirm-box" hidden><strong>READY FOR A NEW EGG?</strong><p>Your current companion will stay in History.</p><div class="dialog-actions"><button id="new-partner-accept" class="primary-action" type="button">START NEW</button><button id="new-partner-cancel" type="button">KEEP COMPANION</button></div></div>
      </section>
    </fieldset>
  </div>
  <p id="options-status" class="dialog-feedback" role="status" aria-live="polite"></p>
</dialog>
<dialog id="pair-dialog" class="web-dialog" aria-labelledby="pair-title">
  <header class="dialog-head"><div><p class="dialog-eyebrow">CONNECT DEVICES</p><h2 id="pair-title">PAIR DEVICES</h2></div><form method="dialog"><button class="dialog-close" aria-label="Close pairing">✕</button></form></header>
  <div class="dialog-body">
    <p class="section-description">Enter the other device's code to bring its companion here. Both apps must be open with THIS BROWSER selected.</p>
    <label for="pair-own-code">THIS DEVICE</label><div class="pair-code-row"><output id="pair-own-code">LOADING…</output><button id="pair-copy" type="button">COPY</button></div>
    <label for="pair-target">OTHER DEVICE CODE</label><div class="pair-code-row"><input id="pair-target" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX"><button id="pair-request" type="button" disabled>REQUEST</button></div>
    <p id="pair-status" class="connection-status" role="status" aria-live="polite">Connecting…</p>
    <section id="pair-incoming" hidden><h3>PAIRING REQUEST</h3><p>Device <strong id="pair-incoming-code"></strong> wants to receive your save and pair with you.</p><div class="dialog-actions"><button id="pair-send" class="primary-action" type="button">SEND SAVE & PAIR</button><button id="pair-decline" type="button">DECLINE</button></div></section>
    <section id="pair-preview" hidden><h3>RECEIVED SAVE</h3><p id="pair-preview-text"></p><div class="dialog-actions"><button id="pair-import" class="primary-action" type="button">REPLACE SAVE & PAIR</button><button id="pair-reject" type="button">KEEP MINE</button></div></section>
    <button id="pair-restore" class="wide-action" type="button" hidden>RESTORE PREVIOUS SAVE</button>
  </div>
</dialog>`

export const optionsStyles = /* css */ `
  .web-dialog { width: min(94vw, 410px); max-height: min(90dvh, 820px); padding: 0; overflow: hidden;
    color: var(--ink); background: var(--lcd); border: 6px double var(--case-edge);
    box-shadow: 0 10px 35px #0009; font: 13px 'Digital Pet Pixel', monospace; }
  .web-dialog[open] { display: flex; flex-direction: column; }
  #options-dialog { height: min(90dvh, 820px); }
  .web-dialog::backdrop { background: #071211b8; }
  .web-dialog h2 { margin: 0; font-size: 19px; line-height: 1.4; }
  .web-dialog h3 { margin: 0; font-size: 13px; line-height: 1.5; }
  .web-dialog p { margin: 0; line-height: 1.65; }
  .web-dialog small, .web-dialog .section-description, .setting-caption { font-size: 11px; line-height: 1.65; }
  .web-dialog button, .web-dialog input { font: inherit; color: var(--ink); background: transparent; border-radius: 0; }
  .web-dialog button, .web-dialog input:not([type=radio]):not([type=range]) { border: 2px solid var(--muted); padding: 10px; }
  .web-dialog button { cursor: pointer; min-height: 44px; }
  .web-dialog button:hover:not(:disabled) { background: var(--ink); color: var(--lcd); border-color: var(--ink); }
  .web-dialog button:disabled { cursor: default; opacity: .55; }
  .web-dialog button:focus-visible, .web-dialog input:focus-visible { outline: 2px dotted var(--ink); outline-offset: 3px; }
  .dialog-head { flex: none; display: flex; justify-content: space-between; align-items: center; gap: 12px;
    padding: 12px 16px; border-bottom: 2px solid var(--muted); }
  .web-dialog .dialog-eyebrow { margin-bottom: 3px; color: var(--muted); font-size: 9px; letter-spacing: 1px; }
  .web-dialog .dialog-close { display: grid; place-items: center; width: 36px; min-height: 36px; padding: 0; border: 2px solid var(--line); font-size: 16px; }
  .dialog-body { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 18px 16px 20px;
    overscroll-behavior: contain; scrollbar-color: var(--muted) var(--line); scrollbar-width: thin; }
  .dialog-body::-webkit-scrollbar { width: 6px; }
  .dialog-body::-webkit-scrollbar-track { background: var(--line); }
  .dialog-body::-webkit-scrollbar-thumb { background: var(--muted); border-radius: 0; }
  .web-dialog section { border-top: 2px solid var(--line); margin-top: 22px; padding-top: 20px; }
  .web-dialog .save-section { border: 0; margin: 0; padding: 0; }
  .web-dialog [hidden] { display: none !important; }
  .web-dialog fieldset { min-width: 0; margin: 0; padding: 0; border: 0; }
  .web-dialog fieldset:disabled .experience-control, .web-dialog fieldset:disabled .option-icon { opacity: .55; }
  .web-dialog fieldset:disabled .connection-status { display: none; }
  #landscape-motion { margin-top: 12px; }
  #landscape-motion[aria-pressed=true] { border-color: var(--ink); }
  .save-choices { display: grid; gap: 10px; margin-top: 12px; }
  .save-choice { display: block; position: relative; cursor: pointer; }
  .save-choice input { appearance: none; -webkit-appearance: none; position: absolute; z-index: 1;
    width: 16px; height: 16px; top: 14px; left: 12px; margin: 0; border: 2px solid var(--muted); }
  .save-choice input:checked { border-color: var(--lcd); box-shadow: inset 0 0 0 3px var(--ink); background: var(--lcd); }
  .save-choice input:checked:focus-visible { outline-color: var(--lcd); }
  .save-choice input:disabled { opacity: .5; cursor: default; }
  .save-card { display: block; padding: 12px 12px 12px 38px; border: 2px solid var(--line); }
  .save-choice input:checked + .save-card { color: var(--lcd); background: var(--ink); border-color: var(--ink); }
  .save-choice input:disabled + .save-card { color: var(--muted); border-style: dashed; }
  .save-choice:has(input:disabled) { cursor: default; }
  .save-card-head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
  .save-card strong { font-size: 12px; font-weight: 400; }
  .web-dialog .save-badge { font-size: 8px; padding: 2px 4px; border: 1px solid currentColor; line-height: 1.4; }
  .save-description { display: block; margin-top: 7px; }
  .web-dialog .save-note { display: flex; gap: 8px; align-items: start; margin-top: 12px; font-size: 10px; color: var(--muted); }
  .note-mark { flex: none; width: 7px; height: 7px; background: var(--muted); margin-top: 5px; }
  .source-notice { margin-top: 14px; padding: 12px; background: var(--line); border-left: 4px solid var(--muted); }
  .source-notice strong { font-size: 10px; font-weight: 400; }
  .source-notice p { margin-top: 6px; font-size: 10px; }
  .section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .value-badge { flex: none; padding: 4px 6px; font-size: 11px; background: var(--ink); color: var(--lcd); }
  .web-dialog .section-description { margin-top: 5px; color: var(--muted); }
  .experience-control { margin-top: 12px; --range-fill: 100%; }
  .experience-slider { appearance: none; -webkit-appearance: none; display: block; width: 100%; height: 38px; min-width: 0;
    padding: 0; margin: 0; cursor: pointer; background: transparent; }
  .experience-slider::-webkit-slider-runnable-track { height: 12px; border: 2px solid var(--muted); background:
    repeating-linear-gradient(90deg, transparent 0 5px, var(--lcd) 5px 7px),
    linear-gradient(90deg, var(--ink) 0 var(--range-fill), var(--line) var(--range-fill) 100%); }
  .experience-slider::-webkit-slider-thumb { appearance: none; -webkit-appearance: none; width: 20px; height: 24px;
    margin-top: -8px; border: 2px solid var(--ink); background: var(--lcd); box-shadow: inset 0 0 0 3px var(--lcd), inset 0 0 0 7px var(--ink); }
  .experience-slider::-moz-range-track { height: 8px; border: 2px solid var(--muted); background: var(--line); }
  .experience-slider::-moz-range-progress { height: 8px; background: repeating-linear-gradient(90deg, var(--ink) 0 5px, var(--lcd) 5px 7px); }
  .experience-slider::-moz-range-thumb { width: 16px; height: 20px; border: 2px solid var(--ink); border-radius: 0;
    background: var(--lcd); box-shadow: inset 0 0 0 3px var(--lcd), inset 0 0 0 7px var(--ink); }
  .range-labels { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
  .web-dialog .range-labels button { font-size: 11px; padding: 5px 2px; border: 2px solid transparent; }
  .range-labels button span { display: block; margin-top: 4px; font-size: 9px; }
  .web-dialog .range-labels button[aria-pressed=true] { border-color: var(--muted); }
  .web-dialog .setting-caption { margin-top: 10px; color: var(--muted); font-size: 10px; }
  .action-heading { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
  .option-icon { width: 32px; height: 32px; flex: none; color: var(--ink); }
  .wide-action, .primary-action { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; }
  .web-dialog .primary-action { background: var(--ink); border-color: var(--ink); color: var(--lcd); }
  .web-dialog .primary-action:hover:not(:disabled) { box-shadow: inset 0 0 0 2px var(--lcd); }
  .web-dialog .primary-action:focus-visible { outline-color: var(--muted); }
  .devices-section:has(.paired-card[hidden]) #pair-button { background: var(--ink); color: var(--lcd); border-color: var(--ink); }
  .paired-card { padding: 12px; border: 2px solid var(--line); margin-bottom: 10px; }
  .card-label { display: block; font-size: 9px; color: var(--muted); }
  #pair-linked { margin: 6px 0 12px; overflow-wrap: anywhere; font-size: 11px; }
  .web-dialog .text-action { width: 100%; min-height: 44px; margin-top: 6px; border: 0; font-size: 9px; color: var(--muted); text-decoration: underline; text-underline-offset: 4px; }
  .web-dialog .connection-status { margin-top: 12px; padding: 10px 0 0 14px; border-top: 2px dotted var(--line); position: relative; font-size: 10px; color: var(--muted); }
  .connection-status:not(:empty)::before { content: ''; position: absolute; left: 0; top: 16px; width: 6px; height: 6px; background: var(--muted); }
  .web-dialog .connection-status:empty, .web-dialog .dialog-feedback:empty { display: none; }
  .web-dialog .dialog-feedback { flex: none; padding: 10px 16px; font-size: 10px; border-top: 2px solid var(--muted); background: var(--line); }
  .confirm-box { border: 2px solid var(--muted); padding: 12px; margin-top: 12px; }
  .confirm-box strong { font-size: 11px; font-weight: 400; }
  .confirm-box p { font-size: 10px; margin-top: 8px; }
  .dialog-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
  .dialog-actions button { flex: 1 1 auto; width: auto; font-size: 11px; justify-content: center; }
  .pair-code-row { display: flex; align-items: center; gap: 6px; }
  .pair-code-row input { flex: 1; min-width: 0; width: 0; text-transform: uppercase; font-size: 11px; }
  .pair-code-row output { flex: 1; overflow-wrap: anywhere; font-size: 12px; }
  #pair-dialog label { display: block; margin: 18px 0 8px; font-size: 11px; }
  #pair-restore { margin-top: 20px; font-size: 11px; }
  #backup-import { margin-top: 8px; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
  @media (max-width: 360px) { .dialog-head { padding: 10px 12px; } .dialog-body { padding: 14px 12px 18px; }
    .save-card { padding-right: 8px; } .section-heading { gap: 6px; } .web-dialog h3 { font-size: 12px; } }
`
