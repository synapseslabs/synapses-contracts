const PublicationsRegistryStorage = artifacts.require(
  './PublicationsRegistryStorage.sol'
)
const contractDefinition = artifacts.require('./PublicationsRegistry.sol')
const UnitPublication = artifacts.require('./UnitPublication.sol')

const initialPublicationsLength = 0
const ipfsHash =
  '0x6b14cac30356789cd0c39fec0acc2176c3573abdb799f3b17ccc6972ab4d39ba'

contract('PublicationsRegistry', accounts => {
  const owner = accounts[0]
  let instance
  let publicationsRegistryStorage

  beforeEach(async function() {
    publicationsRegistryStorage = await PublicationsRegistryStorage.new({ from: owner })
    instance = await contractDefinition.new(publicationsRegistryStorage.address, {
      from: owner
    })
    publicationsRegistryStorage.setActiveRegistry(instance.address)
  })

  it('should have owner as owner of contract', async function() {
    const contractOwner = await instance.owner()
    assert.equal(contractOwner, owner)
  })

  it('should be able to create a publication', async function() {
    const initPrice = 2
    const initUnitsAvailable = 5
    await instance.create(ipfsHash, initPrice, initUnitsAvailable, {
      from: accounts[0]
    })
    const publicationCount = await instance.publicationsLength()
    assert.equal(
      publicationCount,
      initialPublicationsLength + 1,
      'publications count has incremented'
    )
    const publicationAddress = await instance.getPublicationAddress(
      initialPublicationsLength
    )
    const [lister, hash, price, unitsAvailable] = await UnitPublication.at(
      publicationAddress
    ).data()
    assert.equal(lister, accounts[0], 'lister is correct')
    assert.equal(hash, ipfsHash, 'ipfsHash is correct')
    assert.equal(price, initPrice, 'price is correct')
    assert.equal(
      unitsAvailable,
      initUnitsAvailable,
      'unitsAvailable is correct'
    )
  })

  it('should be able to create a publication on behalf of other', async function() {
    const initPrice = 2
    const initUnitsAvailable = 5
    await instance.createOnBehalf(
      ipfsHash,
      initPrice,
      initUnitsAvailable,
      accounts[1],
      { from: accounts[0] }
    )
    const publicationCount = await instance.publicationsLength()
    assert.equal(
      publicationCount,
      initialPublicationsLength + 1,
      'publications count has incremented'
    )
    const publicationAddress = await instance.getPublicationAddress(
      initialPublicationsLength
    )
    const [lister, hash, price, unitsAvailable] = await UnitPublication.at(
      publicationAddress
    ).data()
    assert.equal(lister, accounts[1], 'lister is correct as other account')
    assert.equal(hash, ipfsHash, 'ipfsHash is correct')
    assert.equal(price, initPrice, 'price is correct')
    assert.equal(
      unitsAvailable,
      initUnitsAvailable,
      'unitsAvailable is correct'
    )
  })

  describe('Trusted publication check', async function() {
    it('should verify a trusted publication', async function() {
      await instance.create(ipfsHash, 3000, 1, { from: owner })
      const publicationIndex = (await instance.publicationsLength()) - 1
      const trustedPublicationAddress = await instance.getPublicationAddress(
        publicationIndex
      )
      const isVerified = await instance.isTrustedPublication(trustedPublicationAddress)
      expect(isVerified).to.equal(true)
    })
    it('should not verify an untrusted publication', async function() {
      const otherStorage = await PublicationsRegistryStorage.new()
      const otherRegistry = await contractDefinition.new(otherStorage.address)
      await otherStorage.setActiveRegistry(otherRegistry.address)
      await otherRegistry.create(ipfsHash, 3000, 1)
      const publicationIndex = (await otherRegistry.publicationsLength()) - 1
      const otherPublicationAddress = await otherRegistry.getPublicationAddress(
        publicationIndex
      )
      const isVerified = await instance.isTrustedPublication(otherPublicationAddress)
      expect(isVerified).to.equal(false)
    })
  })
})
