// Auditoria permanente da milestone (6.3.9): inventário da API pública,
// propriedade de safe areas, regressão do nome acessível em loading e
// fundação única de overlays. Estes testes CONGELAM contratos — mudanças
// na superfície pública passam a ser decisões explícitas, nunca acidentes.

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import React from 'react';

import { ThemeProvider } from '@tauros/theme';

import * as publicApi from '../index.js';
import { Button, injectUiStyles, taurosUiStyles } from '../index.js';

// ===== Inventário congelado da API pública (design-system-v1.0) =====

const COMPONENTS = [
  // primitives (6.3.3)
  'Avatar',
  'Badge',
  'Box',
  'Button',
  'Card',
  'Chip',
  'Divider',
  'Flex',
  'Grid',
  'Heading',
  'Icon',
  'IconButton',
  'Label',
  'Skeleton',
  'Spacer',
  'Spinner',
  'Stack',
  'Surface',
  'Text',
  // forms (6.3.4)
  'Field',
  'Input',
  'TextArea',
  'NumberInput',
  'CurrencyInput',
  'SearchInput',
  'Select',
  'MultiSelect',
  'Checkbox',
  'Radio',
  'RadioGroup',
  'Switch',
  'DatePicker',
  'TimePicker',
  'PinInput',
  // feedback (6.3.5)
  'Alert',
  'Banner',
  'ToastProvider',
  'Progress',
  'Dialog',
  'Modal',
  'ConfirmDialog',
  'Tooltip',
  'Popover',
  'EmptyState',
  'ErrorState',
  'LoadingState',
  // navigation (6.3.6)
  'NavigationItem',
  'NavigationGroup',
  'Sidebar',
  'TopBar',
  'NavigationBar',
  'Breadcrumb',
  'Tabs',
  'TabList',
  'Tab',
  'TabPanel',
  'Stepper',
  'Pagination',
  'Drawer',
  'BottomSheet',
  'Menu',
  'MenuTrigger',
  'MenuContent',
  'MenuItem',
  'MenuCheckboxItem',
  'MenuRadioGroup',
  'MenuRadioItem',
  'MenuSeparator',
  'MenuLabel',
  'ContextMenu',
  'ContextMenuTrigger',
  'ContextMenuContent',
  'ContextMenuItem',
  'ContextMenuSeparator',
  'Fab',
  'SegmentedControl',
  // layouts (6.3.7)
  'AppShell',
  'Page',
  'PageHeader',
  'Container',
  'Section',
  'Panel',
  'PanelHeader',
  'PanelBody',
  'PanelFooter',
  'ResponsiveGrid',
  'SplitView',
  'StickyRegion',
].sort();

const ORIENTED_ERRORS = [
  'DialogAccessibleNameError',
  'IncompatibleStylesElementError',
  'InvalidPinLengthError',
  'InvalidProgressRangeError',
  'MenuContextMissingError',
  'MissingAccessibleNameError',
  'MultipleMainLandmarksError',
  'NavigationDepthExceededError',
  'TabsContextMissingError',
  'ToastProviderMissingError',
].sort();

const PUBLIC_HOOKS = ['useFieldContext', 'useToast'].sort();

const PUBLIC_UTILITIES = [
  'BADGE_STATUS_PRECEDENCE', // precedência congelada de status (contexto 5.2-B)
  'TOAST_PARAMETERS', // parâmetros semânticos tipados (padrão ADR-018A)
  'cx', // utilitário público de composição de classes (6.3.3 §20)
  'injectUiStyles', // mecanismo oficial de injeção (explícito, idempotente)
  'isValidCivilDate', // validador do contrato canônico YYYY-MM-DD
  'isValidLocalTime', // validador do contrato canônico HH:mm
  'taurosUiStyles', // folha oficial (SSR por string)
].sort();

