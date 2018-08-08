// For now, we are just wrapping the methods that are already in
// contractService and ipfsService.

import ResourceBase from './_resource-base'
import Ajv from 'ajv'
import ajvEnableMerge from 'ajv-merge-patch/keywords/merge'
import publicationSchema from '../schemas/publication.json'
import unitpublicationSchema from '../schemas/unit-publication.json'
import fractionalpublicationSchema from '../schemas/fractional-publication.json'

const unitpublicationType = 'unit'
const fractionalpublicationType = 'fractional'

const unitSchemaId = 'unit-publication.json'
const fractionalSchemaId = 'fractional-publication.json'

const ajv = new Ajv({
  schemas: [publicationSchema, unitpublicationSchema, fractionalpublicationSchema]
})
ajvEnableMerge(ajv)

const validateUnitpublication = ajv.getSchema(unitSchemaId)
const validateFractionalpublication = ajv.getSchema(fractionalSchemaId)

const appendSlash = url => {
  return url.substr(-1) === '/' ? url : url + '/'
}

function validate(validateFn, data, schema) {
  if (!validateFn(data)) {
    throw new Error(
      `Data invalid for schema. Data: ${JSON.stringify(
        data
      )}. Schema: ${JSON.stringify(schema)}`
    )
  }
}

class Publications extends ResourceBase {
  constructor({
    contractService,
    ipfsService,
    fetch,
    indexingServerUrl,
    purchases
  }) {
    super({ contractService, ipfsService })
    this.contractDefinition = this.contractService.publicationContract
    this.fetch = fetch
    this.indexingServerUrl = indexingServerUrl
    this.purchases = purchases
  }

  /*
      Public mehods
  */

  // fetches all publications (all data included)
  async all({ noIndex = false } = {}) {
    try {
      if (noIndex) {
        const ids = await this.allIds()

        return await Promise.all(ids.map(this.getByIndex.bind(this)))
      } else {
        return await this.allIndexed()
      }
    } catch (error) {
      console.error(error)
      console.log('Cannot get all publications')
      throw error
    }
  }

  async allIds() {
    const range = (start, count) =>
      Array.apply(0, Array(count)).map((element, index) => index + start)

    let instance
    try {
      instance = await this.contractService.deployed(
        this.contractService.publicationsRegistryContract
      )
    } catch (error) {
      console.log('Contract not deployed')
      throw error
    }

    // Get total number of publications
    let publicationsLength
    try {
      publicationsLength = await instance.methods.publicationsLength().call()
    } catch (error) {
      console.log(error)
      console.log('Cannot get number of publications')
      throw error
    }

    return range(0, Number(publicationsLength))
  }

  async allAddresses() {
    const contract = this.contractService.publicationsRegistryContract
    const deployed = await this.contractService.deployed(contract)
    const events = await deployed.getPastEvents('Newpublication', {
      fromBlock: 0,
      toBlock: 'latest'
    })
    return events.map(({ returnValues }) => {
      return returnValues['_address']
    })
  }

  async get(address) {
    const publication = await this.contractService.deployed(
      this.contractService.publicationContract,
      address
    )
    const ipfsHashBytes32 = await publication.methods.ipfsHash().call()
    const ipfsHash = this.contractService.getIpfsHashFromBytes32(
      ipfsHashBytes32
    )
    const ipfsJson = await this.ipfsService.getFile(ipfsHash)
    const ipfsData = ipfsJson ? ipfsJson.data : {}

    ipfsData.publicationType = ipfsData.publicationType || unitpublicationType

    if (ipfsData.publicationType === unitpublicationType) {
      return await this.getUnitpublication(address, ipfsData, ipfsHash)
    } else if (ipfsData.publicationType === fractionalpublicationType) {
      return await this.getFractionalpublication(address, ipfsData, ipfsHash)
    } else {
      throw new Error('Invalid publication type:', ipfsData.publicationType)
    }
  }

  // This method is DEPRECATED
  async getByIndex(publicationIndex) {
    const publicationsRegistry = await this.contractService.deployed(
      this.contractService.publicationsRegistryContract
    )
    const publicationAddress = await publicationsRegistry.methods
      .getpublicationAddress(publicationIndex)
      .call()
    return await this.get(publicationAddress)
  }

  async create(data, schemaType) {
    const publicationType = data.publicationType || unitpublicationType
    data.publicationType = publicationType // in case it wasn't set
    if (publicationType === unitpublicationType) {
      return await this.createUnit(data, schemaType)
    } else if (publicationType === fractionalpublicationType) {
      return await this.createFractional(data)
    }
  }

