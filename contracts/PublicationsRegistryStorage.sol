pragma solidity 0.4.24;


// PublicationsRegistryStorage provides long term storage for the replacable
// PublicationRegistry.
//
// This PublicationsRegistryStorage provides only the ability to add new Publication
// contracts to storage. There is no provision for deleting them.
contract PublicationsRegistryStorage {

  /*
  * Events
  */

  event RegistryChange(address registryAddress);

  /*
  * Storage
  */

  address public owner;
  address public activeRegistry;
  address[] public publications;
  mapping(address => bool) public publicationsMap;

  /*
  * Modifiers
  */

  modifier isOwner() {
    require(msg.sender == owner);
    _;
  }

  modifier isRegistryOrOwner() {
    require(
      msg.sender == activeRegistry || msg.sender == owner
    );
    _;
  }

  /*
  * Methods
  */

  constructor()
    public
  {
    owner = msg.sender;
  }

  /*
  * Ownership Methods
  */

  function setOwner(address _owner)
    public
    isOwner()
  {
    owner = _owner;
  }

  function setActiveRegistry(address _newRegistry)
    public
    isRegistryOrOwner()
  {
    activeRegistry = _newRegistry;
    emit RegistryChange(activeRegistry);
  }

  /*
  * Publication Storage Methods
  */

  function add(address _publicationAddress)
    public
    isRegistryOrOwner()
    returns (uint)
  {
    publications.push(_publicationAddress);
    publicationsMap[_publicationAddress] = true;
    return (publications.length-1);
  }

  function length()
    public
    view
    returns (uint)
  {
    return publications.length;
  }

  function isTrustedPublication(address _publicationAddress)
    public
    view
    returns (bool)
  {
    return publicationsMap[_publicationAddress];
  }
}