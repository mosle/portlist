import { i18n } from '../../shared/i18n/index.js';

export interface ToolbarProps {
  isPinned: boolean;
  isLoading: boolean;
  filterText: string;
  onReload: () => void;
  onTogglePin: () => void;
  onOpenSettings: () => void;
  onFilterChange: (text: string) => void;
}

// Cache for preventing unnecessary re-renders
let lastToolbarKey = '';

/**
 * Render toolbar
 */
export function renderToolbar(container: HTMLElement, props: ToolbarProps): void {
  const { isPinned, isLoading, filterText, onReload, onTogglePin, onOpenSettings, onFilterChange } = props;

  // Skip re-render if nothing changed
  const currentKey = `${isPinned}::${isLoading}::${filterText}`;
  if (currentKey === lastToolbarKey && container.children.length > 0) {
    return;
  }
  lastToolbarKey = currentKey;

  // Preserve focus if filter input was focused
  const activeElement = document.activeElement;
  const wasFilterFocused = activeElement?.classList.contains('filter-input');
  const selectionStart = wasFilterFocused ? (activeElement as HTMLInputElement).selectionStart : null;

  container.innerHTML = '';

  // Filter container
  const filterContainer = document.createElement('div');
  filterContainer.className = 'filter-container';

  // Filter input
  const filterInput = document.createElement('input');
  filterInput.type = 'text';
  filterInput.className = 'filter-input';
  filterInput.placeholder = i18n.t('actions.filter_placeholder');
  filterInput.value = filterText;
  filterInput.addEventListener('input', (e) => {
    onFilterChange((e.target as HTMLInputElement).value);
  });
  filterContainer.appendChild(filterInput);

  // Clear button (only show when there's text)
  if (filterText) {
    const clearBtn = document.createElement('button');
    clearBtn.className = 'filter-clear-button';
    clearBtn.textContent = '×';
    clearBtn.addEventListener('click', () => {
      onFilterChange('');
      filterInput.focus();
    });
    filterContainer.appendChild(clearBtn);
  }

  container.appendChild(filterContainer);

  // Restore focus if needed
  if (wasFilterFocused) {
    filterInput.focus();
    if (selectionStart !== null) {
      filterInput.setSelectionRange(selectionStart, selectionStart);
    }
  }

  // Reload button
  const reloadBtn = document.createElement('button');
  reloadBtn.className = 'toolbar-button reload-button';
  reloadBtn.disabled = isLoading;
  reloadBtn.title = i18n.t('actions.reload');
  reloadBtn.innerHTML = '↻';
  if (isLoading) {
    reloadBtn.classList.add('loading');
  }
  reloadBtn.addEventListener('click', onReload);
  container.appendChild(reloadBtn);

  // Pin button
  const pinBtn = document.createElement('button');
  pinBtn.className = `toolbar-button pin-button ${isPinned ? 'active' : ''}`;
  pinBtn.title = isPinned ? i18n.t('actions.unpin') : i18n.t('actions.pin');
  pinBtn.innerHTML = '📌';
  pinBtn.addEventListener('click', onTogglePin);
  container.appendChild(pinBtn);

  // Settings button
  const settingsBtn = document.createElement('button');
  settingsBtn.className = 'toolbar-button settings-button';
  settingsBtn.title = i18n.t('actions.settings');
  settingsBtn.innerHTML = '⚙';
  settingsBtn.addEventListener('click', onOpenSettings);
  container.appendChild(settingsBtn);
}