  async update(address, data = {}) {
    if (data.publicationType !== fractionalpublicationType) {
      throw new Error(
        `This publication type (${data.publicationType}) cannot be updated.`
      )
    }
    return await this.updateFractional(address, data)
  }

  async buy(address, unitsToBuy, ethToPay) {
    // TODO: ethToPay should really be replaced by something that takes Wei.
    const value = this.contractService.web3.utils.toWei(
      String(ethToPay),
      'ether'
    )
    return await this.contractService.contractFn(
      this.contractService.unitpublicationContract,
      address,
      'buypublication',
      [unitsToBuy],
      {
        value: value,
        gas: 850000
      }
    )
  }

  async request(address, ifpsData, ethToPay) {
    // TODO: ethToPay should really be replaced by something that takes Wei.
    const value = this.contractService.web3.utils.toWei(
      String(ethToPay),
      'ether'
    )
    const ipfsHash = await this.ipfsService.submitFile(ifpsData)
    const ipfsBytes32 = this.contractService.getBytes32FromIpfsHash(ipfsHash)
    return await this.contractService.contractFn(
      this.contractService.fractionalpublicationContract,
      address,
      'request',
      [ipfsBytes32],
      {
        value: value,
        gas: 850000
      }
    )
  }

  async close(address) {
    return await this.contractService.contractFn(
      this.contractService.unitpublicationContract,
      address,
      'close'
    )
  }

  async purchasesLength(address) {
    return Number(
      await this.contractService.contractFn(
        this.contractService.unitpublicationContract,
        address,
        'purchasesLength'
      )
    )
  }

  async getPurchases(address) {
    const purchasesLength = await this.purchasesLength(address)
    const indices = []
    for (let i = 0; i < purchasesLength; i++) {
      indices.push(i)
    }
    return await Promise.all(
      indices.map(async index => {
        const purchaseAddress = await this.contractService.contractFn(
          this.contractService.publicationContract,
          address,
          'getPurchase',
          [index]
        )
        return this.purchases.get(purchaseAddress)
      })
    )
  }

  async purchaseAddressByIndex(address, index) {
    return await this.contractService.contractFn(
      this.contractService.unitpublicationContract,
      address,
      'getPurchase',
      [index]
    )
  }

  /*
      Private methods
  */

  async createUnit(data, schemaType) {
    validate(validateUnitpublication, data, unitpublicationSchema)

    const formpublication = { formData: data }

    // TODO: Why can't we take schematype from the formpublication object?
    const jsonBlob = {
      schema: `http://localhost:3000/schemas/${schemaType}.json`,
      data: formpublication.formData
    }

    let ipfsHash
    try {
      // Submit to IPFS
      ipfsHash = await this.ipfsService.submitFile(jsonBlob)
    } catch (error) {
      throw new Error(`IPFS Failure: ${error}`)
    }

    console.log(`IPFS file created with hash: ${ipfsHash} for data:`)
    console.log(jsonBlob)

    // For now, accept price in either wei or eth for backwards compatibility
    // `price` is now deprecated. `priceWei` should be used instead.
    const priceEth = String(formpublication.formData.price)
    const priceWei = formpublication.formData.priceWei
      ? String(formpublication.formData.priceWei)
      : this.contractService.web3.utils.toWei(priceEth, 'ether')

    // Submit to ETH contract
    const units = 1 // TODO: Allow users to set number of units in form
    let transactionReceipt
    try {
      transactionReceipt = await this.submitUnitpublication(
        ipfsHash,
        priceWei,
        units
      )
    } catch (error) {
      console.error(error)
      throw new Error(`ETH Failure: ${error}`)
    }

    // Success!
    console.log(
      `Submitted to ETH blockchain with transactionReceipt.tx: ${
        transactionReceipt.tx
      }`
    )
    return transactionReceipt
  }

  async createFractional(data) {
    validate(validateFractionalpublication, data, fractionalpublicationSchema)
    const json = { data }

    // Submit to IPFS
    let ipfsHash
    try {
      ipfsHash = await this.ipfsService.submitFile(json)
    } catch (error) {
      throw new Error(`IPFS Failure: ${error}`)
    }

    // Submit to ETH contract
    let transactionReceipt
    try {
      transactionReceipt = await this.submitFractionalpublication(ipfsHash)
    } catch (error) {
      console.error(error)
      throw new Error(`ETH Failure: ${error}`)
    }

    return transactionReceipt
  }

