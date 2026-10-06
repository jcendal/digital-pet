export const SIDEBAR_SCRIPT = /* javascript */ `
  const vscode = acquireVsCodeApi();
  let model = null;
  let state = {phase:'idle'};
  let artwork = '';
  let artworkColumns = 32;
  let battleHud = null;
  const byId = id => document.getElementById(id);
  const root = document.querySelector('.pet-module');
  const renderBattleHud = () => {
    const visible = battleHud !== null;
    document.querySelector('.arena').classList.toggle('with-battle-hud',visible);
    byId('battle-scores').hidden = !visible;
    byId('battle-caption').hidden = !visible || !battleHud.caption;
    byId('battle-caption').textContent = battleHud?.caption || '';
    if (!visible) return;
    document.querySelector('.arena').setAttribute('aria-label','Battle: partner ' + battleHud.playerHits + ' / ' + battleHud.hitsToWin + ' hits; opponent ' + battleHud.opponentHits + ' / ' + battleHud.hitsToWin + ' hits' + (battleHud.caption ? '; ' + battleHud.caption : ''));
    for (const [id,hits] of [['player-score',battleHud.playerHits],['opponent-score',battleHud.opponentHits]]) {
      const score = byId(id); score.replaceChildren();
      score.setAttribute('aria-label',(id === 'player-score' ? 'Partner' : 'Opponent') + ': ' + hits + ' / ' + battleHud.hitsToWin + ' hits');
      for (let index = 0; index < battleHud.hitsToWin; index++) {
        const pip = document.createElement('span'); pip.className = index < hits ? 'score-pip filled' : 'score-pip'; pip.setAttribute('aria-hidden','true'); score.append(pip);
      }
    }
  };
  const renderArtwork = () => {
    const svg = byId('artwork'); svg.replaceChildren();
    const lines = artwork.split('\\n');
    const width = Math.max(artworkColumns,...lines.map(line => Array.from(line).length));
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + Math.max(16,lines.length * 2));
    const append = (tag, attrs) => { const node = document.createElementNS('http://www.w3.org/2000/svg',tag); for (const [key,value] of Object.entries(attrs)) node.setAttribute(key,String(value)); svg.append(node); return node; };
    for (const [row,line] of lines.entries()) for (const [column,cell] of Array.from(line).entries()) {
      if (battleHud && (row === battleHud.scoreRow || row === battleHud.captionRow) && column >= battleHud.gapStartColumn && column < battleHud.gapStartColumn + battleHud.gapColumns) continue;
      if ('█▀▄░▒▓'.includes(cell)) {
        const top = cell !== '▄'; const bottom = cell !== '▀';
        const opacity = cell === '░' ? .25 : cell === '▒' ? .5 : cell === '▓' ? .75 : 1;
        if (top) append('rect',{x:column,y:row*2,width:1,height:1,fill:'currentColor',opacity});
        if (bottom) append('rect',{x:column,y:row*2+1,width:1,height:1,fill:'currentColor',opacity});
      } else if (cell.trim()) {
        // Battle captions (HIT!, WIN!, MISS) share frames with the pixel sprites.
        const text = append('text',{x:column+.5,y:row*2+1.6,'text-anchor':'middle','font-family':'monospace','font-size':1.6,fill:'currentColor'}); text.textContent = cell;
      }
    }
  };
  const render = () => {
    const active = model?.kind === 'partner';
    root.classList.toggle('no-partner',!active);
    root.classList.toggle('animating',state.phase !== 'idle');
    root.classList.toggle('battling',state.phase === 'battle');
    byId('empty').hidden = active;
    byId('empty').textContent = model?.messageLine || 'Spawn a partner to begin.';
    byId('phase').textContent = !active ? 'NO PARTNER' : state.phase === 'idle' ? (model.frozen ? 'FROZEN' : 'ACTIVE') : state.phase.toUpperCase();
    if (!active) return;
    byId('name').textContent = model.name;
    byId('name').title = model.name;
    byId('stage').textContent = state.phase === 'battle' ? (model.opponentName || '') : state.phase === 'evolving' ? 'TRANSFORMING...' : state.phase === 'defeated' ? 'DEFEAT · ' + model.stage : model.stage;
    byId('stage').title = byId('stage').textContent;
    const percent = Math.round(model.progress * 100);
    byId('progress-label').textContent = model.terminal ? 'FINAL STAGE' : 'NEXT CHECK';
    byId('percent').textContent = model.terminal ? '' : percent + '%';
    byId('meter').hidden = model.terminal;
    byId('meter').setAttribute('aria-valuenow',String(percent));
    byId('meter-fill').style.width = percent + '%';
    const abbreviated = model.gauge.split('/').map(value => {
      const count = Number(value.replaceAll(',', ''));
      return Number.isFinite(count) ? new Intl.NumberFormat('en', {notation:'compact',maximumFractionDigits:1}).format(count) : value;
    }).join(' / ');
    byId('gauge').textContent = model.terminal ? 'No further evolution check.' : abbreviated;
    byId('gauge').title = model.gauge;
    document.querySelector('.arena').setAttribute('aria-label', (state.phase === 'idle' ? 'Partner' : state.phase) + ' animation: ' + model.name);
  };
  const reportWidth = () => {
    const width = document.querySelector('.arena').clientWidth;
    if (width > 0) {
      const columns = Math.max(state.phase === 'idle' ? 16 : 36,Math.floor(width / 6));
      if (columns !== artworkColumns) { artworkColumns = columns; renderArtwork(); }
      vscode.postMessage({type:'artwork-width',width:columns});
    }
  };
  for (const button of document.querySelectorAll('[data-panel]')) button.addEventListener('click', () => vscode.postMessage({type:'open-panel',panel:button.dataset.panel}));
  window.addEventListener('message', event => {
    const message = event.data;
    if (message?.type === 'sidebar-model') { model = message; render(); reportWidth(); }
    if (message?.type === 'presentation-state') { state = message.state; if (state.phase !== 'battle') { battleHud = null; renderBattleHud(); } render(); reportWidth(); }
    if (message?.type === 'animation-frame' && typeof message.artwork === 'string') { artwork = message.artwork; battleHud = message.hud || null; renderBattleHud(); renderArtwork(); }
  });
  new ResizeObserver(reportWidth).observe(root);
  render(); reportWidth();
  vscode.postMessage({type:"sidebar-ready"});
`
