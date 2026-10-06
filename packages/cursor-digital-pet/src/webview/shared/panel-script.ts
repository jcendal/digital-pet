// Runs inside each isolated webview. Strings enter the DOM through textContent.
export const PANEL_SCRIPT_HELPERS = /* javascript */ `
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const UNKNOWN = 'M5 3h6v1H5zM4 4h2v2H4zM10 4h2v3h-2zM8 7h3v1H8zM7 8h2v3H7zM7 13h2v2H7z';
  const sprite = (entry, className) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('aria-hidden', 'true');
    if (className) svg.setAttribute('class', className);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', entry.artwork || UNKNOWN);
    path.setAttribute('fill', 'currentColor');
    svg.append(path);
    return svg;
  };
`
