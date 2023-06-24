// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.0) (metatx/ERC2771Forwarder.sol)

pragma solidity ^0.8.19;

import "../utils/cryptography/ECDSA.sol";
import "../utils/cryptography/EIP712.sol";
import "../utils/Nonces.sol";

/**
 * @dev An implementation of a production-ready forwarder compatible with ERC2771 contracts.
 *
 * This forwarder operates on forward requests that include:
 *
 * * `from`: An address to operate on behalf of. It is required to be equal to the request signer.
 * * `to`: The address that should be called.
 * * `value`: The amount of ETH to attach with the requested call.
 * * `gas`: The amount of gas limit that will be forwarded with the requested call.
 * * `nonce`: A unique transaction ordering identifier to avoid replayability and request invalidation.
 * * `deadline`: A timestamp after which the request is not executable anymore.
 * * `data`: Encoded `msg.data` to send with the requested call.
 */
contract ERC2771Forwarder is EIP712, Nonces {
    using ECDSA for bytes32;

    struct ForwardRequestData {
        address from;
        address to;
        uint256 value;
        uint256 gas;
        uint48 deadline;
        bytes data;
        bytes signature;
    }

    bytes32 private constant _FORWARD_REQUEST_TYPEHASH =
        keccak256(
            "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,uint48 deadline,bytes data)"
        );

    /**
     * @dev Emitted when a `ForwardRequest` is executed.
     */
    event ExecutedForwardRequest(address indexed signer, uint256 nonce, bool success, bytes returndata);

    /**
     * @dev The request `from` doesn't match with the recovered `signer`.
     */
    error ERC2771ForwarderInvalidSigner(address signer, address from);

    /**
     * @dev The requested `value` doesn't match with the available `msgValue`, leaving ETH stuck in the contract.
     */
    error ERC2771ForwarderMismatchedValue(uint256 value, uint256 msgValue);

    /**
     * @dev The list of requests length doesn't match with the list of signatures length.
     */
    error ERC2771ForwarderInvalidBatchLength(uint256 requestsLength, uint256 signaturesLength);

    /**
     * @dev The request `deadline` has expired.
     */
    error ERC2771ForwarderExpiredRequest(uint48 deadline);

    /**
     * @dev See {EIP712-constructor}.
     */
    constructor(string memory name) EIP712(name, "1") {}

    /**
     * @dev Returns `true` if a request is valid for a provided `signature` at the current block.
     *
     * NOTE: A request signed with an invalid nonce will return false here but won't revert by default
     * to prevent revert when a batch includes a request already executed by another relay. This behavior can be opt-out.
     * See {executeBatch}.
     */
    function verify(ForwardRequestData calldata request) public view virtual returns (bool) {
        (bool alive, bool signerMatch, ) = _validate(request, nonces(request.from));
        return alive && signerMatch;
    }

    /**
     * @dev Executes a `request` on behalf of `signature`'s signer guaranteeing that the forwarded call
     * will receive the requested gas and no ETH is left stuck in the contract.
     */
    function execute(ForwardRequestData calldata request) public payable virtual returns (bool, bytes memory) {
        if (msg.value != request.value) {
            revert ERC2771ForwarderMismatchedValue(request.value, msg.value);
        }

        (bool success, bytes memory returndata) = _execute(request, _useNonce(request.from), true);

        return (success, returndata);
    }

    /**
     * @dev Batch version of {execute} that also includes an `atomic` parameter to indicate whether all requests are
     * executed or none of them.
     */
    function executeBatch(ForwardRequestData[] calldata requests, bool atomic) public payable virtual {
        uint256 requestsValue;

        for (uint256 i; i < requests.length; ++i) {
            requestsValue += requests[i].value;
            _execute(requests[i], _useNonce(requests[i].from), atomic);
        }

        if (msg.value != requestsValue) {
            revert ERC2771ForwarderMismatchedValue(requestsValue, msg.value);
        }
    }

    /**
     * @dev Validates if the provided request can be executed at current block with `signature` on behalf of `signer`.
     *
     * Internal function without nonce validation.
     */
    function _validate(
        ForwardRequestData calldata request,
        uint256 nonce
    ) internal view virtual returns (bool alive, bool signerMatch, address signer) {
        signer = _recoverForwardRequestSigner(request, nonce);
        return (request.deadline >= block.timestamp, signer == request.from, signer);
    }

    /**
     * @dev Recovers the signer of an EIP712 message hash for a forward `request` and its corresponding `signature`.
     * See {ECDSA-recover}.
     *
     * Internal function without nonce validation.
     */
    function _recoverForwardRequestSigner(
        ForwardRequestData calldata request,
        uint256 nonce
    ) internal view virtual returns (address) {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        _FORWARD_REQUEST_TYPEHASH,
                        request.from,
                        request.to,
                        request.value,
                        request.gas,
                        nonce,
                        request.deadline,
                        keccak256(request.data)
                    )
                )
            ).recover(request.signature);
    }

    /**
     * @dev Validates and executes a signed request.
     *
     * Internal function without nonce and msg.value validation.
     *
     * Requirements:
     *
     * - The request's deadline must have not passed.
     * - The request's from must be the request's signer.
     * - The caller must have provided enough gas to forward with the call.
     *
     * Emits an {ExecutedForwardRequest} event.
     *
     * IMPORTANT: Using this function doesn't check that all the `msg.value` was sent, potentially leaving
     * ETH stuck in the contract.
     */
    function _execute(
        ForwardRequestData calldata request,
        uint256 nonce,
        bool requireValidRequest
    ) internal virtual returns (bool success, bytes memory returndata) {
        (bool alive, bool signerMatch, address signer) = _validate(request, nonce);

        // Need to explicitly specify if a revert is required since non-reverting is default for
        // batches and reversion is opt-in since it could be useful in some scenarios
        if (requireValidRequest) {
            if (!alive) {
                revert ERC2771ForwarderExpiredRequest(request.deadline);
            }

            if (!signerMatch) {
                revert ERC2771ForwarderInvalidSigner(signer, request.from);
            }
        }

        // Avoid execution instead of reverting in case a batch includes an already executed request
        if (signerMatch && alive) {
            (success, returndata) = request.to.call{gas: request.gas, value: request.value}(
                abi.encodePacked(request.data, request.from)
            );

            _checkForwardedGas(request);

            emit ExecutedForwardRequest(signer, nonce, success, returndata);
        }
    }

    /**
     * @dev Checks if the requested gas was correctly forwarded to the callee.
     *
     * As a consequence of https://eips.ethereum.org/EIPS/eip-150[EIP-150]:
     * - At most `gasleft() - floor(gasleft() / 64)` is forwarded to the callee.
     * - At least `floor(gasleft() / 64)` is kept in the caller.
     *
     * It reverts consuming all the available gas if the forwarded gas is not the requested gas.
     *
     * IMPORTANT: This function should be called exactly the end of the forwarded call. Any gas consumed
     * in between will make room for bypassing this check.
     */
    function _checkForwardedGas(ForwardRequestData calldata request) private view {
        // To avoid insufficient gas griefing attacks, as referenced in https://ronan.eth.limo/blog/ethereum-gas-dangers/
        // A malicious relayer can attempt to shrink the gas forwarded so that the underlying call reverts out-of-gas
        // and the top-level call still passes, so in order to make sure that the subcall received the requested gas,
        // we let X be the available gas before the call and require that:
        //
        // - 63/64 * X >= req.gas  // Gas before call is enough to forward req.gas to callee
        // - 63X >= 64req.gas
        // - 63(X - req.gas) >= req.gas
        // - (X - req.gas) >= req.gas/63
        //
        // Although we can't access X, we let Y be the actual gas used in the subcall so that `gasleft() == X - Y`, then
        // we know that `X - req.gas <= X - Y`, thus `Y <= req.gas` and finally `X - req.gas <= gasleft()`.
        // Therefore, any attempt to manipulate X to reduce the gas provided to the callee will result in the following
        // invariant violated:
        if (gasleft() < request.gas / 63) {
            // We explicitly trigger invalid opcode to consume all gas and bubble-up the effects, since
            // neither revert or assert consume all gas since Solidity 0.8.0
            // https://docs.soliditylang.org/en/v0.8.0/control-structures.html#panic-via-assert-and-error-via-require
            /// @solidity memory-safe-assembly
            assembly {
                invalid()
            }
        }
    }
}
