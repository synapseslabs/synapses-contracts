var PublicationsRegistry = artifacts.require("./PublicationsRegistry.sol")
var PublicationsRegistryStorage = artifacts.require("./PublicationsRegistryStorage.sol")
var UnitPublication = artifacts.require("./UnitPublication.sol")
var FractionalPublication = artifacts.require("./FractionalPublication.sol")
//var UserRegistry = artifacts.require("./UserRegistry.sol")
var PurchaseLibrary = artifacts.require("./PurchaseLibrary.sol")
//var OriginIdentity = artifacts.require("./OriginIdentity.sol")

module.exports = function(deployer, network) {
  return deployer.then(() => {
    return deployContracts(deployer)
  })
}

async function deployContracts(deployer) {
  await deployer.deploy(PurchaseLibrary)
  await deployer.link(PurchaseLibrary, PublicationsRegistry)
  await deployer.link(PurchaseLibrary, UnitPublication)
  await deployer.link(PurchaseLibrary, FractionalPublication)
  const publicationsRegistryStorage = await deployer.deploy(PublicationsRegistryStorage)
  const publicationRegistry = await deployer.deploy(PublicationsRegistry, publicationsRegistryStorage.address)
  publicationsRegistryStorage.setActiveRegistry(publicationRegistry.address)

  //await deployer.deploy(UserRegistry)

  //await deployer.deploy(OriginIdentity)
}
