const _ = require('lodash');
import { ClientError } from './clienterror';

const errors = {
  AD_ALREADY_EXISTS: 'Ad already exists',
  BAD_SIGNATURES: 'Bad signatures',
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
  INSUFFICIENT_ETH_FEE: 'Your linked ETH wallet does not have enough ETH for fee',
  INVALID_ADDRESS: 'Invalid address',
  INVALID_CHANGE_ADDRESS: 'Invalid change address',
  KEY_IN_COPAYER: 'Key already registered',
  LOCKED_FUNDS: 'Funds are locked by pending transaction proposals',
  LOCKED_ETH_FEE: 'Your linked ETH wallet does not have enough ETH for fee',
  HISTORY_LIMIT_EXCEEDED: 'Requested page limit is above allowed maximum',
  MAIN_ADDRESS_GAP_REACHED: 'Maximum number of consecutive addresses without activity reached',
  NETWORK_SUSPENDED: '$network operations are currently suspended. Please check status.bitpay.com for further updates.',
  NOT_AUTHORIZED: 'Not authorized',
  TOO_MANY_KEYS: 'Too many keys registered',
  TX_ALREADY_BROADCASTED: 'The transaction proposal is already broadcasted',
  TX_CANNOT_CREATE: 'Cannot create TX proposal during backoff time',
  TX_CANNOT_REMOVE: 'Cannot remove this tx proposal during locktime',
  TX_MAX_SIZE_EXCEEDED: 'TX exceeds maximum allowed size',
  TX_NOT_ACCEPTED: 'The transaction proposal is not accepted',
  TX_NOT_FOUND: 'Transaction proposal not found',
  TX_NOT_PENDING: 'The transaction proposal is not pending',
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
  EXCEED_DAILY_LIMIT: 'Order exceeds maximum allowed daily usage'
};

const errorObjects = _.fromPairs(
  _.map(errors, (msg, code) => {
    return [code, new ClientError(code, msg)];
  })
);

errorObjects.codes = _.mapValues(errors, (v, k) => {
  return k;
});

module.exports = errorObjects;
