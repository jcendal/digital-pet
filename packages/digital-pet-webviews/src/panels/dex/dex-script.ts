import { PANEL_SCRIPT_HELPERS } from "../../shared/panel-script.ts"

// Runs inside the isolated VS Code webview or the local browser app. Catalog strings enter the DOM through textContent.
export const DEX_SCRIPT = /* javascript */ `
  const vscode = window.digitalPetBridge || acquireVsCodeApi();
  let model = JSON.parse(document.getElementById('dex-data').textContent);
  const saved = vscode.getState() || {};
  const search = document.getElementById('search');
  const stage = document.getElementById('stage');
  const discovery = document.getElementById('discovery');
  const entries = document.getElementById('entries');
  const detail = document.getElementById('detail');
  let selectedId = typeof saved.selectedId === 'string' ? saved.selectedId : (model.entries.find(e => e.discovered)?.id || model.entries[0]?.id);
  let mode = saved.mode === 'grid' ? 'grid' : 'list';
  let expanded = saved.expanded === true;
  let filtered = [];
  search.value = typeof saved.search === 'string' ? saved.search : '';
  stage.value = typeof saved.stage === 'string' ? saved.stage : 'all';
  if (!stage.value) stage.value = 'all';
  discovery.value = ['all', 'registered', 'unknown'].includes(saved.discovery) ? saved.discovery : 'all';
  const remember = () => vscode.setState({ selectedId, mode, expanded, search: search.value, stage: stage.value, discovery: discovery.value, scroll: entries.scrollTop });
  ${PANEL_SCRIPT_HELPERS}
  const date = value => {
    if (!value || !Number.isFinite(Date.parse(value))) return '--';
    return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };
  const fact = (label, value) => {
    const node = element('div', 'fact');
    node.append(element('span', 'micro', label), element('span', '', value));
    return node;
  };
  const selectEntry = (id, focus = false) => {
    selectedId = id;
    renderSelection();
    remember();
    if (focus) {
      const button = Array.from(entries.children).find(node => node.dataset.id === id);
      button?.focus({ preventScroll: true });
      button?.scrollIntoView({ block: 'nearest' });
    }
  };
  const routeGroup = (label, ids) => {
    const section = element('section', 'routes');
    section.append(element('h3', 'route-label', label));
    const items = element('div', 'route-items');
    for (const id of ids) {
      const target = model.entries.find(e => e.id === id);
      if (!target) continue;
      const button = element('button', 'route', target.discovered ? target.name : '???');
      button.type = 'button';
      button.append(element('span', '', id));
      button.addEventListener('click', () => {
        // A route may leave the current filter. Reset filters so the selected entry stays in its catalog context.
        search.value = ''; stage.value = 'all'; discovery.value = 'all'; selectedId = id;
        render(); selectEntry(id, true);
      });
      items.append(button);
    }
    if (!items.childElementCount) items.append(element('p', 'hint', 'No routes in this V-Pet catalog.'));
    section.append(items);
    return section;
  };
  const renderSelection = () => {
    for (const button of entries.children) {
      const selected = button.dataset.id === selectedId;
      button.setAttribute('aria-pressed', String(selected));
      button.tabIndex = selected ? 0 : -1;
    }
    detail.replaceChildren();
    const entry = model.entries.find(e => e.id === selectedId);
    if (!entry) {
      detail.append(element('p', 'no-results', 'No matching records. Change your filters to continue browsing.'));
      return;
    }
    const heading = element('div', 'detail-heading');
    heading.append(element('span', 'micro', 'DIGIMON RECORD'), element('span', 'detail-id', entry.id));
    const body = element('div', 'detail-body');
    const frame = element('div', 'lcd-frame');
    const lcd = element('div', 'lcd');
    lcd.append(sprite(entry), element('span', 'lcd-label', entry.discovered ? (entry.artwork ? 'DATA REGISTERED' : 'SPRITE UNAVAILABLE') : 'NO DATA'), element('span', 'lcd-number', 'LV.' + entry.stageNumber));
    frame.append(lcd);
    const name = element('div', 'detail-name');
    name.append(element('div', 'badge', entry.discovered ? 'REGISTERED' : 'UNDISCOVERED'), element('h2', '', entry.name));
    if (entry.alternateName && entry.alternateName !== entry.name) name.append(element('p', 'micro', entry.alternateName));
    const facts = element('div', 'facts');
    facts.append(fact('STAGE', entry.stage), fact('CATALOG ID', entry.id));
    body.append(frame, name, facts);
    if (entry.discovered) {
      const extra = element('details', 'record-extra');
      extra.open = expanded;
      extra.addEventListener('toggle', () => { expanded = extra.open; remember(); });
      extra.append(element('summary', '', 'EVOLUTION & ARCHIVE'));
      const history = element('div', 'facts');
      history.append(fact('FIRST REGISTERED', date(entry.firstSeen)), fact('GENERATIONS', String(entry.generations)));
      extra.append(history, routeGroup('EVOLVES FROM', entry.previousIds), routeGroup('EVOLVES TO', entry.nextIds));
      extra.append(element('p', 'hint', 'Routes follow this V-Pet catalog. Other Digimon games may use different evolution paths.'));
      if (entry.url) {
        const reference = element('button', 'utility reference', 'OPEN DIGIMON REFERENCE >');
        reference.type = 'button';
        reference.addEventListener('click', () => vscode.postMessage({ type: 'dex-reference', id: entry.id, url: entry.url }));
        extra.append(reference);
      }
      body.append(extra);
    } else {
      body.append(element('p', 'hint locked-message', model.status === 'unavailable'
        ? 'The partner archive could not be read. Refresh to restore your discovery records.'
        : 'Raise and evolve a partner to register this Digimon. Its name, sprite and evolution routes will appear here. Set Digimon overrides do not register discoveries.'));
    }
    const nav = element('nav', 'detail-nav');
    nav.setAttribute('aria-label', 'Record navigation');
    const index = filtered.findIndex(e => e.id === selectedId);
    for (const [offset, label] of [[-1, '< PREVIOUS'], [1, 'NEXT >']]) {
      const button = element('button', '', label);
      button.type = 'button';
      const target = filtered[index + offset];
      button.disabled = !target;
      button.addEventListener('click', () => { if (target) selectEntry(target.id, true); });
      nav.append(button);
    }
    detail.append(heading, body, nav);
  };
  const render = () => {
    const query = search.value.trim().toLowerCase();
    filtered = model.entries.filter(entry =>
      (stage.value === 'all' || String(entry.stageNumber) === stage.value) &&
      (discovery.value === 'all' || entry.discovered === (discovery.value === 'registered')) &&
      (entry.id.toLowerCase().includes(query) || (entry.discovered && (entry.name + ' ' + entry.alternateName).toLowerCase().includes(query))));
    if (!filtered.some(entry => entry.id === selectedId)) selectedId = filtered[0]?.id;
    entries.className = 'entries ' + mode;
    const fragment = document.createDocumentFragment();
    for (const entry of filtered) {
      const button = element('button', 'entry' + (entry.discovered ? '' : ' locked'));
      button.type = 'button'; button.dataset.id = entry.id;
      button.setAttribute('aria-label', entry.id + ', ' + entry.name + ', ' + entry.stage + ', ' + (entry.discovered ? 'registered' : 'undiscovered'));
      const status = element('span', 'entry-status');
      status.setAttribute('aria-hidden', 'true');
      status.append(element('span', 'status-text', entry.discovered ? 'FOUND' : 'LOCKED'));
      const mark = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      mark.setAttribute('viewBox', '0 0 8 8'); mark.setAttribute('class', 'status-mark');
      const markPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      markPath.setAttribute('fill', 'currentColor');
      markPath.setAttribute('d', entry.discovered ? 'M1 4h1v1h1v1h1V4h1V2h1V1h1v2H6v2H5v2H3V6H2V5H1z' : 'M2 4h4v1H2z');
      mark.append(markPath); status.append(mark);
      button.append(element('span', 'entry-id', entry.id), sprite(entry, 'entry-sprite'), element('span', 'entry-name', entry.discovered ? entry.name : '???'), element('span', 'entry-stage', entry.stage), status);
      button.addEventListener('click', () => selectEntry(entry.id));
      fragment.append(button);
    }
    entries.replaceChildren(fragment);
    document.getElementById('no-results').hidden = filtered.length > 0;
    document.getElementById('result-count').textContent = filtered.length + ' / ' + model.entries.length;
    document.getElementById('discovered-count').textContent = model.status === 'unavailable' ? '--' : String(model.discovered).padStart(3, '0');
    document.getElementById('total-count').textContent = String(model.entries.length);
    const progress = Math.round(model.discovered / Math.max(1, model.entries.length) * 100);
    document.getElementById('percent').textContent = model.status === 'unavailable' ? '--' : progress + '%';
    const meter = document.getElementById('meter');
    meter.setAttribute('aria-valuenow', String(progress));
    meter.setAttribute('aria-valuetext', model.status === 'unavailable' ? 'Archive unavailable' : model.discovered + ' of ' + model.entries.length + ' discovered');
    document.getElementById('meter-fill').style.width = progress + '%';
    const notice = document.getElementById('notice');
    notice.hidden = model.status === 'available'; notice.textContent = model.message;
    document.getElementById('archive-status').textContent = model.status === 'unavailable' ? 'ARCHIVE OFFLINE' : 'LOCAL ARCHIVE';
    for (const value of ['grid', 'list']) document.getElementById(value + '-mode').setAttribute('aria-pressed', String(mode === value));
    renderSelection(); remember();
  };
  search.addEventListener('input', render);
  stage.addEventListener('change', render);
  discovery.addEventListener('change', render);
  entries.addEventListener('scroll', remember);
  entries.addEventListener('keydown', event => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = filtered.findIndex(e => e.id === selectedId);
    const columns = mode === 'list' ? 1 : Math.max(1, getComputedStyle(entries).gridTemplateColumns.split(' ').length);
    const step = event.key === 'ArrowDown' ? columns : event.key === 'ArrowUp' ? -columns : event.key === 'ArrowLeft' ? -1 : 1;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? filtered.length - 1 : Math.min(filtered.length - 1, Math.max(0, index + step));
    if (filtered[next]) selectEntry(filtered[next].id, true);
  });
  for (const value of ['grid', 'list']) document.getElementById(value + '-mode').addEventListener('click', () => { mode = value; render(); });
  document.getElementById('refresh').addEventListener('click', () => vscode.postMessage({ type: 'dex-refresh' }));
  window.addEventListener('message', event => {
    if (event.data?.type === 'dex-select') {
      const target = model.entries.find(entry => entry.id === event.data.id && entry.discovered);
      if (target) { search.value = ''; stage.value = 'all'; discovery.value = 'all'; selectedId = target.id; render(); selectEntry(target.id, true); }
      return;
    }
    if (event.data?.type !== 'dex-model') return;
    model = event.data.model;
    const scroll = entries.scrollTop;
    render(); entries.scrollTop = scroll;
  });
  render();
  if (Number.isFinite(saved.scroll)) entries.scrollTop = saved.scroll;
  vscode.postMessage({ type: 'dex-ready' });
`
