// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../ERC1155.sol";
import "../../../utils/math/SafeMath.sol";

/**
 * @dev ERC1155 token with totalSupply (per id).
 *
 * Useful for scenarios where Fungible and Non-fungible tokens have to be
 * clearly identified. Note: While a totalSupply of 1 might mean the
 * corresponding is an NFT, there is no guaranties that no other token with the
 * same id are not going to be minted
 */
abstract contract ERC1155Supply is ERC1155 {
    using SafeMath for uint256;

    mapping (uint256 => uint256) private _totalSupply;

    /**
     * @dev Total amount of tokens in with a given id.
     */
    function totalSupply(uint256 id) public view virtual returns (uint256) {
        return _totalSupply[id];
    }

    /**
     * @dev Indicates weither any token exist with a given id, or not.
     */
    function exists(uint256 id) public view virtual returns(bool) {
        return ERC1155Supply.totalSupply(id) > 0;
    }

    function _mint(address account, uint256 id, uint256 amount, bytes memory data) internal virtual override {
        super._mint(account, id, amount, data);
        _totalSupply[id] = _totalSupply[id].add(amount);
    }

    function _mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data) internal virtual override {
        super._mintBatch(to, ids, amounts, data);
        for (uint256 i = 0; i < ids.length; ++i) {
            _totalSupply[ids[i]] = _totalSupply[ids[i]].add(amounts[i]);
        }
    }

    function _burn(address account, uint256 id, uint256 amount) internal virtual override {
        super._burn(account, id, amount);
        _totalSupply[id] = _totalSupply[id].sub(amount);
    }

    function _burnBatch(address account, uint256[] memory ids, uint256[] memory amounts) internal virtual override {
        super._burnBatch(account, ids, amounts);
        for (uint256 i = 0; i < ids.length; ++i) {
            _totalSupply[ids[i]] = _totalSupply[ids[i]].sub(amounts[i]);
        }
    }
}
