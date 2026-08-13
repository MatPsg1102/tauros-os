// Seção "Equipe" da Área do Encarregado — apresentacional: consome APENAS o
// view model da Gestão de Equipe e a API pública do Design System.
// Progressive disclosure em abas (Colaboradores | Posições | Equipes),
// drawers no MESMO padrão de "+ Nova tarefa", glove-first e mobile-first.
// Nenhuma regra de permissão aqui: decisões chegam prontas (ADR-018).

'use client';

import { useEffect, useState, type ReactElement } from 'react';

import {
  Alert,
  Badge,
  Button,
  Card,
  DatePicker,
  Drawer,
  EmptyState,
  Field,
  Flex,
  Heading,
  Input,
  Section,
  SegmentedControl,
  Select,
  Stack,
  Text,
} from '@tauros/ui-primitives';

import type {
  TeamManagementActions,
  TeamManagementView,
  TeamMemberItemView,
  TeamPositionItemView,
} from '../controllers/use-team-management.js';

/** Mesma linguagem de sincronização das tarefas — sem "sucesso" antecipado. */
function syncLine(status: TeamMemberItemView['syncStatus']): string | null {
  if (status === 'queued') return 'Salvo neste aparelho — aguardando sincronização';
  if (status === 'synced') return 'Confirmado pelo servidor';
  if (status === 'conflict') return 'Precisa de revisão';
  if (status === 'failed') return 'Aguardando nova tentativa';
  return null;
}

