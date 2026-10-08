import optionsStylesSource from "./options-styles.css" with { type: "text" }

const deviceIcon = /* html */ `<svg class="option-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M2 2h8v2H2zm0 2h2v12H2zm6 0h2v12H8zm-6 12h8v2H2zm2-3h4v2H4zm10-7h8v2h-8zm0 2h2v12h-2zm6 0h2v12h-2zm-6 12h8v2h-8zm2-3h4v2h-4zM10 8h4v2h-4zm0 4h4v2h-4z"/></svg>`
const eggIcon = /* html */ `<svg class="option-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10 2h4v2h-4zM8 4h2v4H8zm6 0h2v4h-2zM6 8h2v4H6zm10 0h2v4h-2zM4 12h2v6H4zm14 0h2v6h-2zM6 18h2v2H6zm10 0h2v2h-2zM8 20h8v2H8zM8 10h4v4H8zm4 6h4v2h-4z"/></svg>`

export const optionsMarkup = /* html */ `
<dialog id="options-dialog" class="web-dialog" aria-labelledby="options-title">
  <header class="dialog-head"><div><p class="dialog-eyebrow">DIGITAL MONSTER</p><h2 id="options-title">OPTIONS</h2></div><form method="dialog"><button class="dialog-close" aria-label="Close options">✕</button></form></header>
  <div class="dialog-body">
    <section class="save-section"><h3>YOUR SAVE</h3>
      <div class="save-choices">
        <label class="save-choice"><input id="source-computer" type="radio" name="save-source" value="sqlite"><span class="save-card"><span class="save-card-head"><strong>COMPUTER SAVE</strong><small id="computer-availability" class="save-badge"></small></span><small class="save-description">Your companion from Cursor or OpenCode on this computer.</small></span></label>
        <p id="computer-connection-hint" class="hint" aria-live="polite"></p><button id="computer-retry" class="utility" type="button" hidden>TRY CONNECTING AGAIN</button>
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

export const optionsStyles = optionsStylesSource
