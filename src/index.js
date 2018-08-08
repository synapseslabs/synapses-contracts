import ContractService from './services/contract-service'
import IpfsService from './services/ipfs-service'
import { Attestations } from './resources/attestations'
import Publications from './resources/publications'
import Notifications from './resources/notifications'
import Purchases from './resources/purchases'
import Reviews from './resources/reviews'
import Users from './resources/users'
import fetch from 'cross-fetch'
import store from 'store'

const defaultBridgeServer = 'https://bridge.originprotocol.com' //FIXME!!
const defaultIpfsDomain = 'gateway.originprotocol.com' //FIXME!!
const defaultIpfsApiPort = '5002'
const defaultIpfsGatewayPort = '443'
const defaultIpfsGatewayProtocol = 'https'
const defaultAttestationServerUrl = `${defaultBridgeServer}/api/attestations`
const defaultIndexingServerUrl = `${defaultBridgeServer}/api`

class Synapses {
  constructor({
    ipfsDomain = defaultIpfsDomain,
    ipfsApiPort = defaultIpfsApiPort,
    ipfsGatewayPort = defaultIpfsGatewayPort,
    ipfsGatewayProtocol = defaultIpfsGatewayProtocol,
    attestationServerUrl = defaultAttestationServerUrl,
    indexingServerUrl = defaultIndexingServerUrl,
    contractAddresses,
    web3
  } = {}) {
    this.contractService = new ContractService({ contractAddresses, web3 })
    this.ipfsService = new IpfsService({
      ipfsDomain,
      ipfsApiPort,
      ipfsGatewayPort,
      ipfsGatewayProtocol
    })

    this.attestations = new Attestations({
      serverUrl: attestationServerUrl,
      contractService: this.contractService,
      fetch
    })

    this.purchases = new Purchases({
      contractService: this.contractService,
      ipfsService: this.ipfsService,
      indexingServerUrl,
      fetch
    })

    this.publications = new Publications({
      purchases: this.purchases,
      contractService: this.contractService,
      ipfsService: this.ipfsService,
      indexingServerUrl,
      fetch
    })

    this.notifications = new Notifications({
      publications: this.publications,
      purchases: this.purchases,
      contractService: this.contractService,
      store
    })

    this.reviews = new Reviews({
      contractService: this.contractService,
      ipfsService: this.ipfsService
    })

    this.users = new Users({
      contractService: this.contractService,
      ipfsService: this.ipfsService
    })
  }
}

export default Synapses