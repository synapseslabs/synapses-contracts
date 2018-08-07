const PublicationsRegistryStorage = artifacts.require(
  './PublicationsRegistryStorage.sol'
)
const PublicationsRegistry = artifacts.require('./PublicationsRegistry.sol')

const ipfsHash =
  '0x6b14cac30356789cd0c39fec0acc2176c3573abdb799f3b17ccc6972ab4d39ba'

contract('PublicationsRegistryStorage', accounts => {
  const owner = accounts[0]
  const notOwner = accounts[1]
  const alice = accounts[2]
  let storage
  let activeRegistry
  let otherRegistry

  beforeEach(async () => {
    storage = await PublicationsRegistryStorage.new({ from: owner })
    activeRegistry = await PublicationsRegistry.new(storage.address, {
      from: owner
    })
    storage.setActiveRegistry(activeRegistry.address, { from: owner })
  })

  describe('setOwner', async () => {
    it('should allow the owner to be set by the owner', async () => {
      await storage.setOwner(alice, { from: owner })
      expect(await storage.owner()).to.equal(alice)
    })
    it('should not allow the owner to be set by a stranger', async () => {
      try {
        await storage.setOwner(alice, { from: notOwner })
      } catch (e) {
        expect(e).to.exist
      }
      expect(await storage.owner()).to.equal(owner)
    })
  })

  describe('setActiveRegistry', async () => {
    beforeEach(async () => {
      otherRegistry = await PublicationsRegistry.new(storage.address, {
        from: owner
      })
    })
    it('should allow the activeRegistry to be set by the owner', async () => {
      await storage.setActiveRegistry(otherRegistry.address, { from: owner })
      expect(await storage.activeRegistry()).to.equal(otherRegistry.address)
    })
    it('should not allow the activeRegistry to be set by a stranger', async () => {
      try {
        await storage.setActiveRegistry(otherRegistry.address, {
          from: notOwner
        })
      } catch (e) {
        expect(e).to.exist
      }
      expect(await storage.activeRegistry()).to.equal(activeRegistry.address)
    })
    xit('should allow the activeRegistry to be set by the registry', async () => {
      // Not tested right now, since our registry doesn't send these
    })
  })

  describe('Migration process', async () => {
    beforeEach(async () => {
      otherRegistry = await PublicationsRegistry.new(storage.address, {
        from: owner
      })
    })
    it('should allow a migration from one PublicationsRegistry to another', async () => {
      await activeRegistry.create(ipfsHash, 3000, 1, { from: alice })
      await storage.setActiveRegistry(otherRegistry.address, { from: owner })
      await otherRegistry.create(ipfsHash, 3000, 1, { from: alice })
      expect((await storage.length()).toNumber()).to.equal(2)
    })
  })
})
