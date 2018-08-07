const UnitPublication = artifacts.require('./UnitPublication.sol')
const Purchase = artifacts.require('./Purchase.sol')

// Used to assert error cases
const isEVMError = function(err) {
  const str = err.toString()
  return str.includes('revert')
}

const timetravel = async function(seconds) {
  await web3.currentProvider.send({
    jsonrpc: '2.0',
    method: 'evm_increaseTime',
    params: [seconds],
    id: 0
  })
  await web3.currentProvider.send({
    jsonrpc: '2.0',
    method: 'evm_mine',
    params: [],
    id: 0
  })
}

const ipfsHash =
  '0x6b14cac30356789cd0c39fec0acc2176c3573abdb799f3b17ccc6972ab4d39ba'
const price = 33
const unitsAvailable = 42
const LISTING_EXPIRATION_SECONDS = 60 * 24 * 60 * 60

contract('UnitPublication', accounts => {
  const seller = accounts[0]
  const buyer = accounts[1]
  const stranger = accounts[2]
  let publication

  beforeEach(async function() {
    publication = await UnitPublication.new(seller, ipfsHash, price, unitsAvailable, {
      from: seller
    })
  })

  it('should have correct price', async function() {
    const newPrice = await publication.price()
    assert.equal(newPrice, price, 'price is correct')
  })

  it('should allow getting publication information', async function() {
    const data = await publication.data()
    assert.equal(data[0], seller, 'owner')
    assert.equal(data[1], ipfsHash, 'ipfsHash')
    assert.equal(data[2], price, 'price')
    assert.equal(data[3], unitsAvailable, 'unitsAvailable')
    assert.equal(
      data[4].toNumber(),
      (await publication.created()).toNumber(),
      'created'
    )
    assert.equal(
      data[5].toNumber(),
      (await publication.expiration()).toNumber(),
      'expiration'
    )
  })

  it('should decrement the number of units sold', async function() {
    const unitsToBuy = 3
    await publication.buyPublication(unitsToBuy, { from: buyer, value: 6 })
    assert.equal(await publication.unitsAvailable(), unitsAvailable - unitsToBuy)
  })

  it('should decrement the number of units sold to zero if needed', async function() {
    const unitsToBuy = unitsAvailable
    await publication.buyPublication(unitsToBuy, { from: buyer, value: 6 })
    assert.equal(await publication.unitsAvailable(), 0)
  })

  it('should not allow a sale that would decrement the number of units sold to below zero', async function() {
    const unitsToBuy = unitsAvailable + 1
    try {
      await publication.buyPublication(unitsToBuy, { from: buyer, value: 6 })
    } catch (err) {
      assert.ok(isEVMError(err), 'an EVM error is thrown')
    }
    assert.equal(await publication.unitsAvailable(), unitsAvailable)
  })

  it('should not be able to be sold after expiration', async function() {
    timetravel(LISTING_EXPIRATION_SECONDS + 10)
    // Try to buy 1
    try {
      await publication.buyPublication(1, { from: buyer, value: 6 })
    } catch (err) {
      // Verify failure
      assert.ok(isEVMError(err), 'an EVM error is thrown')
    }
    // Verify no change to publication
    assert.equal(await publication.unitsAvailable(), unitsAvailable)
  })

  it('should be able to be sold before expiration', async function() {
    timetravel(LISTING_EXPIRATION_SECONDS - 10)
    // Buy 1
    await publication.buyPublication(1, { from: buyer, value: 6 })
    // Verify sale was good
    assert.equal(await publication.unitsAvailable(), unitsAvailable - 1)
  })

  it('should allow the seller to close it', async function() {
    assert.equal(await publication.unitsAvailable(), unitsAvailable)
    await publication.close({ from: seller })
    assert.equal(await publication.unitsAvailable(), 0)
  })

  it('should not allow a stranger to close it', async function() {
    assert.equal(await publication.unitsAvailable(), unitsAvailable)
    try {
      await publication.close({ from: stranger })
    } catch (err) {
      assert.ok(isEVMError(err), 'an EVM error is thrown')
    }
    assert.equal(await publication.unitsAvailable(), unitsAvailable)
  })

  it('should be able to buy a publication', async function() {
    const unitsToBuy = 1 // TODO: Handle multiple units
    const buyTransaction = await publication.buyPublication(unitsToBuy, {
      from: buyer,
      value: 6
    })
    const publicationPurchasedEvent = buyTransaction.logs.find(
      e => e.event == 'PublicationPurchased'
    )
    const purchaseContract = await Purchase.at(
      publicationPurchasedEvent.args._purchaseContract
    )

    // Check units available decreased
    const newUnitsAvailable = await publication.unitsAvailable()
    assert.equal(
      newUnitsAvailable,
      unitsAvailable - unitsToBuy,
      'units available has decreased'
    )

    // Check buyer set correctly
    assert.equal(await purchaseContract.buyer(), buyer)

    // Check that purchase was stored in publications
    assert.equal((await publication.purchasesLength()).toNumber(), 1)

    // Check that we can fetch the purchase address
    assert.equal(await publication.getPurchase(0), purchaseContract.address)
  })
})