describe('inventário congelado da API pública', () => {
  it('a superfície de valores é EXATAMENTE a aprovada (nada a mais, nada a menos)', () => {
    const actual = Object.keys(publicApi).sort();
    const expected = [
      ...COMPONENTS,
      ...ORIENTED_ERRORS,
      ...PUBLIC_HOOKS,
      ...PUBLIC_UTILITIES,
    ].sort();
    expect(actual).toEqual(expected);
  });

  it('88 renderizáveis, 10 erros orientados, 2 hooks, 7 utilitários', () => {
    expect(COMPONENTS).toHaveLength(88);
    expect(ORIENTED_ERRORS).toHaveLength(10);
    expect(PUBLIC_HOOKS).toHaveLength(2);
    expect(PUBLIC_UTILITIES).toHaveLength(7);
  });

  it('nenhum internal da fundação vaza (amostra de nomes proibidos)', () => {
    const names = Object.keys(publicApi);
    for (const forbidden of [
      'Portal',
      'pushOverlay',
      'removeOverlay',
      'isTopOverlay',
      'overlayCount',
      'acquireScrollLock',
      'scrollLockCount',
      'getFocusableElements',
      'containTabKey',
      'captureFocusRestore',
      'positionOverlay',
      'positionOverlayAtPoint',
      'MenuContext',
      'useMenuContext',
      'SidebarContext',
      'MainLandmarkContext',
      'useMainLandmarkGuard',
      'ControlFrame',
      'resolveControlWiring',
      'composeIds',
      'handleAdapterClick',
    ]) {
      expect(names, `internal vazado: ${forbidden}`).not.toContain(forbidden);
    }
  });
});

// ===== Propriedade de safe areas (matriz de responsabilidade — 6.3.9 §15) =====

describe('propriedade de safe areas na folha oficial', () => {
  it('safe-area-inset-bottom pertence somente aos donos declarados', () => {
    // donos oficiais do inset inferior (cada um em contexto EXCLUSIVO):
    //  - .t-shell-navbar   → AppShell posiciona a NavigationBar (slot sem fixed)
    //  - .t-navbar[data-fixed='true'] → NavigationBar avulsa fixada pelo app
    //  - .t-bottomsheet    → superfície inferior própria
    //  - .t-stickyregion[data-position='bottom'] → ações fixas no fluxo
    const owners = [
      '.t-shell-navbar',
      ".t-navbar[data-fixed='true']",
      '.t-bottomsheet',
      ".t-stickyregion[data-position='bottom']",
    ];
    const blocks = taurosUiStyles
      .split('}')
      .filter((block) => block.includes('safe-area-inset-bottom'));
    expect(blocks).toHaveLength(owners.length);
    for (const owner of owners) {
      expect(
        blocks.some((block) => block.includes(owner)),
        `dono ausente: ${owner}`,
      ).toBe(true);
    }
  });

  it('insets laterais/topo têm dono único (Page e t-shell-topbar)', () => {
    const top = taurosUiStyles.split('}').filter((b) => b.includes('safe-area-inset-top'));
    expect(top).toHaveLength(1);
    expect(top[0]).toContain('.t-shell-topbar');
    const left = taurosUiStyles.split('}').filter((b) => b.includes('safe-area-inset-left'));
    expect(left).toHaveLength(1);
    expect(left[0]).toContain('.t-page');
  });
});

// ===== Regressão: nome acessível do Button em loading (achado 6.3.8) =====

describe('Button loading preserva o nome acessível COM a folha real aplicada', () => {
  it('getByRole encontra o botão pelo texto mesmo em loading (opacity, não visibility)', () => {
    injectUiStyles(document);
    try {
      const { getByRole } = render(
        <ThemeProvider>
          <Button loading>Salvar pesagem</Button>
        </ThemeProvider>,
      );
      // dom-accessibility-api exclui conteúdo visibility:hidden — este teste
      // falhava antes da correção para opacity:0 (achado do contrato 6.3.8)
      const button = getByRole('button', { name: 'Salvar pesagem' });
      expect(button.getAttribute('aria-busy')).toBe('true');
      expect(taurosUiStyles).toContain(
        ".t-btn[data-loading='true'] .t-btn-content { opacity: 0; }",
      );
      expect(taurosUiStyles).not.toContain('.t-btn-content { visibility: hidden');
    } finally {
      document.getElementById('tauros-ui-styles')?.remove();
    }
  });
});
