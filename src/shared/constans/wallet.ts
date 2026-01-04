import { walletType } from 'src/modules/database/entities';

export const InitWallets = [
  { type: walletType.SPOT, name: 'SPOT' },
  { type: walletType.FUTURE, name: 'FUTURE' },
  { type: walletType.FUNDING, name: 'FUNDING' },
];
