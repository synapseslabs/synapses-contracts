pragma solidity 0.4.24;

import "./Publication.sol";
import "./PurchaseLibrary.sol";

contract FractionalPublication is Publication {

  /*
   * Events
   */

  event PublicationPurchased(Purchase _purchaseContract);

  /*
  * Storage
  */

  struct Version {
      uint timestamp;
      bytes32 ipfsHash;
  }

  Version[] public versions;


  constructor (
    address _owner,
    bytes32 _ipfsHash
  )
  public
  {
    owner = _owner;
    publicationRegistry = msg.sender; // PublicationRegistry(msg.sender);
    versions.push(Version(now, _ipfsHash));
    created = now;
    expiration = created + 60 days;
    needsSellerApproval = true;
  }

  /*
    * Public functions
  */

  function isApproved(Purchase)
    public
    view
    returns (bool)
  {
    return false;
  }

  function ipfsHash()
    public
    constant
    returns (bytes32)
  {
    return versions[currentVersion()].ipfsHash;
  }

  function currentVersion()
    public
    constant
    returns (uint)
  {
    return versions.length - 1;
  }

  function data(uint _version)
    public
    constant
    returns (uint timestamp, bytes32 _ipfsHash)
  {
    return (versions[_version].timestamp, versions[_version].ipfsHash);
  }

  function update(uint _currentVersion, bytes32 _ipfsHash)
    public
    isSeller
  {
    if (_currentVersion == currentVersion()) {
      versions.push(Version(now, _ipfsHash));
      emit PublicationChange();
    }
  }

  function request(bytes32 _ipfsHash)
    public
    payable
    isNotSeller
    hasNotExpired
  {
    // Create purchase contract
    Purchase purchaseContract = PurchaseLibrary.newPurchase(this, currentVersion(), _ipfsHash, msg.sender);

    purchases.push(purchaseContract);

    // TODO STAN: How to call function *AND* transfer value??
    purchaseContract.pay.value(msg.value)();

    emit PublicationPurchased(purchaseContract);
    emit PublicationChange();
  }

}
