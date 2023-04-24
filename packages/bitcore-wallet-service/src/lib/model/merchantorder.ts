export enum PaymentType {
  SEND,
  BURN
}

export interface IPaymentInfo {
  payee: string;
  paymentReason: string;
  paymentDescription: string;
  accountNumber: number;
  street: string;
  unitNumber: number;
  amount: string;
  date: Date;
}

export interface IMerchantOrder {
  coin: string;
  tokenId?: string;
  txIdFromUser: string;
  txMerchantPayment?: string;
  merchantCode: string;
  userAddress: string;
  amount: number;
  paymentInfo: IPaymentInfo;
  error?: string;
  pendingReason?: string;
  createdOn: Date;
  lastModified: Date;
  signature?: string;
  isPaidByUser: boolean;
}

export class MerchantOrder implements IMerchantOrder {
  coin: string;
  tokenId?: string;
  userAddress: string;
  txIdFromUser: string;
  txIdMerchantPayment?: string;
  merchantCode: string;
  amount: number;
  paymentType: PaymentType;
  paymentInfo: IPaymentInfo;
  error?: string;
  pendingReason?: string;
  createdOn: Date;
  lastModified: Date;
  signature?: string;
  isPaidByUser: boolean;
  static create(opts) {
    opts = opts || {};
    const x = new MerchantOrder();
    const now = new Date();
    x.coin = opts.coin;
    x.tokenId = opts.tokenId || null;
    x.userAddress = opts.userAddress;
    x.txIdFromUser = opts.txIdFromUser;
    x.txIdMerchantPayment = opts.txIdMerchantPayment || null;
    x.merchantCode = opts.merchantCode;
    x.amount = opts.amount;
    x.paymentInfo = opts.paymentInfo;
    x.createdOn = now;
    x.lastModified = now;
    x.error = opts.error || null;
    x.pendingReason = opts.pendingReason || null;
    x.signature = opts.signature || null;
    x.isPaidByUser = opts.isPaidByUser;
    return x;
  }

  static fromObj(obj) {
    const x = new MerchantOrder();
    x.coin = obj.coin;
    x.tokenId = obj.tokenId || null;
    x.userAddress = obj.userAddress;
    x.txIdFromUser = obj.txIdFromUser;
    x.txIdMerchantPayment = obj.txIdMerchantPayment || null;
    x.merchantCode = obj.merchantCode;
    x.amount = obj.amount;
    x.paymentInfo = obj.paymentInfo;
    x.createdOn = obj.createdOn;
    x.lastModified = obj.lastModified;
    x.error = obj.error || null;
    x.pendingReason = obj.pendingReason || null;
    x.signature = obj.signature || null;
    x.isPaidByUser = obj.isPaidByUser;
    return x;
  }
}
