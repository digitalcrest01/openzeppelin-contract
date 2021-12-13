// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../token/ERC721/extensions/draft-ERC721Royalty.sol";

contract ERC721RoyaltyMock is ERC721Royalty {
    constructor(string memory name, string memory symbol) ERC721(name, symbol) {}

    function setTokenRoyalty(
        uint256 tokenId,
        address recipient,
        uint256 fraction
    ) public {
        _setTokenRoyalty(tokenId, recipient, fraction);
    }

    function setGlobalRoyalty(address recipient, uint256 fraction) public {
        _setGlobalRoyalty(recipient, fraction);
    }

    function mint(address to, uint256 tokenId) public {
        _mint(to, tokenId);
    }

    function burn(uint256 tokenId) public {
        _burn(tokenId);
    }
}
