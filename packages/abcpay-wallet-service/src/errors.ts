export class ClientError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

export const Errors = {
  NOT_AUTHORIZED: new ClientError('NOT_AUTHORIZED', 'Not authorized', 401),
  WALLET_NOT_FOUND: new ClientError('WALLET_NOT_FOUND', 'Wallet not found', 404),
  WALLET_ALREADY_COMPLETED: new ClientError('WALLET_ALREADY_COMPLETED', 'Wallet already completed', 400),
  WALLET_NOT_COMPLETE: new ClientError('WALLET_NOT_COMPLETE', 'Wallet is not complete', 400),
  COPAYER_REGISTERED: new ClientError('COPAYER_REGISTERED', 'Copayer already in this wallet', 400),
  COPAYER_IN_WALLET: new ClientError('COPAYER_IN_WALLET', 'Copayer already registered', 400),
  INSUFFICIENT_FUNDS: new ClientError('INSUFFICIENT_FUNDS', 'Insufficient funds', 400),
  TX_NOT_FOUND: new ClientError('TX_NOT_FOUND', 'Transaction proposal not found', 404),
  TX_ALREADY_SIGNED: new ClientError('TX_ALREADY_SIGNED', 'Already signed', 400),
  TX_NOT_ENOUGH_SIGNATURES: new ClientError('TX_NOT_ENOUGH_SIGNATURES', 'Not enough signatures', 400),
  INVALID_SECRET: new ClientError('INVALID_SECRET', 'Invalid wallet secret', 400),
  INVALID_SIGNATURE: new ClientError('INVALID_SIGNATURE', 'Invalid signature', 400),
  LOCKED_FUNDS: new ClientError('LOCKED_FUNDS', 'Funds locked in pending proposals', 400),
  BAD_ADDRESS: new ClientError('BAD_ADDRESS', 'Invalid address', 400)
};
