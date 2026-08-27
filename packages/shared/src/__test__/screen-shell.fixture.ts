/**
 * Golden fixture for the screen-shell helpers, asserted against by both this
 * package's own spec and (indirectly, via the moved functions) every
 * consumer in `packages/api` and `packages/ui`.
 */
export const SCREEN_SHELL_FIXTURE_MODEL = {
  name: 'v2',
  width: 1872,
  height: 1404,
  rotation: 90,
  cssClasses: ['screen--v2', 'screen--lg', 'screen--density-2x'],
  cssVariables: { '--screen-w': '1040px', '--screen-h': '780px' },
}

export const SCREEN_SHELL_FIXTURE_PALETTE = {
  frameworkClass: 'screen--4bit',
}

export const SCREEN_SHELL_FIXTURE_BODY = '<div class="view view--full"><p>x</p></div>'

export const SCREEN_SHELL_FIXTURE_EXPECTED = {
  classes: ['screen', 'screen--v2', 'screen--lg', 'screen--density-2x', 'screen--4bit'],
  style: '--screen-w: 1040px; --screen-h: 780px;',
  wrappedDiv: '<div class="screen screen--v2 screen--lg screen--density-2x screen--4bit" style="--screen-w: 1040px; --screen-h: 780px;"><div class="view view--full"><p>x</p></div></div>',
}
