// Conectividade composta (RA-QUEUE-01 §6).
// "Online" (navigator.onLine) NÃO significa "apto a sincronizar": as dimensões
// são avaliadas separadamente e todas precisam estar saudáveis.

export interface SyncReadiness {
  readonly deviceOnline: boolean;
  readonly backendReachable: boolean;
  readonly authenticated: boolean;
  readonly serviceAvailable: boolean;
  /** Conjunção das dimensões — a única flag que autoriza o drain. */
  readonly readyToSync: boolean;
}

/** Sonda de uma dimensão de conectividade (injetável; sem rede em testes). */
export type ConnectivityProbe = () => Promise<boolean>;

export interface ConnectivityProbes {
  readonly device: ConnectivityProbe;
  readonly backend: ConnectivityProbe;
  readonly auth: ConnectivityProbe;
  readonly service: ConnectivityProbe;
}

export interface ConnectivityPort {
  assess(): Promise<SyncReadiness>;
}

export class CompositeConnectivity implements ConnectivityPort {
  constructor(private readonly probes: ConnectivityProbes) {}

  async assess(): Promise<SyncReadiness> {
    const deviceOnline = await this.safe(this.probes.device);
    // Curto-circuito: sem dispositivo online, não gastar sondas de rede.
    const backendReachable = deviceOnline ? await this.safe(this.probes.backend) : false;
    const authenticated = backendReachable ? await this.safe(this.probes.auth) : false;
    const serviceAvailable = backendReachable ? await this.safe(this.probes.service) : false;

    return {
      deviceOnline,
      backendReachable,
      authenticated,
      serviceAvailable,
      readyToSync: deviceOnline && backendReachable && authenticated && serviceAvailable,
    };
  }

  /** Sonda que lança = dimensão indisponível (nunca derruba a avaliação). */
  private async safe(probe: ConnectivityProbe): Promise<boolean> {
    try {
      return await probe();
    } catch {
      return false;
    }
  }
}
