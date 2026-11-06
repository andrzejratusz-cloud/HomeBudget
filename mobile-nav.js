const mobileIcons = {
  dashboard: '<path d="M6 18a4 4 0 0 1-.5-8 6 6 0 0 1 11.5-1.5A4.8 4.8 0 0 1 18 18Z" fill="#d9ebff" stroke="#3974ad"/>',
  incomes: '<path d="M6 18 18 6m-8 0h8v8" fill="none" stroke="#258253"/>',
  costs: '<path d="M12 3v18m5-14H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H7" fill="none" stroke="#8b5a18"/>',
  goals: '<circle cx="12" cy="12" r="9" fill="white" stroke="#c7384f"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="#c7384f"/><circle cx="12" cy="12" r="2" fill="#c7384f"/>',
  savings: '<rect x="3" y="4" width="18" height="16" rx="3" fill="#e9dffc" stroke="#644196"/><path d="M6 8v8m12-8v8M7 20v1m10-1v1" stroke="#644196"/><circle cx="12" cy="12" r="3" fill="white" stroke="#644196"/>',
  transactions: '<path d="M4 8h15m-4-4 4 4-4 4" fill="none" stroke="#258253"/><path d="M20 16H5m4-4-4 4 4 4" fill="none" stroke="#c7384f"/>',
  settings: '<path d="m10 3-.6 2.3-1.6.9-2.3-.6-2 3.4 1.7 1.7v1.8l-1.7 1.7 2 3.4 2.3-.6 1.6.9.6 2.3h4l.6-2.3 1.6-.9 2.3.6 2-3.4-1.7-1.7v-1.8l1.7-1.7-2-3.4-2.3.6-1.6-.9L14 3Z" fill="#e9e3f5" stroke="#645477"/><circle cx="12" cy="11.6" r="3" fill="white" stroke="#645477"/>',
};

const menuToggle = document.createElement('button');
menuToggle.type = 'button';
menuToggle.className = 'mobile-menu-toggle';
menuToggle.setAttribute('aria-controls', 'section-menu');
menuToggle.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

nav.id = 'section-menu';
nav.setAttribute('aria-label', 'Menu główne');
const shortcuts = document.createElement('nav');
shortcuts.className = 'mobile-shortcuts';
shortcuts.setAttribute('aria-label', 'Skróty do sekcji');
for (const item of nav.querySelectorAll('button[data-view]')) {
  const section = item.dataset.view;
  const label = item.textContent.trim().replace(/^\S+\s+/, '');
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.view = section;
  button.setAttribute('aria-label', label);
  button.title = label;
  button.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${mobileIcons[section]}</svg>`;
  shortcuts.append(button);
}

const mobileHeader = document.querySelector('aside');
mobileHeader.classList.add('responsive-menu');
mobileHeader.querySelector('.brand').append(menuToggle);
nav.before(shortcuts);

function setMenuOpen(open) {
  mobileHeader.classList.toggle('menu-open', open);
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Zamknij menu' : 'Otwórz menu');
}

setMenuOpen(false);
menuToggle.addEventListener('click', () => setMenuOpen(menuToggle.getAttribute('aria-expanded') === 'false'));
document.addEventListener('click', event => {
  if (!mobileHeader.contains(event.target) || event.target.closest('button[data-view]')) {
    if (menuToggle.getAttribute('aria-expanded') === 'true' && nav.contains(document.activeElement)) menuToggle.focus();
    setMenuOpen(false);
  }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
    setMenuOpen(false);
    menuToggle.focus();
  }
});
window.matchMedia('(max-width: 700px)').addEventListener?.('change', () => setMenuOpen(false));

const renderWithSidebar = render;
render = function () {
  renderWithSidebar();
  for (const button of mobileHeader.querySelectorAll('button[data-view]')) {
    if (button.dataset.view === view) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
};
render();
