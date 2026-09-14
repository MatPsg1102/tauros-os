// Cabeçalho de subtela: título e "Voltar" na MESMA linha. O PageHeader do DS
// empilha as ações abaixo do título em telas estreitas (uma linha de 64px a
// mais por tela); aqui o botão divide a linha do título, centrado.

import { Button, Flex, Heading, Stack, Text } from '@tauros/ui-primitives';
import type { ReactElement } from 'react';

export interface ScreenHeaderProps {
  readonly title: string;
  readonly description?: string;
  readonly onBack: () => void;
}

export function ScreenHeader({ title, description, onBack }: ScreenHeaderProps): ReactElement {
  return (
    <Stack gap={50}>
      <Flex as="header" justify="between" align="center" gap={100}>
        <Heading level={1} visualLevel={2}>
          {title}
        </Heading>
        <Button variant="secondary" size="sm" onClick={onBack}>
          Voltar
        </Button>
      </Flex>
      {description !== undefined && (
        <Text as="p" role="caption" tone="secondary">
          {description}
        </Text>
      )}
    </Stack>
  );
}
