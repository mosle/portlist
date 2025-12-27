import type { ISettings } from '../../shared/types.js';
import { i18n } from '../../shared/i18n/index.js';

export interface SettingsViewProps {
  settings: ISettings;
  onClose: () => void;
  onUpdateSettings: (settings: Partial<ISettings>) => void;
}

/**
 * Render settings modal
 */
export function renderSettingsView(container: HTMLElement, props: SettingsViewProps): void {
  const { settings, onClose, onUpdateSettings } = props;

  const modal = document.createElement('div');
  modal.className = 'settings-modal';

  modal.innerHTML = `
    <div class="settings-backdrop"></div>
    <div class="settings-content">
      <div class="settings-header">
        <h2>${i18n.t('settings.title')}</h2>
        <button class="close-button">×</button>
      </div>
      <div class="settings-body">
        <div class="setting-item">
          <label for="polling-interval">${i18n.t('settings.polling_interval')}</label>
          <div class="setting-control">
            <input
              type="range"
              id="polling-interval"
              min="1"
              max="30"
              value="${settings.pollingInterval / 1000}"
            />
            <span class="setting-value">${settings.pollingInterval / 1000} ${i18n.t('settings.seconds')}</span>
          </div>
        </div>
      </div>
    </div>
  `;

  container.appendChild(modal);

  // Event listeners
  const backdrop = modal.querySelector('.settings-backdrop');
  const closeBtn = modal.querySelector('.close-button');
  const slider = modal.querySelector('#polling-interval') as HTMLInputElement;
  const valueDisplay = modal.querySelector('.setting-value');

  const close = () => {
    container.removeChild(modal);
    onClose();
  };

  backdrop?.addEventListener('click', close);
  closeBtn?.addEventListener('click', close);

  slider?.addEventListener('input', () => {
    const seconds = parseInt(slider.value, 10);
    if (valueDisplay) {
      valueDisplay.textContent = `${seconds} ${i18n.t('settings.seconds')}`;
    }
  });

  slider?.addEventListener('change', () => {
    const seconds = parseInt(slider.value, 10);
    onUpdateSettings({ pollingInterval: seconds * 1000 });
  });
}

/**
 * Remove settings modal
 */
export function removeSettingsView(container: HTMLElement): void {
  const modal = container.querySelector('.settings-modal');
  if (modal) {
    container.removeChild(modal);
  }
}
