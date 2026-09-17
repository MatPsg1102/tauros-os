// Tela Conta (P-0001): login por e-mail/senha de usuário piloto pré-criado.
// Sem cadastro, recuperação de senha ou MFA (decisão humana). Formulário
// nativo (Enter envia); erros do login aparecem no alerta abaixo do formulário.

import { Button, Field, Input, Section, Stack, Surface, Text } from '@tauros/ui-primitives';
import { cssVar } from '@tauros/tokens';
import { useState, type FormEvent, type ReactElement } from 'react';

import type { CloudSessionController } from '../state/use-session.js';
import { ScreenHeader } from './screen-header.js';

export interface AccountScreenProps {
  readonly session: CloudSessionController;
  readonly onBack: () => void;
}

export function AccountScreen({ session, onBack }: AccountScreenProps): ReactElement {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const canSubmit = !session.pending && email.trim() !== '' && password !== '';

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!canSubmit) return;
    void session.signIn(email.trim(), password);
  };

  return (
    <Stack gap={200}>
      <ScreenHeader
        title="Conta"
        description="Com a conta, os lotes salvos ficam na nuvem e aparecem em qualquer aparelho."
        onBack={onBack}
      />

      {session.status === 'signed-in' ? (
        <Section title="Conectado">
          <Surface elevation="card" style={{ padding: cssVar('space-inset-md') }}>
            <Stack gap={100}>
              <Text role="label">Conectado como {session.email}</Text>
              <Text role="caption" tone="secondary">
                Os lotes salvos na calculadora vão para o histórico da nuvem.
              </Text>
              <Button
                variant="secondary"
                fullWidth
                disabled={session.pending}
                onClick={() => {
                  void session.signOut();
                }}
              >
                Sair
              </Button>
            </Stack>
          </Surface>
        </Section>
      ) : (
        <Section title="Entrar">
          <form onSubmit={submit} noValidate>
            <Stack gap={100}>
              <Field label="E-mail" required>
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                  }}
                />
              </Field>
              <Field label="Senha" required>
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                  }}
                />
              </Field>
              <Button type="submit" variant="primary" fullWidth disabled={!canSubmit}>
                {session.pending ? 'Entrando…' : 'Entrar'}
              </Button>
              <Text role="caption" tone="secondary">
                {session.status === 'checking'
                  ? 'Verificando a sessão…'
                  : 'Sem conta, os lotes continuam salvos só neste aparelho.'}
              </Text>
            </Stack>
          </form>
        </Section>
      )}

      <div role="alert" aria-live="assertive">
        {session.error !== null && <Text role="caption">{session.error}</Text>}
      </div>
    </Stack>
  );
}
