// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../token/ERC721/extensions/ERC721Burnable.sol";
import "../token/ERC721/extensions/ERC721Consecutive.sol";
import "../token/ERC721/extensions/ERC721Enumerable.sol";
import "../token/ERC721/extensions/ERC721Pausable.sol";
import "../token/ERC721/extensions/draft-ERC721Votes.sol";

/* solhint-disable-next-line contract-name-camelcase */
abstract contract __VotesDelegationInConstructor is Votes {
    constructor(address[] memory accounts) {
        for (uint256 i; i < accounts.length; ++i) {
            _delegate(accounts[i], accounts[i]);
        }
    }
}

/**
 * @title ERC721ConsecutiveMock
 */
contract ERC721ConsecutiveMock is
    __VotesDelegationInConstructor,
    ERC721Burnable,
    ERC721Consecutive,
    ERC721Enumerable,
    ERC721Pausable,
    ERC721Votes
{
    constructor(
        string memory name,
        string memory symbol,
        address[] memory receivers,
        uint96[] memory amounts
    )
        __VotesDelegationInConstructor(receivers)
        ERC721(name, symbol)
        ERC721Consecutive(receivers, amounts)
        EIP712(name, "1")
    {}

    function pause() external {
        _pause();
    }

    function unpause() external {
        _unpause();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function exists(uint256 tokenId) public view returns (bool) {
        return _exists(tokenId);
    }

    function mint(address to, uint256 tokenId) public {
        _mint(to, tokenId);
    }

    function safeMint(address to, uint256 tokenId) public {
        _safeMint(to, tokenId);
    }

    function _ownerOf(uint256 tokenId) internal view virtual override(ERC721, ERC721Consecutive) returns (address) {
        return super._ownerOf(tokenId);
    }

    function _burn(uint256 tokenId) internal virtual override(ERC721, ERC721Consecutive) {
        super._burn(tokenId);
    }

    function _mint(address to, uint256 tokenId) internal virtual override(ERC721, ERC721Consecutive) {
        super._mint(to, tokenId);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override(ERC721, ERC721Enumerable, ERC721Pausable) {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override(ERC721, ERC721Votes) {
        super._afterTokenTransfer(from, to, tokenId);
    }

    function _beforeConsecutiveTokenTransfer(
        address from,
        address to,
        uint256 first,
        uint256 last
    ) internal virtual override(ERC721, ERC721Enumerable, ERC721Pausable) {
        super._beforeConsecutiveTokenTransfer(from, to, first, last);
    }

    function _afterConsecutiveTokenTransfer(
        address from,
        address to,
        uint256 first,
        uint256 last
    ) internal virtual override(ERC721, ERC721Votes) {
        super._afterConsecutiveTokenTransfer(from, to, first, last);
    }
}
