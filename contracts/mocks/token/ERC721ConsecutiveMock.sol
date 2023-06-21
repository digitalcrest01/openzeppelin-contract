// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import "../../token/ERC721/extensions/ERC721Consecutive.sol";
import "../../token/ERC721/extensions/ERC721Pausable.sol";
import "../../token/ERC721/extensions/ERC721Votes.sol";

/**
 * @title ERC721ConsecutiveMock
 */
contract ERC721ConsecutiveMock is ERC721Consecutive, ERC721Pausable, ERC721Votes {
    uint96 private immutable _offset;

    constructor(
        string memory name,
        string memory symbol,
        uint96 offset,
        address[] memory delegates,
        address[] memory receivers,
        uint96[] memory amounts
    ) ERC721(name, symbol) EIP712(name, "1") {
        _offset = offset;

        for (uint256 i = 0; i < delegates.length; ++i) {
            _delegate(delegates[i], delegates[i]);
        }

        for (uint256 i = 0; i < receivers.length; ++i) {
            _mintConsecutive(receivers[i], amounts[i]);
        }
    }

    function _firstConsecutiveId() internal view virtual override returns (uint96) {
        return _offset;
    }

    function _ownerOf(uint256 tokenId) internal view virtual override(ERC721, ERC721Consecutive) returns (address) {
        return super._ownerOf(tokenId);
    }

    function _update(
        address to,
        uint256 tokenId,
        function(address, address, uint256) view constraints
    ) internal virtual override(ERC721Consecutive, ERC721Pausable, ERC721Votes) returns (address) {
        return super._update(to, tokenId, constraints);
    }

    function __unsafe_increaseBalance(address account, uint256 amount) internal virtual override(ERC721, ERC721Votes) {
        super.__unsafe_increaseBalance(account, amount);
    }
}

contract ERC721ConsecutiveNoConstructorMintMock is ERC721Consecutive {
    constructor(string memory name, string memory symbol) ERC721(name, symbol) {
        _mint(msg.sender, 0);
    }
}