function RegisterEmployeeDrawer({
  view,
  actions,
}: {
  readonly view: TeamManagementView;
  readonly actions: TeamManagementActions;
}): ReactElement {
  const [fullName, setFullName] = useState('');
  const [startDate, setStartDate] = useState(view.today);
  const [positionId, setPositionId] = useState('');
  const [teamId, setTeamId] = useState('');
  const open = view.registration.status !== 'idle';
  const submitting = view.registration.status === 'submitting';

  // formulário limpo a cada ABERTURA; erro de validação NUNCA apaga o que o
  // operador digitou (o drawer permanece aberto com os campos preservados)
  useEffect(() => {
    if (open) return;
    setFullName('');
    setStartDate(view.today);
    setPositionId('');
    setTeamId('');
  }, [open, view.today]);

  function submit(): void {
    void actions.register({ fullName, startDate, positionId, teamId });
  }

  return (
    <Drawer
      open={open}
      side="right"
      title="Novo colaborador"
      description="O colaborador entra na composição da equipe da loja"
      closeLabel="Fechar"
      onOpenChange={(isOpen) => {
        if (!isOpen) actions.closeRegister();
      }}
    >
      <Stack gap={200}>
        <Field label="Nome">
          <Input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            disabled={submitting}
          />
        </Field>
        <Field label="Data de início">
          <DatePicker value={startDate} onValueChange={setStartDate} disabled={submitting} />
        </Field>
        <Field label="Função/posição">
          <Select
            value={positionId}
            onChange={(event) => setPositionId(event.target.value)}
            disabled={submitting}
          >
            <option value="">Escolha a função/posição</option>
            {view.positionOptions.map((position) => (
              <option key={position.id} value={position.id}>
                {position.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Equipe">
          <Select
            value={teamId}
            onChange={(event) => setTeamId(event.target.value)}
            disabled={submitting}
          >
            <option value="">Escolha a equipe</option>
            {view.teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </Select>
        </Field>

        {view.registration.status === 'error' && (
          <Alert status="error" live="polite" title="Colaborador não cadastrado">
            {view.registration.message}
          </Alert>
        )}
        <Button fullWidth disabled={submitting} onClick={submit}>
          {submitting ? 'Cadastrando…' : 'Cadastrar colaborador'}
        </Button>
      </Stack>
    </Drawer>
  );
}

function CreatePositionDrawer({
  view,
  actions,
}: {
  readonly view: TeamManagementView;
  readonly actions: TeamManagementActions;
}): ReactElement {
  const [name, setName] = useState('');
  const open = view.positionCreation.status !== 'idle';
  const submitting = view.positionCreation.status === 'submitting';

  // mesmo contrato do cadastro: erro preserva o campo; reabrir limpa
  useEffect(() => {
    if (!open) setName('');
  }, [open]);

  function submit(): void {
    void actions.createPosition(name);
  }

  return (
    <Drawer
      open={open}
      side="right"
      title="Nova posição"
      description="A posição fica disponível para colaboradores e tarefas"
      closeLabel="Fechar"
      onOpenChange={(isOpen) => {
        if (!isOpen) actions.closeCreatePosition();
      }}
    >
      <Stack gap={200}>
        <Field label="Nome da posição">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={submitting}
          />
        </Field>
        {view.positionCreation.status === 'error' && (
          <Alert status="error" live="polite" title="Posição não criada">
            {view.positionCreation.message}
          </Alert>
        )}
        <Button fullWidth disabled={submitting} onClick={submit}>
          {submitting ? 'Criando posição…' : 'Criar posição'}
        </Button>
      </Stack>
    </Drawer>
  );
}

function MemberItem({ member }: { readonly member: TeamMemberItemView }): ReactElement {
  const sync = syncLine(member.syncStatus);
  return (
    <Card>
      <Stack gap={100}>
        <Heading level={3}>{member.fullName}</Heading>
        <Text role="data" tone="secondary">
          {member.positionName} · {member.teamName}
        </Text>
        <Text tone="secondary">Ativo desde {member.startDateLabel}</Text>
        {sync !== null && (
          <Text role="data" tone="secondary">
            {sync}
          </Text>
        )}
      </Stack>
    </Card>
  );
}

function PositionItem({ position }: { readonly position: TeamPositionItemView }): ReactElement {
  return (
    <Card>
      <Flex gap={100} wrap align="center" justify="between">
        <Heading level={3}>{position.name}</Heading>
        {position.syncStatus === 'queued' && <Badge status="info">Aguardando sincronização</Badge>}
        {position.syncStatus === 'failed' && <Badge status="warn">Aguardando nova tentativa</Badge>}
      </Flex>
    </Card>
  );
}

export function TeamManagementSection({
  view,
  actions,
}: {
  readonly view: TeamManagementView;
  readonly actions: TeamManagementActions;
}): ReactElement {
  return (
    <Section
      title="Equipe"
      description="Colaboradores, funções/posições e composição das equipes"
      actions={
        <>
          {view.tab === 'members' && view.canRegisterEmployee && (
            <Button onClick={actions.openRegister}>+ Novo colaborador</Button>
          )}
          {view.tab === 'positions' && view.canCreatePosition && (
            <Button onClick={actions.openCreatePosition}>+ Nova posição</Button>
          )}
        </>
      }
    >
      <Stack gap={200}>
        <SegmentedControl
          aria-label="Seções da gestão de equipe"
          value={view.tab}
          onValueChange={(value) => actions.setTab(value as TeamManagementView['tab'])}
          options={[
            { value: 'members', label: 'Colaboradores' },
            { value: 'positions', label: 'Posições' },
            { value: 'teams', label: 'Equipes' },
          ]}
        />

        {view.tab === 'members' && (
          <Stack gap={200}>
            <SegmentedControl
              aria-label="Filtrar colaboradores por equipe"
              value={view.memberFilter ?? 'all'}
              onValueChange={(value) => actions.setMemberFilter(value === 'all' ? null : value)}
              options={[
                { value: 'all', label: 'Todos' },
                ...view.teams.map((team) => ({ value: team.id, label: team.name })),
              ]}
            />
            {view.members.length === 0 ? (
              <EmptyState
                title="Nenhum colaborador cadastrado"
                description="Cadastre o primeiro colaborador para montar a composição das equipes."
              />
            ) : (
              <Stack gap={200}>
                {view.members.map((member) => (
                  <MemberItem key={member.employeeId} member={member} />
                ))}
              </Stack>
            )}
          </Stack>
        )}

        {view.tab === 'positions' &&
          (view.positionItems.length === 0 ? (
            <EmptyState
              title="Nenhuma posição cadastrada"
              description="Crie posições para atribuir colaboradores e tarefas."
            />
          ) : (
            <Stack gap={200}>
              {view.positionItems.map((position) => (
                <PositionItem key={position.id} position={position} />
              ))}
            </Stack>
          ))}

        {view.tab === 'teams' && (
          <Stack gap={200}>
            {view.groups.map((group) => (
              <Card key={group.id}>
                <Stack gap={100}>
                  <Heading level={3}>{group.name}</Heading>
                  {group.members.length === 0 ? (
                    <Text tone="secondary">Nenhum colaborador nesta equipe.</Text>
                  ) : (
                    <Stack gap={100}>
                      {group.members.map((member) => (
                        <Text role="data" key={member.employeeId}>
                          {member.fullName} — {member.positionName}
                        </Text>
                      ))}
                    </Stack>
                  )}
                </Stack>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>

      <RegisterEmployeeDrawer view={view} actions={actions} />
      <CreatePositionDrawer view={view} actions={actions} />
    </Section>
  );
}
