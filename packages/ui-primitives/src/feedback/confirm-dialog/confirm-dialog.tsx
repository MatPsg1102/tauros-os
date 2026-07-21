// ConfirmDialog (6.3.5 §13) — contrato especializado de confirmação.
// Confidence Before Speed: em variante destrutiva o foco inicial vai para a
// ação SEGURA (cancelar); nunca foco automático na ação destrutiva.
// onConfirm pode ser assíncrono: pending desabilita ações, falha mantém o
// diálogo aberto com mensagem SEGURA (nunca o conteúdo bruto da exceção) e
// permite nova tentativa. Sem regra de negócio interna.

'use client';

import { useRef, useState, type ReactNode } from 'react';

import { Button } from '../../primitives/button/button.js';
import { Flex } from '../../primitives/flex/flex.js';
import { Dialog } from '../dialog/dialog.js';

export interface ConfirmDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description?: string;
  /** Callback síncrono ou assíncrono; rejeição mantém o diálogo aberto. */
  readonly onConfirm: () => void | Promise<void>;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly destructive?: boolean;
  /** Mensagem exibida quando onConfirm falha (conteúdo seguro do consumidor). */
  readonly errorMessage?: string;
  readonly children?: ReactNode;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  errorMessage = 'Não foi possível concluir a ação. Tente novamente.',
  children,
}: ConfirmDialogProps): ReactNode {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  async function handleConfirm(): Promise<void> {
    setPending(true);
    setFailed(false);
    try {
      await onConfirm();
      setPending(false);
      onOpenChange(false);
    } catch {
      // a exceção não é engolida silenciosamente: vira estado de erro visível;
      // o conteúdo bruto (potencialmente sensível) NÃO é exibido nem logado.
      setPending(false);
      setFailed(true);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return; // não fechar durante operação em andamento
        setFailed(false);
        onOpenChange(next);
      }}
      title={title}
      {...(description !== undefined ? { description } : {})}
      initialFocusRef={destructive ? cancelRef : confirmRef}
    >
      {children}
      {failed && (
        <p className="t-field-error" role="alert">
          <span className="t-field-error-marker" aria-hidden="true" />
          {errorMessage}
        </p>
      )}
      <Flex justify="end" gap={100} className="t-confirm-actions">
        <Button
          ref={cancelRef}
          variant="secondary"
          disabled={pending}
          onClick={() => {
            setFailed(false);
            onOpenChange(false);
          }}
        >
          {cancelLabel}
        </Button>
        <Button
          ref={confirmRef}
          variant={destructive ? 'danger' : 'primary'}
          loading={pending}
          onClick={() => {
            void handleConfirm();
          }}
        >
          {confirmLabel}
        </Button>
      </Flex>
    </Dialog>
  );
}
