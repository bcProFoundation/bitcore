import { ClientError } from './clienterror';


interface Errors<T> {
  AD_ALREADY_EXISTS: T;
  BAD_SIGNATURES: T;
  BALANCE_BELOW_RESERVE: T;
  COPAYER_DATA_MISMATCH: T;
  COPAYER_IN_WALLET: T;
  COPAYER_REGISTERED: T;
  COPAYER_VOTED: T;
  DUST_AMOUNT: T;
  MORE_THAT_ONE_OUTPUT: T;
  INCORRECT_ADDRESS_NETWORK: T;
  ONLY_CASHADDR: T;
  INSUFFICIENT_FUNDS: T;
  INSUFFICIENT_FUNDS_FOR_FEE: T;
  INVALID_ADDRESS: T;
  INVALID_CHANGE_ADDRESS: T;
  KEY_IN_COPAYER: T;
  LOCKED_FUNDS: T;
  // Polygon Errors
  INSUFFICIENT_MATIC_FEE: T;
  LOCKED_MATIC_FEE: T;
  // Ethereum Errors
  INSUFFICIENT_ETH_FEE: T;
  LOCKED_ETH_FEE: T;
  // Arbitrum Errors
  INSUFFICIENT_ARB_FEE: T;
  LOCKED_ARB_FEE: T;
  // Base Errors
  INSUFFICIENT_BASE_FEE: T;
  LOCKED_BASE_FEE: T;
  // Optimisim Errors
  INSUFFICIENT_OP_FEE: T;
  LOCKED_OP_FEE: T;
  HISTORY_LIMIT_EXCEEDED: T;
  MAIN_ADDRESS_GAP_REACHED: T;
  MULTI_TX_UNSUPPORTED: T;
  NETWORK_SUSPENDED: T;
  NOT_AUTHORIZED: T;
  SCRIPT_OP_RETURN: T;
  SCRIPT_OP_RETURN_AMOUNT: T;
  SCRIPT_TYPE: T;
  TOO_MANY_KEYS: T;
  TX_ALREADY_BROADCASTED: T;
  TX_CANNOT_CREATE: T;
  TX_CANNOT_REMOVE: T;
  TX_MAX_SIZE_EXCEEDED: T;
  TX_NOT_ACCEPTED: T;
  TX_NOT_FOUND: T;
  TX_NOT_PENDING: T;
  TX_NONCE_CONFLICT: T;
  UNAVAILABLE_UTXOS: T;
  NO_INPUT_PATHS: T;
  UPGRADE_NEEDED: T;
  WALLET_ALREADY_EXISTS: T;
  WALLET_FULL: T;
  WALLET_BUSY: T;
  WALLET_NOT_COMPLETE: T;
  WALLET_NOT_FOUND: T;
  WALLET_NEED_SCAN: T;
  WRONG_SIGNING_METHOD: T;
  OUT_OF_FUND: T,
  BELOW_MIN_LIMIT: T,
  EXCEED_MAX_LIMIT: T,
  NOT_FOUND_KEY_FUND: T,
  NOT_FOUND_KEY_RECEIVE: T,
  NOT_FOUND_KEY_CONVERSION: T,
  MISSING_REQUIRED_FIELD: T,
  ORDER_EXPIRED: T,
  NO_AVAILABLE_SWAP_COIN: T,
  NO_AVAILABLE_RECEIVE_COIN: T,
  NOT_FOUND_COIN_IN_CONFIG: T,
  NOT_STABLE_RATE: T,
  INVALID_AMOUNT: T,
  NOT_FOUND_TXDETAIL: T,
  INVALID_ADDRESS_TO: T,
  INSUFFICIENT_FUND_XEC: T,
  INSUFFICIENT_FUND_TOKEN: T,
  NOT_FOUND_XEC_WALLET_BALANCE: T,
  NOT_FOUND_TOKEN_WALLET: T,
  NOT_FOUND_RATE_XEC: T,
  NOT_FOUND_RATE_TOKEN: T,
  INVALID_TX_ID: T,
  BELOW_MINIMUM_XEC: T,
  BELOW_MINIMUM_TOKEN: T,
  EXCEED_DAILY_LIMIT: T,
  LONG_MESSAGE: T;
};

