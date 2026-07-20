// Auditoria automatizada WCAG (6.3.3 §16) — axe sobre composições reais.
// (Regra de contraste é validada pelos tokens congelados; axe em jsdom
// cobre estrutura ARIA, nomes acessíveis e papéis.)

import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { type ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { ThemeProvider } from '@tauros/theme';

import {
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  Divider,
  Heading,
  Icon,
  IconButton,
  Label,
  Skeleton,
  Spinner,
  Stack,
  Text,
  type IconDefinition,
} from '../index.js';

const fixtureIcon: IconDefinition = { name: 'x', viewBox: '0 0 16 16', path: 'M0 0h16v16H0z' };

function withTheme(ui: ReactElement): ReactElement {
  return <ThemeProvider>{ui}</ThemeProvider>;
}

describe('axe — sem violações', () => {
  it('composição interativa (botões, chips, avatar, spinner)', async () => {
    const { container } = render(
      withTheme(
        <Stack gap={200}>
          <Button>Confirmar</Button>
          <Button variant="danger" loading>
            Excluir
          </Button>
          <IconButton aria-label="Fechar">
            <Icon icon={fixtureIcon} />
          </IconButton>
          <Chip selected onRemove={() => undefined} removeLabel="Remover filtro">
            Filtro
          </Chip>
          <Avatar name="Maria Silva" />
          <Spinner />
        </Stack>,
      ),
    );
    expect((await axe(container)).violations).toEqual([]);
  });

  it('composição de conteúdo (headings, texto, badge, card, skeleton)', async () => {
    const { container } = render(
      withTheme(
        <Card as="section" aria-label="Resumo">
          <Stack gap={100}>
            <Heading level={1}>Painel</Heading>
            <Heading level={2} visualLevel={4}>
              Subseção
            </Heading>
            <Label htmlFor="campo">Peso</Label>
            <Text role="data">42 kg</Text>
            <Badge status="warn">Atenção</Badge>
            <Divider decorative={false} />
            <Skeleton variant="rect" height={400} />
          </Stack>
        </Card>,
      ),
    );
    expect((await axe(container)).violations).toEqual([]);
  });
});