  async updateFractional(address, data) {
    validate(validateFractionalpublication, data, fractionalpublicationSchema)
    const json = { data }

    // Submit to IPFS
    let ipfsHash
    try {
      ipfsHash = await this.ipfsService.submitFile(json)
    } catch (error) {
      throw new Error(`IPFS Failure: ${error}`)
    }

    // Submit to ETH contract
    let transactionReceipt
    try {
      const account = await this.contractService.currentAccount()
      const instance = await this.contractService.deployed(
        this.contractService.fractionalpublicationContract,
        address
      )
      const version = await instance.methods.currentVersion().call()
      const ipfsBytes32 = this.contractService.getBytes32FromIpfsHash(ipfsHash)

      transactionReceipt = await this.contractService.contractFn(
        this.contractService.fractionalpublicationContract,
        address,
        'update',
        [version, ipfsBytes32],
        { from: account, gas: 4476768 }
      )
    } catch (error) {
      console.error('Error submitting to the Ethereum blockchain: ' + error)
      throw error
    }

    return transactionReceipt
  }

  async submitUnitpublication(ipfspublication, priceWei, units) {
    try {
      const account = await this.contractService.currentAccount()
      const instance = await this.contractService.deployed(
        this.contractService.publicationsRegistryContract
      )

      // Note we cannot get the publicationId returned by our contract.
      // See: https://forum.ethereum.org/discussion/comment/31529/#Comment_31529
      return instance.methods
        .create(
          this.contractService.getBytes32FromIpfsHash(ipfspublication),
          priceWei,
          units
        )
        .send({ from: account, gas: 4476768 })
    } catch (error) {
      console.error('Error submitting to the Ethereum blockchain: ' + error)
      throw error
    }
  }

  async submitFractionalpublication(ipfspublication) {
    try {
      const account = await this.contractService.currentAccount()
      return await this.contractService.contractFn(
        this.contractService.publicationsRegistryContract,
        null,
        'createFractional',
        [this.contractService.getBytes32FromIpfsHash(ipfspublication)],
        { from: account, gas: 4476768 }
      )
    } catch (error) {
      console.error('Error submitting to the Ethereum blockchain: ' + error)
      throw error
    }
  }

  async allIndexed() {
    const url = appendSlash(this.indexingServerUrl) + 'publication'
    const response = await this.fetch(url, { method: 'GET' })
    const json = await response.json()
    return Promise.all(
      json.objects.map(async obj => {
        const ipfsData = obj['ipfs_data']
        // While we wait on https://github.com/OriginProtocol/origin-bridge/issues/18
        // we fetch the array of image data strings for each publication
        const indexedIpfsData = await this.ipfsService.getFile(obj['ipfs_hash'])
        const pictures = indexedIpfsData.data.pictures
        return {
          address: obj['contract_address'],
          ipfsHash: obj['ipfs_hash'],
          sellerAddress: obj['owner_address'],
          price: Number(obj['price']),
          unitsAvailable: Number(obj['units']),
          created: obj['created_at'],
          expiration: obj['expires_at'],

          name: ipfsData ? ipfsData['name'] : null,
          category: ipfsData ? ipfsData['category'] : null,
          description: ipfsData ? ipfsData['description'] : null,
          location: ipfsData ? ipfsData['location'] : null,
          publicationType: ipfsData ? ipfsData['publicationType'] : unitpublicationType,
          pictures
        }
      })
    )
  }

  async getUnitpublication(publicationAddress, ipfsData, ipfsHash) {
    const publication = await this.contractService.deployed(
      this.contractService.unitpublicationContract,
      publicationAddress
    )
    const contractData = await publication.methods.data().call()
    return {
      address: publicationAddress,
      ipfsHash: ipfsHash,
      sellerAddress: contractData[0],
      priceWei: contractData[2].toString(),
      price: this.contractService.web3.utils.fromWei(contractData[2], 'ether'),
      unitsAvailable: Number(contractData[3]),
      created: contractData[4],
      expiration: contractData[5],

      name: ipfsData.name,
      category: ipfsData.category,
      description: ipfsData.description,
      location: ipfsData.location,
      pictures: ipfsData.pictures,
      publicationType: ipfsData.publicationType,
      schemaType: ipfsData.schemaType
    }
  }

  getFractionalpublication(publicationAddress, ipfsData, ipfsHash) {
    return {
      address: publicationAddress,
      ipfsHash: ipfsHash,
      name: ipfsData.name,
      category: ipfsData.category,
      description: ipfsData.description,
      location: ipfsData.location,
      pictures: ipfsData.pictures,
      publicationType: ipfsData.publicationType,
      schemaType: ipfsData.schemaType,
      slots: ipfsData.slots,
      calendarStep: ipfsData.calendarStep
    }
  }
}

export default Publications
