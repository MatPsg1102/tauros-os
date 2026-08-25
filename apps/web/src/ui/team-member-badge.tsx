// Resumo compacto do colaborador escalado — no máximo dois números úteis (§7).
// Compartilhado pela sidebar de triagem e pela faixa "Equipe de hoje" do
// quadro: o MESMO sinal em qualquer lugar que nomeie a pessoa. Apresentacional
// puro (só o DS congelado); nenhum número é calculado aqui — todos chegam
// prontos do view model.

'use client';

import type { ReactElement } from 'react';

import { Badge } from '@tauros/ui-primitives';

import type { TeamMemberSummary } from '../controllers/use-shared-operations.js';

export function plural(count: number, singular: string, pluralForm: string): string {
  return `${String(count)} ${count === 1 ? singular : pluralForm}`;
}

/** Primeiro nome — alvo curto e legível na faixa glove-first. */
export function firstName(fullName: string): string {
  const [first] = fullName.trim().split(/\s+/);
  return first === undefined || first === '' ? fullName : first;
}

export function memberBadge(member: TeamMemberSummary): ReactElement {
  if (member.overdueCount > 0) {
    return (
      <Badge status="error">
        {plural(member.overdueCount, 'atrasada', 'atrasadas')}
        {member.openCount > member.overdueCount
          ? ` · ${plural(member.openCount, 'aberta', 'abertas')}`
          : ''}
      </Badge>
    );
  }
  if (member.openCount > 0) {
    return <Badge status="neutral">{plural(member.openCount, 'aberta', 'abertas')}</Badge>;
  }
  if (member.awaitingReviewCount > 0) {
    return (
      <Badge status="info">
        {plural(member.awaitingReviewCount, 'em conferência', 'em conferência')}
      </Badge>
    );
  }
  return <Badge status="success">Em dia</Badge>;
}
