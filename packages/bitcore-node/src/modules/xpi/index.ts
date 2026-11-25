import { ChainStateProvider } from '../../providers/chain-state';
import { XPIStateProvider } from '../../providers/chain-state/xpi/xpi';
import { Libs } from '../../providers/libs';
import { P2P } from '../../services/p2p';
import { Verification } from '../../services/verification';
import { RegisterModule } from '../../types/Module';
import { VerificationPeer } from '../bitcoin/VerificationPeer';
import { BitcoinP2PWorker } from '../bitcoin/p2p';

const registerModule: RegisterModule = ({ chain, network }) => {
  Libs.register(chain, '@bcpros/bitcore-lib-xpi', '@bcpros/bitcore-p2p-xpi');
  P2P.register(chain, network, BitcoinP2PWorker);
  ChainStateProvider.registerService(chain, network, new XPIStateProvider());
  Verification.register(chain, network, VerificationPeer);
};

export default registerModule;
