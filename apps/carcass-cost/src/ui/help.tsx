// Ajuda contextual — o "?" glove-first do DS (IconButton) revela uma nota
// curta INLINE (aria-expanded/aria-controls), sem overlay: no iPhone o toque
// num botão não dá foco, então tooltip-por-foco não abriria; fechada, a nota
// não ocupa altura. O botão mantém o alvo de toque do DS (size-control-min);
// o que encolhe é só o GLIFO (círculo de 24px, elemento secundário).

import { cssVar } from '@tauros/tokens';
import { Flex, Heading, IconButton, Section, Text, type SectionProps } from '@tauros/ui-primitives';
import { useId, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';

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

// Glifo pequeno dentro do alvo de toque grande — tokens do DS, sem literal
// visual (o 1px da borda é estrutural, como no próprio DS).
const GLYPH: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: cssVar('space-gap-300'),
  height: cssVar('space-gap-300'),
  borderRadius: cssVar('radius-pill'),
  border: `1px solid ${cssVar('color-border-strong')}`,
  color: cssVar('color-text-secondary'),
  fontSize: cssVar('emphasis-level5-size'),
  fontWeight: cssVar('type-role-label-weight'),
};

export interface HelpButtonProps {
  /** Tema, usado no nome acessível: "Sobre: <tema>". */
  readonly topic: string;
  readonly help: HelpState;
}

export function HelpButton({ topic, help }: HelpButtonProps): ReactElement {
  return (
    <IconButton
      variant="ghost"
      aria-label={`Sobre: ${topic}`}
      aria-expanded={help.open}
      {...(help.open ? { 'aria-controls': help.id } : {})}
      onClick={help.toggle}
    >
      <span aria-hidden="true" style={GLYPH}>
        ?
      </span>
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
