// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {PackedUserOperation, IAccount, IEntryPoint, IAccountExecute} from "../interfaces/IERC4337.sol";
import {Address} from "../utils/Address.sol";
import {ERC1155Holder} from "../token/ERC1155/utils/ERC1155Holder.sol";
import {ERC721Holder} from "../token/ERC721/utils/ERC721Holder.sol";

abstract contract AccountBase is IAccount, IAccountExecute, ERC1155Holder, ERC721Holder {
    error AccountEntryPointRestricted();

    IEntryPoint private immutable _entryPoint;

    modifier onlyEntryPointOrSelf() {
        _checkEntryPointOrSelf();
        _;
    }

    modifier onlyEntryPoint() {
        _checkEntryPoint();
        _;
    }

    constructor(IEntryPoint entryPoint_) {
        _entryPoint = entryPoint_;
    }

    function entryPoint() public view virtual returns (IEntryPoint) {
        return _entryPoint;
    }

    /// @dev Return the account nonce for the canonical sequence.
    function getNonce() public view virtual returns (uint256) {
        return getNonce(0);
    }

    /// @dev Return the account nonce for a given sequence (key).
    function getNonce(uint192 key) public view virtual returns (uint256) {
        return entryPoint().getNonce(address(this), key);
    }

    /// @inheritdoc IAccount
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) public virtual onlyEntryPoint returns (uint256) {
        (, uint256 validationData) = _validateUserOp(userOp, userOpHash);
        _payPrefund(missingAccountFunds);
        return validationData;
    }

    /// @inheritdoc IAccountExecute
    function executeUserOp(PackedUserOperation calldata userOp, bytes32 /*userOpHash*/) public virtual onlyEntryPoint {
        Address.functionDelegateCall(address(this), userOp.callData[4:]);
    }

    function _validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) internal virtual returns (address signer, uint256 validationData);

    function _payPrefund(uint256 missingAccountFunds) internal virtual {
        if (missingAccountFunds > 0) {
            (bool success, ) = payable(msg.sender).call{value: missingAccountFunds}("");
            success;
            //ignore failure (its EntryPoint's job to verify, not account.)
        }
    }

    function _checkEntryPoint() internal view virtual {
        if (msg.sender != address(entryPoint())) {
            revert AccountEntryPointRestricted();
        }
    }

    function _checkEntryPointOrSelf() internal view virtual {
        if (msg.sender != address(this) && msg.sender != address(entryPoint())) {
            revert AccountEntryPointRestricted();
        }
    }

    /// @dev Receive Ether.
    receive() external payable virtual {}
}
