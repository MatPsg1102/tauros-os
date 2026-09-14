// Ajuda contextual — o "?" glove-first do DS (IconButton) revela uma nota
// curta INLINE (aria-expanded/aria-controls), sem overlay: no iPhone o toque
// num botão não dá foco, então tooltip-por-foco não abriria; fechada, a nota
// não ocupa altura. Explicação longa sai da interface principal e vem para cá.

import { Flex, Heading, IconButton, Section, Text, type SectionProps } from '@tauros/ui-primitives';
import { useId, useState, type ReactElement, type ReactNode } from 'react';

export interface HelpState {
  readonly open: boolean;
  readonly id: string;
  readonly toggle: () => void;
}

export function useHelp(): HelpState {
  const id = useId();
  const [open, setOpen] = useState(false);
  return {
    open,
    id,
    toggle: () => {
      setOpen((current) => !current);
    },
  };
}

export interface HelpButtonProps {
  /** Tema, usado no nome acessível: "Sobre: <tema>". */
  readonly topic: string;
  readonly help: HelpState;
}

export function HelpButton({ topic, help }: HelpButtonProps): ReactElement {
  return (
    <IconButton
      variant="secondary"
      aria-label={`Sobre: ${topic}`}
      aria-expanded={help.open}
      {...(help.open ? { 'aria-controls': help.id } : {})}
      onClick={help.toggle}
    >
      ?
    </IconButton>
  );
}

export interface HelpNoteProps {
  readonly help: HelpState;
  readonly children: ReactNode;
}

export function HelpNote({ help, children }: HelpNoteProps): ReactElement | null {
  if (!help.open) return null;
  return (
    <Text as="p" id={help.id} role="caption" tone="secondary">
      {children}
    </Text>
  );
}

export interface HelpSectionProps extends Omit<SectionProps, 'title' | 'description' | 'actions'> {
  readonly title: string;
  readonly help: string;
  readonly actions?: ReactNode;
}

/** Section com título e "?" na mesma linha (centrados) e nota inline. */
export function HelpSection({
  title,
  help,
  actions,
  children,
  ...rest
}: HelpSectionProps): ReactElement {
  const state = useHelp();
  return (
    <Section aria-label={title} {...rest}>
      <Flex justify="between" align="center" gap={100}>
        <Heading level={2} visualLevel={3}>
          {title}
        </Heading>
        <Flex align="center" gap={100}>
          {actions}
          <HelpButton topic={title} help={state} />
        </Flex>
      </Flex>
      <HelpNote help={state}>{help}</HelpNote>
      {children}
    </Section>
  );
}
