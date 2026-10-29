/**
 * Diálogos do app (confirmação e aviso), desenhados pelo próprio app em vez
 * de alert/confirm do navegador, que nem sempre aparecem na web.
 */

export interface DialogRequest {
  title: string;
  message?: string;
  /** Texto do botão principal; sem cancelar quando é só um aviso. */
  ok: string;
  cancel: boolean;
  resolve: (ok: boolean) => void;
}

type Listener = (request: DialogRequest) => void;
let listener: Listener | null = null;

export function setDialogListener(fn: Listener | null): void {
  listener = fn;
}

function open(request: Omit<DialogRequest, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    if (!listener) return resolve(false);
    listener({ ...request, resolve });
  });
}

/** Pergunta de sim ou não. */
export function confirm(title: string, message: string, ok = 'Continuar'): Promise<boolean> {
  return open({ title, message, ok, cancel: true });
}

export function notify(title: string, message?: string): void {
  void open({ title, message, ok: 'Entendi', cancel: false });
}
