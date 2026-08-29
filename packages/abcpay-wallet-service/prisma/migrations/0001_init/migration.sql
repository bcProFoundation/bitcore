-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "coin" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "m" INTEGER NOT NULL,
    "n" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "pubKey" TEXT NOT NULL,
    "derivationStrategy" TEXT NOT NULL DEFAULT 'BIP44',
    "addressType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Copayer" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "xPubKey" TEXT NOT NULL,
    "requestPubKey" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "copayerIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Copayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "isChange" BOOLEAN NOT NULL DEFAULT false,
    "addressIndex" INTEGER NOT NULL,
    "publicKeys" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TxProposal" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "fee" TEXT NOT NULL,
    "feePerKb" INTEGER NOT NULL,
    "changeAddress" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL,
    "raw" TEXT,
    "txid" TEXT,
    "inputs" JSONB NOT NULL,
    "outputs" JSONB NOT NULL,
    "excludeUnconfirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TxProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TxAction" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "copayerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "signatures" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TxAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TxNote" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "txid" TEXT NOT NULL,
    "copayerId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TxNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Copayer_walletId_xPubKey_key" ON "Copayer"("walletId", "xPubKey");
CREATE INDEX "Copayer_walletId_idx" ON "Copayer"("walletId");
CREATE UNIQUE INDEX "Address_walletId_path_key" ON "Address"("walletId", "path");
CREATE INDEX "Address_address_idx" ON "Address"("address");
CREATE INDEX "Address_walletId_idx" ON "Address"("walletId");
CREATE INDEX "TxProposal_walletId_status_idx" ON "TxProposal"("walletId", "status");
CREATE UNIQUE INDEX "TxAction_proposalId_copayerId_key" ON "TxAction"("proposalId", "copayerId");
CREATE UNIQUE INDEX "TxNote_walletId_txid_copayerId_key" ON "TxNote"("walletId", "txid", "copayerId");

-- AddForeignKey
ALTER TABLE "Copayer" ADD CONSTRAINT "Copayer_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Address" ADD CONSTRAINT "Address_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TxProposal" ADD CONSTRAINT "TxProposal_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TxAction" ADD CONSTRAINT "TxAction_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "TxProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TxNote" ADD CONSTRAINT "TxNote_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