const errors: Errors<string> = {
  AD_ALREADY_EXISTS: 'Ad already exists',
  BAD_SIGNATURES: 'Bad signatures',
  BALANCE_BELOW_RESERVE: 'Balance below reserve limit',
  COPAYER_DATA_MISMATCH: 'Copayer data mismatch',
  COPAYER_IN_WALLET: 'Copayer already in wallet',
  COPAYER_REGISTERED: 'Copayer ID already registered on server',
  COPAYER_VOTED: 'Copayer already voted on this transaction proposal',
  DUST_AMOUNT: 'Amount below dust threshold',
  MORE_THAT_ONE_OUTPUT: 'This wallet supports transactions with only one output',
  INCORRECT_ADDRESS_NETWORK: 'Incorrect address network',
  ONLY_CASHADDR: 'Only cashaddr wo prefix is allowed for outputs',
  INSUFFICIENT_FUNDS: 'Insufficient funds',
  INSUFFICIENT_FUNDS_FOR_FEE: 'Insufficient funds for fee',
  INSUFFICIENT_MATIC_FEE: 'Your linked POLYGON wallet does not have enough MATIC for fee',
  LOCKED_MATIC_FEE: 'Your linked POLYGON wallet does not have enough MATIC for fee',
  INSUFFICIENT_ETH_FEE: 'Your linked ETH wallet does not have enough ETH for fee',
  LOCKED_ETH_FEE: 'Your linked ETH wallet does not have enough ETH for fee',
  INSUFFICIENT_ARB_FEE: 'Your linked ARB wallet does not have enough ETH for fee',
  LOCKED_ARB_FEE: 'Your linked ARB wallet does not have enough ETH for fee',
  INSUFFICIENT_BASE_FEE: 'Your linked BASE wallet does not have enough ETH for fee',
  LOCKED_BASE_FEE: 'Your linked BASE wallet does not have enough ETH for fee',
  INSUFFICIENT_OP_FEE: 'Your linked OP wallet does not have enough ETH for fee',
  LOCKED_OP_FEE: 'Your linked OP wallet does not have enough ETH for fee',
  INVALID_ADDRESS: 'Invalid address',
  INVALID_CHANGE_ADDRESS: 'Invalid change address',
  KEY_IN_COPAYER: 'Key already registered',
  LOCKED_FUNDS: 'Funds are locked by pending transaction proposals',
  HISTORY_LIMIT_EXCEEDED: 'Requested page limit is above allowed maximum',
  MAIN_ADDRESS_GAP_REACHED: 'Maximum number of consecutive addresses without activity reached',
  MULTI_TX_UNSUPPORTED: 'Desired chain does not support multi transaction proposals',
  NETWORK_SUSPENDED: '$network operations are currently suspended. Please check status.bitpay.com for further updates.',
  NOT_AUTHORIZED: 'Not authorized',
  SCRIPT_OP_RETURN: 'The only supported script is OP_RETURN',
  SCRIPT_OP_RETURN_AMOUNT: 'The amount of an output with OP_RETURN script must be 0',
  SCRIPT_TYPE: 'Script must be a valid data type',
  TOO_MANY_KEYS: 'Too many keys registered',
  TX_ALREADY_BROADCASTED: 'The transaction proposal is already broadcasted',
  TX_CANNOT_CREATE: 'Cannot create TX proposal during backoff time',
  TX_CANNOT_REMOVE: 'Cannot remove this tx proposal during locktime',
  TX_MAX_SIZE_EXCEEDED: 'TX exceeds maximum allowed size',
  TX_NOT_ACCEPTED: 'The transaction proposal is not accepted',
  TX_NOT_FOUND: 'Transaction proposal not found',
  TX_NOT_PENDING: 'The transaction proposal is not pending',
  TX_NONCE_CONFLICT: 'Unsigned TX proposal(s) with lower or conflicting nonces exist. Please sign or reject them first.',
  UNAVAILABLE_UTXOS: 'Unavailable unspent outputs',
  NO_INPUT_PATHS: 'Derivation paths were not provided for the inputs',
  UPGRADE_NEEDED: 'Client app needs to be upgraded',
  WALLET_ALREADY_EXISTS: 'Wallet already exists',
  WALLET_FULL: 'Wallet full',
  WALLET_BUSY: 'Wallet is busy, try later',
  WALLET_NOT_COMPLETE: 'Wallet is not complete',
  WALLET_NOT_FOUND: 'Wallet not found',
  WALLET_NEED_SCAN: 'Wallet needs addresses scan',
  WRONG_SIGNING_METHOD: 'Wrong signed method for coin/network',
  OUT_OF_FUND: 'Out of fund',
  BELOW_MIN_LIMIT: 'Below minimum allow',
  EXCEED_MAX_LIMIT: 'Above maximum allow',
  NOT_FOUND_KEY_FUND: 'Not found funding key',
  NOT_FOUND_KEY_RECEIVE: 'Not found receiving key',
  NOT_FOUND_KEY_CONVERSION: 'Not found key conversion',
  MISSING_REQUIRED_FIELD: 'Missing required field',
  ORDER_EXPIRED: 'Order is expired',
  NO_AVAILABLE_SWAP_COIN: 'Not found availabe coin user can swap',
  NO_AVAILABLE_RECEIVE_COIN: 'Not found availbe coin user can receive',
  NOT_FOUND_COIN_IN_CONFIG: 'This coin is not allowed to swap',
  NOT_STABLE_RATE: 'Rate is not stable',
  INVALID_AMOUNT: 'Invalid amount',
  NOT_FOUND_TXDETAIL: 'Can not get txdetail',
  INVALID_ADDRESS_TO: 'Invalid address to',
  INSUFFICIENT_FUND_XEC: 'Insufficient fund for xec wallet',
  INSUFFICIENT_FUND_TOKEN: 'Insufficient fund for token wallet',
  NOT_FOUND_XEC_WALLET_BALANCE: 'Not found xec wallet balance',
  NOT_FOUND_TOKEN_WALLET: 'Not found token wallet',
  NOT_FOUND_RATE_XEC: 'Not found rate for xec wallet',
  NOT_FOUND_RATE_TOKEN: 'Not found rate for token wallet',
  INVALID_TX_ID: 'Invalid txid',
  BELOW_MINIMUM_XEC: 'FUND XEC REACHED THRESHOLD LIMIT',
  BELOW_MINIMUM_TOKEN: 'FUND TOKEN REACHED THRESHOLD LIMIT',
  EXCEED_DAILY_LIMIT: 'Order exceeds maximum allowed daily usage',
  LONG_MESSAGE: 'Message is too long'
};

const errorsObject = { codes: {} };

for (const [code, msg] of Object.entries(errors)) {
  errorsObject[code] = new ClientError(code, msg);
  errorsObject.codes[code] = code;
}

export const Errors = errorsObject as Errors<ClientError> & { codes: Errors<string> };
