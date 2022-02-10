// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../../utils/Address.sol";

abstract contract BaseRelayMock {
    // needed to parse custom errors
    error NotCrossChainCall();
    error InvalidCrossChainSender(address sender, address expected);

    address public currentSender;

    function relayAs(
        address target,
        bytes calldata data,
        address sender
    ) external {
        address previousSender = currentSender;

        currentSender = sender;

        (bool success, bytes memory returndata) = target.call(data);
        Address.verifyCallResult(success, returndata, "low-level call reverted");

        currentSender = previousSender;
    }
}

/**
 * AMB
 */
contract BridgeAMBMock is BaseRelayMock {
    function messageSender() public view returns (address) {
        return currentSender;
    }
}

/**
 * Arbitrum
 */
contract BridgeArbitrumL1Mock is BaseRelayMock {
    address public immutable inbox = address(new BridgeArbitrumL1Inbox());
    address public immutable outbox = address(new BridgeArbitrumL1Outbox());

    function activeOutbox() public view returns (address) {
        return outbox;
    }
}

contract BridgeArbitrumL1Inbox {
    address public immutable bridge = msg.sender;
}

contract BridgeArbitrumL1Outbox {
    address public immutable bridge = msg.sender;

    function l2ToL1Sender() public view returns (address) {
        return BaseRelayMock(bridge).currentSender();
    }
}

contract BridgeArbitrumL2Mock is BaseRelayMock {
    function isTopLevelCall() public view returns (bool) {
        return currentSender != address(0);
    }

    function wasMyCallersAddressAliased() public pure returns (bool) {
        return true;
    }

    function myCallersAddressWithoutAliasing() public view returns (address) {
        return currentSender;
    }
}

/**
 * Optimism
 */
contract BridgeOptimismMock is BaseRelayMock {
    function xDomainMessageSender() public view returns (address) {
        return currentSender;
    }
}
