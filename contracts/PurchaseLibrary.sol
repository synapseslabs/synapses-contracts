pragma solidity 0.4.24;

/// @title PurchaseLibrary
/// @dev An collection of helper tools for a purchase

import "./Purchase.sol";
import "./Publication.sol";

library PurchaseLibrary {

    function newPurchase(Publication _publication, uint _publicationVersion, bytes32 _ipfsHash, address _buyer)
    public
    returns (Purchase purchase)
    {
        purchase = new Purchase(_publication, _publicationVersion, _ipfsHash, _buyer);
    }

}
