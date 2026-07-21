// Vocabulário único de estado de sincronização local (derivado da fila
// oficial). Compartilhado por sessão e execução de tarefa para que a UI use
// UMA linguagem — evita uniões duplicadas por entidade.

export type LocalSyncStatus = 'queued' | 'syncing' | 'synced' | 'conflict' | 'failed';
