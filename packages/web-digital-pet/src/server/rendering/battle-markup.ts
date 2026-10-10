export const battleMarkup = /* html */ `
<dialog id="battle-dialog" class="web-dialog" aria-labelledby="battle-title">
  <header class="dialog-head"><div><p class="dialog-eyebrow">DIGIMON ARENA</p><h2 id="battle-title">PLAYER BATTLE</h2></div><form method="dialog"><button class="dialog-close" aria-label="Close battle">✕</button></form></header>
  <div class="dialog-body">
    <p class="section-description">Keep both apps open with THIS BROWSER selected. Use your hatched companions. A win gives 20% experience; a draw gives none. Final-stage Digimon can battle without gaining experience.</p>
    <label for="battle-own-code">YOUR BATTLE CODE</label><div class="pair-code-row"><output id="battle-own-code">CONNECTING…</output><button id="battle-copy" type="button">COPY</button></div>
    <p class="setting-caption">This code changes when you reopen the app.</p>
    <label for="battle-target">OTHER PLAYER'S CODE</label><div class="pair-code-row"><input id="battle-target" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="off" placeholder="000000"><button id="battle-request" type="button" disabled>CHALLENGE</button></div>
    <p id="battle-status" class="connection-status" role="status" aria-live="polite">Connecting…</p>
    <section id="battle-incoming" hidden><h3>BATTLE REQUEST</h3><p id="battle-incoming-text"></p><div class="dialog-actions"><button id="battle-accept" class="primary-action" type="button">ACCEPT BATTLE</button><button id="battle-decline" type="button">DECLINE</button></div></section>
    <section id="battle-arena" hidden aria-label="Player battle"><p id="battle-score"></p><pre id="battle-artwork" aria-hidden="true"></pre></section>
  </div>
</dialog>`
