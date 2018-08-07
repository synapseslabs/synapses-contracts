pragma solidity 0.4.24;

/// @title Publication
/// @dev Used to keep marketplace of publications for buyers and sellers
/// @author Matt Liu <matt@originprotocol.com>, Josh Fraser <josh@originprotocol.com>, Stan James <stan@originprotocol.com>

import "./UnitPublication.sol";
import "./FractionalPublication.sol";
import "./PublicationsRegistryStorage.sol";

contract PublicationsRegistry {

  /*
   * Events
   */

  event NewPublication(uint _index, address _address);

  /*
   * Storage
   */

  address public owner;

  PublicationsRegistryStorage public publicationStorage;

  /*
   * Public functions
   */

  constructor(PublicationsRegistryStorage _publicationStorage)
    public
  {
    // Defines origin admin address - may be removed for public deployment
    owner = msg.sender;
    publicationStorage = _publicationStorage;
  }

  /// @dev publicationsLength(): Return number of publications
  function publicationsLength()
    public
    constant
    returns (uint)
  {
      return publicationStorage.length();
  }

  /// @dev getPublicationAddress(): Return publication address
  /// @param _index the index of the publication
  function getPublicationAddress(uint _index)
    public
    constant
    returns (address)
  {
    return publicationStorage.publications(_index);
  }

  /// @dev create(): Create a new publication
  /// @param _ipfsHash Hash of data on ipfsHash
  /// @param _price Price of unit in wei
  /// @param _unitsAvailable Number of units availabe for sale at start
  ///
  /// Sample Remix invocation:
  /// ["0x01","0x7d","0xfd","0x85","0xd4","0xf6","0xcb","0x4d","0xcd","0x71","0x5a","0x88","0x10","0x1f","0x7b","0x1f","0x06","0xcd","0x1e","0x00","0x9b","0x23","0x27","0xa0","0x80","0x9d","0x01","0xeb","0x9c","0x91","0xf2","0x31"],"3140000000000000000",42
  function create(
    bytes32 _ipfsHash,
    uint _price,
    uint _unitsAvailable
  )
    public
    returns (uint)
  {
    Publication newPublication = new UnitPublication(msg.sender, _ipfsHash, _price, _unitsAvailable);
    publicationStorage.add(newPublication);
    emit NewPublication((publicationStorage.length())-1, address(newPublication));
    return publicationStorage.length();
  }

  /// @dev createFractional(): Create a new fractional publication
  /// @param _ipfsHash Hash of data on ipfsHash
  function createFractional(
    bytes32 _ipfsHash
  )
    public
    returns (uint)
  {
    Publication newPublication = new FractionalPublication(msg.sender, _ipfsHash);
    publicationStorage.add(newPublication);
    emit NewPublication((publicationStorage.length())-1, address(newPublication));
    return publicationStorage.length();
  }

  /// @dev createOnBehalf(): Create a new publication with specified creator
  ///                        Used for migrating from old contracts (admin only)
  /// @param _ipfsHash Hash of data on ipfsHash
  /// @param _price Price of unit in wei
  /// @param _unitsAvailable Number of units availabe for sale at start
  /// @param _creatorAddress Address of account to be the creator
  function createOnBehalf(
    bytes32 _ipfsHash,
    uint _price,
    uint _unitsAvailable,
    address _creatorAddress
  )
    public
    returns (uint)
  {
    require (msg.sender == owner, "Only callable by registry owner");
    Publication newPublication = new UnitPublication(_creatorAddress, _ipfsHash, _price, _unitsAvailable);
    publicationStorage.add(newPublication);
    emit NewPublication(publicationStorage.length()-1, address(newPublication));
    return publicationStorage.length();
  }

  // @dev isTrustedPublication(): Checks to see if a publication belongs to
  //                          this registry, and thus trusting that
  //                          it was created with good bytecode and
  //                          the proper initialization was completed.
  function isTrustedPublication(
    address _publicationAddress
  )
    public
    view
    returns(bool)
  {
    return publicationStorage.isTrustedPublication(_publicationAddress);
  }
}
