import { CommandService } from './command-service.js';
import { SuccessFactorsAdapter } from './successfactors-adapter.js';

/**
 * SearchBarHandler
 * ----------------
 * Responsibility : attach a keydown listener to the SF shellbar search input so
 *                  power-user syntax ("/o key", "/n key") triggers navigation.
 * Public API     : attach
 * Dependencies   : CommandService, SuccessFactorsAdapter
 *
 * Idempotent: uses a data-flag so repeated MutationObserver calls don't stack
 * listeners.
 */
export const SearchBarHandler = (() => {
  function attach() {
    const input = SuccessFactorsAdapter.getSearchInput();
    if (!input || input.dataset.sfBound) return;
    input.dataset.sfBound = 'true';
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const val = input.value.trim();
      if (val.startsWith('/') && CommandService.executeFromSearchBar(val)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    });
  }

  return { attach };
})();
